-- Adjust governed source frequency from recent failures and candidate yield.

alter table public.web_ingestion_sources
  add column if not exists adaptive_refresh_interval_hours integer,
  add column if not exists last_candidate_yield integer not null default 0,
  add column if not exists consecutive_empty_runs integer not null default 0,
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists scheduling_reason text;

update public.web_ingestion_sources
set adaptive_refresh_interval_hours=coalesce(adaptive_refresh_interval_hours,refresh_interval_hours)
where adaptive_refresh_interval_hours is null;

alter table public.web_ingestion_sources
  drop constraint if exists web_ingestion_sources_adaptive_interval_check;
alter table public.web_ingestion_sources
  add constraint web_ingestion_sources_adaptive_interval_check
  check (adaptive_refresh_interval_hours is null or adaptive_refresh_interval_hours between 1 and 8760);

create or replace function private.apply_adaptive_web_source_schedule_v1()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  min_hours integer:=6;
  max_hours integer:=168;
  zero_backoff numeric:=1.5;
  failure_backoff numeric:=2;
  base_hours integer;
  effective_hours integer;
  latest_job uuid;
  candidate_yield integer:=0;
begin
  if new.last_status is not distinct from old.last_status
     and new.last_completed_at is not distinct from old.last_completed_at then
    return new;
  end if;

  select coalesce((value #>> '{}')::integer,6) into min_hours
  from public.platform_settings where setting_key='growth.min_refresh_hours';
  select coalesce((value #>> '{}')::integer,168) into max_hours
  from public.platform_settings where setting_key='growth.max_refresh_hours';
  select coalesce((value #>> '{}')::numeric,1.5) into zero_backoff
  from public.platform_settings where setting_key='growth.zero_yield_backoff';
  select coalesce((value #>> '{}')::numeric,2) into failure_backoff
  from public.platform_settings where setting_key='growth.failure_backoff';

  min_hours:=greatest(1,coalesce(min_hours,6));
  max_hours:=greatest(min_hours,coalesce(max_hours,168));
  base_hours:=greatest(min_hours,least(max_hours,coalesce(old.adaptive_refresh_interval_hours,new.refresh_interval_hours,24)));
  effective_hours:=base_hours;

  if new.last_status='failed' then
    new.consecutive_failures:=coalesce(old.consecutive_failures,0)+1;
    effective_hours:=least(max_hours,greatest(min_hours,ceil(base_hours*greatest(1,failure_backoff))::integer));
    new.scheduling_reason:='failure_backoff';
  elsif new.last_status='completed' then
    select id into latest_job
    from public.web_ingestion_jobs
    where source_id=new.id and status='completed'
    order by completed_at desc nulls last,created_at desc
    limit 1;

    if latest_job is not null then
      select count(*)::integer into candidate_yield
      from public.web_ingestion_candidates where job_id=latest_job;
    end if;

    new.last_candidate_yield:=candidate_yield;
    new.consecutive_failures:=0;
    if candidate_yield=0 then
      new.consecutive_empty_runs:=coalesce(old.consecutive_empty_runs,0)+1;
      effective_hours:=least(max_hours,greatest(min_hours,ceil(base_hours*greatest(1,zero_backoff))::integer));
      new.scheduling_reason:='zero_yield_backoff';
    else
      new.consecutive_empty_runs:=0;
      effective_hours:=case
        when candidate_yield>=10 then greatest(min_hours,ceil(base_hours*0.5)::integer)
        when candidate_yield>=3 then greatest(min_hours,ceil(base_hours*0.75)::integer)
        else greatest(min_hours,ceil(base_hours*0.9)::integer)
      end;
      new.scheduling_reason:='productive_source_acceleration';
    end if;
  else
    return new;
  end if;

  new.adaptive_refresh_interval_hours:=effective_hours;
  new.next_run_at:=coalesce(new.last_completed_at,now())+make_interval(hours=>effective_hours);
  return new;
end;
$$;

drop trigger if exists apply_adaptive_web_source_schedule_v1 on public.web_ingestion_sources;
create trigger apply_adaptive_web_source_schedule_v1
before update of last_status,last_completed_at on public.web_ingestion_sources
for each row execute function private.apply_adaptive_web_source_schedule_v1();

create or replace view public.web_ingestion_source_health_v1
with (security_invoker=true)
as
select source.id,source.source_name,source.entity_type,source.allowed_domain,
  quality.trust_tier,quality.reliability_score,quality.required_corroborations,
  source.refresh_interval_hours,source.adaptive_refresh_interval_hours,
  source.last_candidate_yield,source.consecutive_empty_runs,source.consecutive_failures,
  source.scheduling_reason,source.last_status,source.last_completed_at,source.next_run_at,
  source.schedule_enabled,source.is_active
from public.web_ingestion_sources source
left join public.web_ingestion_source_quality quality on quality.source_id=source.id;

revoke all on public.web_ingestion_source_health_v1 from public,anon,authenticated;
grant select on public.web_ingestion_source_health_v1 to authenticated,service_role;
