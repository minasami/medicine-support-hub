-- Optional target links let reviewed web evidence route to an existing medicine or company.

alter table public.web_ingestion_sources
  add column if not exists canonical_id bigint,
  add column if not exists company_slug text;

create index if not exists web_ingestion_sources_canonical_idx
  on public.web_ingestion_sources(canonical_id) where canonical_id is not null;
create index if not exists web_ingestion_sources_company_idx
  on public.web_ingestion_sources(company_slug) where company_slug is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='web_ingestion_sources_target_check') then
    alter table public.web_ingestion_sources add constraint web_ingestion_sources_target_check check (
      (entity_type='medicine' and company_slug is null)
      or (entity_type='company' and canonical_id is null)
    );
  end if;
end $$;
