-- =============================================================================
-- BlueMarket Nigeria — 0600 logistics & cold chain; reviews, disputes, reports
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Logistics and cold-chain services (request-and-confirm, no live tracking)
-- ---------------------------------------------------------------------------
create table public.logistics_services (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses (id) on delete cascade,
  service_type          public.logistics_service_type not null,
  title                 text not null check (char_length(title) between 3 and 120),
  description           text not null check (char_length(description) between 10 and 4000),
  coverage_states       text[] not null check (cardinality(coverage_states) > 0),
  capacity_description  text check (char_length(capacity_description) <= 300),
  temperature_range     text check (char_length(temperature_range) <= 60),
  base_price_minor      bigint check (base_price_minor is null or base_price_minor > 0),
  currency              char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  pricing_unit          text check (char_length(pricing_unit) <= 60),
  pricing_notes         text check (char_length(pricing_notes) <= 1000),
  status                public.listing_status not null default 'draft',
  moderation_note       text check (char_length(moderation_note) <= 1000),
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
alter table public.logistics_services enable row level security;
create index logistics_services_business_idx on public.logistics_services (business_id, status);
create index logistics_services_public_idx on public.logistics_services (service_type) where status = 'published';
create index logistics_services_coverage_idx on public.logistics_services using gin (coverage_states);
create trigger logistics_services_updated_at before update on public.logistics_services
  for each row execute function private.set_updated_at();

create function private.business_can_offer_logistics(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.is_logistics_provider and b.status = 'active' and b.deleted_at is null
  );
$$;

create function private.guard_logistics_service_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if tg_op = 'UPDATE' then
      if new.business_id is distinct from old.business_id
         or new.created_by is distinct from old.created_by
         or new.moderation_note is distinct from old.moderation_note then
        raise exception 'That service field is managed by the platform' using errcode = '42501';
      end if;
      if old.status = 'hidden' and new.status is distinct from old.status then
        raise exception 'This service was hidden by a moderator. Contact support to appeal.' using errcode = '42501';
      end if;
    elsif new.moderation_note is not null then
      raise exception 'That service field is managed by the platform' using errcode = '42501';
    end if;
    if new.status = 'hidden' and (tg_op = 'INSERT' or old.status <> 'hidden') then
      raise exception 'Only moderators can hide services' using errcode = '42501';
    end if;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published')
     and not private.business_can_offer_logistics(new.business_id) then
    raise exception 'This business is not an active logistics provider' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger logistics_services_guard before insert or update on public.logistics_services
  for each row execute function private.guard_logistics_service_columns();

create table public.logistics_bookings (
  id                       uuid primary key default gen_random_uuid(),
  service_id               uuid not null references public.logistics_services (id) on delete restrict,
  provider_business_id     uuid not null references public.businesses (id),
  requester_id             uuid not null references public.profiles (id),
  requester_business_id    uuid references public.businesses (id) on delete set null,
  order_id                 uuid references public.orders (id) on delete set null,
  pickup_location          text not null check (char_length(pickup_location) between 2 and 300),
  dropoff_location         text not null check (char_length(dropoff_location) between 2 and 300),
  requested_date           date not null,
  cargo_description        text not null check (char_length(cargo_description) between 3 and 1000),
  quantity_description     text check (char_length(quantity_description) <= 200),
  special_requirements     text check (char_length(special_requirements) <= 1000),
  status                   public.booking_status not null default 'requested',
  quoted_price_minor       bigint check (quoted_price_minor is null or quoted_price_minor > 0),
  currency                 char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  provider_note            text check (char_length(provider_note) <= 1000),
  delivery_terms           text check (char_length(delivery_terms) <= 1000),
  expected_date            date,
  proof_of_delivery_note   text check (char_length(proof_of_delivery_note) <= 1000),
  proof_recorded_at        timestamptz,
  cancellation_reason      text check (char_length(cancellation_reason) <= 1000),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table public.logistics_bookings enable row level security;
create index logistics_bookings_provider_idx on public.logistics_bookings (provider_business_id, status, created_at desc);
create index logistics_bookings_requester_idx on public.logistics_bookings (requester_id, created_at desc);
create index logistics_bookings_order_idx on public.logistics_bookings (order_id);
create trigger logistics_bookings_updated_at before update on public.logistics_bookings
  for each row execute function private.set_updated_at();

-- Client inserts must start at 'requested' with no provider-set fields; provider
-- business is always derived from the service, never trusted from the client.
create function private.prepare_booking_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.logistics_services;
begin
  select * into v_service from public.logistics_services where id = new.service_id;
  if not found then
    raise exception 'Service not found' using errcode = 'P0002';
  end if;
  new.provider_business_id := v_service.business_id;
  new.currency := v_service.currency;
  return new;
end;
$$;

create function private.guard_booking_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if new.status <> 'requested' or new.quoted_price_minor is not null or new.provider_note is not null
       or new.expected_date is not null or new.proof_of_delivery_note is not null
       or new.proof_recorded_at is not null or new.delivery_terms is not null then
      raise exception 'Bookings start as requests; the provider sets price and terms' using errcode = '42501';
    end if;
    if new.requested_date < current_date then
      raise exception 'Requested date cannot be in the past' using errcode = '22023';
    end if;
    perform private.enforce_rate_limit('booking_create', 20, 3600);
  end if;
  return new;
end;
$$;
create trigger logistics_bookings_guard before insert on public.logistics_bookings
  for each row execute function private.guard_booking_insert();
create trigger logistics_bookings_prepare before insert on public.logistics_bookings
  for each row execute function private.prepare_booking_insert();

-- ---------------------------------------------------------------------------
-- Reviews: only the buyer of a completed order may review the seller.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  author_id        uuid not null references public.profiles (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  rating           smallint not null check (rating between 1 and 5),
  comment          text check (char_length(comment) <= 2000),
  status           public.review_status not null default 'published',
  moderation_note  text check (char_length(moderation_note) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (order_id, author_id)
);
alter table public.reviews enable row level security;
create index reviews_business_idx on public.reviews (business_id, created_at desc) where status = 'published';
create trigger reviews_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

create function private.guard_review_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if tg_op = 'INSERT' and (new.status <> 'published' or new.moderation_note is not null) then
      raise exception 'Review moderation fields are managed by moderators' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.status is distinct from old.status
       or new.moderation_note is distinct from old.moderation_note
       or new.order_id is distinct from old.order_id
       or new.business_id is distinct from old.business_id
       or new.author_id is distinct from old.author_id) then
      raise exception 'Review moderation fields are managed by moderators' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger reviews_guard before insert or update on public.reviews
  for each row execute function private.guard_review_columns();

-- ---------------------------------------------------------------------------
-- Disputes
-- ---------------------------------------------------------------------------
create table public.disputes (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete restrict,
  opened_by              uuid not null references public.profiles (id),
  category               public.dispute_category not null,
  description            text not null check (char_length(description) between 10 and 4000),
  status                 public.dispute_status not null default 'open',
  previous_order_status  public.order_status not null,
  assigned_admin_id      uuid references public.profiles (id) on delete set null,
  outcome                public.dispute_outcome,
  resolution_note        text check (char_length(resolution_note) <= 4000),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  resolved_at            timestamptz
);
alter table public.disputes enable row level security;
create unique index disputes_one_active_per_order
  on public.disputes (order_id) where status not in ('resolved', 'rejected');
create index disputes_status_idx on public.disputes (status, created_at);
create trigger disputes_updated_at before update on public.disputes
  for each row execute function private.set_updated_at();

create function private.is_dispute_participant(p_dispute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.disputes d
    join public.orders o on o.id = d.order_id
    where d.id = p_dispute_id
      and (d.opened_by = (select auth.uid())
           or o.buyer_id = (select auth.uid())
           or private.is_business_member(o.seller_business_id))
  );
$$;

create table public.dispute_messages (
  id           uuid primary key default gen_random_uuid(),
  dispute_id   uuid not null references public.disputes (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id),
  body         text not null check (char_length(body) between 1 and 4000),
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.dispute_messages enable row level security;
create index dispute_messages_dispute_idx on public.dispute_messages (dispute_id, created_at);

create table public.dispute_attachments (
  id            uuid primary key default gen_random_uuid(),
  dispute_id    uuid not null references public.disputes (id) on delete cascade,
  uploaded_by   uuid not null references public.profiles (id),
  storage_path  text not null unique check (char_length(storage_path) <= 300),
  file_name     text not null check (char_length(file_name) <= 200),
  mime_type     text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes    integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at    timestamptz not null default now()
);
alter table public.dispute_attachments enable row level security;
create index dispute_attachments_dispute_idx on public.dispute_attachments (dispute_id);

-- ---------------------------------------------------------------------------
-- Content reports (listings, businesses, users, services) and support requests
-- ---------------------------------------------------------------------------
create table public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  target_type      public.report_target not null,
  target_id        uuid not null,
  reason           public.report_reason not null,
  details          text check (char_length(details) <= 2000),
  status           public.report_status not null default 'open',
  handled_by       uuid references public.profiles (id) on delete set null,
  resolution_note  text check (char_length(resolution_note) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.content_reports enable row level security;
create index content_reports_status_idx on public.content_reports (status, created_at);
create index content_reports_target_idx on public.content_reports (target_type, target_id);
create trigger content_reports_updated_at before update on public.content_reports
  for each row execute function private.set_updated_at();

create table public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null check (char_length(name) between 2 and 120),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  topic       text not null check (topic in ('account', 'listing', 'order', 'payment', 'logistics', 'safety', 'data_protection', 'other')),
  message     text not null check (char_length(message) between 10 and 4000),
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);
alter table public.support_requests enable row level security;
create index support_requests_status_idx on public.support_requests (status, created_at);

-- Rate limits and status defaults for client-created trust records.
create function private.guard_client_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if tg_table_name = 'content_reports' then
      if new.status <> 'open' or new.handled_by is not null or new.resolution_note is not null then
        raise exception 'Reports start open' using errcode = '42501';
      end if;
      perform private.enforce_rate_limit('content_report', 10, 3600);
    elsif tg_table_name = 'support_requests' then
      if new.status <> 'open' then
        raise exception 'Support requests start open' using errcode = '42501';
      end if;
      new.user_id := (select auth.uid());
      perform private.enforce_rate_limit('support_request', 5, 3600);
    end if;
  end if;
  return new;
end;
$$;
create trigger content_reports_guard before insert on public.content_reports
  for each row execute function private.guard_client_report();
create trigger support_requests_guard before insert on public.support_requests
  for each row execute function private.guard_client_report();

grant execute on function private.business_can_offer_logistics(uuid) to anon, authenticated;
grant execute on function private.is_dispute_participant(uuid) to anon, authenticated;
