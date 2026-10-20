-- =============================================================================
-- BlueMarket Nigeria — 0800 onboarding, listings, logistics bookings, disputes,
-- moderation and administration RPCs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Onboarding and account self-service
-- ---------------------------------------------------------------------------
create function public.complete_onboarding(
  p_full_name text,
  p_phone text,
  p_roles public.app_role[],
  p_accept_terms boolean,
  p_marketing_consent boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.app_role;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not coalesce(p_accept_terms, false) then
    raise exception 'You must accept the terms of use and privacy notice' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Enter your full name' using errcode = '22023';
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'Choose at least one way to use BlueMarket' using errcode = '22023';
  end if;

  foreach v_role in array p_roles loop
    if v_role not in ('buyer', 'supplier', 'logistics_provider') then
      raise exception 'That role can only be granted by an administrator' using errcode = '42501';
    end if;
    insert into public.role_assignments (user_id, role) values (v_uid, v_role) on conflict do nothing;
  end loop;

  update public.profiles set
    full_name = left(trim(p_full_name), 120),
    phone = nullif(regexp_replace(coalesce(p_phone, ''), '[\s-]', '', 'g'), ''),
    marketing_consent = coalesce(p_marketing_consent, false),
    terms_accepted_at = coalesce(terms_accepted_at, now()),
    onboarding_completed = true
  where id = v_uid;
end;
$$;

-- Data access request (NDPA): the signed-in user's own records as JSON.
create function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = (select auth.uid())),
    'roles', (select coalesce(jsonb_agg(jsonb_build_object('role', role, 'granted_at', granted_at, 'revoked_at', revoked_at)), '[]')
              from public.role_assignments where user_id = (select auth.uid())),
    'business_memberships', (select coalesce(jsonb_agg(jsonb_build_object('business', b.name, 'role', m.role)), '[]')
              from public.business_memberships m join public.businesses b on b.id = m.business_id
              where m.user_id = (select auth.uid())),
    'orders_as_buyer', (select coalesce(jsonb_agg(to_jsonb(o) - 'buyer_note'), '[]')
              from public.orders o where o.buyer_id = (select auth.uid())),
    'enquiries', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.enquiries e where e.buyer_id = (select auth.uid())),
    'saved_products', (select coalesce(jsonb_agg(s.product_id), '[]') from public.saved_products s where s.user_id = (select auth.uid())),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reviews r where r.author_id = (select auth.uid())),
    'notifications', (select coalesce(jsonb_agg(jsonb_build_object('title', n.title, 'created_at', n.created_at)), '[]')
              from public.notifications n where n.user_id = (select auth.uid()))
  );
$$;

create function public.request_account_deletion(p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  update public.profiles set deletion_requested_at = now() where id = (select auth.uid());
  perform private.audit('account_deletion_requested', 'profile', (select auth.uid())::text,
    jsonb_build_object('reason', left(p_reason, 500)));
  perform private.notify_admins('deletion_request', 'Account deletion requested',
    'A user asked for their account to be deleted. Review retention obligations before acting.', '/dashboard/admin/users');
end;
$$;

-- Business owner adds a teammate who already has an account.
create function public.add_business_member(p_business_id uuid, p_email text, p_role public.membership_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not exists (select 1 from public.businesses where id = p_business_id and owner_id = (select auth.uid())) then
    raise exception 'Only the business owner can add members' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'Ownership cannot be transferred this way' using errcode = '22023';
  end if;
  select id into v_user from public.profiles where lower(email) = lower(trim(p_email)) and deleted_at is null;
  if v_user is null then
    raise exception 'No BlueMarket account uses that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  insert into public.business_memberships (business_id, user_id, role) values (p_business_id, v_user, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role
  where public.business_memberships.role <> 'owner';
  perform private.audit('business_member_added', 'business', p_business_id::text,
    jsonb_build_object('user_id', v_user, 'role', p_role));
  perform private.notify(v_user, 'business_membership', 'You were added to a business',
    'You can now help manage this business on BlueMarket.', '/dashboard/supplier/business');
end;
$$;

create function public.remove_business_member(p_business_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.businesses where id = p_business_id and owner_id = (select auth.uid())) then
    raise exception 'Only the business owner can remove members' using errcode = '42501';
  end if;
  delete from public.business_memberships where business_id = p_business_id and user_id = p_user_id and role <> 'owner';
  perform private.audit('business_member_removed', 'business', p_business_id::text, jsonb_build_object('user_id', p_user_id));
end;
$$;

-- Business contacts: shown when the business made them public, or to members,
-- admins, and buyers with an enquiry or order with this business.
create function public.get_business_contact(p_business_id uuid)
returns table (contact_phone text, contact_email text, whatsapp text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.contact_phone, d.contact_email, d.whatsapp
  from public.business_private_details d
  join public.businesses b on b.id = d.business_id
  where d.business_id = p_business_id
    and b.deleted_at is null
    and (
      (b.contact_public and b.status = 'active')
      or private.is_business_member(p_business_id)
      or private.is_admin()
      or exists (select 1 from public.enquiries e where e.supplier_business_id = p_business_id and e.buyer_id = (select auth.uid()))
      or exists (select 1 from public.orders o where o.seller_business_id = p_business_id and o.buyer_id = (select auth.uid()))
    );
$$;

-- Parties to an order see each other's contact details (and nothing more).
create function public.get_order_parties(p_order_id uuid)
returns table (buyer_name text, buyer_phone text, buyer_email text, seller_name text, seller_phone text, seller_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name, p.phone, p.email, b.name, d.contact_phone, d.contact_email
  from public.orders o
  join public.profiles p on p.id = o.buyer_id
  join public.businesses b on b.id = o.seller_business_id
  left join public.business_private_details d on d.business_id = b.id
  where o.id = p_order_id
    and (o.buyer_id = (select auth.uid()) or private.is_business_member(o.seller_business_id) or private.is_admin());
$$;

-- ---------------------------------------------------------------------------
-- Listings: refresh availability, view counter
-- ---------------------------------------------------------------------------
create function public.refresh_listing(p_product_id uuid, p_available_quantity numeric default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.products;
begin
  select * into p from public.products where id = p_product_id for update;
  if not found or not private.is_business_member(p.business_id) then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if p.status <> 'published' then
    raise exception 'Only published listings can be refreshed' using errcode = '22023';
  end if;
  if p_available_quantity is not null and p_available_quantity < 0 then
    raise exception 'Quantity cannot be negative' using errcode = '22023';
  end if;
  update public.products set
    expires_at = now() + make_interval(days => private.setting_int('listing_default_ttl_days', 14)),
    available_quantity = coalesce(p_available_quantity, available_quantity)
  where id = p_product_id;
end;
$$;

create function public.record_product_view(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('product_view', 300, 3600);
  update public.products set view_count = view_count + 1
  where id = p_product_id and status = 'published' and deleted_at is null
    and not private.is_business_member(business_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Logistics bookings state machine
-- ---------------------------------------------------------------------------
create function public.booking_transition_allowed(p_from public.booking_status, p_to public.booking_status, p_actor text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from::text, p_to::text, p_actor) in (
    ('requested', 'quoted', 'provider'),
    ('requested', 'confirmed', 'provider'),
    ('requested', 'declined', 'provider'),
    ('requested', 'cancelled', 'requester'),
    ('quoted', 'confirmed', 'requester'),
    ('quoted', 'cancelled', 'requester'),
    ('quoted', 'declined', 'provider'),
    ('confirmed', 'in_progress', 'provider'),
    ('confirmed', 'cancelled', 'requester'),
    ('confirmed', 'cancelled', 'provider'),
    ('in_progress', 'completed', 'provider')
  );
$$;

create function public.transition_booking(
  p_booking_id uuid,
  p_to public.booking_status,
  p_quoted_price_minor bigint default null,
  p_expected_date date default null,
  p_delivery_terms text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.logistics_bookings;
  v_actor text;
  v_link text;
begin
  select * into b from public.logistics_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if private.is_business_member(b.provider_business_id) then
    v_actor := 'provider';
  elsif b.requester_id = (select auth.uid()) then
    v_actor := 'requester';
  else
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if not public.booking_transition_allowed(b.status, p_to, v_actor) then
    raise exception 'A booking cannot move from % to %', b.status, p_to using errcode = '22023';
  end if;

  if p_to = 'quoted' and (p_quoted_price_minor is null or p_quoted_price_minor <= 0) then
    raise exception 'Enter a price for the quote' using errcode = '22023';
  end if;
  if p_to in ('declined', 'cancelled') and coalesce(trim(p_note), '') = '' then
    raise exception 'Please give a reason' using errcode = '22023';
  end if;
  if p_to = 'completed' and coalesce(trim(p_note), '') = '' then
    raise exception 'Record proof of delivery (who received it, when, condition)' using errcode = '22023';
  end if;
  if p_expected_date is not null and p_expected_date < current_date then
    raise exception 'Expected date cannot be in the past' using errcode = '22023';
  end if;

  update public.logistics_bookings set
    status = p_to,
    quoted_price_minor = case when p_to in ('quoted', 'confirmed') and v_actor = 'provider'
                              then coalesce(p_quoted_price_minor, quoted_price_minor) else quoted_price_minor end,
    expected_date = case when v_actor = 'provider' then coalesce(p_expected_date, expected_date) else expected_date end,
    delivery_terms = case when v_actor = 'provider' then coalesce(nullif(trim(p_delivery_terms), ''), delivery_terms) else delivery_terms end,
    provider_note = case when v_actor = 'provider' and p_to not in ('completed') then coalesce(nullif(trim(p_note), ''), provider_note) else provider_note end,
    cancellation_reason = case when p_to in ('declined', 'cancelled') then left(trim(p_note), 1000) else cancellation_reason end,
    proof_of_delivery_note = case when p_to = 'completed' then left(trim(p_note), 1000) else proof_of_delivery_note end,
    proof_recorded_at = case when p_to = 'completed' then now() else proof_recorded_at end
  where id = p_booking_id;

  v_link := '/dashboard/bookings/' || b.id;
  if v_actor = 'provider' then
    perform private.notify(b.requester_id, 'booking_status', 'Logistics booking ' || replace(p_to::text, '_', ' '),
      'Open the booking to see the provider''s update.', v_link);
  else
    perform private.notify_business(b.provider_business_id, 'booking_status',
      'Booking ' || replace(p_to::text, '_', ' ') || ' by requester', 'Open the booking for details.', v_link);
  end if;
end;
$$;

create function private.after_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_business(new.provider_business_id, 'booking_requested', 'New logistics booking request',
    'A customer requested your service. Quote, confirm or decline it.', '/dashboard/bookings/' || new.id);
  return new;
end;
$$;
create trigger logistics_bookings_notify after insert on public.logistics_bookings
  for each row execute function private.after_booking_insert();

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create function public.open_dispute(p_order_id uuid, p_category public.dispute_category, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_actor text;
  v_id uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  v_actor := private.order_actor_kind(o);
  if v_actor is null or v_actor not in ('buyer', 'seller') then
    raise exception 'Only the buyer or seller can open a dispute' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Describe the problem in at least 10 characters' using errcode = '22023';
  end if;
  if p_category = 'cancellation_request' and o.status not in ('paid', 'preparing') then
    raise exception 'Cancellation requests are for paid orders that have not been dispatched' using errcode = '22023';
  end if;
  perform private.enforce_rate_limit('dispute_open', 5, 3600);

  insert into public.disputes (order_id, opened_by, category, description, previous_order_status)
  values (p_order_id, (select auth.uid()), p_category, trim(p_description), o.status)
  returning id into v_id;

  perform private.apply_order_transition(p_order_id, 'disputed', v_actor, 'Dispute opened: ' || replace(p_category::text, '_', ' '));
  perform private.notify_admins('dispute_opened', 'New dispute on order ' || o.order_number,
    'A dispute needs review.', '/dashboard/admin/disputes/' || v_id);
  return v_id;
end;
$$;

create function private.after_dispute_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.disputes;
  o public.orders;
begin
  if new.is_internal then
    return new;
  end if;
  select * into d from public.disputes where id = new.dispute_id;
  select * into o from public.orders where id = d.order_id;
  if new.sender_id <> o.buyer_id then
    perform private.notify(o.buyer_id, 'dispute_message', 'New message on your dispute',
      'Open the dispute to read it.', '/dashboard/disputes/' || d.id);
  end if;
  perform private.notify_business(o.seller_business_id, 'dispute_message', 'New message on a dispute',
    'Open the dispute to read it.', '/dashboard/disputes/' || d.id, new.sender_id);
  return new;
end;
$$;
create trigger dispute_messages_notify after insert on public.dispute_messages
  for each row execute function private.after_dispute_message();

create function public.admin_update_dispute(p_dispute_id uuid, p_status public.dispute_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.disputes;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'awaiting_evidence') then
    raise exception 'Use resolve_dispute to close a dispute' using errcode = '22023';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved', 'rejected') then
    raise exception 'Dispute not found or already closed' using errcode = 'P0002';
  end if;
  update public.disputes set status = p_status, assigned_admin_id = coalesce(assigned_admin_id, (select auth.uid()))
  where id = p_dispute_id;
  if coalesce(trim(p_note), '') <> '' then
    insert into public.dispute_messages (dispute_id, sender_id, body) values (p_dispute_id, (select auth.uid()), trim(p_note));
  end if;
  perform private.audit('dispute_' || p_status::text, 'dispute', p_dispute_id::text, jsonb_build_object('note', p_note));
end;
$$;

create function public.resolve_dispute(
  p_dispute_id uuid,
  p_outcome public.dispute_outcome,
  p_resolution_note text,
  p_reject boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.disputes;
  o public.orders;
  v_new_status public.order_status;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_resolution_note, ''))) < 10 then
    raise exception 'Record the reason for the decision' using errcode = '22023';
  end if;
  select * into d from public.disputes where id = p_dispute_id for update;
  if not found or d.status in ('resolved', 'rejected') then
    raise exception 'Dispute not found or already closed' using errcode = 'P0002';
  end if;
  select * into o from public.orders where id = d.order_id for update;

  v_new_status := case
    when p_reject or p_outcome = 'no_action' then d.previous_order_status
    when p_outcome = 'refund' then 'refunded'::public.order_status
    else 'completed'::public.order_status
  end;

  update public.disputes set
    status = case when p_reject then 'rejected'::public.dispute_status else 'resolved'::public.dispute_status end,
    outcome = case when p_reject then 'no_action'::public.dispute_outcome else p_outcome end,
    resolution_note = trim(p_resolution_note),
    resolved_at = now(),
    assigned_admin_id = coalesce(assigned_admin_id, (select auth.uid()))
  where id = p_dispute_id;

  if o.status = 'disputed' then
    if v_new_status in ('refunded', 'completed') then
      perform private.apply_order_transition(o.id, v_new_status, 'admin', 'Dispute decision: ' || trim(p_resolution_note));
    else
      -- Restore the pre-dispute state (admin-only path, recorded in history).
      update public.orders set status = v_new_status where id = o.id;
      insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_kind, note)
      values (o.id, 'disputed', v_new_status, (select auth.uid()), 'admin', 'Dispute closed without change: ' || trim(p_resolution_note));
    end if;
  end if;

  if v_new_status = 'refunded' then
    update public.payment_transactions set note = left(coalesce(note || ' | ', '') || 'Refund approved by dispute decision; process through provider.', 500)
    where order_id = o.id and status = 'succeeded';
  end if;

  perform private.audit('dispute_resolved', 'dispute', p_dispute_id::text,
    jsonb_build_object('outcome', p_outcome, 'rejected', p_reject, 'order_status', v_new_status));
  perform private.notify(o.buyer_id, 'dispute_outcome', 'Decision on your dispute for order ' || o.order_number,
    'Open the dispute to read the decision.', '/dashboard/disputes/' || d.id);
  perform private.notify_business(o.seller_business_id, 'dispute_outcome', 'Decision on dispute for order ' || o.order_number,
    'Open the dispute to read the decision.', '/dashboard/disputes/' || d.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
create function private.after_verification_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.businesses set verification_status = 'pending_review'
  where id = new.business_id and verification_status in ('unverified', 'rejected', 'pending_review');
  perform private.notify_admins('verification_submitted', 'Business verification submitted',
    'A business is waiting in the verification queue.', '/dashboard/admin/businesses/' || new.business_id);
  return new;
end;
$$;
create trigger bvr_after_insert after insert on public.business_verification_requests
  for each row execute function private.after_verification_request();

create function public.review_verification_request(
  p_request_id uuid,
  p_decision public.verification_request_status,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.business_verification_requests;
  b public.businesses;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_decision = 'pending_review' then
    raise exception 'Choose approve, reject or request changes' using errcode = '22023';
  end if;
  if p_decision <> 'approved' and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Tell the business what is missing or why it was rejected' using errcode = '22023';
  end if;
  select * into r from public.business_verification_requests where id = p_request_id for update;
  if not found or r.status <> 'pending_review' then
    raise exception 'Request not found or already reviewed' using errcode = 'P0002';
  end if;
  select * into b from public.businesses where id = r.business_id for update;
  if b.owner_id = (select auth.uid()) or private.is_business_member(b.id) then
    raise exception 'You cannot review a business you belong to' using errcode = '42501';
  end if;

  update public.business_verification_requests
  set status = p_decision, reviewer_id = (select auth.uid()), reviewer_note = nullif(trim(p_note), ''), reviewed_at = now()
  where id = p_request_id;

  update public.businesses set
    verification_status = case p_decision
      when 'approved' then 'verified'::public.verification_status
      when 'rejected' then 'rejected'::public.verification_status
      else 'unverified'::public.verification_status end,
    verification_note = nullif(trim(p_note), ''),
    verified_at = case when p_decision = 'approved' then now() else null end
  where id = b.id;

  perform private.audit('verification_' || p_decision::text, 'business', b.id::text,
    jsonb_build_object('request_id', p_request_id, 'note', p_note));
  perform private.notify_business(b.id, 'verification_decision',
    case p_decision when 'approved' then 'Your business is now verified'
                    when 'rejected' then 'Verification was not approved'
                    else 'More information needed for verification' end,
    'Open your business profile for details.', '/dashboard/supplier/business');
end;
$$;

-- ---------------------------------------------------------------------------
-- Administration: accounts, businesses, roles, moderation, reports, settings
-- ---------------------------------------------------------------------------
create function public.admin_set_account_status(p_user_id uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;
  if p_status <> 'active' and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Record a reason' using errcode = '22023';
  end if;
  update public.profiles set account_status = p_status,
    suspended_reason = case when p_status = 'active' then null else trim(p_reason) end
  where id = p_user_id;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  perform private.audit('account_' || p_status::text, 'profile', p_user_id::text, jsonb_build_object('reason', p_reason));
  perform private.notify(p_user_id, 'account_status',
    case when p_status = 'active' then 'Your account is active' else 'Your account has been ' || p_status::text end,
    'Contact support if you have questions.', '/dashboard/account');
end;
$$;

create function public.admin_set_business_status(p_business_id uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_status <> 'active' and char_length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Record a reason' using errcode = '22023';
  end if;
  update public.businesses set status = p_status,
    suspended_reason = case when p_status = 'active' then null else trim(p_reason) end,
    verification_status = case
      when p_status = 'suspended' then 'suspended'::public.verification_status
      when p_status = 'active' and verification_status = 'suspended' then
        case when verified_at is not null then 'verified'::public.verification_status else 'unverified'::public.verification_status end
      else verification_status end
  where id = p_business_id;
  if not found then
    raise exception 'Business not found' using errcode = 'P0002';
  end if;
  perform private.audit('business_' || p_status::text, 'business', p_business_id::text, jsonb_build_object('reason', p_reason));
  perform private.notify_business(p_business_id, 'business_status',
    case when p_status = 'active' then 'Your business is active again' else 'Your business has been ' || p_status::text end,
    'Contact support if you have questions.', '/dashboard/supplier/business');
end;
$$;

create function public.grant_privileged_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'agency_analyst') then
    raise exception 'Self-service roles are chosen by the user' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and account_status = 'active') then
    raise exception 'User not found or not active' using errcode = 'P0002';
  end if;
  insert into public.role_assignments (user_id, role, granted_by) values (p_user_id, p_role, (select auth.uid()))
  on conflict do nothing;
  perform private.audit('role_granted', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

create function public.revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_role = 'admin' and p_user_id = (select auth.uid()) then
    raise exception 'Ask another administrator to remove your admin role' using errcode = '42501';
  end if;
  update public.role_assignments set revoked_at = now(), revoked_by = (select auth.uid())
  where user_id = p_user_id and role = p_role and revoked_at is null;
  perform private.audit('role_revoked', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

create function public.moderate_listing(p_product_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.products;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hide', 'restore') then
    raise exception 'Unknown moderation action' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Record a reason' using errcode = '22023';
  end if;
  select * into p from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  update public.products set
    status = case when p_action = 'hide' then 'hidden'::public.listing_status else 'paused'::public.listing_status end,
    moderation_note = trim(p_note)
  where id = p_product_id;
  perform private.audit('listing_' || p_action, 'product', p_product_id::text, jsonb_build_object('note', p_note));
  perform private.notify_business(p.business_id, 'listing_moderated',
    case when p_action = 'hide' then 'A listing was hidden by moderators' else 'A listing was restored (paused)' end,
    'Open the listing to see the moderator note. You can appeal through Help.', '/dashboard/supplier/listings/' || p.id);
end;
$$;

create function public.moderate_logistics_service(p_service_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.logistics_services;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hide', 'restore') or char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Choose hide or restore and record a reason' using errcode = '22023';
  end if;
  select * into s from public.logistics_services where id = p_service_id for update;
  if not found then
    raise exception 'Service not found' using errcode = 'P0002';
  end if;
  update public.logistics_services set
    status = case when p_action = 'hide' then 'hidden'::public.listing_status else 'paused'::public.listing_status end,
    moderation_note = trim(p_note)
  where id = p_service_id;
  perform private.audit('logistics_service_' || p_action, 'logistics_service', p_service_id::text, jsonb_build_object('note', p_note));
  perform private.notify_business(s.business_id, 'service_moderated',
    case when p_action = 'hide' then 'A service was hidden by moderators' else 'A service was restored (paused)' end,
    'Open the service to see the moderator note.', '/dashboard/logistics/services/' || s.id);
end;
$$;

create function public.moderate_review(p_review_id uuid, p_status public.review_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  update public.reviews set status = p_status, moderation_note = nullif(trim(p_note), '') where id = p_review_id;
  perform private.audit('review_' || p_status::text, 'review', p_review_id::text, jsonb_build_object('note', p_note));
end;
$$;

create function public.handle_content_report(p_report_id uuid, p_status public.report_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.content_reports;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  select * into r from public.content_reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  update public.content_reports set status = p_status, handled_by = (select auth.uid()),
    resolution_note = nullif(trim(p_note), '')
  where id = p_report_id;
  perform private.audit('report_' || p_status::text, 'content_report', p_report_id::text,
    jsonb_build_object('target_type', r.target_type, 'target_id', r.target_id, 'note', p_note));
  if p_status in ('actioned', 'dismissed') then
    perform private.notify(r.reporter_id, 'report_outcome', 'Thank you — your report was reviewed',
      'Our team has reviewed the report you submitted.', null);
  end if;
end;
$$;

create function public.close_support_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  update public.support_requests set status = 'closed' where id = p_request_id;
  perform private.audit('support_request_closed', 'support_request', p_request_id::text);
end;
$$;

create function public.update_platform_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.platform_settings;
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  select * into s from public.platform_settings where key = p_key for update;
  if not found then
    raise exception 'Unknown setting' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_value) <> jsonb_typeof(s.value) then
    raise exception 'Setting % expects a % value', p_key, jsonb_typeof(s.value) using errcode = '22023';
  end if;
  if p_key in ('marketplace_fee_bps', 'tax_bps') and ((p_value #>> '{}')::integer < 0 or (p_value #>> '{}')::integer > 5000) then
    raise exception 'Rates must be between 0 and 5000 basis points' using errcode = '22023';
  end if;
  if p_key in ('listing_default_ttl_days', 'max_listing_images', 'analytics_min_group_size')
     and ((p_value #>> '{}')::integer < 1 or (p_value #>> '{}')::integer > 365) then
    raise exception 'Value must be between 1 and 365' using errcode = '22023';
  end if;
  update public.platform_settings set value = p_value, updated_by = (select auth.uid()), updated_at = now()
  where key = p_key;
  -- The audit trigger on platform_settings records before/after.
end;
$$;
