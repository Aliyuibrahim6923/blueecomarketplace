-- =============================================================================
-- BlueMarket Nigeria — 0100 foundation
-- Schemas, enumerated types, reference regions and generic trigger helpers.
-- Rollback: drop schema private cascade; drop the types below (see docs/supabase-setup.md).
-- =============================================================================

-- Internal helpers live in `private`, which is NOT exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('buyer', 'supplier', 'logistics_provider', 'admin', 'agency_analyst');
create type public.account_status as enum ('active', 'suspended', 'deactivated');
create type public.verification_status as enum ('unverified', 'pending_review', 'verified', 'suspended', 'rejected');
create type public.verification_request_status as enum ('pending_review', 'approved', 'rejected', 'changes_requested');
create type public.membership_role as enum ('owner', 'manager', 'staff');
create type public.listing_status as enum ('draft', 'published', 'paused', 'archived', 'hidden');
create type public.product_state as enum ('fresh', 'frozen', 'processed', 'live', 'dried', 'smoked', 'other');
create type public.pricing_type as enum ('fixed', 'quote_required');
create type public.enquiry_kind as enum ('general', 'quote_request');
create type public.enquiry_status as enum ('open', 'responded', 'closed');
create type public.quotation_status as enum ('sent', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.order_status as enum (
  'draft', 'requested', 'accepted', 'rejected', 'awaiting_payment', 'paid',
  'preparing', 'dispatched', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded'
);
create type public.payment_provider as enum ('sandbox', 'offline', 'paystack');
create type public.payment_status as enum ('initialized', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded');
create type public.reconciliation_status as enum ('unreconciled', 'matched', 'mismatch');
create type public.logistics_service_type as enum ('delivery', 'refrigerated_transport', 'cold_storage', 'ice_supply', 'other');
create type public.booking_status as enum ('requested', 'quoted', 'confirmed', 'declined', 'in_progress', 'completed', 'cancelled');
create type public.dispute_category as enum ('non_delivery', 'quality', 'quantity', 'misrepresentation', 'payment', 'cancellation_request', 'other');
create type public.dispute_status as enum ('open', 'under_review', 'awaiting_evidence', 'resolved', 'rejected');
create type public.dispute_outcome as enum ('refund', 'partial_refund', 'complete_order', 'no_action');
create type public.report_target as enum ('product', 'business', 'user', 'logistics_service');
create type public.report_reason as enum ('fraud', 'unsafe_product', 'impersonation', 'misrepresentation', 'counterfeit', 'non_delivery', 'other');
create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type public.review_status as enum ('published', 'hidden');
create type public.notification_channel as enum ('email', 'sms');
create type public.outbox_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- Reference data: Nigerian states + FCT (stable, public)
-- ---------------------------------------------------------------------------
create table public.regions (
  code        text primary key check (code ~ '^[A-Z]{2,3}$'),
  name        text not null unique,
  is_coastal  boolean not null default false,
  sort_order  integer not null default 0
);
alter table public.regions enable row level security;

insert into public.regions (code, name, is_coastal, sort_order) values
  ('AB', 'Abia', false, 1), ('AD', 'Adamawa', false, 2), ('AK', 'Akwa Ibom', true, 3),
  ('AN', 'Anambra', false, 4), ('BA', 'Bauchi', false, 5), ('BY', 'Bayelsa', true, 6),
  ('BE', 'Benue', false, 7), ('BO', 'Borno', false, 8), ('CR', 'Cross River', true, 9),
  ('DE', 'Delta', true, 10), ('EB', 'Ebonyi', false, 11), ('ED', 'Edo', false, 12),
  ('EK', 'Ekiti', false, 13), ('EN', 'Enugu', false, 14), ('FC', 'Federal Capital Territory', false, 15),
  ('GO', 'Gombe', false, 16), ('IM', 'Imo', false, 17), ('JI', 'Jigawa', false, 18),
  ('KD', 'Kaduna', false, 19), ('KN', 'Kano', false, 20), ('KT', 'Katsina', false, 21),
  ('KE', 'Kebbi', false, 22), ('KO', 'Kogi', false, 23), ('KW', 'Kwara', false, 24),
  ('LA', 'Lagos', true, 25), ('NA', 'Nasarawa', false, 26), ('NI', 'Niger', false, 27),
  ('OG', 'Ogun', true, 28), ('ON', 'Ondo', true, 29), ('OS', 'Osun', false, 30),
  ('OY', 'Oyo', false, 31), ('PL', 'Plateau', false, 32), ('RI', 'Rivers', true, 33),
  ('SO', 'Sokoto', false, 34), ('TA', 'Taraba', false, 35), ('YO', 'Yobe', false, 36),
  ('ZA', 'Zamfara', false, 37);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

-- Maintains updated_at on every table that has one.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the statement is being executed directly by an API client
-- (anon / authenticated). Inside SECURITY DEFINER functions current_user is the
-- function owner, so business-rule RPCs are not treated as client writes.
-- Protected-column triggers are SECURITY INVOKER so this reflects the caller.
create function private.is_client_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- Safe uuid parse for storage paths: returns null instead of raising.
create function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- Slug helper used when the client does not supply one.
create function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

grant execute on function private.is_client_role() to anon, authenticated;
grant execute on function private.try_uuid(text) to anon, authenticated;
grant execute on function private.slugify(text) to anon, authenticated;
