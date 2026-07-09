create or replace view public.medicine_enrichment_import_queue_coverage
with (security_invoker = true)
as
select
  source_name,
  match_status,
  count(*)::int as queue_records,
  count(*) filter (where source_price_amount is not null)::int as records_with_price,
  count(*) filter (where source_barcode is not null)::int as records_with_barcode,
  max(updated_at) as latest_update
from public.medicine_enrichment_import_queue
group by source_name, match_status;

grant select on public.medicine_enrichment_import_queue_coverage to authenticated;
