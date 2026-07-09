create or replace view public.platform_universal_search_index
with (security_invoker = true)
as
select
  'module'::text as entity_type,
  node_key::text as entity_key,
  label::text as title,
  null::text as subtitle,
  href::text as href,
  node_type::text as category,
  weight::int as weight,
  to_tsvector('simple', coalesce(label,'') || ' ' || coalesce(node_type,'') || ' platform module workflow') as search_vector
from public.platform_connection_graph_nodes
where node_type = 'module'
union all
select
  'verified_product',
  id::text,
  product_name,
  concat_ws(' · ', generic_name, company_name, disease_name, prescription_required, final_price::text || ' ' || price_currency),
  '/verified-products?query=' || replace(product_name, ' ', '%20'),
  'product',
  coalesce(final_price,0)::int,
  to_tsvector('simple', coalesce(product_name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(company_name,'') || ' ' || coalesce(disease_name,'') || ' ' || coalesce(prescription_required,''))
from public.verified_medicine_source_products
where duplicate_status = 'active'
union all
select
  'company',
  company_slug,
  company_name,
  concat_ws(' · ', active_product_count::text || ' active products', generic_count::text || ' generics', disease_area_count::text || ' disease areas'),
  '/companies?company=' || company_slug,
  'company',
  active_product_count,
  to_tsvector('simple', coalesce(company_name,'') || ' ' || coalesce(origin,'') || ' company manufacturer profile')
from public.medicine_company_profiles
union all
select
  'generic',
  lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')),
  generic_name,
  count(*)::text || ' active product records',
  '/verified-products?generic=' || replace(generic_name, ' ', '%20'),
  'generic',
  count(*)::int,
  to_tsvector('simple', coalesce(generic_name,'') || ' generic ingredient active substance')
from public.verified_medicine_source_products
where duplicate_status='active' and generic_name is not null
group by generic_name
union all
select
  'disease_area',
  lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')),
  disease_name,
  count(*)::text || ' active product records',
  '/verified-products?disease=' || replace(disease_name, ' ', '%20'),
  'disease',
  count(*)::int,
  to_tsvector('simple', coalesce(disease_name,'') || ' disease therapy area indication category')
from public.verified_medicine_source_products
where duplicate_status='active' and disease_name is not null
group by disease_name
union all
select
  'medicine_enrichment_source',
  lower(regexp_replace(source_name, '[^a-zA-Z0-9]+', '-', 'g')),
  source_name,
  count(*)::text || ' verified enrichment records',
  '/integrations',
  'source',
  count(*)::int,
  to_tsvector('simple', coalesce(source_name,'') || ' source dataset enrichment verification')
from public.medicine_enrichments
where confidence='verified'
group by source_name;

grant select on public.platform_universal_search_index to anon, authenticated;

create or replace view public.platform_interconnection_metrics
with (security_invoker = true)
as
select
  (select count(*)::int from public.platform_connection_graph_nodes) as graph_nodes,
  (select count(*)::int from public.platform_connection_graph_edges) as graph_edges,
  (select count(*)::int from public.platform_universal_search_index) as searchable_entities,
  (select count(*)::int from public.verified_medicine_source_products where duplicate_status='active') as active_verified_products,
  (select count(*)::int from public.verified_medicine_source_products where duplicate_status='archived_lower_price') as archived_duplicate_prices,
  (select count(*)::int from public.medicine_company_profiles) as company_profiles,
  (select count(distinct generic_name)::int from public.verified_medicine_source_products where duplicate_status='active' and generic_name is not null) as generic_filters,
  (select count(distinct disease_name)::int from public.verified_medicine_source_products where duplicate_status='active' and disease_name is not null) as disease_filters,
  (select count(*)::int from public.medicine_enrichments where confidence='verified') as verified_enrichment_records;

grant select on public.platform_interconnection_metrics to anon, authenticated;
