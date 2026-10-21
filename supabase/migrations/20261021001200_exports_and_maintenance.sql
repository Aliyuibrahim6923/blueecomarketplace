-- =============================================================================
-- BlueMarket Nigeria — 1200 admin exports audit + scheduled maintenance helpers
-- =============================================================================

-- Admin CSV exports are recorded before the file is generated.
create function public.log_admin_export(p_report text, p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrators only' using errcode = '42501';
  end if;
  if p_report not in ('orders', 'payments', 'businesses', 'listings', 'disputes') then
    raise exception 'Unknown report' using errcode = '22023';
  end if;
  perform private.audit('report_exported', 'report', p_report, jsonb_build_object('days', p_days));
end;
$$;

-- Expire quotations past their validity date (called by the cron route).
create function public.expire_stale_quotations()
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.quotations set status = 'expired'
    where status = 'sent' and valid_until < current_date
    returning 1)
  select count(*)::integer from updated;
$$;

revoke all on function public.log_admin_export(text, integer) from public;
revoke all on function public.expire_stale_quotations() from public;
grant execute on function public.log_admin_export(text, integer) to authenticated;
grant execute on function public.expire_stale_quotations() to service_role;
