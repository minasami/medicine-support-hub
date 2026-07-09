create or replace view public.medicine_enrichment_source_coverage
with (security_invoker = true)
as
select
  source_name,
  source_type,
  count(*)::int as verified_records,
  count(*) filter (where price_amount is not null)::int as records_with_price,
  count(*) filter (where barcode is not null)::int as records_with_barcode,
  count(*) filter (where manufacturer is not null)::int as records_with_manufacturer,
  count(*) filter (where active_ingredient is not null)::int as records_with_active_ingredient,
  max(updated_at) as latest_update
from public.medicine_enrichments
where confidence = 'verified'
group by source_name, source_type;

grant select on public.medicine_enrichment_source_coverage to anon, authenticated;
