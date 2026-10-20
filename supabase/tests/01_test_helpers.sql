-- Test helpers (created in the throwaway test database only).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Act as a user for the rest of the session: call after `set role authenticated`.
create or replace function tests.login(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;

create or replace function tests.anon()
returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', false);
$$;

create or replace function tests.ok(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAILED: %', p_message;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

create or replace function tests.eq(p_actual anyelement, p_expected anyelement, p_message text)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED: % (expected %, got %)', p_message, p_expected, p_actual;
  end if;
  raise notice 'ok - %', p_message;
end;
$$;

-- Passes when the statement raises; optionally checks the message fragment.
create or replace function tests.throws(p_sql text, p_message text, p_fragment text default null)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_fragment is not null and position(lower(p_fragment) in lower(sqlerrm)) = 0 then
      raise exception 'FAILED: % (raised "%", expected to contain "%")', p_message, sqlerrm, p_fragment;
    end if;
    raise notice 'ok - % (%)', p_message, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (statement did not raise)', p_message;
end;
$$;

-- Number of rows a statement affected (RLS makes forbidden UPDATE/DELETE affect 0 rows).
create or replace function tests.affected(p_sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function tests.count(p_sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') t' into n;
  return n;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Well-known fictional IDs from supabase/seed.sql
create or replace view tests.ids as select
  '11111111-1111-4111-8111-111111111111'::uuid as admin,
  '22222222-2222-4222-8222-222222222222'::uuid as analyst,
  '33333333-3333-4333-8333-333333333333'::uuid as supplier,
  '44444444-4444-4444-8444-444444444444'::uuid as farmer,
  '55555555-5555-4555-8555-555555555555'::uuid as logistics,
  '66666666-6666-4666-8666-666666666666'::uuid as buyer,
  '77777777-7777-4777-8777-777777777777'::uuid as buyer2,
  'a1111111-1111-4111-8111-111111111111'::uuid as biz_coop,
  'a2222222-2222-4222-8222-222222222222'::uuid as biz_farm,
  'a3333333-3333-4333-8333-333333333333'::uuid as biz_cold,
  'b1111111-1111-4111-8111-111111111111'::uuid as p_croaker,
  'b2222222-2222-4222-8222-222222222222'::uuid as p_periwinkle,
  'b3333333-3333-4333-8333-333333333333'::uuid as p_catfish,
  'b5555555-5555-4555-8555-555555555555'::uuid as p_draft,
  'c1111111-1111-4111-8111-111111111111'::uuid as s_reefer;
grant select on tests.ids to anon, authenticated, service_role;
