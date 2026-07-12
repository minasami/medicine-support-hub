-- Keep public search caches and the adaptive growth queue synchronized with each controlled index refresh.

create or replace function public.refresh_medicine_search_index_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  row_count bigint;
  refreshed timestamptz := clock_timestamp();
  cache_result jsonb;
  growth_result jsonb;
begin
  refresh materialized view private.medicine_search_index_v1;
  analyze private.medicine_search_index_v1;
  select count(*) into row_count from private.medicine_search_index_v1;
  cache_result:=public.refresh_medicine_search_caches_v1();
  growth_result:=public.refresh_medicine_growth_queue_v1();
  return jsonb_build_object(
    'refreshed_at',refreshed,
    'products',row_count,
    'caches',cache_result,
    'adaptive_growth',growth_result
  );
end;
$$;

revoke all on function public.refresh_medicine_search_index_v1() from public,anon,authenticated;
grant execute on function public.refresh_medicine_search_index_v1() to service_role;
