-- =============================================================================
-- BlueMarket Nigeria — 0300 platform: settings, audit, notifications, rate limits
-- =============================================================================

-- ---------------------------------------------------------------------------
-- platform_settings: typed via jsonb, edited only through update_platform_setting()
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key          text primary key check (key ~ '^[a-z0-9_]{2,64}$'),
  value        jsonb not null,
  is_public    boolean not null default false,
  description  text not null default '',
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.platform_settings enable row level security;

insert into public.platform_settings (key, value, is_public, description) values
  ('marketplace_fee_bps', '0', true, 'Marketplace fee charged to the buyer, in basis points of subtotal (100 = 1%). Pending commercial approval.'),
  ('tax_bps', '0', true, 'Tax applied to subtotal + delivery + fee, in basis points. Keep 0 until tax advice is received.'),
  ('listing_default_ttl_days', '14', true, 'Days a published listing stays visible before the supplier must refresh availability.'),
  ('payment_sandbox_enabled', 'true', true, 'Allow clearly-labelled sandbox payments. MUST be false in production.'),
  ('offline_payments_enabled', 'true', true, 'Allow sellers to record payments received outside the platform (pilot flow).'),
  ('verification_required_to_publish', 'false', true, 'Require a verified business before listings can be published.'),
  ('max_listing_images', '6', true, 'Maximum photos per listing.'),
  ('analytics_min_group_size', '5', false, 'Minimum businesses in a group before agency dashboards show it.');

create function private.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), p_default);
$$;

create function private.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = p_key), p_default);
$$;

grant execute on function private.setting_int(text, integer) to anon, authenticated;
grant execute on function private.setting_bool(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. Written only through private.audit().
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  action       text not null check (char_length(action) <= 80),
  entity_type  text not null check (char_length(entity_type) <= 60),
  entity_id    text,
  outcome      text not null default 'success' check (outcome in ('success', 'denied', 'failure')),
  metadata     jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at   timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();

create function private.audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb,
  p_outcome text default 'success'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, outcome, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, p_outcome, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Generic audit trigger for admin-managed reference tables (categories, settings).
create function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  v_id := coalesce(
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
    (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'key'
  );
  perform private.audit(lower(tg_op) || '_' || tg_table_name, tg_table_name, v_id,
    jsonb_build_object('before', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'after',  case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end;
$$;
create trigger platform_settings_audit after insert or update or delete on public.platform_settings
  for each row execute function private.audit_row_change();

-- ---------------------------------------------------------------------------
-- notifications + outbox for optional email / SMS delivery
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (char_length(type) <= 60),
  title       text not null check (char_length(title) <= 160),
  body        text not null default '' check (char_length(body) <= 1000),
  link        text check (link is null or (link ~ '^/[^/]' and char_length(link) <= 300)),
  is_read     boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

create function private.set_notification_read_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_read and not old.is_read then
    new.read_at := now();
  elsif not new.is_read then
    new.read_at := null;
  end if;
  return new;
end;
$$;
create trigger notifications_read_at before update on public.notifications
  for each row execute function private.set_notification_read_at();

create table public.notification_outbox (
  id               bigint generated always as identity primary key,
  notification_id  uuid not null references public.notifications (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  channel          public.notification_channel not null,
  status           public.outbox_status not null default 'pending',
  attempts         integer not null default 0 check (attempts >= 0),
  last_error       text check (char_length(last_error) <= 500),
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);
alter table public.notification_outbox enable row level security;
create index notification_outbox_pending_idx on public.notification_outbox (created_at) where status = 'pending';

-- Create an in-app notification and queue external deliveries per user preference.
create function private.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or v_profile.deleted_at is not null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, left(p_title, 160), left(coalesce(p_body, ''), 1000), p_link)
  returning id into v_id;

  if v_profile.email_notifications and v_profile.email is not null then
    insert into public.notification_outbox (notification_id, user_id, channel) values (v_id, p_user_id, 'email');
  end if;
  if v_profile.sms_notifications and v_profile.phone is not null then
    insert into public.notification_outbox (notification_id, user_id, channel) values (v_id, p_user_id, 'sms');
  end if;
end;
$$;

-- Notify every active member of a business, optionally skipping the actor.
create function private.notify_business(
  p_business_id uuid,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_skip_user uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.user_id from public.business_memberships m
    join public.profiles p on p.id = m.user_id
    where m.business_id = p_business_id and p.account_status = 'active'
      and m.user_id is distinct from p_skip_user
  loop
    perform private.notify(r.user_id, p_type, p_title, p_body, p_link);
  end loop;
end;
$$;

create function private.notify_admins(p_type text, p_title text, p_body text default '', p_link text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select distinct ra.user_id from public.role_assignments ra
    join public.profiles p on p.id = ra.user_id
    where ra.role = 'admin' and ra.revoked_at is null and p.account_status = 'active'
  loop
    perform private.notify(r.user_id, p_type, p_title, p_body, p_link);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, per user, or per forwarded IP for anon)
-- ---------------------------------------------------------------------------
create table private.rate_limits (
  subject       text not null,
  action        text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (subject, action, window_start)
);

create function private.enforce_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text;
  v_window timestamptz;
  v_hits integer;
  v_headers json;
begin
  -- Only Data API requests carry JWT claims (PostgREST sets them for anon too).
  -- Migrations, seeds and the service role are not rate limited.
  if coalesce(current_setting('request.jwt.claims', true), '') = ''
     or (current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role' then
    return;
  end if;

  v_subject := (select auth.uid())::text;
  if v_subject is null then
    begin
      v_headers := current_setting('request.headers', true)::json;
    exception when others then
      v_headers := null;
    end;
    v_subject := 'ip:' || coalesce(split_part(v_headers ->> 'x-forwarded-for', ',', 1), 'unknown');
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limits as r (subject, action, window_start, hits)
  values (v_subject, p_action, v_window, 1)
  on conflict (subject, action, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  if v_hits > p_max then
    raise exception 'Too many requests. Please wait a little and try again.' using errcode = 'P0429';
  end if;

  delete from private.rate_limits
  where subject = v_subject and action = p_action and window_start < now() - interval '1 day';
end;
$$;
