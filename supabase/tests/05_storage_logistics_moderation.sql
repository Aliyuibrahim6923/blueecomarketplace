-- Storage object policies, logistics bookings, verification and moderation.
begin;
set role authenticated;

-- ---------------------------------------------------------------- storage
select tests.login((select farmer from tests.ids));
select tests.eq(tests.affected(format(
  $$insert into storage.objects (bucket_id, name, owner) values ('product-images', '%s/%s.jpg', auth.uid())$$,
  (select biz_farm from tests.ids), gen_random_uuid())), 1::bigint, 'members can upload images to their business folder');
select tests.throws(format(
  $$insert into storage.objects (bucket_id, name, owner) values ('product-images', '%s/%s.jpg', auth.uid())$$,
  (select biz_coop from tests.ids), gen_random_uuid()),
  'members cannot upload into another business folder', 'row-level security');
select tests.throws(format(
  $$insert into storage.objects (bucket_id, name, owner) values ('product-images', '%s/../../evil.exe', auth.uid())$$,
  (select biz_farm from tests.ids)),
  'unsafe object names are rejected', 'row-level security');

-- A private verification document for the coop, uploaded by the coop owner.
select tests.login((select supplier from tests.ids));
create temporary table t_doc on commit drop as
select (select biz_coop from tests.ids)::text || '/' || gen_random_uuid()::text || '.pdf' as name;
grant select on t_doc to authenticated;
insert into storage.objects (bucket_id, name, owner) select 'verification-documents', name, auth.uid() from t_doc;
select tests.eq(tests.count($$select * from storage.objects where bucket_id = 'verification-documents'$$), 1::bigint,
  'owners can read their own verification documents');

select tests.login((select buyer from tests.ids));
select tests.eq(tests.count($$select * from storage.objects where bucket_id = 'verification-documents'$$), 0::bigint,
  'other users cannot read verification documents');
select tests.eq(tests.count($$select * from storage.objects where bucket_id = 'product-images'$$), 0::bigint,
  'the product image bucket cannot be enumerated through the API');
select tests.throws(format(
  $$insert into storage.objects (bucket_id, name, owner) values ('dispute-evidence', '%s/%s.pdf', auth.uid())$$,
  gen_random_uuid(), gen_random_uuid()),
  'evidence cannot be uploaded to a dispute you are not part of', 'row-level security');

select tests.login((select admin from tests.ids));
select tests.eq(tests.count($$select * from storage.objects where bucket_id = 'verification-documents'$$), 1::bigint,
  'admins can read verification documents for review');

-- ---------------------------------------------------------------- verification workflow
select tests.login((select farmer from tests.ids));
insert into public.business_verification_requests (business_id, submitted_by, document_type, applicant_note)
select biz_farm, auth.uid(), 'cac_certificate', 'CAC certificate attached' from tests.ids;
select tests.eq((select verification_status::text from public.businesses where id = (select biz_farm from tests.ids)), 'pending_review',
  'submitting a request moves the business to pending review');
select tests.throws($$update public.business_verification_requests set status = 'approved'$$,
  'applicants cannot approve their own request', 'permission denied');
select tests.throws($$select public.review_verification_request((select id from public.business_verification_requests limit 1), 'approved', 'ok')$$,
  'applicants cannot call the review RPC', 'administrators only');

select tests.login((select admin from tests.ids));
select public.review_verification_request(
  (select id from public.business_verification_requests where business_id = (select biz_farm from tests.ids)), 'approved', 'CAC checked');
select tests.eq((select verification_status::text from public.businesses where id = (select biz_farm from tests.ids)), 'verified',
  'admin approval verifies the business');
select tests.ok(exists (select 1 from public.audit_logs where action = 'verification_approved'), 'verification decision audited');

-- ---------------------------------------------------------------- moderation
select tests.throws($$select public.moderate_listing((select p_catfish from tests.ids), 'hide', '')$$,
  'moderation requires a reason', 'reason');
select public.moderate_listing((select p_catfish from tests.ids), 'hide', 'Photos do not match the product');
reset role;
set role anon;
select tests.anon();
select tests.eq(tests.count($$select * from public.products where id = (select p_catfish from tests.ids)$$), 0::bigint,
  'hidden listings disappear from public view');
select tests.eq((select count(*) from public.search_products('catfish')), 1::bigint,
  'search returns remaining matching listings only (smoked catfish)');
reset role;
set role authenticated;
select tests.login((select farmer from tests.ids));
select tests.throws($$update public.products set status = 'published' where id = (select p_catfish from tests.ids)$$,
  'suppliers cannot un-hide a moderated listing', 'hidden by a moderator');

-- suspension blocks a business
select tests.login((select admin from tests.ids));
select public.admin_set_business_status((select biz_coop from tests.ids), 'suspended', 'Investigation pending');
reset role;
set role anon;
select tests.anon();
select tests.eq(tests.count($$select * from public.products where business_id = (select biz_coop from tests.ids)$$), 0::bigint,
  'suspended businesses'' listings are not public');
reset role;
set role authenticated;
select tests.login((select buyer from tests.ids));
select tests.throws($$select public.create_order((select biz_coop from tests.ids),
  jsonb_build_array(jsonb_build_object('product_id', (select p_croaker from tests.ids), 'quantity', 10)), 'pickup')$$,
  'suspended suppliers cannot receive orders', 'not accepting orders');

-- ---------------------------------------------------------------- logistics bookings
select tests.login((select buyer from tests.ids));
select tests.throws($$insert into public.logistics_bookings (service_id, provider_business_id, requester_id, pickup_location,
    dropoff_location, requested_date, cargo_description, quoted_price_minor)
  select s_reefer, biz_coop, auth.uid(), 'Epe', 'Lekki', current_date + 1, '500 kg catfish', 1 from tests.ids$$,
  'requesters cannot set the price', 'provider sets price');
create temporary table t_booking on commit drop as
with ins as (
  insert into public.logistics_bookings (service_id, provider_business_id, requester_id, pickup_location, dropoff_location,
    requested_date, cargo_description)
  select s_reefer, biz_coop, auth.uid(), 'Epe jetty', 'Lekki Phase 1', current_date + 1, '500 kg live catfish' from tests.ids
  returning id, provider_business_id)
select * from ins;
grant select on t_booking to authenticated;
select tests.eq((select provider_business_id from t_booking), (select biz_cold from tests.ids),
  'provider is derived from the service, not the client');
select tests.throws($$select public.transition_booking((select id from t_booking), 'confirmed')$$,
  'requester cannot confirm before a quote', 'cannot move');

select tests.login((select logistics from tests.ids));
select public.transition_booking((select id from t_booking), 'quoted', 5200000, current_date + 1, 'Pickup 6am', 'Includes ice');
select tests.login((select buyer from tests.ids));
select public.transition_booking((select id from t_booking), 'confirmed');
select tests.login((select logistics from tests.ids));
select public.transition_booking((select id from t_booking), 'in_progress');
select tests.throws($$select public.transition_booking((select id from t_booking), 'completed')$$,
  'completion requires proof of delivery', 'proof');
select public.transition_booking((select id from t_booking), 'completed', null, null, null, 'Received by kitchen manager 7:40am, chilled');
select tests.eq((select status::text from public.logistics_bookings where id = (select id from t_booking)), 'completed',
  'booking completed with proof of delivery');

select tests.login((select buyer2 from tests.ids));
select tests.eq(tests.count('select * from public.logistics_bookings'), 0::bigint, 'other users cannot see bookings');

-- ---------------------------------------------------------------- reports & support
select tests.eq(tests.affected($$insert into public.content_reports (reporter_id, target_type, target_id, reason, details)
  select auth.uid(), 'product', p_croaker, 'misrepresentation', 'Photo looks like stock image' from tests.ids$$), 1::bigint,
  'users can report listings');
select tests.throws($$insert into public.content_reports (reporter_id, target_type, target_id, reason, status)
  select auth.uid(), 'product', p_croaker, 'fraud', 'actioned' from tests.ids$$,
  'reporters cannot pre-resolve their report', 'start open');
reset role;
set role anon;
select tests.anon();
select tests.eq(tests.affected($$insert into public.support_requests (name, email, topic, message)
  values ('Guest', 'guest@example.test', 'account', 'I cannot verify my email address')$$), 1::bigint,
  'guests can contact support');
select tests.throws($$select * from public.support_requests$$, 'guests cannot read support requests', 'permission denied');

rollback;
