-- =============================================================================
-- BlueMarket Nigeria — 1000 marketplace search, supplier insights, admin and
-- agency analytics. GMV and marketplace revenue are always reported separately.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Public product search. SECURITY INVOKER: RLS on products/businesses applies.
-- ---------------------------------------------------------------------------
create function public.search_products(
  p_query text default null,
  p_category_slug text default null,
  p_state text default null,
  p_product_state public.product_state default null,
  p_min_price_minor bigint default null,
  p_max_price_minor bigint default null,
  p_verified_only boolean default false,
  p_delivery_option text default null,
  p_fixed_price_only boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  description text,
  product_state public.product_state,
  pricing_type public.pricing_type,
  price_minor bigint,
  currency char(3),
  unit text,
  available_quantity numeric,
  min_order_quantity numeric,
  location_state text,
  location_city text,
  available_from date,
  delivery_options text[],
  published_at timestamptz,
  expires_at timestamptz,
  category_slug text,
  category_name text,
  business_id uuid,
  business_name text,
  business_slug text,
  business_verification public.verification_status,
  cover_image_path text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select case when nullif(trim(p_query), '') is null then null
                else websearch_to_tsquery('english', left(trim(p_query), 100)) end as tsq,
           nullif(trim(left(p_query, 100)), '') as raw
  ),
  matches as (
    select p.*, c.slug as c_slug, c.name as c_name, b.name as b_name, b.slug as b_slug,
           b.verification_status as b_verification,
           case when q.tsq is null then 0 else ts_rank(p.search_vector, q.tsq) end as rank
    from public.products p
    join public.categories c on c.id = p.category_id
    join public.businesses b on b.id = p.business_id
    cross join q
    where p.status = 'published'
      and p.deleted_at is null
      and (p.expires_at is null or p.expires_at > now())
      and b.status = 'active' and b.deleted_at is null
      and (q.raw is null
           or p.search_vector @@ q.tsq
           or b.name ilike '%' || replace(replace(replace(q.raw, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           or p.name ilike '%' || replace(replace(replace(q.raw, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      and (p_category_slug is null or c.slug = p_category_slug)
      and (p_state is null or p.location_state = p_state)
      and (p_product_state is null or p.product_state = p_product_state)
      and (p_min_price_minor is null or p.price_minor >= p_min_price_minor)
      and (p_max_price_minor is null or p.price_minor <= p_max_price_minor)
      and (not coalesce(p_verified_only, false) or b.verification_status = 'verified')
      and (p_delivery_option is null or p_delivery_option = any (p.delivery_options))
      and (not coalesce(p_fixed_price_only, false) or p.pricing_type = 'fixed')
  )
  select m.id, m.name, m.description, m.product_state, m.pricing_type, m.price_minor, m.currency, m.unit,
         m.available_quantity, m.min_order_quantity, m.location_state, m.location_city, m.available_from,
         m.delivery_options, m.published_at, m.expires_at, m.c_slug, m.c_name, m.business_id, m.b_name, m.b_slug,
         m.b_verification,
         (select i.storage_path from public.product_images i where i.product_id = m.id order by i.sort_order, i.created_at limit 1),
         count(*) over ()
  from matches m
  order by
    case when p_sort = 'price_asc' then m.price_minor end asc nulls last,
    case when p_sort = 'price_desc' then m.price_minor end desc nulls last,
    case when p_sort = 'relevance' then m.rank end desc,
    m.published_at desc,
    m.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- Supplier insights (members of the business only)
-- ---------------------------------------------------------------------------
create function public.supplier_insights(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not (private.is_business_member(p_business_id) or private.is_admin()) then
    raise exception 'Not a member of this business' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'listings', jsonb_build_object(
      'published', count(*) filter (where p.status = 'published' and (p.expires_at is null or p.expires_at > now())),
      'expired', count(*) filter (where p.status = 'published' and p.expires_at <= now()),
      'draft', count(*) filter (where p.status = 'draft'),
      'paused', count(*) filter (where p.status = 'paused'),
      'hidden', count(*) filter (where p.status = 'hidden')),
    'orders', (select jsonb_build_object(
        'requested', count(*) filter (where o.status = 'requested'),
        'in_progress', count(*) filter (where o.status in ('accepted', 'awaiting_payment', 'paid', 'preparing', 'dispatched', 'delivered')),
        'completed', count(*) filter (where o.status = 'completed'),
        'cancelled_or_rejected', count(*) filter (where o.status in ('cancelled', 'rejected')),
        'disputed', count(*) filter (where o.status = 'disputed'),
        'completed_value_minor', coalesce(sum(o.subtotal_minor) filter (where o.status = 'completed'), 0),
        'last_30_days_value_minor', coalesce(sum(o.subtotal_minor) filter (
            where o.status = 'completed' and o.completed_at > now() - interval '30 days'), 0))
      from public.orders o where o.seller_business_id = p_business_id),
    'open_enquiries', (select count(*) from public.enquiries e where e.supplier_business_id = p_business_id and e.status <> 'closed'),
    'average_rating', (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.business_id = p_business_id and r.status = 'published'),
    'review_count', (select count(*) from public.reviews r where r.business_id = p_business_id and r.status = 'published'),
    'top_products', coalesce((
      select jsonb_agg(t order by t.orders desc, t.views desc) from (
        select p2.id, p2.name, p2.view_count as views,
               (select count(*) from public.saved_products s where s.product_id = p2.id) as saves,
               (select count(*) from public.enquiries e where e.product_id = p2.id) as enquiries,
               (select count(distinct oi.order_id) from public.order_items oi where oi.product_id = p2.id) as orders
        from public.products p2
        where p2.business_id = p_business_id and p2.deleted_at is null and p2.status <> 'archived'
        order by p2.view_count desc limit 10) t), '[]'::jsonb)
  ) into v
  from public.products p
  where p.business_id = p_business_id and p.deleted_at is null;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin operational overview
-- ---------------------------------------------------------------------------
create function public.admin_overview(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles where deleted_at is null),
      'new_in_period', (select count(*) from public.profiles where created_at between p_from and p_to),
      'suspended', (select count(*) from public.profiles where account_status = 'suspended'),
      'deletion_requests', (select count(*) from public.profiles where deletion_requested_at is not null and deleted_at is null)),
    'businesses', jsonb_build_object(
      'total', (select count(*) from public.businesses where deleted_at is null),
      'suppliers', (select count(*) from public.businesses where deleted_at is null and is_supplier),
      'logistics', (select count(*) from public.businesses where deleted_at is null and is_logistics_provider),
      'verified', (select count(*) from public.businesses where deleted_at is null and verification_status = 'verified'),
      'pending_verification', (select count(*) from public.business_verification_requests where status = 'pending_review')),
    'listings', jsonb_build_object(
      'published', (select count(*) from public.products where status = 'published' and deleted_at is null and (expires_at is null or expires_at > now())),
      'hidden', (select count(*) from public.products where status = 'hidden'),
      'open_reports', (select count(*) from public.content_reports where status in ('open', 'reviewing'))),
    'orders', (select jsonb_build_object(
        'placed', count(*),
        'completed', count(*) filter (where status = 'completed'),
        'cancelled', count(*) filter (where status in ('cancelled', 'rejected')),
        'disputed', count(*) filter (where status = 'disputed'),
        'gmv_completed_minor', coalesce(sum(subtotal_minor + delivery_fee_minor) filter (where status = 'completed'), 0),
        'marketplace_revenue_minor', coalesce(sum(marketplace_fee_minor) filter (where status = 'completed'), 0),
        'refunded_minor', coalesce(sum(total_minor) filter (where status = 'refunded'), 0))
      from public.orders where placed_at between p_from and p_to),
    'payments', (select jsonb_build_object(
        'succeeded_real', count(*) filter (where status = 'succeeded' and provider <> 'sandbox'),
        'succeeded_sandbox', count(*) filter (where status = 'succeeded' and provider = 'sandbox'),
        'failed', count(*) filter (where status = 'failed'),
        'mismatched', count(*) filter (where reconciliation_status = 'mismatch'),
        'unreconciled_offline', count(*) filter (where provider = 'offline' and reconciliation_status = 'unreconciled'),
        'provider_fees_minor', coalesce(sum(provider_fee_minor), 0))
      from public.payment_transactions where created_at between p_from and p_to),
    'disputes', jsonb_build_object(
      'open', (select count(*) from public.disputes where status in ('open', 'under_review', 'awaiting_evidence')),
      'resolved_in_period', (select count(*) from public.disputes where resolved_at between p_from and p_to)),
    'support', jsonb_build_object('open', (select count(*) from public.support_requests where status = 'open'))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Agency analytics: aggregates only, with small-group suppression.
-- Sandbox payments are excluded from GMV and revenue.
-- ---------------------------------------------------------------------------
create function public.agency_overview(p_from timestamptz default now() - interval '90 days', p_to timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_k integer := private.setting_int('analytics_min_group_size', 5);
begin
  if not (private.is_agency_analyst() or private.is_admin()) then
    raise exception 'Agency analysts and administrators only' using errcode = '42501';
  end if;

  perform private.audit('agency_report_viewed', 'analytics', 'agency_overview',
    jsonb_build_object('from', p_from, 'to', p_to));

  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'min_group_size', v_k,
    'participation', jsonb_build_object(
      'registered_businesses', (select count(*) from public.businesses where deleted_at is null),
      'active_businesses', (select count(distinct x.business_id) from (
          select seller_business_id as business_id from public.orders where placed_at between p_from and p_to
          union select business_id from public.products where published_at between p_from and p_to) x),
      'verified_suppliers', (select count(*) from public.businesses where deleted_at is null and is_supplier and verification_status = 'verified'),
      'logistics_providers', (select count(*) from public.businesses where deleted_at is null and is_logistics_provider),
      'published_listings', (select count(*) from public.products where status = 'published' and deleted_at is null and (expires_at is null or expires_at > now()))),
    'transactions', (select jsonb_build_object(
        'orders_placed', count(*),
        'orders_completed', count(*) filter (where o.status = 'completed'),
        'gmv_minor', coalesce(sum(o.subtotal_minor + o.delivery_fee_minor) filter (where o.status = 'completed'), 0),
        'marketplace_revenue_minor', coalesce(sum(o.marketplace_fee_minor) filter (where o.status = 'completed'), 0),
        'cancellation_rate', case when count(*) = 0 then null
          else round((count(*) filter (where o.status in ('cancelled', 'rejected')))::numeric / count(*), 4) end,
        'dispute_rate', case when count(*) = 0 then null
          else round((select count(*) from public.disputes d join public.orders o2 on o2.id = d.order_id
                       where o2.placed_at between p_from and p_to)::numeric / count(*), 4) end)
      from public.orders o
      where o.placed_at between p_from and p_to
        and coalesce(o.payment_provider, 'offline') <> 'sandbox'),
    'regional_participation', coalesce((
      select jsonb_agg(jsonb_build_object('state', r.name, 'businesses', x.n, 'suppliers', x.s) order by x.n desc)
      from (select state_code, count(*) as n, count(*) filter (where is_supplier) as s
            from public.businesses where deleted_at is null group by state_code
            having count(*) >= v_k) x
      join public.regions r on r.code = x.state_code), '[]'::jsonb),
    'regions_suppressed', (select count(*) from (
        select state_code from public.businesses where deleted_at is null group by state_code having count(*) < v_k) s),
    'category_availability', coalesce((
      select jsonb_agg(jsonb_build_object('category', c.name, 'listings', x.n, 'suppliers', x.suppliers,
                                          'median_price_per_kg_minor', x.median_kg) order by x.n desc)
      from (select p.category_id, count(*) as n, count(distinct p.business_id) as suppliers,
                   case when count(distinct p.business_id) filter (where p.unit = 'kg' and p.price_minor is not null) >= v_k
                        then percentile_cont(0.5) within group (order by p.price_minor) filter (where p.unit = 'kg')::bigint end as median_kg
            from public.products p
            where p.status = 'published' and p.deleted_at is null and (p.expires_at is null or p.expires_at > now())
            group by p.category_id) x
      join public.categories c on c.id = x.category_id), '[]'::jsonb),
    'price_trend_weekly', coalesce((
      select jsonb_agg(jsonb_build_object('week', t.week, 'category', t.category, 'median_price_per_kg_minor', t.median) order by t.week, t.category)
      from (select date_trunc('week', o.completed_at)::date as week, c.name as category,
                   percentile_cont(0.5) within group (order by oi.unit_price_minor)::bigint as median
            from public.order_items oi
            join public.orders o on o.id = oi.order_id
            join public.products p on p.id = oi.product_id
            join public.categories c on c.id = p.category_id
            where o.status = 'completed' and oi.unit = 'kg' and o.completed_at between p_from and p_to
              and coalesce(o.payment_provider, 'offline') <> 'sandbox'
            group by 1, 2
            having count(distinct o.seller_business_id) >= v_k) t), '[]'::jsonb),
    'logistics_utilisation', (select jsonb_build_object(
        'bookings_requested', count(*),
        'bookings_completed', count(*) filter (where status = 'completed'),
        'by_service_type', coalesce((select jsonb_object_agg(service_type, n) from (
            select s.service_type, count(*) as n from public.logistics_bookings lb
            join public.logistics_services s on s.id = lb.service_id
            where lb.created_at between p_from and p_to group by s.service_type) y), '{}'::jsonb))
      from public.logistics_bookings where created_at between p_from and p_to)
  );
end;
$$;

revoke all on function public.search_products(text, text, text, public.product_state, bigint, bigint, boolean, text, boolean, text, integer, integer) from public;
revoke all on function public.supplier_insights(uuid) from public;
revoke all on function public.admin_overview(timestamptz, timestamptz) from public;
revoke all on function public.agency_overview(timestamptz, timestamptz) from public;

grant execute on function public.search_products(text, text, text, public.product_state, bigint, bigint, boolean, text, boolean, text, integer, integer) to anon, authenticated;
grant execute on function public.supplier_insights(uuid) to authenticated;
grant execute on function public.admin_overview(timestamptz, timestamptz) to authenticated;
grant execute on function public.agency_overview(timestamptz, timestamptz) to authenticated;
