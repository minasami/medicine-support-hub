-- Optimize medicine name exact match suggestion candidate lookups (functional/expression indexes)
create index if not exists medicine_canonical_name_en_normalized_idx
  on public.medicine_canonical_products_v1 (lower(regexp_replace(trim(coalesce(name_en, '')), '\s+', ' ', 'g')));

create index if not exists medicine_mapping_review_legacy_name_normalized_idx
  on public.medicine_mapping_review_queue (lower(regexp_replace(trim(coalesce(legacy_name, '')), '\s+', ' ', 'g')));

-- Optimize open queue checks (partial index for pending mapping requests)
create index if not exists medicine_mapping_review_queue_open_idx
  on public.medicine_mapping_review_queue (status)
  where status in ('pending', 'in_review', 'reopened');

-- Optimize cutover readiness checks (partial indexes for unresolved canonical references)
create index if not exists medicine_catalog_v2_map_unresolved_idx
  on public.medicine_catalog_v2_map (canonical_medicine_id)
  where canonical_medicine_id is null;

create index if not exists medicine_catalog_source_evidence_unresolved_idx
  on public.medicine_catalog_source_evidence (canonical_medicine_id)
  where canonical_medicine_id is null;

create index if not exists medicine_enrichments_unresolved_idx
  on public.medicine_enrichments (canonical_medicine_id)
  where canonical_medicine_id is null;

create index if not exists medicine_enrichment_import_queue_unresolved_idx
  on public.medicine_enrichment_import_queue (suggested_medicine_id)
  where suggested_medicine_id is not null and canonical_medicine_id is null;

create index if not exists pharmacy_inventory_items_unresolved_idx
  on public.pharmacy_inventory_items (medicine_id)
  where medicine_id is not null and canonical_medicine_id is null;
