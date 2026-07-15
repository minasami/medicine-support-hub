-- Keep the public medicine filter menu inside the database statement timeout.
-- The previous view ranked every cached facet row with a window function before
-- discarding most of them. These bounded scans use the existing
-- (facet_type, product_count desc, facet_value) index directly.

create or replace view public.medicine_encyclopedia_facets_featured_v1
with (security_invoker = true)
as
select facet_type, facet_value, product_count
from (
  (select facet_type, facet_value, product_count
   from public.medicine_search_facets_cache_v1
   where facet_type = 'manufacturer'
   order by product_count desc, facet_value
   limit 600)
  union all
  (select facet_type, facet_value, product_count
   from public.medicine_search_facets_cache_v1
   where facet_type = 'drug_class'
   order by product_count desc, facet_value
   limit 400)
  union all
  (select facet_type, facet_value, product_count
   from public.medicine_search_facets_cache_v1
   where facet_type = 'category'
   order by product_count desc, facet_value
   limit 100)
  union all
  (select facet_type, facet_value, product_count
   from public.medicine_search_facets_cache_v1
   where facet_type = 'route'
   order by product_count desc, facet_value
   limit 50)
  union all
  (select facet_type, facet_value, product_count
   from public.medicine_search_facets_cache_v1
   where facet_type = 'source_system'
   order by product_count desc, facet_value
   limit 50)
) bounded_facets;

grant select on public.medicine_encyclopedia_facets_featured_v1 to anon, authenticated, service_role;
