create or replace function public.database_storage_admin_health()
returns table(database_bytes bigint,quota_bytes bigint,usage_percent numeric,remaining_bytes bigint,status text,checked_at timestamptz)
language plpgsql
stable
security definer
set search_path=public,private,pg_catalog
as $$
declare
  used_bytes bigint := pg_database_size(current_database());
  free_quota_bytes constant bigint := 500000000;
  percent_used numeric;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator required' using errcode='42501';
  end if;
  percent_used := round((used_bytes::numeric / free_quota_bytes::numeric) * 100, 1);
  return query select used_bytes,free_quota_bytes,percent_used,greatest(free_quota_bytes-used_bytes,0::bigint),
    case when percent_used>=90 then 'critical' when percent_used>=80 then 'warning' else 'healthy' end,now();
end;
$$;

revoke all on function public.database_storage_admin_health() from public,anon;
grant execute on function public.database_storage_admin_health() to authenticated,service_role;
