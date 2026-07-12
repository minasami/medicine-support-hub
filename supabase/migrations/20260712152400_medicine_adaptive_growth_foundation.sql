-- Prioritize the highest-value medicine data gaps without automatically publishing crawled facts.

create table if not exists public.medicine_data_growth_queue (
  id bigint generated always as identity primary key,
  canonical_id bigint not null,
  gap_type text not null check (gap_type in ('price','scientific_name','manufacturer','drug_class','route','category','image','price_history')),
  priority integer not null check (priority between 0 and 200),
  recommended_source_tier text not null default 'trusted_reference',
  status text not null default 'open' check (status in ('open','queued','in_review','resolved','ignored')),
  evidence_candidate_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(canonical_id,gap_type)
);
create index if not exists medicine_data_growth_queue_priority_idx on public.medicine_data_growth_queue(status,priority desc,last_seen_at asc);
create index if not exists medicine_data_growth_queue_canonical_idx on public.medicine_data_growth_queue(canonical_id,status);

alter table public.medicine_data_growth_queue enable row level security;
drop policy if exists medicine_data_growth_queue_admin_all on public.medicine_data_growth_queue;
create policy medicine_data_growth_queue_admin_all
  on public.medicine_data_growth_queue for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
revoke all on public.medicine_data_growth_queue from public,anon,authenticated;
grant select,insert,update,delete on public.medicine_data_growth_queue to authenticated,service_role;
grant usage,select on sequence public.medicine_data_growth_queue_id_seq to authenticated,service_role;

create table if not exists public.medicine_data_growth_metrics_cache_v1 (
  singleton boolean primary key default true check(singleton),
  canonical_products bigint not null default 0,
  missing_scientific_name bigint not null default 0,
  missing_manufacturer bigint not null default 0,
  missing_drug_class bigint not null default 0,
  missing_route bigint not null default 0,
  missing_category bigint not null default 0,
  missing_image bigint not null default 0,
  missing_price bigint not null default 0,
  missing_price_history bigint not null default 0,
  active_growth_queue bigint not null default 0,
  active_scheduled_sources bigint not null default 0,
  pending_evidence_candidates bigint not null default 0,
  refreshed_at timestamptz not null default now()
);

alter table public.medicine_data_growth_metrics_cache_v1 enable row level security;
drop policy if exists medicine_data_growth_metrics_public_read on public.medicine_data_growth_metrics_cache_v1;
create policy medicine_data_growth_metrics_public_read
  on public.medicine_data_growth_metrics_cache_v1 for select to anon,authenticated using(true);
revoke all on public.medicine_data_growth_metrics_cache_v1 from public;
grant select on public.medicine_data_growth_metrics_cache_v1 to anon,authenticated,service_role;
grant insert,update,delete on public.medicine_data_growth_metrics_cache_v1 to service_role;

create or replace view public.medicine_data_growth_health_v1 with (security_invoker=true) as
select canonical_products,missing_scientific_name,missing_manufacturer,missing_drug_class,
  missing_route,missing_category,missing_image,missing_price,missing_price_history,
  active_growth_queue,active_scheduled_sources,pending_evidence_candidates,refreshed_at
from public.medicine_data_growth_metrics_cache_v1 where singleton=true;
revoke all on public.medicine_data_growth_health_v1 from public;
grant select on public.medicine_data_growth_health_v1 to anon,authenticated,service_role;

insert into public.platform_settings(setting_key,category,label,description,value,value_type,is_public)
values
  ('growth.enabled','operations','Adaptive data growth','Maintain a prioritized data-quality queue and governed source discovery.','true'::jsonb,'boolean',false),
  ('growth.queue_per_gap','operations','Queue size per gap','Maximum high-value medicines queued for each missing-field category.','250'::jsonb,'integer',false),
  ('growth.min_refresh_hours','firecrawl','Minimum source refresh interval','Shortest adaptive interval for high-yield approved sources.','6'::jsonb,'integer',false),
  ('growth.max_refresh_hours','firecrawl','Maximum source refresh interval','Longest adaptive interval after repeated low-yield or failed runs.','168'::jsonb,'integer',false),
  ('growth.zero_yield_backoff','firecrawl','Zero-yield backoff','Multiplier applied when a successful source run produces no new candidates.','1.5'::jsonb,'number',false),
  ('growth.failure_backoff','firecrawl','Failure backoff','Multiplier applied after source failures.','2'::jsonb,'number',false)
on conflict(setting_key) do nothing;
