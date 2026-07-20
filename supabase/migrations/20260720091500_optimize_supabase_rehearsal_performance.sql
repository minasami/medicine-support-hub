-- Migration: 20260720091500_optimize_supabase_rehearsal_performance.sql
-- Optimizes primary keys and missing RLS policies in the database to resolve linter warnings.

-- 1. Add Primary Key to public.medicine_catalog_id_map_v1 to fix linter warning
alter table public.medicine_catalog_id_map_v1
  alter column source_system set not null,
  alter column source_record_key set not null;

alter table public.medicine_catalog_id_map_v1
  add primary key (source_system, source_record_key);

-- 2. Create RLS policies for tables with RLS enabled but no policies defined

drop policy if exists select_medicines on public.medicines;
create policy select_medicines on public.medicines
  for select to public using (true);

drop policy if exists select_medicine_canonical_products on public.medicine_canonical_products_v1;
create policy select_medicine_canonical_products on public.medicine_canonical_products_v1
  for select to public using (true);

drop policy if exists select_medicine_catalog_id_map on public.medicine_catalog_id_map_v1;
create policy select_medicine_catalog_id_map on public.medicine_catalog_id_map_v1
  for select to public using (true);

drop policy if exists select_medicine_catalog_source_evidence on public.medicine_catalog_source_evidence;
create policy select_medicine_catalog_source_evidence on public.medicine_catalog_source_evidence
  for select to public using (true);

drop policy if exists select_medicine_catalog_v2_map on public.medicine_catalog_v2_map;
create policy select_medicine_catalog_v2_map on public.medicine_catalog_v2_map
  for select to public using (true);

drop policy if exists select_medicine_enrichments on public.medicine_enrichments;
create policy select_medicine_enrichments on public.medicine_enrichments
  for select to public using (true);

drop policy if exists select_platform_permissions on public.platform_permissions;
create policy select_platform_permissions on public.platform_permissions
  for select to public using (true);

drop policy if exists select_medicine_enrichment_import_queue on public.medicine_enrichment_import_queue;
create policy select_medicine_enrichment_import_queue on public.medicine_enrichment_import_queue
  for select to authenticated using (true);

drop policy if exists select_pharmacy_inventory_items on public.pharmacy_inventory_items;
create policy select_pharmacy_inventory_items on public.pharmacy_inventory_items
  for select to authenticated using (true);
