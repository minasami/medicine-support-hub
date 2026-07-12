-- Append adaptive growth and source-trust review counts to the existing admin command center.

do $migration$
declare current_definition text;
begin
  select regexp_replace(
    pg_get_viewdef('public.platform_approval_summary_v1'::regclass,true),
    ';\s*$',''
  ) into current_definition;

  execute 'create or replace view public.platform_approval_summary_v1 with (security_invoker=true) as '
    || current_definition
    || ' union all select ''medicine_growth''::text as queue_key, ''Adaptive medicine growth''::text as label, count(*) filter (where status in (''open'',''queued'',''in_review'')) as pending_count, ''/admin/control-center''::text as route from public.medicine_data_growth_queue'
    || ' union all select ''source_quality''::text as queue_key, ''Source trust reviews''::text as label, count(*) filter (where trust_tier=''discovery'' or last_verified_at is null) as pending_count, ''/admin/control-center''::text as route from public.web_ingestion_source_quality';
end
$migration$;
