-- Authorized, read-only normalization readiness report.
-- This function does not approve mappings, switch reads, or remove legacy data.

create or replace function private.get_medicine_normalization_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare report jsonb;
begin
  if not private.can_review_medicine_mappings() then
    raise exception 'Medicine mapping review permission is required.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'database_size_bytes', pg_database_size(current_database()),
    'database_size_pretty', pg_size_pretty(pg_database_size(current_database())),
    'queue', jsonb_build_object(
      'total', count(*),
      'open', count(*) filter (where status in ('pending', 'in_review', 'reopened')),
      'approved', count(*) filter (where status = 'approved'),
      'rejected', count(*) filter (where status = 'rejected'),
      'with_suggestions', count(*) filter (where status in ('pending', 'in_review', 'reopened') and jsonb_array_length(suggested_matches) > 0)
    )
  ) into report from public.medicine_mapping_review_queue;

  return report || jsonb_build_object(
    'references', jsonb_build_array(
      jsonb_build_object('source', 'Catalog v2 map', 'total', (select count(*) from public.medicine_catalog_v2_map), 'unresolved', (select count(*) from public.medicine_catalog_v2_map where canonical_medicine_id is null)),
      jsonb_build_object('source', 'Source evidence', 'total', (select count(*) from public.medicine_catalog_source_evidence), 'unresolved', (select count(*) from public.medicine_catalog_source_evidence where canonical_medicine_id is null)),
      jsonb_build_object('source', 'Enrichments', 'total', (select count(*) from public.medicine_enrichments), 'unresolved', (select count(*) from public.medicine_enrichments where canonical_medicine_id is null)),
      jsonb_build_object('source', 'Import queue links', 'total', (select count(*) from public.medicine_enrichment_import_queue where suggested_medicine_id is not null), 'unresolved', (select count(*) from public.medicine_enrichment_import_queue where suggested_medicine_id is not null and canonical_medicine_id is null)),
      jsonb_build_object('source', 'Pharmacy inventory links', 'total', (select count(*) from public.pharmacy_inventory_items where medicine_id is not null), 'unresolved', (select count(*) from public.pharmacy_inventory_items where medicine_id is not null and canonical_medicine_id is null))
    ),
    'read_cutover_ready', not exists (select 1 from public.medicine_mapping_review_queue where status in ('pending', 'in_review', 'reopened'))
      and not exists (select 1 from public.medicine_catalog_v2_map where canonical_medicine_id is null)
      and not exists (select 1 from public.medicine_catalog_source_evidence where canonical_medicine_id is null)
      and not exists (select 1 from public.medicine_enrichments where canonical_medicine_id is null)
      and not exists (select 1 from public.medicine_enrichment_import_queue where suggested_medicine_id is not null and canonical_medicine_id is null)
      and not exists (select 1 from public.pharmacy_inventory_items where medicine_id is not null and canonical_medicine_id is null),
    'legacy_deletion_ready', false
  );
end;
$$;

revoke all on function private.get_medicine_normalization_readiness() from public, anon;
grant execute on function private.get_medicine_normalization_readiness() to authenticated, service_role;

create or replace function public.get_medicine_normalization_readiness()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_medicine_normalization_readiness(); $$;

revoke all on function public.get_medicine_normalization_readiness() from public, anon;
grant execute on function public.get_medicine_normalization_readiness() to authenticated, service_role;
