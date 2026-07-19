-- PHASE 0 DRAFT: additive compatibility columns only.
-- Rehearse and approve before placing this SQL in Supabase migration history.
-- This file intentionally contains no DROP, TRUNCATE, DELETE, or legacy rename.

set lock_timeout = '5s';
set statement_timeout = '120s';

alter table public.medicine_catalog_v2_map
  add column if not exists canonical_medicine_id bigint;
alter table public.medicine_enrichment_import_queue
  add column if not exists canonical_medicine_id bigint;
alter table public.medicine_enrichments
  add column if not exists canonical_medicine_id bigint;
alter table public.pharmacy_inventory_items
  add column if not exists canonical_medicine_id bigint;
alter table public.medicine_catalog_source_evidence
  add column if not exists canonical_medicine_id bigint;

-- Backfill through the existing, audited medicines2-to-canonical ID map.
update public.medicine_catalog_v2_map target
set canonical_medicine_id = id_map.canonical_id
from public.medicine_catalog_id_map_v1 id_map
where id_map.source_system = 'medicines2'
  and id_map.source_record_key = target.medicines2_id::text
  and target.canonical_medicine_id is distinct from id_map.canonical_id;

update public.medicine_catalog_source_evidence target
set canonical_medicine_id = id_map.canonical_id
from public.medicine_catalog_id_map_v1 id_map
where id_map.source_system = 'medicines2'
  and id_map.source_record_key = target.medicines2_id::text
  and target.canonical_medicine_id is distinct from id_map.canonical_id;

-- Existing legacy-medicine references first resolve through the verified v2 map.
update public.medicine_enrichment_import_queue target
set canonical_medicine_id = id_map.canonical_id
from public.medicine_catalog_v2_map legacy_map
join public.medicine_catalog_id_map_v1 id_map
  on id_map.source_system = 'medicines2'
 and id_map.source_record_key = legacy_map.medicines2_id::text
where legacy_map.legacy_medicine_id = target.suggested_medicine_id
  and target.suggested_medicine_id is not null
  and target.canonical_medicine_id is distinct from id_map.canonical_id;

update public.medicine_enrichments target
set canonical_medicine_id = id_map.canonical_id
from public.medicine_catalog_v2_map legacy_map
join public.medicine_catalog_id_map_v1 id_map
  on id_map.source_system = 'medicines2'
 and id_map.source_record_key = legacy_map.medicines2_id::text
where legacy_map.legacy_medicine_id = target.medicine_id
  and target.canonical_medicine_id is distinct from id_map.canonical_id;

update public.pharmacy_inventory_items target
set canonical_medicine_id = id_map.canonical_id
from public.medicine_catalog_v2_map legacy_map
join public.medicine_catalog_id_map_v1 id_map
  on id_map.source_system = 'medicines2'
 and id_map.source_record_key = legacy_map.medicines2_id::text
where legacy_map.legacy_medicine_id = target.medicine_id
  and target.medicine_id is not null
  and target.canonical_medicine_id is distinct from id_map.canonical_id;

create index if not exists medicine_catalog_v2_map_canonical_medicine_idx
  on public.medicine_catalog_v2_map(canonical_medicine_id)
  where canonical_medicine_id is not null;
create index if not exists medicine_enrichment_import_queue_canonical_idx
  on public.medicine_enrichment_import_queue(canonical_medicine_id)
  where canonical_medicine_id is not null;
create index if not exists medicine_enrichments_canonical_idx
  on public.medicine_enrichments(canonical_medicine_id)
  where canonical_medicine_id is not null;
create index if not exists pharmacy_inventory_items_canonical_medicine_idx
  on public.pharmacy_inventory_items(canonical_medicine_id)
  where canonical_medicine_id is not null;
create index if not exists medicine_catalog_source_evidence_canonical_idx
  on public.medicine_catalog_source_evidence(canonical_medicine_id)
  where canonical_medicine_id is not null;

comment on column public.pharmacy_inventory_items.canonical_medicine_id is
  'Additive unified-catalog identifier; legacy medicine_id remains during rollback window.';

