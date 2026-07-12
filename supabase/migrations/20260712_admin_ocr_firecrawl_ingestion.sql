-- Administrator-only OCR and Firecrawl ingestion foundation.
-- Raw documents and crawled data remain private and require human review before promotion.

create table if not exists public.document_ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  mime_type text not null,
  document_sha256 text,
  provider_requested text not null default 'google_document_ai',
  provider_used text,
  status text not null default 'queued',
  review_status text not null default 'pending',
  page_count integer,
  language_codes text[] not null default '{}'::text[],
  quality_score numeric,
  extracted_text text,
  extracted_blocks jsonb not null default '[]'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint document_ocr_jobs_status_check check (status in ('queued','processing','completed','failed')),
  constraint document_ocr_jobs_review_check check (review_status in ('pending','approved','rejected')),
  constraint document_ocr_jobs_provider_check check (provider_requested in ('google_document_ai','auto')),
  constraint document_ocr_jobs_mime_check check (mime_type in ('application/pdf','image/jpeg','image/png','image/tiff','image/webp')),
  constraint document_ocr_jobs_quality_check check (quality_score is null or quality_score between 0 and 1)
);

create index if not exists document_ocr_jobs_created_idx on public.document_ocr_jobs(created_at desc);
create index if not exists document_ocr_jobs_review_idx on public.document_ocr_jobs(review_status, status, created_at desc);

create table if not exists public.web_ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  source_name text not null,
  root_url text not null,
  allowed_domain text not null,
  crawl_mode text not null default 'scrape',
  include_paths text[] not null default '{}'::text[],
  exclude_paths text[] not null default '{}'::text[],
  max_pages integer not null default 25,
  refresh_interval_hours integer not null default 24,
  schedule_enabled boolean not null default false,
  is_active boolean not null default true,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_ingestion_sources_entity_check check (entity_type in ('medicine','company')),
  constraint web_ingestion_sources_mode_check check (crawl_mode in ('scrape','crawl')),
  constraint web_ingestion_sources_url_check check (root_url ~ '^https://'),
  constraint web_ingestion_sources_pages_check check (max_pages between 1 and 250),
  constraint web_ingestion_sources_interval_check check (refresh_interval_hours between 6 and 8760),
  constraint web_ingestion_sources_domain_check check (allowed_domain ~ '^[a-z0-9.-]+$')
);

create table if not exists public.web_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.web_ingestion_sources(id) on delete cascade,
  provider text not null default 'firecrawl',
  mode text not null,
  external_job_id text,
  status text not null default 'queued',
  pages_discovered integer not null default 0,
  pages_processed integer not null default 0,
  credits_used integer,
  provider_response jsonb not null default '{}'::jsonb,
  error_message text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint web_ingestion_jobs_provider_check check (provider = 'firecrawl'),
  constraint web_ingestion_jobs_mode_check check (mode in ('scrape','crawl')),
  constraint web_ingestion_jobs_status_check check (status in ('queued','running','completed','failed','cancelled'))
);

create table if not exists public.web_ingestion_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.web_ingestion_jobs(id) on delete cascade,
  source_id uuid not null references public.web_ingestion_sources(id) on delete cascade,
  entity_type text not null,
  canonical_id bigint,
  company_slug text,
  source_url text not null,
  source_title text,
  extracted_data jsonb not null default '{}'::jsonb,
  content_hash text not null,
  confidence_score integer not null default 0,
  status text not null default 'pending',
  review_notes text,
  promoted_record_id uuid,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_ingestion_candidates_entity_check check (entity_type in ('medicine','company')),
  constraint web_ingestion_candidates_confidence_check check (confidence_score between 0 and 100),
  constraint web_ingestion_candidates_status_check check (status in ('pending','approved','rejected','promoted')),
  constraint web_ingestion_candidates_unique unique(source_id, source_url, content_hash)
);

create index if not exists web_ingestion_sources_due_idx on public.web_ingestion_sources(schedule_enabled, is_active, next_run_at);
create index if not exists web_ingestion_jobs_status_created_idx on public.web_ingestion_jobs(status, created_at desc);
create index if not exists web_ingestion_candidates_review_idx on public.web_ingestion_candidates(status, confidence_score desc, created_at desc);
create index if not exists web_ingestion_candidates_canonical_idx on public.web_ingestion_candidates(canonical_id) where canonical_id is not null;

alter table public.document_ocr_jobs enable row level security;
alter table public.web_ingestion_sources enable row level security;
alter table public.web_ingestion_jobs enable row level security;
alter table public.web_ingestion_candidates enable row level security;

do $$
declare target text;
begin
  foreach target in array array['document_ocr_jobs','web_ingestion_sources','web_ingestion_jobs','web_ingestion_candidates'] loop
    execute format('drop policy if exists %I_admin_select on public.%I', target, target);
    execute format('create policy %I_admin_select on public.%I for select to authenticated using (private.is_platform_admin())', target, target);
    execute format('drop policy if exists %I_admin_insert on public.%I', target, target);
    execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (private.is_platform_admin())', target, target);
    execute format('drop policy if exists %I_admin_update on public.%I', target, target);
    execute format('create policy %I_admin_update on public.%I for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin())', target, target);
    execute format('drop policy if exists %I_admin_delete on public.%I', target, target);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (private.is_platform_admin())', target, target);
  end loop;
end $$;

create or replace function private.normalize_web_ingestion_source()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.root_url := btrim(new.root_url);
  new.allowed_domain := lower(split_part(regexp_replace(new.root_url, '^https://', '', 'i'), '/', 1));
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.next_run_at := coalesce(new.next_run_at, now());
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function private.normalize_web_ingestion_source() from public;

drop trigger if exists web_ingestion_source_normalize on public.web_ingestion_sources;
create trigger web_ingestion_source_normalize before insert or update on public.web_ingestion_sources
for each row execute function private.normalize_web_ingestion_source();

create or replace function private.touch_admin_ingestion_rows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_admin_ingestion_rows() from public;

drop trigger if exists document_ocr_jobs_touch on public.document_ocr_jobs;
create trigger document_ocr_jobs_touch before update on public.document_ocr_jobs
for each row execute function private.touch_admin_ingestion_rows();
drop trigger if exists web_ingestion_jobs_touch on public.web_ingestion_jobs;
create trigger web_ingestion_jobs_touch before update on public.web_ingestion_jobs
for each row execute function private.touch_admin_ingestion_rows();
drop trigger if exists web_ingestion_candidates_touch on public.web_ingestion_candidates;
create trigger web_ingestion_candidates_touch before update on public.web_ingestion_candidates
for each row execute function private.touch_admin_ingestion_rows();

create or replace function public.review_web_ingestion_candidate(
  target_candidate uuid,
  decision text,
  reviewer_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  candidate public.web_ingestion_candidates%rowtype;
  profile_id_value uuid;
  organization_id_value uuid;
  promoted_id uuid;
  summary_value text;
  title_value text;
  price_value numeric;
begin
  if not private.is_platform_admin() then raise exception 'Platform-admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;

  select * into candidate from public.web_ingestion_candidates where id = target_candidate for update;
  if candidate.id is null then raise exception 'Candidate not found'; end if;
  if candidate.status not in ('pending','approved') then raise exception 'Candidate is not reviewable'; end if;

  if decision = 'rejected' then
    update public.web_ingestion_candidates
      set status='rejected', review_notes=reviewer_notes, reviewed_by=auth.uid(), reviewed_at=now()
      where id=target_candidate;
    return jsonb_build_object('status','rejected','candidate_id',target_candidate);
  end if;

  title_value := coalesce(nullif(candidate.source_title,''), initcap(candidate.entity_type)||' web evidence');
  summary_value := coalesce(nullif(candidate.extracted_data->>'summary',''), nullif(candidate.extracted_data->>'description',''), 'Structured evidence extracted from an attributed web source and submitted for human verification.');
  if length(summary_value) < 10 then summary_value := summary_value || ' Source review required.'; end if;

  if candidate.entity_type = 'medicine' and candidate.canonical_id is not null then
    begin
      price_value := nullif(regexp_replace(coalesce(candidate.extracted_data->>'price_egp',''), '[^0-9.]', '', 'g'), '')::numeric;
    exception when others then price_value := null; end;

    insert into public.medicine_collaboration_submissions(
      canonical_id, contribution_type, title, summary, proposed_price_egp,
      evidence_urls, submitted_by, organization_name, status
    ) values (
      candidate.canonical_id,
      case when price_value is not null and price_value > 0 then 'price_observation' else 'product_evidence' end,
      left(title_value, 240), left(summary_value, 4000),
      case when price_value > 0 then price_value else null end,
      array[candidate.source_url], auth.uid(), 'Firecrawl attributed source', 'submitted'
    ) returning id into promoted_id;

    update public.web_ingestion_candidates
      set status='promoted', review_notes=reviewer_notes, promoted_record_id=promoted_id,
          reviewed_by=auth.uid(), reviewed_at=now()
      where id=target_candidate;
    return jsonb_build_object('status','promoted','candidate_id',target_candidate,'record_id',promoted_id,'queue','medicine_contribution');
  end if;

  if candidate.entity_type = 'company' and candidate.company_slug is not null then
    select id, organization_id into profile_id_value, organization_id_value
    from public.industry_company_profiles
    where company_slug = candidate.company_slug and verification_status = 'verified'
    limit 1;

    if profile_id_value is not null and organization_id_value is not null then
      insert into public.industry_company_contributions(
        profile_id, organization_id, company_slug, contribution_type, title, summary,
        payload, evidence_urls, status, submitted_by
      ) values (
        profile_id_value, organization_id_value, candidate.company_slug, 'evidence',
        left(title_value, 240), left(summary_value, 4000), candidate.extracted_data,
        array[candidate.source_url], 'submitted', auth.uid()
      ) returning id into promoted_id;

      update public.web_ingestion_candidates
        set status='promoted', review_notes=reviewer_notes, promoted_record_id=promoted_id,
            reviewed_by=auth.uid(), reviewed_at=now()
        where id=target_candidate;
      return jsonb_build_object('status','promoted','candidate_id',target_candidate,'record_id',promoted_id,'queue','company_contribution');
    end if;
  end if;

  update public.web_ingestion_candidates
    set status='approved', review_notes=reviewer_notes, reviewed_by=auth.uid(), reviewed_at=now()
    where id=target_candidate;
  return jsonb_build_object('status','approved','candidate_id',target_candidate,'promotion','manual_matching_required');
end;
$$;

revoke all on function public.review_web_ingestion_candidate(uuid,text,text) from public;
grant execute on function public.review_web_ingestion_candidate(uuid,text,text) to authenticated;

create or replace view public.platform_approval_summary_v1
with (security_invoker = true)
as
select 'founder_leads'::text queue_key, 'Founder CRM'::text label,
       count(*) filter (where status in ('new','contacted','qualified','pilot_discussion'))::bigint pending_count,
       '/admin/leads'::text route
from public.partnership_leads
union all
select 'company_claims','Company profile claims',count(*) filter (where status in ('pending','under_review')),'/admin/industry'
from public.industry_company_profile_claims
union all
select 'company_contributions','Company contributions',count(*) filter (where status in ('submitted','under_review')),'/admin/industry'
from public.industry_company_contributions
union all
select 'medicine_contributions','Medicine contributions',count(*) filter (where status in ('submitted','under_review')),'/admin/industry'
from public.medicine_collaboration_submissions
union all
select 'seller_applications','Seller applications',count(*) filter (where status in ('pending','under_review')),'/admin/marketplace'
from public.marketplace_seller_applications
union all
select 'marketplace_offers','Marketplace offers',count(*) filter (where status in ('submitted','under_review')),'/admin/marketplace'
from public.marketplace_medicine_offers
union all
select 'medicine_enrichments','Medicine enrichments',count(*) filter (where confidence='needs_review'),'/admin/medicine-enrichment'
from public.medicine_enrichments
union all
select 'medicine_images','Medicine images',count(*) filter (where status='pending'),'/admin'
from public.medicine_image_candidates
union all
select 'ocr_documents','OCR documents',count(*) filter (where status='completed' and review_status='pending'),'/admin/control-center'
from public.document_ocr_jobs
union all
select 'web_ingestion','Web-ingestion candidates',count(*) filter (where status='pending'),'/admin/control-center'
from public.web_ingestion_candidates;

grant select, insert, update, delete on public.document_ocr_jobs to authenticated;
grant select, insert, update, delete on public.web_ingestion_sources to authenticated;
grant select, insert, update, delete on public.web_ingestion_jobs to authenticated;
grant select, insert, update, delete on public.web_ingestion_candidates to authenticated;
grant select on public.platform_approval_summary_v1 to authenticated;
