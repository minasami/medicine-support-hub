-- Keep the full cache for administration but return a useful bounded facet set to public clients.

create or replace view public.medicine_encyclopedia_facets_v4
with (security_invoker=true)
as
select facet_type,facet_value,product_count
from public.medicine_encyclopedia_facets_featured_v1;

grant select on public.medicine_encyclopedia_facets_v4 to anon,authenticated,service_role;
