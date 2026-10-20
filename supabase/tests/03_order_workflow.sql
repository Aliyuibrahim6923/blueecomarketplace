-- Order lifecycle, pricing, quotations, payments (sandbox, offline, provider
-- webhook idempotency), reviews and disputes.
begin;
set role authenticated;

-- ---------------------------------------------------------------- order creation
select tests.login((select buyer from tests.ids));

select tests.throws($$insert into public.orders (order_number, buyer_id, seller_business_id, subtotal_minor, total_minor, delivery_method)
  values ('X', auth.uid(), (select biz_farm from tests.ids), 1, 1, 'pickup')$$,
  'orders cannot be inserted directly by clients', 'permission denied');

select tests.throws($$select public.create_order((select biz_farm from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_catfish from tests.ids), 'quantity', 5)), 'pickup')$$,
  'minimum order quantity is enforced', 'minimum order');
select tests.throws($$select public.create_order((select biz_coop from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_periwinkle from tests.ids), 'quantity', 2)), 'pickup')$$,
  'quote-required listings cannot be ordered directly', 'quotation');
select tests.throws($$select public.create_order((select biz_farm from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_croaker from tests.ids), 'quantity', 10)), 'pickup')$$,
  'items must belong to the chosen seller', 'no longer available');
select tests.throws($$select public.create_order((select biz_farm from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_catfish from tests.ids), 'quantity', 25)), 'seller_delivery')$$,
  'delivery requires an address', 'address');
select tests.throws($$select public.create_order((select biz_farm from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_draft from tests.ids), 'quantity', 10)), 'pickup')$$,
  'draft listings cannot be ordered', 'no longer available');

create temporary table t_order on commit drop as
select public.create_order(
  (select biz_farm from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_catfish from tests.ids), 'quantity', 25.5)),
  'seller_delivery', '12 Demo Close, Lekki (fictional)', 'LA', 'Please call on arrival') as id;
grant select on t_order to authenticated, service_role;

select tests.eq((select subtotal_minor from public.orders where id = (select id from t_order)), 7140000::bigint,
  'subtotal = 25.5 kg × ₦2,800.00 = ₦71,400.00 (integer kobo)');
select tests.eq((select marketplace_fee_minor from public.orders where id = (select id from t_order)), 178500::bigint,
  'marketplace fee = 2.5% of subtotal');
select tests.eq((select total_minor from public.orders where id = (select id from t_order)), 7318500::bigint,
  'total = subtotal + delivery + fee + tax');
select tests.eq((select status::text from public.orders where id = (select id from t_order)), 'requested', 'new order is requested');
select tests.eq((select count(*) from public.notifications), 0::bigint, 'buyer gets no notification for their own action');

select tests.login((select buyer2 from tests.ids));
select tests.eq(tests.count($$select * from public.orders$$), 0::bigint, 'other buyers cannot see the order');
select tests.eq(tests.count($$select * from public.order_items$$), 0::bigint, 'other buyers cannot see order items');
select tests.eq((select count(*) from public.get_order_parties((select id from t_order))), 0::bigint,
  'other buyers cannot see order contact details');

select tests.login((select supplier from tests.ids));
select tests.eq(tests.count($$select * from public.orders$$), 0::bigint, 'other suppliers cannot see the order');

-- ---------------------------------------------------------------- seller acceptance
select tests.login((select buyer from tests.ids));
select tests.throws($$select public.accept_order((select id from t_order), 0)$$, 'buyers cannot accept their own order', 'manager');
select tests.throws($$select public.transition_order((select id from t_order), 'completed')$$,
  'skipping states is rejected', 'cannot move');

select tests.login((select farmer from tests.ids));
select tests.ok(tests.count($$select * from public.notifications where type = 'order_requested'$$) = 1, 'seller was notified');
select tests.eq((select buyer_phone from public.get_order_parties((select id from t_order))), '+2348000000666',
  'seller can see the buyer''s contact for fulfilment');
select tests.throws($$select public.transition_order((select id from t_order), 'rejected')$$, 'rejection needs a reason', 'reason');
select tests.throws($$select public.accept_order((select id from t_order), -5)$$, 'negative delivery fee rejected', 'negative');
select public.accept_order((select id from t_order), 500000, current_date + 2, 'Delivered chilled in the morning', 'Confirmed');
select tests.eq((select status::text from public.orders where id = (select id from t_order)), 'accepted', 'seller accepted');
select tests.eq((select total_minor from public.orders where id = (select id from t_order)), 7818500::bigint,
  'total recalculated with ₦5,000 delivery fee');
select tests.throws($$select public.transition_order((select id from t_order), 'preparing')$$,
  'seller cannot prepare before payment', 'cannot move');

-- ---------------------------------------------------------------- payment (sandbox)
select tests.login((select buyer from tests.ids));
select tests.throws($$select public.sandbox_confirm_payment((select id from t_order))$$,
  'cannot pay before confirming totals', 'not awaiting payment');
select public.transition_order((select id from t_order), 'awaiting_payment', 'Totals confirmed');
select public.sandbox_confirm_payment((select id from t_order));
select tests.eq((select status::text from public.orders where id = (select id from t_order)), 'paid', 'sandbox payment marks order paid');
select tests.eq((select provider::text from public.payment_transactions where order_id = (select id from t_order)), 'sandbox',
  'sandbox transaction is labelled as sandbox');
select tests.ok((select note from public.payment_transactions where order_id = (select id from t_order)) like 'SANDBOX%',
  'sandbox transaction carries an explicit not-real note');

-- ---------------------------------------------------------------- fulfilment
select tests.login((select farmer from tests.ids));
select public.transition_order((select id from t_order), 'preparing');
select public.transition_order((select id from t_order), 'dispatched');
select tests.login((select buyer from tests.ids));
select tests.throws($$insert into public.reviews (order_id, author_id, business_id, rating)
  select id, auth.uid(), (select biz_farm from tests.ids), 5 from t_order$$,
  'reviews require a completed order', 'row-level security');
select public.transition_order((select id from t_order), 'delivered', 'Received in good condition');
select public.transition_order((select id from t_order), 'completed');
select tests.eq((select count(*) from public.order_status_history where order_id = (select id from t_order)), 8::bigint,
  'every step is recorded in the status history');
select tests.eq(tests.affected($$insert into public.reviews (order_id, author_id, business_id, rating, comment)
  select id, auth.uid(), (select biz_farm from tests.ids), 5, 'Fresh and on time' from t_order$$), 1::bigint,
  'buyer can review after completion');
select tests.throws($$insert into public.reviews (order_id, author_id, business_id, rating)
  select id, auth.uid(), (select biz_farm from tests.ids), 4 from t_order$$,
  'only one review per order', 'duplicate');

select tests.login((select buyer2 from tests.ids));
select tests.throws($$insert into public.reviews (order_id, author_id, business_id, rating)
  select id, auth.uid(), (select biz_farm from tests.ids), 1 from t_order$$,
  'non-participants cannot review', 'row-level security');

-- ---------------------------------------------------------------- enquiry → quotation → order
select tests.login((select buyer from tests.ids));
create temporary table t_enq on commit drop as
with ins as (
  insert into public.enquiries (buyer_id, supplier_business_id, product_id, kind, subject, message, requested_quantity)
  select auth.uid(), biz_coop, p_periwinkle, 'quote_request', 'Weekly periwinkles', 'Need 10 bags every Friday', 10 from tests.ids
  returning id)
select id from ins;
grant select on t_enq to authenticated;

select tests.throws($$insert into public.enquiries (buyer_id, supplier_business_id, subject, message)
  select buyer2, biz_coop, 'Spoof', 'Pretending to be someone else' from tests.ids$$,
  'enquiries cannot be sent as another user', 'row-level security');

select tests.login((select buyer2 from tests.ids));
select tests.eq(tests.count('select * from public.enquiries'), 0::bigint, 'other buyers cannot read the enquiry');
select tests.throws($$insert into public.enquiry_messages (enquiry_id, sender_id, body) select id, auth.uid(), 'hi' from t_enq$$,
  'non-parties cannot post into an enquiry', 'row-level security');

select tests.login((select supplier from tests.ids));
create temporary table t_quote on commit drop as
select public.create_quotation((select id from t_enq), 'Live periwinkles, 25 kg bags', 'bag', 1800000, 10, 250000,
  current_date + 7, 'Delivery to Port Harcourt only', null) as id;
grant select on t_quote to authenticated;
select tests.eq((select status::text from public.enquiries where id = (select id from t_enq)), 'responded', 'enquiry marked responded');

select tests.login((select buyer from tests.ids));
create temporary table t_qorder on commit drop as
select public.accept_quotation((select id from t_quote), 'seller_delivery', '5 Demo Street, Port Harcourt (fictional)', 'RI') as id;
grant select on t_qorder to authenticated, service_role;
select tests.eq((select status::text from public.orders where id = (select id from t_qorder)), 'accepted',
  'accepting a quotation creates an accepted order');
select tests.eq((select subtotal_minor from public.orders where id = (select id from t_qorder)), 18000000::bigint,
  'quotation price carried into the order');
select tests.eq((select status::text from public.quotations where id = (select id from t_quote)), 'accepted', 'quotation accepted');
select tests.throws($$select public.accept_quotation((select id from t_quote), 'pickup')$$,
  'a quotation cannot be accepted twice', 'no longer open');

-- ---------------------------------------------------------------- provider payment + webhook idempotency
select public.transition_order((select id from t_qorder), 'awaiting_payment');
select public.create_payment_transaction((select id from t_qorder), 'paystack', 'BM-TEST-REF-0001');
select tests.throws($$select public.record_payment_result('BM-TEST-REF-0001', 'succeeded', 1, 'NGN')$$,
  'clients cannot record payment results', 'permission denied');

reset role;
set role service_role;
select tests.eq(public.record_webhook_event('paystack', 'evt-1', 'charge.success', 'BM-TEST-REF-0001', true, repeat('a', 64)), true,
  'first webhook delivery is accepted');
select tests.eq(public.record_webhook_event('paystack', 'evt-1', 'charge.success', 'BM-TEST-REF-0001', true, repeat('a', 64)), false,
  'replayed webhook is detected');
select tests.eq(public.record_payment_result('BM-TEST-REF-0001', 'succeeded', 100, 'NGN'), 'amount_mismatch',
  'amount mismatch is refused');
select tests.eq((select status::text from public.orders where id = (select id from t_qorder)), 'awaiting_payment',
  'mismatched payment does not mark the order paid');

reset role;
set role authenticated;
select tests.login((select buyer from tests.ids));
select public.create_payment_transaction((select id from t_qorder), 'paystack', 'BM-TEST-REF-0002');
reset role;
set role service_role;
select tests.eq(public.record_payment_result('BM-TEST-REF-0002', 'succeeded',
  (select total_minor from public.orders where id = (select id from t_qorder)), 'NGN', 'PSK-123', 5000, 'card'), 'paid',
  'verified payment marks the order paid');
select tests.eq(public.record_payment_result('BM-TEST-REF-0002', 'succeeded',
  (select total_minor from public.orders where id = (select id from t_qorder)), 'NGN'), 'already_processed',
  'payment processing is idempotent');
select tests.eq(public.record_payment_result('UNKNOWN-REF-999', 'succeeded', 1, 'NGN'), 'unknown_reference',
  'unknown references are ignored');

-- ---------------------------------------------------------------- dispute
reset role;
set role authenticated;
select tests.login((select buyer2 from tests.ids));
select tests.throws($$select public.open_dispute((select id from t_qorder), 'non_delivery', 'I am not part of this order')$$,
  'non-participants cannot open disputes', 'buyer or seller');

select tests.login((select buyer from tests.ids));
create temporary table t_dispute on commit drop as
select public.open_dispute((select id from t_qorder), 'cancellation_request', 'Event cancelled, please cancel this order') as id;
grant select on t_dispute to authenticated;
select tests.eq((select status::text from public.orders where id = (select id from t_qorder)), 'disputed', 'order moves to disputed');
select tests.throws($$select public.transition_order((select id from t_qorder), 'cancelled', 'try direct cancel')$$,
  'disputed orders cannot be cancelled directly', 'cannot move');
select tests.throws($$select public.resolve_dispute((select id from t_dispute), 'refund', 'I decide for myself')$$,
  'participants cannot resolve their own dispute', 'administrators only');
select tests.eq(tests.affected($$insert into public.dispute_messages (dispute_id, sender_id, body) select id, auth.uid(), 'Receipt attached' from t_dispute$$),
  1::bigint, 'participants can add messages');
select tests.throws($$insert into public.dispute_messages (dispute_id, sender_id, body, is_internal) select id, auth.uid(), 'x', true from t_dispute$$,
  'participants cannot post internal notes', 'row-level security');

select tests.login((select admin from tests.ids));
insert into public.dispute_messages (dispute_id, sender_id, body, is_internal)
select id, auth.uid(), 'Internal: check supplier history', true from t_dispute;
select public.resolve_dispute((select id from t_dispute), 'refund', 'Buyer cancelled before dispatch; full refund approved.');
select tests.eq((select status::text from public.orders where id = (select id from t_qorder)), 'refunded', 'refund decision applied');
select tests.ok(exists(select 1 from public.audit_logs where action = 'dispute_resolved'), 'dispute decision audited');

select tests.login((select buyer from tests.ids));
select tests.eq(tests.count($$select * from public.dispute_messages where is_internal$$), 0::bigint,
  'participants never see internal admin notes');
select tests.ok(tests.count($$select * from public.notifications where type = 'dispute_outcome'$$) = 1, 'buyer notified of outcome');

-- ---------------------------------------------------------------- offline payment path
select tests.login((select buyer2 from tests.ids));
create temporary table t_off on commit drop as
select public.create_order((select biz_coop from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_croaker from tests.ids), 'quantity', 10)), 'pickup') as id;
grant select on t_off to authenticated;
select tests.login((select supplier from tests.ids));
select public.accept_order((select id from t_off), 0, null, null, null);
select tests.login((select buyer2 from tests.ids));
select public.transition_order((select id from t_off), 'awaiting_payment');
select tests.throws($$select public.confirm_offline_payment((select id from t_off), 'TRF-1')$$,
  'buyers cannot self-confirm offline payments', 'seller or an administrator');
select tests.login((select supplier from tests.ids));
select public.confirm_offline_payment((select id from t_off), 'TRF-778812', 'Bank transfer seen');
select tests.eq((select status::text from public.orders where id = (select id from t_off)), 'paid', 'offline payment recorded by seller');
select tests.eq((select reconciliation_status::text from public.payment_transactions where order_id = (select id from t_off)), 'unreconciled',
  'offline payments stay unreconciled until checked');

rollback;
