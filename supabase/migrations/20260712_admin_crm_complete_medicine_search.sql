-- Founder CRM, governed medicine images, and completeness-ranked public search.
-- Additive migration: existing public routes and search RPC v2 remain available.

alter table public.partnership_leads
  add column if not exists phone text,
  add column if not exists lead_type text not null default 'partnership',
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists next_action text,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists closed_reason text,
  add column if not exists last_activity_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partnership_leads_lead_type_check') then
    alter table public.partnership_leads add constraint partnership_leads_lead_type_check
      check (lead_type in ('demo','partnership','pilot','data_contribution','marketplace','institutional','support','other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'partnership_leads_priority_check') then
    alter table public.partnership_leads add constraint partnership_leads_priority_check
      check (priority in ('low','normal','high','urgent'));
  end if;
end $$;

create index if not exists partnership_leads_status_priority_created_idx
  on public.partnership_leads(status, priority, created_at desc);
create index if not exists partnership_leads_follow_up_idx
  on public.partnership_leads(follow_up_at)
  where follow_up_at is not null;
create index if not exists partnership_leads_assigned_to_idx
  on public.partnership_leads(assigned_to)
  where assigned_to is not null;

create table if not exists public.partnership_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.partnership_leads(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  activity_type text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint partnership_lead_activities_type_check check (
    activity_type in ('created','status_changed','follow_up_changed','note_changed','assignment_changed','priority_changed','contacted','other')
  )
);

create index if not exists partnership_lead_activities_lead_created_idx
  on public.partnership_lead_activities(lead_id, created_at desc);

alter table public.partnership_lead_activities enable row level security;

drop policy if exists partnership_lead_activities_admin_select on public.partnership_lead_activities;
create policy partnership_lead_activities_admin_select
  on public.partnership_lead_activities for select to authenticated
  using (private.is_platform_admin());

drop policy if exists partnership_lead_activities_admin_insert on public.partnership_lead_activities;
create policy partnership_lead_activities_admin_insert
  on public.partnership_lead_activities for insert to authenticated
  with check (private.is_platform_admin());

drop policy if exists partnership_lead_activities_admin_update on public.partnership_lead_activities;
create policy partnership_lead_activities_admin_update
  on public.partnership_lead_activities for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists partnership_lead_activities_admin_delete on public.partnership_lead_activities;
create policy partnership_lead_activities_admin_delete
  on public.partnership_lead_activities for delete to authenticated
  using (private.is_platform_admin());

create or replace function private.log_partnership_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'created', 'Founder contact request created', jsonb_build_object('source_path', new.source_path, 'lead_type', new.lead_type));
    new.last_activity_at := coalesce(new.last_activity_at, now());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'status_changed', 'Lead status changed', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.follow_up_at is distinct from old.follow_up_at or new.next_action is distinct from old.next_action then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'follow_up_changed', 'Follow-up plan changed', jsonb_build_object('follow_up_at', new.follow_up_at, 'next_action', new.next_action));
  end if;
  if new.admin_notes is distinct from old.admin_notes then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary)
    values (new.id, actor, 'note_changed', 'Admin notes updated');
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'assignment_changed', 'Lead assignment changed', jsonb_build_object('assigned_to', new.assigned_to));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'priority_changed', 'Lead priority changed', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;

revoke all on function private.log_partnership_lead_activity() from public;

drop trigger if exists partnership_lead_activity_log on public.partnership_leads;
create trigger partnership_lead_activity_log
before insert or update on public.partnership_leads
for each row execute function private.log_partnership_lead_activity();

-- Image candidates discovered from official sites, verified contributors, or configured image-search APIs.
-- Search-engine discoveries never become public until an administrator approves them.
create table if not exists public.medicine_image_candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_id bigint not null,
  image_url text not null,
  thumbnail_url text,
  source_page_url text,
  source_domain text,
  source_kind text not null default 'search_engine_result',
  discovery_provider text not null default 'manual',
  query_text text,
  result_title text,
  width integer,
  height integer,
  match_score integer not null default 0,
  authenticity_score integer not null default 0,
  status text not null default 'pending',
  review_notes text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medicine_image_candidates_url_unique unique(canonical_id, image_url),
  constraint medicine_image_candidates_source_kind_check check (source_kind in ('official_manufacturer','regulator','verified_company','licensed_pharmacy','trusted_database','search_engine_result','other')),
  constraint medicine_image_candidates_provider_check check (discovery_provider in ('manual','bing','google','company','dataset','other')),
  constraint medicine_image_candidates_status_check check (status in ('pending','approved','rejected')),
  constraint medicine_image_candidates_match_score_check check (match_score between 0 and 100),
  constraint medicine_image_candidates_auth_score_check check (authenticity_score between 0 and 100),
  constraint medicine_image_candidates_width_check check (width is null or width > 0),
  constraint medicine_image_candidates_height_check check (height is null or height > 0)
);

create index if not exists medicine_image_candidates_review_idx
  on public.medicine_image_candidates(status, authenticity_score desc, match_score desc, created_at desc);
create index if not exists medicine_image_candidates_medicine_idx
  on public.medicine_image_candidates(canonical_id, status, authenticity_score desc);

alter table public.medicine_image_candidates enable row level security;

drop policy if exists medicine_image_candidates_public_approved_select on public.medicine_image_candidates;
create policy medicine_image_candidates_public_approved_select
  on public.medicine_image_candidates for select to anon, authenticated
  using (status = 'approved');

drop policy if exists medicine_image_candidates_admin_select on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_select
  on public.medicine_image_candidates for select to authenticated
  using (private.is_platform_admin());

drop policy if exists medicine_image_candidates_admin_insert on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_insert
  on public.medicine_image_candidates for insert to authenticated
  with check (private.is_platform_admin() and coalesce(created_by, auth.uid()) = auth.uid());

drop policy if exists medicine_image_candidates_admin_update on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_update
  on public.medicine_image_candidates for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists medicine_image_candidates_admin_delete on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_delete
  on public.medicine_image_candidates for delete to authenticated
  using (private.is_platform_admin());

create or replace function private.normalize_medicine_image_candidate()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.image_url := btrim(new.image_url);
  new.source_page_url := nullif(btrim(coalesce(new.source_page_url, '')), '');
  new.source_domain := lower(split_part(regexp_replace(coalesce(new.source_page_url, new.image_url), '^https?://', '', 'i'), '/', 1));
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_by is null then new.created_by := auth.uid(); end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_medicine_image_candidate() from public;

drop trigger if exists medicine_image_candidate_normalize on public.medicine_image_candidates;
create trigger medicine_image_candidate_normalize
before insert or update on public.medicine_image_candidates
for each row execute function private.normalize_medicine_image_candidate();

create or replace view public.medicine_preferred_images_v1
with (security_invoker = true)
as
with approved_candidates as (
  select candidate.canonical_id,
         candidate.image_url,
         candidate.thumbnail_url,
         candidate.source_page_url,
         candidate.source_domain,
         candidate.source_kind,
         candidate.discovery_provider,
         candidate.authenticity_score,
         candidate.match_score,
         true as image_is_reviewed,
         candidate.reviewed_at as observed_at
  from public.medicine_image_candidates candidate
  where candidate.status = 'approved'
), base_images as (
  select product.canonical_id,
         product.image_url,
         product.image_url as thumbnail_url,
         product.egyptdwa_source_url as source_page_url,
         lower(split_part(regexp_replace(product.image_url, '^https?://', '', 'i'), '/', 1)) as source_domain,
         case when product.has_company_verified_source then 'verified_company' else 'trusted_database' end as source_kind,
         case when product.has_company_verified_source then 'company' else 'dataset' end as discovery_provider,
         case when product.has_company_verified_source then 95 else 65 end as authenticity_score,
         case when product.has_company_verified_source then 95 else 75 end as match_score,
         product.has_company_verified_source as image_is_reviewed,
         product.current_price_observed_at as observed_at
  from public.medicine_encyclopedia_products_v2 product
  where nullif(btrim(product.image_url), '') is not null
), ranked as (
  select source.*,
         row_number() over (
           partition by source.canonical_id
           order by source.authenticity_score desc,
                    source.image_is_reviewed desc,
                    source.match_score desc,
                    source.observed_at desc nulls last,
                    source.image_url
         ) as rank_number
  from (
    select * from approved_candidates
    union all
    select * from base_images
  ) source
)
select canonical_id, image_url, thumbnail_url, source_page_url, source_domain, source_kind,
       discovery_provider, authenticity_score, match_score, image_is_reviewed
from ranked
where rank_number = 1;

grant select on public.medicine_preferred_images_v1 to anon, authenticated;

create or replace function public.search_medicine_encyclopedia_v3(
  p_query text default '',
  p_manufacturer text default null,
  p_drug_class text default null,
  p_route text default null,
  p_scientific_name text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_has_price_history boolean default null,
  p_verified_only boolean default null,
  p_has_marketplace_offers boolean default null,
  p_sort text default 'completeness',
  p_limit integer default 60,
  p_offset integer default 0
)
returns table(
  canonical_id bigint,
  name_en text,
  name_ar text,
  scientific_name text,
  manufacturer text,
  drug_class text,
  route text,
  category text,
  image_url text,
  image_source_url text,
  image_source_domain text,
  image_source_kind text,
  image_authenticity_score integer,
  image_match_score integer,
  image_is_verified boolean,
  barcode text,
  code text,
  current_price_egp numeric,
  price_currency text,
  min_price_egp numeric,
  max_price_egp numeric,
  price_observation_count integer,
  distinct_price_count integer,
  has_price_history boolean,
  source_record_count integer,
  source_count integer,
  source_systems text[],
  has_verified_dataset boolean,
  has_company_verified_source boolean,
  marketplace_offer_count integer,
  marketplace_seller_count integer,
  lowest_marketplace_price_egp numeric,
  current_price_source text,
  complete_field_count integer,
  available_field_count integer,
  completeness_score integer,
  completeness_percent integer,
  relevance numeric,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions, pg_catalog
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  row_limit integer := greatest(1, least(coalesce(p_limit, 60), 100));
  row_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  sort_mode text := case when p_sort in ('relevance','completeness','name','price_high','price_low','history','sources','offers') then p_sort else 'completeness' end;
begin
  return query
  with enriched as (
    select product.*,
           preferred.image_url as preferred_image_url,
           preferred.source_page_url as preferred_image_source_url,
           preferred.source_domain as preferred_image_source_domain,
           preferred.source_kind as preferred_image_source_kind,
           coalesce(preferred.authenticity_score, 0)::integer as preferred_image_authenticity_score,
           coalesce(preferred.match_score, 0)::integer as preferred_image_match_score,
           coalesce(preferred.image_is_reviewed, false) as preferred_image_is_verified,
           (
             (case when nullif(btrim(coalesce(product.name_en, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.name_ar, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.scientific_name, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.manufacturer, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.drug_class, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.route, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.category, '')), '') is not null then 1 else 0 end) +
             (case when preferred.image_url is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.barcode, '')), '') is not null then 1 else 0 end) +
             (case when nullif(btrim(coalesce(product.code, '')), '') is not null then 1 else 0 end) +
             (case when product.current_price_egp is not null then 1 else 0 end) +
             (case when product.has_verified_dataset or product.has_company_verified_source or product.source_count > 1 then 1 else 0 end) +
             (case when product.has_price_history then 1 else 0 end) +
             (case when product.marketplace_offer_count > 0 then 1 else 0 end)
           )::integer as complete_fields,
           (
             (case when nullif(btrim(coalesce(product.name_en, '')), '') is not null then 8 else 0 end) +
             (case when nullif(btrim(coalesce(product.name_ar, '')), '') is not null then 8 else 0 end) +
             (case when nullif(btrim(coalesce(product.scientific_name, '')), '') is not null then 12 else 0 end) +
             (case when nullif(btrim(coalesce(product.manufacturer, '')), '') is not null then 10 else 0 end) +
             (case when nullif(btrim(coalesce(product.drug_class, '')), '') is not null then 8 else 0 end) +
             (case when nullif(btrim(coalesce(product.route, '')), '') is not null then 6 else 0 end) +
             (case when nullif(btrim(coalesce(product.category, '')), '') is not null then 6 else 0 end) +
             (case when preferred.image_url is not null then 12 else 0 end) +
             (case when nullif(btrim(coalesce(product.barcode, '')), '') is not null then 8 else 0 end) +
             (case when nullif(btrim(coalesce(product.code, '')), '') is not null then 4 else 0 end) +
             (case when product.current_price_egp is not null then 8 else 0 end) +
             (case when product.has_verified_dataset or product.has_company_verified_source or product.source_count > 1 then 6 else 0 end) +
             (case when product.has_price_history then 2 else 0 end) +
             (case when product.marketplace_offer_count > 0 then 2 else 0 end)
           )::integer as completeness_points
    from public.medicine_encyclopedia_products_v2 product
    left join public.medicine_preferred_images_v1 preferred using (canonical_id)
  ), candidates as (
    select enriched.*,
      case when q = '' then 0::numeric
        when enriched.barcode = q or enriched.code = q then 10000::numeric
        when lower(coalesce(enriched.name_en, '')) = lower(q) or lower(coalesce(enriched.name_ar, '')) = lower(q) then 9000::numeric
        when lower(coalesce(enriched.name_en, '')) like lower(q) || '%' or lower(coalesce(enriched.name_ar, '')) like lower(q) || '%' then 7000::numeric
        else (5000 + greatest(
          extensions.similarity(coalesce(enriched.name_en, ''), q),
          extensions.similarity(coalesce(enriched.name_ar, ''), q),
          extensions.similarity(coalesce(enriched.scientific_name, ''), q),
          extensions.similarity(coalesce(enriched.manufacturer, ''), q)
        ) * 100)::numeric end as relevance_score
    from enriched
    where (q = '' or enriched.barcode = q or enriched.code = q or enriched.search_text ilike '%' || q || '%')
      and (p_manufacturer is null or enriched.manufacturer = p_manufacturer)
      and (p_drug_class is null or enriched.drug_class = p_drug_class)
      and (p_route is null or enriched.route = p_route)
      and (p_scientific_name is null or enriched.scientific_name ilike '%' || p_scientific_name || '%')
      and (p_min_price is null or enriched.current_price_egp >= p_min_price)
      and (p_max_price is null or enriched.current_price_egp <= p_max_price)
      and (p_has_price_history is null or enriched.has_price_history = p_has_price_history)
      and (p_verified_only is null or not p_verified_only or enriched.has_verified_dataset or enriched.has_company_verified_source)
      and (p_has_marketplace_offers is null or ((enriched.marketplace_offer_count > 0) = p_has_marketplace_offers))
  ), counted as (
    select candidates.*, count(*) over() as total_rows from candidates
  )
  select counted.canonical_id, counted.name_en, counted.name_ar, counted.scientific_name,
    counted.manufacturer, counted.drug_class, counted.route, counted.category,
    counted.preferred_image_url, counted.preferred_image_source_url, counted.preferred_image_source_domain,
    counted.preferred_image_source_kind, counted.preferred_image_authenticity_score,
    counted.preferred_image_match_score, counted.preferred_image_is_verified,
    counted.barcode, counted.code, counted.current_price_egp, counted.price_currency,
    counted.min_price_egp, counted.max_price_egp, counted.price_observation_count,
    counted.distinct_price_count, counted.has_price_history, counted.source_record_count,
    counted.source_count, counted.source_systems, counted.has_verified_dataset,
    counted.has_company_verified_source, counted.marketplace_offer_count, counted.marketplace_seller_count,
    counted.lowest_marketplace_price_egp, counted.current_price_source,
    counted.complete_fields, 14, counted.completeness_points, counted.completeness_points,
    counted.relevance_score, counted.total_rows
  from counted
  order by
    case when sort_mode = 'relevance' then counted.relevance_score end desc,
    case when sort_mode = 'completeness' then counted.completeness_points end desc,
    case when sort_mode = 'price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode = 'price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode = 'history' then counted.distinct_price_count end desc,
    case when sort_mode = 'sources' then counted.source_count end desc,
    case when sort_mode = 'offers' then counted.marketplace_offer_count end desc,
    case when sort_mode = 'name' then coalesce(counted.name_en, counted.name_ar) end asc,
    counted.completeness_points desc,
    counted.preferred_image_authenticity_score desc,
    counted.source_count desc,
    coalesce(counted.name_en, counted.name_ar),
    counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;

grant execute on function public.search_medicine_encyclopedia_v3(text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer) to anon, authenticated;

grant select on public.medicine_image_candidates to anon, authenticated;
grant insert, update, delete on public.medicine_image_candidates to authenticated;
grant select, insert, update, delete on public.partnership_lead_activities to authenticated;
