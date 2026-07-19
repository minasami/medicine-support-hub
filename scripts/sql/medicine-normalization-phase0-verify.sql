-- Run after Phase 0. This is read-only and does not approve deletion.

with coverage as (
  select 'medicine_catalog_v2_map' object_name,
         count(*) filter (where medicines2_id is not null) eligible,
         count(*) filter (where medicines2_id is not null and canonical_medicine_id is not null) mapped
  from public.medicine_catalog_v2_map
  union all
  select 'medicine_catalog_source_evidence', count(*),
         count(*) filter (where canonical_medicine_id is not null)
  from public.medicine_catalog_source_evidence
  union all
  select 'medicine_enrichment_import_queue',
         count(*) filter (where suggested_medicine_id is not null),
         count(*) filter (where suggested_medicine_id is not null and canonical_medicine_id is not null)
  from public.medicine_enrichment_import_queue
  union all
  select 'medicine_enrichments', count(*),
         count(*) filter (where canonical_medicine_id is not null)
  from public.medicine_enrichments
  union all
  select 'pharmacy_inventory_items',
         count(*) filter (where medicine_id is not null),
         count(*) filter (where medicine_id is not null and canonical_medicine_id is not null)
  from public.pharmacy_inventory_items
)
select object_name, eligible, mapped, eligible - mapped unresolved
from coverage order by object_name;

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and column_name = 'canonical_medicine_id'
  and table_name in (
    'medicine_catalog_v2_map', 'medicine_enrichment_import_queue',
    'medicine_enrichments', 'pharmacy_inventory_items',
    'medicine_catalog_source_evidence'
  )
order by table_name;

-- These counts must remain unchanged from the signed preflight snapshot.
select 'medicines' object_name, count(*)::bigint row_count from public.medicines
union all select 'medicines2', count(*) from public.medicines2
union all select 'medicines3', count(*) from public.medicines3
union all select 'medicines4', count(*) from public.medicines4
union all select 'medicines5', count(*) from public.medicines5;

