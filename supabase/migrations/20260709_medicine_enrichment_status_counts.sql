create or replace view public.medicine_enrichment_status_counts
with (security_invoker = true)
as
select confidence, count(*)::int as count
from public.medicine_enrichments
group by confidence;
