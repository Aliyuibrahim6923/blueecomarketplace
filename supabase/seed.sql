-- =============================================================================
-- BlueMarket Nigeria — DEVELOPMENT SEED DATA
--
-- EVERYTHING IN THIS FILE IS FICTIONAL. Names, businesses, phone numbers,
-- prices and orders are invented for local development and automated tests.
-- Do not load this file into a production or pilot database.
--
-- All demo accounts use the password:  BlueMarket-Dev-2026!
-- =============================================================================

-- Demo users ------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('BlueMarket-Dev-2026!', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', u.full_name, 'intended_role', u.intended_role), now(), now()
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'admin@example.test',     'Demo Admin (fictional)',          'buyer'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'analyst@example.test',   'Demo Agency Analyst (fictional)', 'buyer'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'supplier@example.test',  'Tamuno Briggs (fictional)',       'supplier'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'farmer@example.test',    'Ngozi Okafor (fictional)',        'supplier'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'logistics@example.test', 'Emeka Cold Chain (fictional)',    'logistics_provider'),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'buyer@example.test',     'Halima Restaurant Buyer (fictional)', 'buyer'),
  ('77777777-7777-4777-8777-777777777777'::uuid, 'buyer2@example.test',    'Second Demo Buyer (fictional)',   'buyer')
) as u(id, email, full_name, intended_role)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@example.test'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

update public.profiles set onboarding_completed = true, terms_accepted_at = now(),
  phone = '+2348000000' || right(id::text, 3)
where email like '%@example.test';

-- Privileged roles are bootstrapped here only for local development.
insert into public.role_assignments (user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'agency_analyst')
on conflict do nothing;

-- Demo businesses ---------------------------------------------------------------
insert into public.businesses (id, owner_id, name, slug, description, business_category, is_supplier,
  is_logistics_provider, is_buyer_organisation, state_code, city, service_states, contact_public)
values
  ('a1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333',
   'Ebi Creek Fishers Cooperative (demo)', 'ebi-creek-fishers-demo',
   '[Fictional demo data] A small-scale fishing cooperative used to demonstrate supplier features.',
   'fisher_cooperative', true, false, false, 'RI', 'Bonny', array['RI', 'BY'], true),
  ('a2222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444',
   'Lagoon Fresh Aquaculture (demo)', 'lagoon-fresh-aquaculture-demo',
   '[Fictional demo data] A catfish and tilapia farm used to demonstrate scheduled harvests.',
   'aquaculture_farm', true, false, false, 'LA', 'Epe', array['LA', 'OG'], false),
  ('a3333333-3333-4333-8333-333333333333', '55555555-5555-4555-8555-555555555555',
   'Coastline Cold Chain (demo)', 'coastline-cold-chain-demo',
   '[Fictional demo data] A refrigerated transport and cold-storage provider.',
   'cold_storage', false, true, false, 'LA', 'Apapa', array['LA', 'OG', 'OY'], true),
  ('a4444444-4444-4444-8444-444444444444', '66666666-6666-4666-8666-666666666666',
   'Harbour View Kitchen (demo)', 'harbour-view-kitchen-demo',
   '[Fictional demo data] A restaurant buying business.',
   'hospitality', false, false, true, 'LA', 'Lekki', array['LA'], false)
on conflict (id) do nothing;

insert into public.business_private_details (business_id, street_address, contact_phone, contact_email, whatsapp) values
  ('a1111111-1111-4111-8111-111111111111', '1 Demo Jetty Road (fictional)', '+2348000000101', 'supplier@example.test', '+2348000000101'),
  ('a2222222-2222-4222-8222-222222222222', '2 Demo Pond Lane (fictional)', '+2348000000102', 'farmer@example.test', null),
  ('a3333333-3333-4333-8333-333333333333', '3 Demo Wharf (fictional)', '+2348000000103', 'logistics@example.test', '+2348000000103')
on conflict (business_id) do nothing;

update public.businesses set verification_status = 'verified', verified_at = now(),
  verification_note = 'Demo verification (fictional)'
where id = 'a1111111-1111-4111-8111-111111111111';

-- Demo listings -------------------------------------------------------------------
insert into public.products (id, business_id, category_id, created_by, name, description, product_state, pricing_type,
  price_minor, unit, available_quantity, min_order_quantity, size_grade, packaging, location_state, location_city,
  harvest_date, handling_info, delivery_options, status)
select v.id, v.business_id, c.id, v.created_by, v.name, v.description, v.product_state::public.product_state,
       v.pricing_type::public.pricing_type, v.price_minor, v.unit, v.qty, v.moq, v.size_grade, v.packaging,
       v.state, v.city, v.harvest_date, v.handling, v.delivery, v.status::public.listing_status
from (values
  ('b1111111-1111-4111-8111-111111111111'::uuid, 'a1111111-1111-4111-8111-111111111111'::uuid, 'fresh-fish',
   '33333333-3333-4333-8333-333333333333'::uuid, 'Fresh croaker (demo)',
   '[Fictional demo data] Whole croaker landed this morning and kept on ice.', 'fresh', 'fixed',
   350000::bigint, 'kg', 120.000, 5.000, 'Medium, 400–700 g', 'Iced cooler boxes', 'RI', 'Bonny',
   current_date, 'Kept on flake ice from landing.', array['pickup', 'seller_delivery'], 'published'),
  ('b2222222-2222-4222-8222-222222222222'::uuid, 'a1111111-1111-4111-8111-111111111111'::uuid, 'shellfish',
   '33333333-3333-4333-8333-333333333333'::uuid, 'Periwinkles, bulk (demo)',
   '[Fictional demo data] Live periwinkles by the bag. Price agreed per order volume.', 'live', 'quote_required',
   null, 'bag', 40.000, 1.000, null, '25 kg sacks', 'RI', 'Bonny',
   current_date - 1, null, array['pickup', 'third_party_logistics'], 'published'),
  ('b3333333-3333-4333-8333-333333333333'::uuid, 'a2222222-2222-4222-8222-222222222222'::uuid, 'aquaculture',
   '44444444-4444-4444-8444-444444444444'::uuid, 'Table-size catfish (demo)',
   '[Fictional demo data] Farm-raised catfish, 1–1.5 kg each, harvested to order.', 'live', 'fixed',
   280000::bigint, 'kg', 800.000, 20.000, '1–1.5 kg', 'Aerated drums', 'LA', 'Epe',
   null, 'Transported live in aerated drums.', array['pickup', 'seller_delivery', 'third_party_logistics'], 'published'),
  ('b4444444-4444-4444-8444-444444444444'::uuid, 'a2222222-2222-4222-8222-222222222222'::uuid, 'processed-seafood',
   '44444444-4444-4444-8444-444444444444'::uuid, 'Smoked catfish (demo)',
   '[Fictional demo data] Kiln-smoked catfish, packed in cartons.', 'smoked', 'fixed',
   650000::bigint, 'kg', 60.000, 2.000, null, '10 kg cartons', 'LA', 'Epe',
   null, null, array['pickup', 'seller_delivery'], 'published'),
  ('b5555555-5555-4555-8555-555555555555'::uuid, 'a2222222-2222-4222-8222-222222222222'::uuid, 'frozen-seafood',
   '44444444-4444-4444-8444-444444444444'::uuid, 'Frozen tilapia fillets (draft demo)',
   '[Fictional demo data] Draft listing that is not yet published.', 'frozen', 'fixed',
   420000::bigint, 'kg', 30.000, 5.000, null, '1 kg vacuum packs', 'LA', 'Epe',
   null, 'Store at -18°C.', array['pickup'], 'draft')
) as v(id, business_id, cat, created_by, name, description, product_state, pricing_type, price_minor, unit, qty, moq,
       size_grade, packaging, state, city, harvest_date, handling, delivery, status)
join public.categories c on c.slug = v.cat
on conflict (id) do nothing;

-- Demo logistics service ----------------------------------------------------------------
insert into public.logistics_services (id, business_id, service_type, title, description, coverage_states,
  capacity_description, temperature_range, base_price_minor, pricing_unit, pricing_notes, status, created_by)
values
  ('c1111111-1111-4111-8111-111111111111', 'a3333333-3333-4333-8333-333333333333', 'refrigerated_transport',
   'Reefer van, Lagos–Ogun (demo)', '[Fictional demo data] 3-tonne refrigerated van for fish and seafood.',
   array['LA', 'OG'], 'Up to 3 tonnes per trip', '0°C to 4°C', 4500000, 'per trip',
   'Final price depends on distance and waiting time.', 'published', '55555555-5555-4555-8555-555555555555'),
  ('c2222222-2222-4222-8222-222222222222', 'a3333333-3333-4333-8333-333333333333', 'cold_storage',
   'Blast freezer storage, Apapa (demo)', '[Fictional demo data] Frozen storage by the pallet.',
   array['LA'], '40 pallets', '-18°C', 1500000, 'per pallet per week', null, 'published',
   '55555555-5555-4555-8555-555555555555')
on conflict (id) do nothing;

-- Demo fee so the order totals show a separate marketplace fee (fictional rate).
update public.platform_settings set value = '250' where key = 'marketplace_fee_bps';
