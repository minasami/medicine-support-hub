create or replace view public.platform_connection_graph_nodes
with (security_invoker = true)
as
select 'module'::text as node_type, 'medicines'::text as node_key, 'Medicines encyclopedia'::text as label, '/medicines'::text as href, null::text as parent_key, 1::int as weight
union all select 'module','verified-products','Verified product database','/verified-products',null,1
union all select 'module','companies','Company profiles','/companies',null,1
union all select 'module','medicine-enrichment-admin','Medicine enrichment admin','/admin/medicine-enrichment',null,1
union all select 'module','integrations','Platform integration hub','/integrations',null,1
union all select 'module','pharmacy','Pharmacy operations','/pharmacy',null,1
union all select 'module','pharmacy-reports','Pharmacy reports','/pharmacy/reports',null,1
union all select 'module','workspace','Program workspace','/workspace',null,1
union all select 'module','impact','Impact reporting','/impact',null,1
union all select 'module','portal','Staff portal','/portal',null,1
union all
select 'company', company_slug, company_name, '/companies?company=' || company_slug, 'companies', active_product_count
from public.medicine_company_profiles
union all
select 'generic', lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')), generic_name, '/verified-products?generic=' || replace(generic_name, ' ', '%20'), 'verified-products', count(*)::int
from public.verified_medicine_source_products
where duplicate_status='active' and generic_name is not null
group by generic_name
union all
select 'disease', lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')), disease_name, '/verified-products?disease=' || replace(disease_name, ' ', '%20'), 'verified-products', count(*)::int
from public.verified_medicine_source_products
where duplicate_status='active' and disease_name is not null
group by disease_name
union all
select 'source', lower(regexp_replace(source_name, '[^a-zA-Z0-9]+', '-', 'g')), source_name, '/integrations', 'integrations', count(*)::int
from public.medicine_enrichments
where confidence='verified'
group by source_name;

create or replace view public.platform_connection_graph_edges
with (security_invoker = true)
as
select 'integrations'::text as source_key, 'medicines'::text as target_key, 'routes_to'::text as relation, 1::int as weight
union all select 'integrations','verified-products','routes_to',1
union all select 'integrations','companies','routes_to',1
union all select 'integrations','medicine-enrichment-admin','routes_to',1
union all select 'integrations','pharmacy','routes_to',1
union all select 'integrations','workspace','routes_to',1
union all select 'integrations','impact','routes_to',1
union all select 'verified-products','companies','aggregates_into',1
union all select 'verified-products','medicines','enriches',1
union all select 'medicine-enrichment-admin','medicines','publishes_to',1
union all select 'pharmacy','pharmacy-reports','feeds',1
union all select 'workspace','impact','feeds',1
union all
select company_slug, 'verified-products', 'has_products', active_product_count
from public.medicine_company_profiles
union all
select lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')), 'verified-products', 'filters_products', count(*)::int
from public.verified_medicine_source_products
where duplicate_status='active' and generic_name is not null
group by generic_name
union all
select lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')), 'verified-products', 'filters_products', count(*)::int
from public.verified_medicine_source_products
where duplicate_status='active' and disease_name is not null
group by disease_name
union all
select lower(regexp_replace(source_name, '[^a-zA-Z0-9]+', '-', 'g')), 'medicines', 'source_enriches', count(*)::int
from public.medicine_enrichments
where confidence='verified'
group by source_name;

grant select on public.platform_connection_graph_nodes to anon, authenticated;
grant select on public.platform_connection_graph_edges to anon, authenticated;
