-- RLS isolation, protected columns and privileged-role rules.
begin;

-- ---------------------------------------------------------------- anonymous
set role anon;
select tests.anon();

select tests.eq(tests.count('select * from public.products'), 4::bigint, 'guests see only the 4 published demo listings');
select tests.eq(tests.count($$select * from public.products where status <> 'published'$$), 0::bigint, 'guests never see drafts');
select tests.ok(tests.count('select * from public.categories') >= 7, 'guests can read categories');
select tests.ok(tests.count('select * from public.businesses') >= 3, 'guests can read public business profiles');
select tests.throws('select * from public.profiles', 'guests cannot read profiles', 'permission denied');
select tests.throws('select * from public.business_private_details', 'guests cannot read private business details', 'permission denied');
select tests.throws('select * from public.orders', 'guests cannot read orders', 'permission denied');
select tests.throws($$insert into public.products (business_id, category_id, name, description, product_state, price_minor, unit, available_quantity, location_state)
  select biz_coop, (select id from public.categories limit 1), 'Anon fish', 'not allowed at all', 'fresh', 100, 'kg', 1, 'LA' from tests.ids$$,
  'guests cannot create listings', 'permission denied');
select tests.eq((select count(*) from public.get_business_contact((select biz_coop from tests.ids))), 1::bigint,
  'public contact details visible when the business opts in');
select tests.eq((select count(*) from public.get_business_contact((select biz_farm from tests.ids))), 0::bigint,
  'contact details hidden when the business keeps them private');
select tests.eq(tests.count($$select * from public.platform_settings where key = 'analytics_min_group_size'$$), 0::bigint,
  'private platform settings are hidden from guests');
select tests.throws($$select public.admin_overview()$$, 'guests cannot run admin reports', 'permission denied');

-- ---------------------------------------------------------------- buyer
reset role;
set role authenticated;
select tests.login((select buyer from tests.ids));

select tests.eq(tests.count('select * from public.profiles'), 1::bigint, 'a user sees only their own profile');
select tests.throws($$update public.profiles set account_status = 'active' where id = auth.uid()$$,
  'users cannot change their own account status', 'permission denied');
select tests.eq(tests.affected($$update public.profiles set full_name = 'Renamed' where id = (select buyer2 from tests.ids)$$), 0::bigint,
  'users cannot edit another profile');
select tests.eq(tests.affected($$update public.profiles set full_name = 'Halima (edited)' where id = auth.uid()$$), 1::bigint,
  'users can edit their own name');

select tests.throws($$insert into public.role_assignments (user_id, role) values (auth.uid(), 'admin')$$,
  'users cannot grant themselves admin', 'row-level security');
select tests.throws($$insert into public.role_assignments (user_id, role) values (auth.uid(), 'agency_analyst')$$,
  'users cannot grant themselves agency analyst', 'row-level security');
select tests.eq(tests.affected($$insert into public.role_assignments (user_id, role) values (auth.uid(), 'supplier')$$), 1::bigint,
  'users can add the supplier role themselves');
select tests.throws($$select public.complete_onboarding('Halima', null, array['admin']::public.app_role[], true)$$,
  'onboarding cannot grant privileged roles', 'administrator');
select tests.throws($$select public.grant_privileged_role(auth.uid(), 'admin')$$,
  'non-admins cannot call grant_privileged_role', 'administrators only');

select tests.throws($$insert into public.businesses (owner_id, name, slug, state_code, verification_status)
  values (auth.uid(), 'Self Verified Ltd', 'self-verified', 'LA', 'verified')$$,
  'a new business cannot start verified', 'unverified');
select tests.throws($$insert into public.businesses (owner_id, name, slug, state_code)
  values ((select supplier from tests.ids), 'Spoofed owner', 'spoofed-owner', 'LA')$$,
  'a business cannot be created for someone else', 'row-level security');

select tests.eq(tests.count('select * from public.business_private_details'), 0::bigint,
  'buyers cannot read other businesses'' private details');
select tests.eq(tests.affected($$update public.products set price_minor = 1 where id = (select p_catfish from tests.ids)$$), 0::bigint,
  'buyers cannot edit listings');
select tests.eq(tests.count('select * from public.orders'), 0::bigint, 'buyer starts with no visible orders');
select tests.eq(tests.count('select * from public.audit_logs'), 0::bigint, 'non-admins cannot read the audit log');
select tests.throws($$select public.agency_overview()$$, 'buyers cannot read agency analytics', 'agency analysts');
select tests.throws($$select public.supplier_insights((select biz_farm from tests.ids))$$, 'buyers cannot read supplier insights', 'not a member');

-- notifications: only is_read is updatable
select tests.throws($$update public.notifications set title = 'spoof'$$, 'notification text cannot be changed', 'permission denied');

-- ---------------------------------------------------------------- supplier (coop owner)
select tests.login((select supplier from tests.ids));

select tests.eq(tests.count($$select * from public.products where business_id = (select biz_coop from tests.ids)$$), 2::bigint,
  'supplier sees own listings');
select tests.eq(tests.count($$select * from public.products where id = (select p_draft from tests.ids)$$), 0::bigint,
  'supplier cannot see another business''s drafts');
select tests.eq(tests.affected($$update public.products set price_minor = 1 where id = (select p_catfish from tests.ids)$$), 0::bigint,
  'supplier cannot edit another business''s listing');
select tests.eq(tests.affected($$update public.products set available_quantity = 99 where id = (select p_croaker from tests.ids)$$), 1::bigint,
  'supplier can edit own listing');
select tests.throws($$update public.products set status = 'hidden' where id = (select p_croaker from tests.ids)$$,
  'supplier cannot hide (moderate) a listing', 'moderators');
select tests.throws($$update public.products set view_count = 100000 where id = (select p_croaker from tests.ids)$$,
  'supplier cannot inflate view counts', 'managed by the platform');
select tests.throws($$update public.businesses set verification_status = 'verified' where id = (select biz_coop from tests.ids)$$,
  'supplier cannot change verification status', 'permission denied');
select tests.eq(tests.count('select * from public.business_private_details'), 1::bigint,
  'supplier reads only their own private details');
select tests.ok((public.supplier_insights((select biz_coop from tests.ids)) -> 'listings' ->> 'published')::int = 2,
  'supplier insights use real data');

-- ---------------------------------------------------------------- agency analyst
select tests.login((select analyst from tests.ids));
select tests.eq(tests.count('select * from public.orders'), 0::bigint, 'analysts cannot read orders directly');
select tests.eq(tests.count('select * from public.profiles'), 1::bigint, 'analysts cannot read other people''s profiles');
select tests.eq(tests.count('select * from public.enquiries'), 0::bigint, 'analysts cannot read private enquiries');
select tests.ok(public.agency_overview() ? 'participation', 'analysts can read aggregated agency metrics');
select tests.eq(jsonb_array_length(public.agency_overview() -> 'regional_participation'), 0,
  'regions below the minimum group size are suppressed');
select tests.throws($$select public.admin_overview()$$, 'analysts cannot read the admin console data', 'administrators only');

-- ---------------------------------------------------------------- admin
select tests.login((select admin from tests.ids));
select tests.ok(tests.count('select * from public.profiles') >= 7, 'admins can read profiles');
select tests.ok(public.admin_overview() ? 'orders', 'admins can read the operational overview');
select tests.ok(tests.count('select * from public.audit_logs') >= 1, 'admins can read the audit log (agency report view was audited)');
select tests.throws($$select public.admin_set_account_status(auth.uid(), 'suspended', 'testing self')$$,
  'admins cannot suspend themselves', 'own account');

reset role;
select tests.throws($$delete from public.audit_logs$$, 'audit log rows cannot be deleted even by the owner', 'append-only');

rollback;
