-- =============================================================================
-- BlueMarket Nigeria — 0400 catalogue: categories, products, images, saved
-- =============================================================================

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.categories (id) on delete restrict,
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(name) between 2 and 80),
  description  text check (char_length(description) <= 500),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.categories enable row level security;
create trigger categories_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row_change();

-- Starter categories (reference data; editable by administrators).
insert into public.categories (slug, name, description, sort_order) values
  ('fresh-fish', 'Fresh fish', 'Whole or gutted fish landed recently and kept chilled.', 1),
  ('frozen-seafood', 'Frozen seafood', 'Fish and seafood frozen for storage and transport.', 2),
  ('aquaculture', 'Aquaculture', 'Farmed fish such as catfish and tilapia, including live and table-size stock.', 3),
  ('shellfish', 'Shellfish and crustaceans', 'Prawns, shrimps, crabs, lobsters, periwinkles, oysters and clams.', 4),
  ('processed-seafood', 'Processed seafood', 'Smoked, dried, salted or otherwise processed marine products.', 5),
  ('fingerlings-and-inputs', 'Fingerlings and inputs', 'Fingerlings, juveniles and other approved aquaculture inputs.', 6),
  ('other-marine-products', 'Other marine products', 'Other approved marine and coastal products.', 7);

-- ---------------------------------------------------------------------------
-- products (listings)
-- ---------------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,
  category_id         uuid not null references public.categories (id),
  created_by          uuid references public.profiles (id) on delete set null,
  name                text not null check (char_length(name) between 3 and 120),
  description         text not null check (char_length(description) between 10 and 4000),
  product_state       public.product_state not null,
  pricing_type        public.pricing_type not null default 'fixed',
  price_minor         bigint check (price_minor is null or price_minor > 0),
  currency            char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  unit                text not null check (unit in ('kg', 'tonne', 'crate', 'carton', 'basket', 'piece', 'dozen', 'litre', 'bag', 'pack')),
  available_quantity  numeric(14,3) not null check (available_quantity >= 0),
  min_order_quantity  numeric(14,3) not null default 1 check (min_order_quantity > 0),
  size_grade          text check (char_length(size_grade) <= 80),
  packaging           text check (char_length(packaging) <= 120),
  location_state      text not null references public.regions (code),
  location_city       text check (char_length(location_city) <= 80),
  available_from      date not null default current_date,
  harvest_date        date,
  handling_info       text check (char_length(handling_info) <= 1000),
  delivery_options    text[] not null default array['pickup']::text[]
                        check (cardinality(delivery_options) > 0
                               and delivery_options <@ array['pickup', 'seller_delivery', 'third_party_logistics']::text[]),
  certification_info  text check (char_length(certification_info) <= 1000),
  status              public.listing_status not null default 'draft',
  moderation_note     text check (char_length(moderation_note) <= 1000),
  published_at        timestamptz,
  expires_at          timestamptz,
  view_count          bigint not null default 0 check (view_count >= 0),
  search_vector       tsvector generated always as (
                        setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
                        setweight(to_tsvector('english'::regconfig, coalesce(size_grade, '') || ' ' || coalesce(packaging, '')), 'B') ||
                        setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
                      ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint products_price_matches_pricing check (
    (pricing_type = 'fixed' and price_minor is not null)
    or (pricing_type = 'quote_required' and price_minor is null)
  )
);
alter table public.products enable row level security;
create index products_business_idx on public.products (business_id, status);
create index products_public_idx on public.products (status, expires_at, published_at desc) where deleted_at is null;
create index products_category_idx on public.products (category_id) where status = 'published';
create index products_state_idx on public.products (location_state) where status = 'published';
create index products_price_idx on public.products (price_minor) where status = 'published';
create index products_search_idx on public.products using gin (search_vector);
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- Can this business publish listings right now?
create function private.business_can_sell(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.is_supplier
      and b.status = 'active'
      and b.deleted_at is null
      and (not private.setting_bool('verification_required_to_publish', false) or b.verification_status = 'verified')
  );
$$;

create function private.guard_product_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ttl integer := private.setting_int('listing_default_ttl_days', 14);
begin
  if private.is_client_role() then
    if tg_op = 'UPDATE' then
      if new.business_id is distinct from old.business_id
         or new.created_by is distinct from old.created_by
         or new.created_at is distinct from old.created_at
         or new.view_count is distinct from old.view_count
         or new.moderation_note is distinct from old.moderation_note
         or new.published_at is distinct from old.published_at
         or new.expires_at is distinct from old.expires_at then
        raise exception 'That listing field is managed by the platform' using errcode = '42501';
      end if;
      if old.status = 'hidden' and new.status is distinct from old.status then
        raise exception 'This listing was hidden by a moderator. Contact support to appeal.' using errcode = '42501';
      end if;
    else
      if new.view_count <> 0 or new.moderation_note is not null
         or new.published_at is not null or new.expires_at is not null then
        raise exception 'That listing field is managed by the platform' using errcode = '42501';
      end if;
    end if;

    if new.status = 'hidden' and (tg_op = 'INSERT' or old.status <> 'hidden') then
      raise exception 'Only moderators can hide listings' using errcode = '42501';
    end if;
  end if;

  -- Publishing rules apply to everyone.
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if not private.business_can_sell(new.business_id) then
      raise exception 'This business cannot publish listings yet (must be an active supplier%).',
        case when private.setting_bool('verification_required_to_publish', false) then ' and verified' else '' end
        using errcode = '42501';
    end if;
    new.published_at := now();
    new.expires_at := now() + make_interval(days => v_ttl);
  end if;

  return new;
end;
$$;
create trigger products_guard before insert or update on public.products
  for each row execute function private.guard_product_columns();

create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null unique check (char_length(storage_path) <= 300),
  alt_text      text check (char_length(alt_text) <= 200),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.product_images enable row level security;
create index product_images_product_idx on public.product_images (product_id, sort_order);

create function private.enforce_image_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id)
     >= private.setting_int('max_listing_images', 6) then
    raise exception 'A listing can have at most % photos', private.setting_int('max_listing_images', 6);
  end if;
  return new;
end;
$$;
create trigger product_images_limit before insert on public.product_images
  for each row execute function private.enforce_image_limit();

create table public.saved_products (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.saved_products enable row level security;

grant execute on function private.business_can_sell(uuid) to anon, authenticated;
