-- =============================================================================
-- BlueMarket Nigeria — 0500 commerce: enquiries, quotations, orders, payments
-- All money columns are integer minor units (kobo for NGN).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enquiries and messages (customer communication)
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id                       uuid primary key default gen_random_uuid(),
  buyer_id                 uuid not null references public.profiles (id),
  buyer_business_id        uuid references public.businesses (id) on delete set null,
  supplier_business_id     uuid not null references public.businesses (id) on delete cascade,
  product_id               uuid references public.products (id) on delete set null,
  kind                     public.enquiry_kind not null default 'general',
  subject                  text not null check (char_length(subject) between 3 and 150),
  message                  text not null check (char_length(message) between 1 and 4000),
  requested_quantity       numeric(14,3) check (requested_quantity is null or requested_quantity > 0),
  requested_delivery_date  date,
  delivery_state           text references public.regions (code),
  status                   public.enquiry_status not null default 'open',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  closed_at                timestamptz,
  constraint enquiries_not_self check (buyer_business_id is distinct from supplier_business_id)
);
alter table public.enquiries enable row level security;
create index enquiries_buyer_idx on public.enquiries (buyer_id, created_at desc);
create index enquiries_supplier_idx on public.enquiries (supplier_business_id, status, created_at desc);
create trigger enquiries_updated_at before update on public.enquiries
  for each row execute function private.set_updated_at();

create table public.enquiry_messages (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid not null references public.enquiries (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id),
  body        text not null check (char_length(body) between 1 and 4000),
  created_at  timestamptz not null default now()
);
alter table public.enquiry_messages enable row level security;
create index enquiry_messages_enquiry_idx on public.enquiry_messages (enquiry_id, created_at);

create function private.is_enquiry_party(p_enquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enquiries e
    where e.id = p_enquiry_id
      and (e.buyer_id = (select auth.uid()) or private.is_business_member(e.supplier_business_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Quotations (supplier offers in response to an enquiry)
-- ---------------------------------------------------------------------------
create table public.quotations (
  id                    uuid primary key default gen_random_uuid(),
  enquiry_id            uuid not null references public.enquiries (id) on delete cascade,
  supplier_business_id  uuid not null references public.businesses (id) on delete cascade,
  buyer_id              uuid not null references public.profiles (id),
  product_id            uuid references public.products (id) on delete set null,
  item_description      text not null check (char_length(item_description) between 3 and 200),
  unit                  text not null check (unit in ('kg', 'tonne', 'crate', 'carton', 'basket', 'piece', 'dozen', 'litre', 'bag', 'pack')),
  unit_price_minor      bigint not null check (unit_price_minor > 0),
  quantity              numeric(14,3) not null check (quantity > 0),
  delivery_fee_minor    bigint not null default 0 check (delivery_fee_minor >= 0),
  currency              char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  delivery_terms        text check (char_length(delivery_terms) <= 1000),
  valid_until           date not null,
  status                public.quotation_status not null default 'sent',
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  responded_at          timestamptz,
  order_id              uuid
);
alter table public.quotations enable row level security;
create index quotations_enquiry_idx on public.quotations (enquiry_id, created_at desc);
create index quotations_buyer_idx on public.quotations (buyer_id, status);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id                      uuid primary key default gen_random_uuid(),
  order_number            text not null unique,
  buyer_id                uuid not null references public.profiles (id),
  buyer_business_id       uuid references public.businesses (id) on delete set null,
  seller_business_id      uuid not null references public.businesses (id),
  quotation_id            uuid references public.quotations (id) on delete set null,
  status                  public.order_status not null default 'requested',
  currency                char(3) not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor          bigint not null check (subtotal_minor >= 0),
  delivery_fee_minor      bigint not null default 0 check (delivery_fee_minor >= 0),
  marketplace_fee_minor   bigint not null default 0 check (marketplace_fee_minor >= 0),
  tax_minor               bigint not null default 0 check (tax_minor >= 0),
  total_minor             bigint not null check (total_minor >= 0),
  marketplace_fee_bps     integer not null default 0 check (marketplace_fee_bps between 0 and 5000),
  tax_bps                 integer not null default 0 check (tax_bps between 0 and 5000),
  delivery_method         text not null check (delivery_method in ('pickup', 'seller_delivery', 'third_party_logistics')),
  delivery_address        text check (char_length(delivery_address) <= 500),
  delivery_state          text references public.regions (code),
  delivery_terms          text check (char_length(delivery_terms) <= 1000),
  expected_delivery_date  date,
  buyer_note              text check (char_length(buyer_note) <= 1000),
  seller_note             text check (char_length(seller_note) <= 1000),
  rejection_reason        text check (char_length(rejection_reason) <= 1000),
  cancellation_reason     text check (char_length(cancellation_reason) <= 1000),
  payment_provider        public.payment_provider,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  placed_at               timestamptz,
  accepted_at             timestamptz,
  paid_at                 timestamptz,
  delivered_at            timestamptz,
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  constraint orders_total_is_sum check (
    total_minor = subtotal_minor + delivery_fee_minor + marketplace_fee_minor + tax_minor
  )
);
alter table public.orders enable row level security;
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_business_id, status, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

alter table public.quotations
  add constraint quotations_order_fk foreign key (order_id) references public.orders (id) on delete set null;

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  product_name      text not null check (char_length(product_name) <= 200),
  unit              text not null,
  unit_price_minor  bigint not null check (unit_price_minor > 0),
  quantity          numeric(14,3) not null check (quantity > 0),
  line_total_minor  bigint not null check (line_total_minor >= 0),
  constraint order_items_line_total check (line_total_minor = round(unit_price_minor * quantity))
);
alter table public.order_items enable row level security;
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_kind   text not null check (actor_kind in ('buyer', 'seller', 'admin', 'system')),
  note         text check (char_length(note) <= 1000),
  created_at   timestamptz not null default now()
);
alter table public.order_status_history enable row level security;
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create function private.is_order_participant(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = (select auth.uid()) or private.is_business_member(o.seller_business_id))
  );
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references public.orders (id) on delete restrict,
  provider                 public.payment_provider not null,
  reference                text not null unique check (char_length(reference) between 6 and 100),
  amount_minor             bigint not null check (amount_minor > 0),
  currency                 char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status                   public.payment_status not null default 'initialized',
  provider_transaction_id  text check (char_length(provider_transaction_id) <= 100),
  provider_fee_minor       bigint check (provider_fee_minor is null or provider_fee_minor >= 0),
  channel                  text check (char_length(channel) <= 40),
  failure_reason           text check (char_length(failure_reason) <= 300),
  refunded_amount_minor    bigint not null default 0 check (refunded_amount_minor >= 0),
  refund_reference         text check (char_length(refund_reference) <= 100),
  reconciliation_status    public.reconciliation_status not null default 'unreconciled',
  note                     text check (char_length(note) <= 500),
  initiated_by             uuid references public.profiles (id) on delete set null,
  verified_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint payment_refund_not_more_than_amount check (refunded_amount_minor <= amount_minor)
);
alter table public.payment_transactions enable row level security;
create index payment_transactions_order_idx on public.payment_transactions (order_id);
create unique index payment_transactions_one_success_per_order
  on public.payment_transactions (order_id) where status = 'succeeded';
create trigger payment_transactions_updated_at before update on public.payment_transactions
  for each row execute function private.set_updated_at();

-- Idempotency ledger for provider webhooks. Only minimal metadata is retained.
create table public.payment_webhook_events (
  id                 bigint generated always as identity primary key,
  provider           public.payment_provider not null,
  event_key          text not null check (char_length(event_key) <= 200),
  event_type         text not null check (char_length(event_type) <= 80),
  reference          text check (char_length(reference) <= 100),
  signature_valid    boolean not null,
  payload_sha256     text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  received_at        timestamptz not null default now(),
  processed_at       timestamptz,
  processing_result  text check (char_length(processing_result) <= 300),
  unique (provider, event_key)
);
alter table public.payment_webhook_events enable row level security;
create index payment_webhook_events_reference_idx on public.payment_webhook_events (reference);

grant execute on function private.is_enquiry_party(uuid) to anon, authenticated;
grant execute on function private.is_order_participant(uuid) to anon, authenticated;
