create or replace view public.platform_related_navigation
with (security_invoker = true)
as
select
  'module'::text as context_type,
  'medicines'::text as context_key,
  'Verified product database'::text as related_title,
  '/verified-products'::text as related_href,
  'Browse source-backed products linked to the encyclopedia.'::text as reason,
  95::int as priority
union all select 'module','medicines','Medicine enrichment admin','/admin/medicine-enrichment','Review and publish source-backed medicine enrichment.',90
union all select 'module','verified-products','Company profiles','/companies','Analyze manufacturers and product portfolios.',95
union all select 'module','verified-products','Platform network','/network','See how products connect to companies, generics, diseases, and sources.',90
union all select 'module','companies','Verified product database','/verified-products','Open filtered product intelligence from company profiles.',95
union all select 'module','companies','Universal search','/search','Search across companies, products, generics, diseases, and modules.',85
union all select 'module','pharmacy','Pharmacy reports','/pharmacy/reports','Turn pharmacy operations into financial, stock, movement, and access reports.',95
union all select 'module','workspace','Impact reporting','/impact','Connect program work to measurable public-health outcomes.',95
union all select 'module','integrations','Platform network','/network','Open the live graph of connected modules and entities.',100
union all select 'module','integrations','Universal search','/search','Search across the connected platform from one place.',98
union all
select
  'company',
  company_slug,
  'Products by ' || company_name,
  '/verified-products?company=' || company_slug,
  'Open all active verified products for this company.',
  100
from public.medicine_company_profiles
union all
select
  'company',
  company_slug,
  'Universal search for ' || company_name,
  '/search?query=' || replace(company_name, ' ', '%20'),
  'Search the full platform for this company.',
  80
from public.medicine_company_profiles
union all
select
  'generic',
  lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')),
  'Products containing ' || generic_name,
  '/verified-products?generic=' || replace(generic_name, ' ', '%20'),
  'Open active verified products for this generic ingredient.',
  100
from public.verified_medicine_source_products
where duplicate_status='active' and generic_name is not null
group by generic_name
union all
select
  'disease',
  lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')),
  'Products for ' || disease_name,
  '/verified-products?disease=' || replace(disease_name, ' ', '%20'),
  'Open active verified products in this disease area.',
  100
from public.verified_medicine_source_products
where duplicate_status='active' and disease_name is not null
group by disease_name;

grant select on public.platform_related_navigation to anon, authenticated;

create or replace view public.platform_connection_density
with (security_invoker = true)
as
select
  n.node_type,
  count(distinct n.node_key)::int as nodes,
  count(distinct e.source_key || '->' || e.target_key || ':' || e.relation)::int as outgoing_edges,
  coalesce(round(count(distinct e.source_key || '->' || e.target_key || ':' || e.relation)::numeric / nullif(count(distinct n.node_key),0), 2), 0) as edges_per_node
from public.platform_connection_graph_nodes n
left join public.platform_connection_graph_edges e on e.source_key = n.node_key
group by n.node_type;

grant select on public.platform_connection_density to anon, authenticated;
