-- Snapshot source trust on every candidate and connect attributed evidence to data-growth gaps.

alter table public.web_ingestion_candidates
  add column if not exists source_trust_tier text,
  add column if not exists source_reliability_score integer,
  add column if not exists required_corroborations integer;

alter table public.web_ingestion_source_quality
  drop constraint if exists web_ingestion_source_quality_no_auto_publish;
update public.web_ingestion_source_quality set automatic_publication=false where automatic_publication;
alter table public.web_ingestion_source_quality
  add constraint web_ingestion_source_quality_no_auto_publish check (automatic_publication=false);

create or replace function private.ensure_web_source_quality_v1()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
begin
  insert into public.web_ingestion_source_quality(
    source_id,trust_tier,reliability_score,required_corroborations,allowed_fields
  ) values (
    new.id,'discovery',60,2,
    case when new.entity_type='medicine'
      then array['commercial_name','scientific_name','manufacturer','dosage_form','strength','barcode','price_egp','description']::text[]
      else array['company_name','description','country','therapeutic_areas','product_names','capabilities']::text[]
    end
  ) on conflict(source_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_web_source_quality_v1 on public.web_ingestion_sources;
create trigger ensure_web_source_quality_v1
after insert on public.web_ingestion_sources
for each row execute function private.ensure_web_source_quality_v1();

create or replace function private.apply_web_candidate_trust_v1()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare quality public.web_ingestion_source_quality%rowtype;
begin
  select * into quality
  from public.web_ingestion_source_quality
  where source_id=new.source_id;

  if quality.source_id is null then
    new.source_trust_tier:='discovery';
    new.source_reliability_score:=40;
    new.required_corroborations:=2;
    new.confidence_score:=least(coalesce(new.confidence_score,0),40);
  else
    if tg_op='INSERT' and not quality.automatic_candidate_creation then
      raise exception 'Automatic candidate creation is disabled for this source';
    end if;
    new.source_trust_tier:=quality.trust_tier;
    new.source_reliability_score:=quality.reliability_score;
    new.required_corroborations:=quality.required_corroborations;
    new.confidence_score:=least(coalesce(new.confidence_score,0),quality.reliability_score);
  end if;

  if tg_op='INSERT' then new.status:='pending'; end if;
  return new;
end;
$$;

drop trigger if exists apply_web_candidate_trust_v1 on public.web_ingestion_candidates;
create trigger apply_web_candidate_trust_v1
before insert or update of source_id,confidence_score on public.web_ingestion_candidates
for each row execute function private.apply_web_candidate_trust_v1();

create or replace function private.connect_candidate_to_growth_queue_v1()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
begin
  if new.entity_type='medicine' and new.canonical_id is not null then
    update public.medicine_data_growth_queue queue
    set status=case when queue.status='open' then 'queued' else queue.status end,
        evidence_candidate_count=evidence_candidate_count+1,
        last_seen_at=now()
    where queue.canonical_id=new.canonical_id
      and queue.status in ('open','queued','in_review')
      and (
        (queue.gap_type='price' and new.extracted_data ? 'price_egp') or
        (queue.gap_type='scientific_name' and new.extracted_data ? 'scientific_name') or
        (queue.gap_type='manufacturer' and new.extracted_data ? 'manufacturer') or
        (queue.gap_type='route' and (new.extracted_data ? 'dosage_form' or new.extracted_data ? 'route')) or
        (queue.gap_type='category' and new.extracted_data ? 'description') or
        (queue.gap_type='price_history' and new.extracted_data ? 'price_egp')
      );
  end if;
  return new;
end;
$$;

drop trigger if exists connect_candidate_to_growth_queue_v1 on public.web_ingestion_candidates;
create trigger connect_candidate_to_growth_queue_v1
after insert on public.web_ingestion_candidates
for each row execute function private.connect_candidate_to_growth_queue_v1();
