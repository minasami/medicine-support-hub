-- Every automated web source receives an explicit trust tier and field boundary.

create table if not exists public.web_ingestion_source_quality (
  source_id uuid primary key references public.web_ingestion_sources(id) on delete cascade,
  trust_tier text not null default 'discovery' check (trust_tier in ('official','regulator','licensed_provider','verified_partner','trusted_reference','discovery')),
  reliability_score integer not null default 60 check (reliability_score between 0 and 100),
  required_corroborations integer not null default 2 check (required_corroborations between 1 and 5),
  allowed_fields text[] not null default array[]::text[],
  automatic_candidate_creation boolean not null default true,
  automatic_publication boolean not null default false,
  last_verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.web_ingestion_source_quality enable row level security;
drop policy if exists web_ingestion_source_quality_admin_all on public.web_ingestion_source_quality;
create policy web_ingestion_source_quality_admin_all
  on public.web_ingestion_source_quality for all to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
revoke all on public.web_ingestion_source_quality from public,anon,authenticated;
grant select,insert,update,delete on public.web_ingestion_source_quality to authenticated,service_role;

insert into public.web_ingestion_source_quality(source_id,trust_tier,reliability_score,required_corroborations,allowed_fields)
select id,'discovery',60,2,
  case when entity_type='medicine'
    then array['commercial_name','scientific_name','manufacturer','dosage_form','strength','barcode','price_egp','description']::text[]
    else array['company_name','description','country','therapeutic_areas','product_names','capabilities']::text[]
  end
from public.web_ingestion_sources
on conflict(source_id) do nothing;
