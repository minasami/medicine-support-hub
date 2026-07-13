create table if not exists public.platform_automation_jobs (
  id uuid primary key default gen_random_uuid(), job_key text not null unique, display_name text not null,
  description text not null default '', handler text not null, cadence_minutes integer not null check (cadence_minutes>=60),
  enabled boolean not null default true, safety_level text not null default 'reviewed' check (safety_level in ('safe_read','reviewed','human_approval_required')),
  requires_human_approval boolean not null default false, last_enqueued_at timestamptz,
  next_run_at timestamptz not null default now(), configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.platform_automation_queue_runs (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.platform_automation_jobs(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','succeeded','failed','cancelled')),
  trigger_source text not null default 'schedule', input jsonb not null default '{}'::jsonb, output jsonb not null default '{}'::jsonb,
  error_message text, queued_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz,
  approved_by uuid, approved_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists platform_automation_queue_runs_idx on public.platform_automation_queue_runs(job_id,status,queued_at desc);
create index if not exists platform_automation_jobs_due_idx on public.platform_automation_jobs(enabled,next_run_at);
alter table public.platform_automation_jobs enable row level security;
alter table public.platform_automation_queue_runs enable row level security;
create or replace function public.is_platform_automation_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and is_active=true and role in ('admin','platform_admin','super_admin')); $$;
revoke all on function public.is_platform_automation_admin() from public; grant execute on function public.is_platform_automation_admin() to authenticated;
create policy "automation jobs admin read" on public.platform_automation_jobs for select to authenticated using (public.is_platform_automation_admin());
create policy "automation jobs admin write" on public.platform_automation_jobs for all to authenticated using (public.is_platform_automation_admin()) with check (public.is_platform_automation_admin());
create policy "automation queue admin read" on public.platform_automation_queue_runs for select to authenticated using (public.is_platform_automation_admin());
create policy "automation queue admin write" on public.platform_automation_queue_runs for all to authenticated using (public.is_platform_automation_admin()) with check (public.is_platform_automation_admin());
insert into public.platform_automation_jobs(job_key,display_name,description,handler,cadence_minutes,safety_level,requires_human_approval,configuration) values
('company_claim_recheck','Company claim verification refresh','Recalculate domain, dataset, evidence and risk checks for pending company-profile claims.','recheck_pending_company_claims',1440,'reviewed',false,'{"final_ownership_decision":"platform_admin"}'::jsonb),
('company_profile_refresh','Company portfolio summary refresh','Recalculate company portfolio counts, generics, therapeutic areas and price ranges from imported source records.','refresh_medicine_company_profiles',1440,'safe_read',false,'{"public_data_only":true}'::jsonb),
('medicine_data_quality_scan','Medicine data quality scan','Detect missing attribution, malformed URLs, invalid prices, duplicate anomalies and stale source records.','scan_medicine_data_quality',1440,'reviewed',false,'{"create_review_tasks":true}'::jsonb),
('production_error_triage','Production error triage','Collect error clusters, group regressions and create repair tasks without automatically publishing code.','triage_production_errors',60,'reviewed',false,'{"auto_deploy":false,"human_review_for_code":true}'::jsonb),
('search_ai_discovery_refresh','Search and AI discovery refresh','Refresh sitemap, structured data, AI context files and public entity coverage after approved data changes.','refresh_discovery_assets',10080,'reviewed',false,'{"respect_privacy":true}'::jsonb),
('community_engagement_digest','Community collaboration digest','Prepare a reviewable digest of public resources, collaboration requests and opportunities.','prepare_engagement_digest',1440,'human_approval_required',true,'{"auto_post":false,"channels":["linkedin"]}'::jsonb)
on conflict(job_key) do update set display_name=excluded.display_name,description=excluded.description,handler=excluded.handler,cadence_minutes=excluded.cadence_minutes,safety_level=excluded.safety_level,requires_human_approval=excluded.requires_human_approval,configuration=excluded.configuration,updated_at=now();
create or replace function public.enqueue_due_platform_automation_jobs() returns integer language plpgsql security definer set search_path=public as $$ declare rec record; n integer:=0; begin
 if auth.uid() is not null and not public.is_platform_automation_admin() then raise exception 'not authorized'; end if;
 for rec in select * from public.platform_automation_jobs j where j.enabled=true and j.next_run_at<=now() and not exists(select 1 from public.platform_automation_queue_runs r where r.job_id=j.id and r.status in ('queued','running','awaiting_approval')) for update skip locked loop
  insert into public.platform_automation_queue_runs(job_id,status,input) values(rec.id,case when rec.requires_human_approval then 'awaiting_approval' else 'queued' end,jsonb_build_object('configuration',rec.configuration,'scheduled_at',now()));
  update public.platform_automation_jobs set last_enqueued_at=now(),next_run_at=now()+make_interval(mins=>rec.cadence_minutes),updated_at=now() where id=rec.id; n:=n+1;
 end loop; return n; end; $$;
revoke all on function public.enqueue_due_platform_automation_jobs() from public; grant execute on function public.enqueue_due_platform_automation_jobs() to authenticated;
create or replace view public.platform_automation_health as select j.id,j.job_key,j.display_name,j.description,j.handler,j.enabled,j.safety_level,j.requires_human_approval,j.cadence_minutes,j.last_enqueued_at,j.next_run_at,lr.status latest_status,lr.queued_at latest_queued_at,lr.started_at latest_started_at,lr.completed_at latest_completed_at,lr.error_message latest_error,case when not j.enabled then 'disabled' when lr.status='failed' then 'attention' when j.next_run_at<now()-interval '2 hours' then 'overdue' when lr.status in ('queued','running','awaiting_approval') then lr.status else 'healthy' end health from public.platform_automation_jobs j left join lateral(select r.* from public.platform_automation_queue_runs r where r.job_id=j.id order by r.queued_at desc limit 1) lr on true;
grant select on public.platform_automation_health to authenticated;