create or replace view public.public_seo_catalog
with (security_invoker = true)
as
select
  'product'::text as entity_type,
  id::text as entity_key,
  product_name as title,
  concat_ws(' · ', generic_name, company_name, disease_name, final_price::text || ' ' || price_currency) as description,
  '/verified-products?query=' || replace(product_name, ' ', '%20') as canonical_path,
  company_name,
  generic_name,
  disease_name,
  final_price,
  price_currency,
  updated_at
from public.verified_medicine_source_products
where duplicate_status = 'active'
union all
select
  'company',
  company_slug,
  company_name,
  concat(active_product_count, ' active verified products across ', generic_count, ' generics and ', disease_area_count, ' disease areas.'),
  '/companies?company=' || company_slug,
  company_name,
  null,
  null,
  null,
  null,
  updated_at
from public.medicine_company_profiles
union all
select
  'generic',
  lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')),
  generic_name,
  concat(count(*), ' active verified products containing ', generic_name, '.'),
  '/verified-products?generic=' || replace(generic_name, ' ', '%20'),
  null,
  generic_name,
  null,
  null,
  null,
  max(updated_at)
from public.verified_medicine_source_products
where duplicate_status = 'active' and generic_name is not null
group by generic_name
union all
select
  'disease',
  lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')),
  disease_name,
  concat(count(*), ' active verified products categorized under ', disease_name, '.'),
  '/verified-products?disease=' || replace(disease_name, ' ', '%20'),
  null,
  null,
  disease_name,
  null,
  null,
  max(updated_at)
from public.verified_medicine_source_products
where duplicate_status = 'active' and disease_name is not null
group by disease_name;

grant select on public.public_seo_catalog to anon, authenticated;

create or replace view public.public_seo_metrics
with (security_invoker = true)
as
select
  count(*)::int as seo_entities,
  count(*) filter (where entity_type = 'product')::int as product_pages,
  count(*) filter (where entity_type = 'company')::int as company_pages,
  count(*) filter (where entity_type = 'generic')::int as generic_pages,
  count(*) filter (where entity_type = 'disease')::int as disease_pages,
  max(updated_at) as latest_update
from public.public_seo_catalog;

grant select on public.public_seo_metrics to anon, authenticated;
