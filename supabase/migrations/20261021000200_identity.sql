-- =============================================================================
-- BlueMarket Nigeria — 0200 identity, roles and businesses
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (created by trigger on auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text,
  full_name             text not null default '' check (char_length(full_name) <= 120),
  phone                 text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  account_status        public.account_status not null default 'active',
  suspended_reason      text check (char_length(suspended_reason) <= 1000),
  onboarding_completed  boolean not null default false,
  email_notifications   boolean not null default true,
  sms_notifications     boolean not null default false,
  marketing_consent     boolean not null default false,
  terms_accepted_at     timestamptz,
  deletion_requested_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- role_assignments: buyer / supplier / logistics_provider are self-service;
-- admin / agency_analyst are granted only by an admin RPC (audited).
-- ---------------------------------------------------------------------------
create table public.role_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.app_role not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  revoked_by  uuid references public.profiles (id) on delete set null
);
alter table public.role_assignments enable row level security;
create unique index role_assignments_active_uq
  on public.role_assignments (user_id, role) where revoked_at is null;
create index role_assignments_role_idx on public.role_assignments (role) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can read role_assignments under RLS)
-- ---------------------------------------------------------------------------
create function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.profiles p on p.id = ra.user_id
    where ra.user_id = (select auth.uid())
      and ra.role = p_role
      and ra.revoked_at is null
      and p.account_status = 'active'
      and p.deleted_at is null
  );
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin');
$$;

create function private.is_agency_analyst()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('agency_analyst');
$$;

create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and account_status = 'active' and deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- businesses: trading entities. Public fields only; private details separate.
-- ---------------------------------------------------------------------------
create table public.businesses (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references public.profiles (id),
  name                   text not null check (char_length(name) between 2 and 120),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  description            text check (char_length(description) <= 2000),
  business_category      text not null default 'other' check (business_category in (
                           'fisher_cooperative', 'artisanal_fisher', 'aquaculture_farm', 'processor',
                           'wholesaler', 'retailer', 'hospitality', 'exporter', 'logistics', 'cold_storage', 'other')),
  is_supplier            boolean not null default false,
  is_logistics_provider  boolean not null default false,
  is_buyer_organisation  boolean not null default false,
  state_code             text not null references public.regions (code),
  city                   text check (char_length(city) <= 80),
  service_states         text[] not null default '{}',
  contact_public         boolean not null default false,
  logo_path              text,
  verification_status    public.verification_status not null default 'unverified',
  verification_note      text check (char_length(verification_note) <= 1000),
  verified_at            timestamptz,
  status                 public.account_status not null default 'active',
  suspended_reason       text check (char_length(suspended_reason) <= 1000),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
alter table public.businesses enable row level security;
create index businesses_owner_idx on public.businesses (owner_id);
create index businesses_state_idx on public.businesses (state_code);
create index businesses_verification_idx on public.businesses (verification_status);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();

-- Private details: street address, CAC registration, direct contacts.
create table public.business_private_details (
  business_id          uuid primary key references public.businesses (id) on delete cascade,
  street_address       text check (char_length(street_address) <= 300),
  registration_number  text check (char_length(registration_number) <= 40),
  tax_id               text check (char_length(tax_id) <= 40),
  contact_phone        text check (contact_phone is null or contact_phone ~ '^\+?[0-9]{7,15}$'),
  contact_email        text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp             text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{7,15}$'),
  updated_at           timestamptz not null default now()
);
alter table public.business_private_details enable row level security;
create trigger business_private_details_updated_at before update on public.business_private_details
  for each row execute function private.set_updated_at();

create table public.business_memberships (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.membership_role not null default 'staff',
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
alter table public.business_memberships enable row level security;
create index business_memberships_user_idx on public.business_memberships (user_id);

-- Membership helpers ----------------------------------------------------------
create function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and p.account_status = 'active'
  );
$$;

create function private.is_business_manager(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_memberships m
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
      and p.account_status = 'active'
  );
$$;

create function private.business_is_active(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses
    where id = p_business_id and status = 'active' and deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Verification requests
-- ---------------------------------------------------------------------------
create table public.business_verification_requests (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  submitted_by     uuid not null references public.profiles (id),
  status           public.verification_request_status not null default 'pending_review',
  document_type    text not null check (document_type in (
                     'cac_certificate', 'fisheries_licence', 'cooperative_registration',
                     'food_safety_certificate', 'export_licence', 'government_id', 'other')),
  document_path    text,
  document_expiry  date,
  applicant_note   text check (char_length(applicant_note) <= 2000),
  reviewer_id      uuid references public.profiles (id),
  reviewer_note    text check (char_length(reviewer_note) <= 2000),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.business_verification_requests enable row level security;
create index bvr_business_idx on public.business_verification_requests (business_id, created_at desc);
create index bvr_pending_idx on public.business_verification_requests (created_at) where status = 'pending_review';
create trigger bvr_updated_at before update on public.business_verification_requests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Protected columns: clients cannot set their own privileged state.
-- These triggers are SECURITY INVOKER on purpose (see private.is_client_role).
-- ---------------------------------------------------------------------------
create function private.guard_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.account_status is distinct from old.account_status
       or new.suspended_reason is distinct from old.suspended_reason
       or new.deleted_at is distinct from old.deleted_at
       or new.deletion_requested_at is distinct from old.deletion_requested_at
       or new.created_at is distinct from old.created_at then
      raise exception 'You cannot change protected account fields' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_columns();

create function private.guard_business_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if tg_op = 'INSERT' then
      if new.verification_status <> 'unverified' or new.status <> 'active'
         or new.verified_at is not null or new.verification_note is not null
         or new.suspended_reason is not null or new.deleted_at is not null then
        raise exception 'New businesses start unverified and active' using errcode = '42501';
      end if;
    else
      if new.owner_id is distinct from old.owner_id
         or new.verification_status is distinct from old.verification_status
         or new.verification_note is distinct from old.verification_note
         or new.verified_at is distinct from old.verified_at
         or new.status is distinct from old.status
         or new.suspended_reason is distinct from old.suspended_reason
         or new.created_at is distinct from old.created_at then
        raise exception 'Verification and suspension are managed by marketplace administrators'
          using errcode = '42501';
      end if;
      -- Only the owner may soft-delete the business.
      if new.deleted_at is distinct from old.deleted_at and old.owner_id <> (select auth.uid()) then
        raise exception 'Only the business owner can close the business' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger businesses_guard before insert or update on public.businesses
  for each row execute function private.guard_business_columns();

create function private.guard_verification_request_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if tg_op = 'INSERT' then
      if new.status <> 'pending_review' or new.reviewer_id is not null
         or new.reviewer_note is not null or new.reviewed_at is not null then
        raise exception 'Verification requests start pending review' using errcode = '42501';
      end if;
    else
      raise exception 'Verification requests cannot be edited after submission' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger bvr_guard before insert or update on public.business_verification_requests
  for each row execute function private.guard_verification_request_columns();

-- ---------------------------------------------------------------------------
-- Automatic rows
-- ---------------------------------------------------------------------------

-- New auth user → profile + default self-service role. Metadata is user-controlled,
-- so only the three self-service roles are ever honoured here.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role := 'buyer';
  v_requested text := new.raw_user_meta_data ->> 'intended_role';
begin
  if v_requested in ('buyer', 'supplier', 'logistics_provider') then
    v_role := v_requested::public.app_role;
  end if;

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;

  insert into public.role_assignments (user_id, role) values (new.id, v_role)
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profiles.email in sync when the user confirms a new address.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- New business → owner membership.
create function private.handle_new_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_memberships (business_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (business_id, user_id) do update set role = 'owner';
  return new;
end;
$$;
create trigger on_business_created after insert on public.businesses
  for each row execute function private.handle_new_business();

grant execute on function private.has_role(public.app_role) to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_agency_analyst() to anon, authenticated;
grant execute on function private.is_active_user() to anon, authenticated;
grant execute on function private.is_business_member(uuid) to anon, authenticated;
grant execute on function private.is_business_manager(uuid) to anon, authenticated;
grant execute on function private.business_is_active(uuid) to anon, authenticated;
