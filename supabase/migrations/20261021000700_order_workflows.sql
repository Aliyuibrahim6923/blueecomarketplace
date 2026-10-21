-- =============================================================================
-- BlueMarket Nigeria — 0700 order, quotation and payment workflows
-- Every state change runs here, server-side, inside one transaction:
-- authorization → allowed transition → update → status history → notifications.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Money helpers (integer kobo; basis points)
-- ---------------------------------------------------------------------------
create function private.bps_of(p_amount bigint, p_bps integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select round(p_amount::numeric * p_bps / 10000)::bigint;
$$;

-- Recompute fee, tax and total from subtotal + delivery fee using the order's rates.
create function private.recalculate_order_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_fee bigint;
  v_tax bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  v_fee := private.bps_of(o.subtotal_minor, o.marketplace_fee_bps);
  v_tax := private.bps_of(o.subtotal_minor + o.delivery_fee_minor + v_fee, o.tax_bps);
  update public.orders
  set marketplace_fee_minor = v_fee,
      tax_minor = v_tax,
      total_minor = subtotal_minor + delivery_fee_minor + v_fee + v_tax
  where id = p_order_id;
end;
$$;

create function private.generate_order_number()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'BM-' || to_char(now() at time zone 'Africa/Lagos', 'YYMMDD') || '-'
         || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- ---------------------------------------------------------------------------
-- Order state machine. Mirrored in lib/orders/state-machine.ts — keep in sync.
-- actor: buyer | seller | admin | system
-- ---------------------------------------------------------------------------
create function public.order_transition_allowed(p_from public.order_status, p_to public.order_status, p_actor text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text, p_actor) in (
    ('draft', 'requested', 'buyer'),
    ('draft', 'cancelled', 'buyer'),
    ('requested', 'accepted', 'seller'),
    ('requested', 'rejected', 'seller'),
    ('requested', 'cancelled', 'buyer'),
    ('requested', 'cancelled', 'admin'),
    ('accepted', 'awaiting_payment', 'buyer'),
    ('accepted', 'cancelled', 'buyer'),
    ('accepted', 'cancelled', 'seller'),
    ('accepted', 'cancelled', 'admin'),
    ('awaiting_payment', 'paid', 'system'),
    ('awaiting_payment', 'paid', 'seller'),
    ('awaiting_payment', 'paid', 'admin'),
    ('awaiting_payment', 'cancelled', 'buyer'),
    ('awaiting_payment', 'cancelled', 'seller'),
    ('awaiting_payment', 'cancelled', 'admin'),
    ('paid', 'preparing', 'seller'),
    ('paid', 'refunded', 'admin'),
    ('preparing', 'dispatched', 'seller'),
    ('dispatched', 'delivered', 'seller'),
    ('dispatched', 'delivered', 'buyer'),
    ('delivered', 'completed', 'buyer'),
    ('delivered', 'completed', 'admin'),
    ('paid', 'disputed', 'buyer'), ('paid', 'disputed', 'seller'),
    ('preparing', 'disputed', 'buyer'), ('preparing', 'disputed', 'seller'),
    ('dispatched', 'disputed', 'buyer'), ('dispatched', 'disputed', 'seller'),
    ('delivered', 'disputed', 'buyer'), ('delivered', 'disputed', 'seller'),
    ('disputed', 'refunded', 'admin'),
    ('disputed', 'completed', 'admin')
  );
$$;

-- Who is the caller relative to this order?
create function private.order_actor_kind(p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_order.buyer_id = (select auth.uid()) then 'buyer'
    when private.is_business_member(p_order.seller_business_id) then 'seller'
    when private.is_admin() then 'admin'
    else null
  end;
$$;

create function private.order_status_label(p_status public.order_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select initcap(replace(p_status::text, '_', ' '));
$$;

-- Apply one transition. Callers must have authorised the actor already.
create function private.apply_order_transition(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_kind text,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_from public.order_status;
  v_link text;
  v_title text;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  v_from := o.status;
  if not public.order_transition_allowed(o.status, p_to, p_actor_kind) then
    raise exception 'An order cannot move from % to % (%)', o.status, p_to, p_actor_kind using errcode = '22023';
  end if;

  update public.orders set
    status = p_to,
    placed_at = case when p_to = 'requested' then now() else placed_at end,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    paid_at = case when p_to = 'paid' then now() else paid_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    completed_at = case when p_to = 'completed' then now() else completed_at end,
    cancelled_at = case when p_to in ('cancelled', 'rejected') then now() else cancelled_at end
  where id = p_order_id
  returning * into o;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_kind, note)
  values (p_order_id, v_from, p_to, (select auth.uid()), p_actor_kind, left(p_note, 1000));

  v_link := '/dashboard/orders/' || o.id;
  v_title := 'Order ' || o.order_number || ': ' || private.order_status_label(p_to);
  if p_actor_kind <> 'buyer' then
    perform private.notify(o.buyer_id, 'order_status', v_title, 'Open the order to see the latest update.', v_link);
  end if;
  if p_actor_kind <> 'seller' then
    perform private.notify_business(o.seller_business_id, 'order_status', v_title,
      'Open the order to see the latest update.', v_link);
  end if;
  return o;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_order: buyer submits an order request to one seller.
-- p_items: [{"product_id": "...", "quantity": 12.5}, ...]
-- Prices are always read from the database, never from the client.
-- ---------------------------------------------------------------------------
create function public.create_order(
  p_seller_business_id uuid,
  p_items jsonb,
  p_delivery_method text,
  p_delivery_address text default null,
  p_delivery_state text default null,
  p_buyer_note text default null,
  p_buyer_business_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order_id uuid;
  v_item jsonb;
  v_product public.products;
  v_qty numeric(14,3);
  v_subtotal bigint := 0;
  v_line bigint;
  v_currency char(3);
begin
  if v_uid is null or not private.is_active_user() then
    raise exception 'Sign in with an active account to place an order' using errcode = '42501';
  end if;
  perform private.enforce_rate_limit('order_create', 30, 3600);

  if private.is_business_member(p_seller_business_id) then
    raise exception 'You cannot order from your own business' using errcode = '42501';
  end if;
  if not private.business_can_sell(p_seller_business_id) then
    raise exception 'This supplier is not accepting orders right now' using errcode = '22023';
  end if;
  if p_buyer_business_id is not null and not private.is_business_member(p_buyer_business_id) then
    raise exception 'You are not a member of that buying business' using errcode = '42501';
  end if;
  if p_delivery_method is null or p_delivery_method not in ('pickup', 'seller_delivery', 'third_party_logistics') then
    raise exception 'Unknown delivery method' using errcode = '22023';
  end if;
  if p_delivery_method <> 'pickup' and (coalesce(trim(p_delivery_address), '') = '' or p_delivery_state is null) then
    raise exception 'A delivery address and state are required for delivery' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'An order needs between 1 and 20 items' using errcode = '22023';
  end if;

  insert into public.orders (
    order_number, buyer_id, buyer_business_id, seller_business_id, status, currency,
    subtotal_minor, total_minor, marketplace_fee_bps, tax_bps,
    delivery_method, delivery_address, delivery_state, buyer_note, placed_at)
  values (
    private.generate_order_number(), v_uid, p_buyer_business_id, p_seller_business_id, 'requested', 'NGN',
    0, 0, private.setting_int('marketplace_fee_bps', 0), private.setting_int('tax_bps', 0),
    p_delivery_method, nullif(trim(p_delivery_address), ''), p_delivery_state, nullif(trim(p_buyer_note), ''), now())
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
    where id = private.try_uuid(v_item ->> 'product_id')
      and business_id = p_seller_business_id
      and status = 'published'
      and deleted_at is null
      and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'A product in your cart is no longer available from this supplier' using errcode = '22023';
    end if;
    if v_product.pricing_type <> 'fixed' then
      raise exception '"%" needs a quotation — send an enquiry instead', v_product.name using errcode = '22023';
    end if;
    if not (p_delivery_method = any (v_product.delivery_options)) then
      raise exception '"%" is not available with the selected delivery method', v_product.name using errcode = '22023';
    end if;

    begin
      v_qty := (v_item ->> 'quantity')::numeric(14,3);
    exception when others then
      raise exception 'Invalid quantity' using errcode = '22023';
    end;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be greater than zero' using errcode = '22023';
    end if;
    if v_qty < v_product.min_order_quantity then
      raise exception 'Minimum order for "%" is % %', v_product.name, v_product.min_order_quantity, v_product.unit using errcode = '22023';
    end if;
    if v_qty > v_product.available_quantity then
      raise exception 'Only % % of "%" listed as available', v_product.available_quantity, v_product.unit, v_product.name using errcode = '22023';
    end if;
    if v_currency is not null and v_currency <> v_product.currency then
      raise exception 'All items in one order must use the same currency' using errcode = '22023';
    end if;
    v_currency := v_product.currency;

    v_line := round(v_product.price_minor * v_qty)::bigint;
    v_subtotal := v_subtotal + v_line;
    insert into public.order_items (order_id, product_id, product_name, unit, unit_price_minor, quantity, line_total_minor)
    values (v_order_id, v_product.id, v_product.name, v_product.unit, v_product.price_minor, v_qty, v_line);
  end loop;

  update public.orders set subtotal_minor = v_subtotal, total_minor = v_subtotal, currency = v_currency where id = v_order_id;
  perform private.recalculate_order_totals(v_order_id);

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_kind, note)
  values (v_order_id, null, 'requested', v_uid, 'buyer', 'Order requested');

  perform private.notify_business(p_seller_business_id, 'order_requested',
    'New order request ' || (select order_number from public.orders where id = v_order_id),
    'A buyer has requested an order. Review and accept or decline it.', '/dashboard/orders/' || v_order_id);
  return v_order_id;
end;
$$;

-- Seller accepts, confirming delivery fee and expected date (no stock reservation).
create function public.accept_order(
  p_order_id uuid,
  p_delivery_fee_minor bigint default 0,
  p_expected_delivery_date date default null,
  p_delivery_terms text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or not private.is_business_manager(o.seller_business_id) then
    raise exception 'Only a manager of the selling business can accept this order' using errcode = '42501';
  end if;
  if p_delivery_fee_minor is null or p_delivery_fee_minor < 0 then
    raise exception 'Delivery fee cannot be negative' using errcode = '22023';
  end if;
  if o.delivery_method = 'pickup' and p_delivery_fee_minor <> 0 then
    raise exception 'Pickup orders cannot carry a delivery fee' using errcode = '22023';
  end if;
  if p_expected_delivery_date is not null and p_expected_delivery_date < current_date then
    raise exception 'Expected date cannot be in the past' using errcode = '22023';
  end if;

  update public.orders set
    delivery_fee_minor = p_delivery_fee_minor,
    total_minor = subtotal_minor + p_delivery_fee_minor + marketplace_fee_minor + tax_minor,
    expected_delivery_date = p_expected_delivery_date,
    delivery_terms = nullif(trim(p_delivery_terms), ''),
    seller_note = coalesce(nullif(trim(p_note), ''), seller_note)
  where id = p_order_id;
  perform private.recalculate_order_totals(p_order_id);
  perform private.apply_order_transition(p_order_id, 'accepted', 'seller', coalesce(p_note, 'Order accepted'));
end;
$$;

-- Generic transitions that need no extra data. Reasons are required for
-- rejection and cancellation.
create function public.transition_order(p_order_id uuid, p_to public.order_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_actor text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  v_actor := private.order_actor_kind(o);
  if v_actor is null then
    raise exception 'You are not a participant in this order' using errcode = '42501';
  end if;

  if p_to in ('accepted', 'paid', 'disputed') then
    raise exception 'Use the dedicated action for this step' using errcode = '22023';
  end if;
  if p_to in ('rejected', 'cancelled', 'refunded') and coalesce(trim(p_note), '') = '' then
    raise exception 'Please give a reason' using errcode = '22023';
  end if;
  if v_actor = 'seller' and p_to in ('rejected', 'cancelled') and not private.is_business_manager(o.seller_business_id) then
    raise exception 'Only a manager can reject or cancel orders' using errcode = '42501';
  end if;

  if p_to = 'rejected' then
    update public.orders set rejection_reason = left(trim(p_note), 1000) where id = p_order_id;
  elsif p_to = 'cancelled' then
    update public.orders set cancellation_reason = left(trim(p_note), 1000) where id = p_order_id;
  end if;

  perform private.apply_order_transition(p_order_id, p_to, v_actor, p_note);
  if v_actor = 'admin' then
    perform private.audit('order_' || p_to::text, 'order', p_order_id::text, jsonb_build_object('note', p_note));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
create function public.create_quotation(
  p_enquiry_id uuid,
  p_item_description text,
  p_unit text,
  p_unit_price_minor bigint,
  p_quantity numeric,
  p_delivery_fee_minor bigint,
  p_valid_until date,
  p_delivery_terms text default null,
  p_product_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries;
  v_id uuid;
begin
  select * into e from public.enquiries where id = p_enquiry_id for update;
  if not found or not private.is_business_manager(e.supplier_business_id) then
    raise exception 'Only a manager of the supplier can send quotations' using errcode = '42501';
  end if;
  if e.status = 'closed' then
    raise exception 'This enquiry is closed' using errcode = '22023';
  end if;
  if p_valid_until < current_date then
    raise exception 'Validity date cannot be in the past' using errcode = '22023';
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id and business_id = e.supplier_business_id) then
    raise exception 'Product does not belong to this supplier' using errcode = '22023';
  end if;

  insert into public.quotations (enquiry_id, supplier_business_id, buyer_id, product_id, item_description, unit,
    unit_price_minor, quantity, delivery_fee_minor, delivery_terms, valid_until, created_by)
  values (p_enquiry_id, e.supplier_business_id, e.buyer_id, coalesce(p_product_id, e.product_id),
    trim(p_item_description), p_unit, p_unit_price_minor, p_quantity, coalesce(p_delivery_fee_minor, 0),
    nullif(trim(p_delivery_terms), ''), p_valid_until, (select auth.uid()))
  returning id into v_id;

  update public.enquiries set status = 'responded' where id = p_enquiry_id;
  perform private.notify(e.buyer_id, 'quotation_received', 'New quotation for "' || left(e.subject, 80) || '"',
    'A supplier has sent you a quotation. Review it before it expires.', '/dashboard/enquiries/' || e.id);
  return v_id;
end;
$$;

create function public.respond_quotation(p_quotation_id uuid, p_response public.quotation_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotations;
begin
  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'This quotation is no longer open' using errcode = '22023';
  end if;
  if p_response = 'declined' and q.buyer_id = (select auth.uid()) then
    update public.quotations set status = 'declined', responded_at = now() where id = p_quotation_id;
    perform private.notify_business(q.supplier_business_id, 'quotation_declined', 'A quotation was declined',
      'The buyer declined your quotation.', '/dashboard/enquiries/' || q.enquiry_id);
  elsif p_response = 'withdrawn' and private.is_business_manager(q.supplier_business_id) then
    update public.quotations set status = 'withdrawn', responded_at = now() where id = p_quotation_id;
    perform private.notify(q.buyer_id, 'quotation_withdrawn', 'A quotation was withdrawn',
      'The supplier withdrew a quotation.', '/dashboard/enquiries/' || q.enquiry_id);
  else
    raise exception 'You cannot make that change to this quotation' using errcode = '42501';
  end if;
end;
$$;

-- Buyer accepts a quotation → order created directly in "accepted".
create function public.accept_quotation(
  p_quotation_id uuid,
  p_delivery_method text,
  p_delivery_address text default null,
  p_delivery_state text default null,
  p_buyer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotations;
  v_order_id uuid;
  v_line bigint;
begin
  select * into q from public.quotations where id = p_quotation_id for update;
  if not found or q.buyer_id <> (select auth.uid()) then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'This quotation is no longer open' using errcode = '22023';
  end if;
  if q.valid_until < current_date then
    update public.quotations set status = 'expired' where id = p_quotation_id;
    raise exception 'This quotation has expired' using errcode = '22023';
  end if;
  if not private.business_can_sell(q.supplier_business_id) then
    raise exception 'This supplier is not accepting orders right now' using errcode = '22023';
  end if;
  if p_delivery_method is null or p_delivery_method not in ('pickup', 'seller_delivery', 'third_party_logistics') then
    raise exception 'Unknown delivery method' using errcode = '22023';
  end if;
  if p_delivery_method <> 'pickup' and (coalesce(trim(p_delivery_address), '') = '' or p_delivery_state is null) then
    raise exception 'A delivery address and state are required for delivery' using errcode = '22023';
  end if;

  v_line := round(q.unit_price_minor * q.quantity)::bigint;
  insert into public.orders (order_number, buyer_id, seller_business_id, quotation_id, status, currency,
    subtotal_minor, delivery_fee_minor, total_minor, marketplace_fee_bps, tax_bps,
    delivery_method, delivery_address, delivery_state, delivery_terms, buyer_note, placed_at, accepted_at)
  values (private.generate_order_number(), q.buyer_id, q.supplier_business_id, q.id, 'accepted', q.currency,
    v_line, case when p_delivery_method = 'pickup' then 0 else q.delivery_fee_minor end,
    v_line + case when p_delivery_method = 'pickup' then 0 else q.delivery_fee_minor end,
    private.setting_int('marketplace_fee_bps', 0), private.setting_int('tax_bps', 0),
    p_delivery_method, nullif(trim(p_delivery_address), ''), p_delivery_state, q.delivery_terms,
    nullif(trim(p_buyer_note), ''), now(), now())
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit, unit_price_minor, quantity, line_total_minor)
  values (v_order_id, q.product_id, q.item_description, q.unit, q.unit_price_minor, q.quantity, v_line);
  perform private.recalculate_order_totals(v_order_id);

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_kind, note) values
    (v_order_id, null, 'requested', (select auth.uid()), 'buyer', 'Created from quotation'),
    (v_order_id, 'requested', 'accepted', (select auth.uid()), 'buyer', 'Terms agreed in accepted quotation');

  update public.quotations set status = 'accepted', responded_at = now(), order_id = v_order_id where id = q.id;
  update public.quotations set status = 'expired'
    where enquiry_id = q.enquiry_id and id <> q.id and status = 'sent';
  update public.enquiries set status = 'closed', closed_at = now() where id = q.enquiry_id;

  perform private.notify_business(q.supplier_business_id, 'quotation_accepted', 'Quotation accepted',
    'The buyer accepted your quotation and an order was created.', '/dashboard/orders/' || v_order_id);
  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

-- Buyer starts a provider payment (server action calls this, then the provider).
create function public.create_payment_transaction(p_order_id uuid, p_provider public.payment_provider, p_reference text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_id uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> (select auth.uid()) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'awaiting_payment' then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;
  if p_provider not in ('paystack') then
    raise exception 'Use the sandbox or offline payment actions for that provider' using errcode = '22023';
  end if;
  perform private.enforce_rate_limit('payment_init', 20, 3600);

  insert into public.payment_transactions (order_id, provider, reference, amount_minor, currency, status, initiated_by)
  values (p_order_id, p_provider, p_reference, o.total_minor, o.currency, 'initialized', (select auth.uid()))
  returning id into v_id;
  update public.orders set payment_provider = p_provider where id = p_order_id;
  return v_id;
end;
$$;

-- Development sandbox: clearly-labelled simulated payment. Disabled in production
-- by setting payment_sandbox_enabled = false.
create function public.sandbox_confirm_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if not private.setting_bool('payment_sandbox_enabled', false) then
    raise exception 'Sandbox payments are disabled on this platform' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.buyer_id <> (select auth.uid()) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'awaiting_payment' then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;

  insert into public.payment_transactions (order_id, provider, reference, amount_minor, currency, status,
    reconciliation_status, initiated_by, verified_at, note)
  values (p_order_id, 'sandbox', 'SBX-' || replace(gen_random_uuid()::text, '-', ''), o.total_minor, o.currency,
    'succeeded', 'matched', (select auth.uid()), now(), 'SANDBOX — simulated payment, no money moved');
  update public.orders set payment_provider = 'sandbox' where id = p_order_id;
  perform private.apply_order_transition(p_order_id, 'paid', 'system', 'Sandbox payment (simulated — not a real transaction)');
end;
$$;

-- Pilot offline flow: the seller (manager) or an admin records a payment received
-- outside the platform.
create function public.confirm_offline_payment(p_order_id uuid, p_reference text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_actor text;
begin
  if not private.setting_bool('offline_payments_enabled', false) then
    raise exception 'Offline payment recording is disabled' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if private.is_business_manager(o.seller_business_id) then
    v_actor := 'seller';
  elsif private.is_admin() then
    v_actor := 'admin';
  else
    raise exception 'Only the seller or an administrator can record an offline payment' using errcode = '42501';
  end if;
  if o.status <> 'awaiting_payment' then
    raise exception 'This order is not awaiting payment' using errcode = '22023';
  end if;
  if char_length(coalesce(trim(p_reference), '')) < 3 then
    raise exception 'Enter the bank transfer or receipt reference' using errcode = '22023';
  end if;

  insert into public.payment_transactions (order_id, provider, reference, amount_minor, currency, status,
    reconciliation_status, initiated_by, verified_at, note)
  values (p_order_id, 'offline', 'OFF-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), o.total_minor,
    o.currency, 'succeeded', 'unreconciled', (select auth.uid()), now(),
    left('Offline payment recorded. Reference: ' || trim(p_reference) || coalesce(' — ' || nullif(trim(p_note), ''), ''), 500));
  update public.orders set payment_provider = 'offline' where id = p_order_id;
  perform private.apply_order_transition(p_order_id, 'paid', v_actor, 'Offline payment recorded by ' || v_actor);
  perform private.audit('payment_offline_recorded', 'order', p_order_id::text,
    jsonb_build_object('reference', left(trim(p_reference), 100), 'amount_minor', o.total_minor));
end;
$$;

-- Webhook idempotency: returns true only the first time an event key is seen.
-- Service role only.
create function public.record_webhook_event(
  p_provider public.payment_provider,
  p_event_key text,
  p_event_type text,
  p_reference text,
  p_signature_valid boolean,
  p_payload_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.payment_webhook_events (provider, event_key, event_type, reference, signature_valid, payload_sha256)
  values (p_provider, p_event_key, left(p_event_type, 80), left(p_reference, 100), p_signature_valid, p_payload_sha256)
  on conflict (provider, event_key) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

create function public.mark_webhook_event_processed(p_provider public.payment_provider, p_event_key text, p_result text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payment_webhook_events set processed_at = now(), processing_result = left(p_result, 300)
  where provider = p_provider and event_key = p_event_key;
$$;

-- Called by the server ONLY after the provider has been re-queried server-side.
-- Idempotent; checks amount and currency before marking the order paid. Service role only.
create function public.record_payment_result(
  p_reference text,
  p_status public.payment_status,
  p_amount_minor bigint,
  p_currency text,
  p_provider_transaction_id text default null,
  p_provider_fee_minor bigint default null,
  p_channel text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.payment_transactions;
  o public.orders;
begin
  select * into t from public.payment_transactions where reference = p_reference for update;
  if not found then
    return 'unknown_reference';
  end if;
  if t.status = 'succeeded' then
    return 'already_processed';
  end if;

  select * into o from public.orders where id = t.order_id for update;

  if p_status = 'succeeded' then
    if p_amount_minor <> t.amount_minor or upper(p_currency) <> t.currency then
      update public.payment_transactions set status = 'failed', reconciliation_status = 'mismatch',
        failure_reason = 'Amount or currency mismatch', provider_transaction_id = p_provider_transaction_id,
        verified_at = now()
      where id = t.id;
      perform private.audit('payment_amount_mismatch', 'payment_transaction', t.id::text,
        jsonb_build_object('expected', t.amount_minor, 'received', p_amount_minor, 'currency', p_currency), 'failure');
      perform private.notify_admins('payment_mismatch', 'Payment amount mismatch',
        'A payment did not match its order total and needs review.', '/dashboard/orders/' || o.id);
      return 'amount_mismatch';
    end if;

    update public.payment_transactions set status = 'succeeded', reconciliation_status = 'matched',
      provider_transaction_id = p_provider_transaction_id, provider_fee_minor = p_provider_fee_minor,
      channel = left(p_channel, 40), verified_at = now()
    where id = t.id;

    if o.status = 'awaiting_payment' then
      perform private.apply_order_transition(o.id, 'paid', 'system', 'Payment confirmed by provider');
      return 'paid';
    end if;
    -- Paid after cancellation etc.: keep the record, flag for manual refund.
    perform private.notify_admins('payment_late', 'Payment received for an order not awaiting payment',
      'Review and refund through the provider if needed.', '/dashboard/orders/' || o.id);
    return 'paid_but_order_not_awaiting';
  end if;

  update public.payment_transactions set status = p_status, provider_transaction_id = p_provider_transaction_id,
    verified_at = now(), failure_reason = case when p_status = 'failed' then 'Provider reported failure' end
  where id = t.id;
  if p_status = 'failed' then
    perform private.notify(o.buyer_id, 'payment_failed', 'Payment for order ' || o.order_number || ' did not go through',
      'You can try again from the order page.', '/dashboard/orders/' || o.id);
  end if;
  return 'recorded_' || p_status::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enquiry triggers: rate limits, notifications, responded status
-- ---------------------------------------------------------------------------
create function private.guard_enquiry_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if new.status <> 'open' or new.closed_at is not null then
      raise exception 'Enquiries start open' using errcode = '42501';
    end if;
    perform private.enforce_rate_limit('enquiry_create', 20, 3600);
  end if;
  return new;
end;
$$;
create trigger enquiries_guard before insert on public.enquiries
  for each row execute function private.guard_enquiry_insert();

create function private.after_enquiry_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_business(new.supplier_business_id,
    case when new.kind = 'quote_request' then 'quote_requested' else 'enquiry_received' end,
    case when new.kind = 'quote_request' then 'New quotation request' else 'New enquiry' end || ': ' || left(new.subject, 80),
    'A buyer has contacted your business.', '/dashboard/enquiries/' || new.id);
  return new;
end;
$$;
create trigger enquiries_notify after insert on public.enquiries
  for each row execute function private.after_enquiry_insert();

create function private.guard_enquiry_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    perform private.enforce_rate_limit('enquiry_message', 60, 3600);
  end if;
  return new;
end;
$$;
create trigger enquiry_messages_guard before insert on public.enquiry_messages
  for each row execute function private.guard_enquiry_message();

create function private.after_enquiry_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries;
begin
  select * into e from public.enquiries where id = new.enquiry_id;
  update public.enquiries set updated_at = now(),
    status = case when new.sender_id <> e.buyer_id and status = 'open' then 'responded'::public.enquiry_status else status end
  where id = e.id;
  if new.sender_id = e.buyer_id then
    perform private.notify_business(e.supplier_business_id, 'enquiry_message', 'New message on "' || left(e.subject, 80) || '"',
      'Open the enquiry to reply.', '/dashboard/enquiries/' || e.id, new.sender_id);
  else
    perform private.notify(e.buyer_id, 'enquiry_message', 'Supplier replied to "' || left(e.subject, 80) || '"',
      'Open the enquiry to read the reply.', '/dashboard/enquiries/' || e.id);
  end if;
  return new;
end;
$$;
create trigger enquiry_messages_notify after insert on public.enquiry_messages
  for each row execute function private.after_enquiry_message();

create function public.close_enquiry(p_enquiry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enquiries;
begin
  select * into e from public.enquiries where id = p_enquiry_id for update;
  if not found or not (e.buyer_id = (select auth.uid()) or private.is_business_member(e.supplier_business_id)) then
    raise exception 'Enquiry not found' using errcode = 'P0002';
  end if;
  update public.enquiries set status = 'closed', closed_at = now() where id = p_enquiry_id;
  update public.quotations set status = 'expired' where enquiry_id = p_enquiry_id and status = 'sent';
end;
$$;
