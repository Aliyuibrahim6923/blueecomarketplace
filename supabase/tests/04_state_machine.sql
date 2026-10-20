-- The SQL state machine must match lib/orders/order-transitions.json exactly,
-- which is the same file the TypeScript UI uses. (Runner executes from repo root.)
\set matrix `cat lib/orders/order-transitions.json`

begin;
create temporary table t_matrix as
select t ->> 0 as from_s, t ->> 1 as to_s, t ->> 2 as actor
from jsonb_array_elements((:'matrix'::jsonb) -> 'transitions') t;

-- Every listed transition is allowed in SQL.
select tests.eq((select count(*) from t_matrix
  where not public.order_transition_allowed(from_s::public.order_status, to_s::public.order_status, actor)), 0::bigint,
  'every JSON transition is allowed by SQL');

-- Nothing else is allowed in SQL (exhaustive over statuses × statuses × actors).
select tests.eq((
  select count(*)
  from unnest(enum_range(null::public.order_status)) f(s)
  cross join unnest(enum_range(null::public.order_status)) t(s)
  cross join unnest(array['buyer', 'seller', 'admin', 'system']) a(actor)
  where public.order_transition_allowed(f.s, t.s, a.actor)
    and not exists (select 1 from t_matrix m where m.from_s = f.s::text and m.to_s = t.s::text and m.actor = a.actor)
), 0::bigint, 'SQL allows no transition missing from the JSON matrix');

select tests.ok(not public.order_transition_allowed('completed', 'cancelled', 'buyer'), 'completed orders are final for buyers');
select tests.ok(not public.order_transition_allowed('paid', 'cancelled', 'buyer'), 'paid orders cannot be cancelled directly');
select tests.ok(not public.order_transition_allowed('requested', 'paid', 'buyer'), 'buyers can never mark orders paid');

-- Booking state machine spot checks
select tests.ok(public.booking_transition_allowed('requested', 'quoted', 'provider'), 'provider can quote a booking');
select tests.ok(not public.booking_transition_allowed('requested', 'completed', 'provider'), 'bookings cannot skip to completed');
select tests.ok(not public.booking_transition_allowed('quoted', 'confirmed', 'provider'), 'only the requester accepts a quote');
rollback;
