-- 20260720270000_prioritize_company_verified_data_in_encyclopedia.sql
-- Prioritize verified company representative updates (company.*) over base seed dataset (base.*)
-- in medicine_encyclopedia_products_v2 so that commercial name and field edits reflect immediately.

create or replace view public.medicine_encyclopedia_products_v2 with (security_invoker = true) as
with company_active as (
  select product.*, profile.display_name company_display_name
  from public.company_verified_medicine_products product
  join public.industry_company_profiles profile on profile.id=product.profile_id
  where product.status='active' and profile.verification_status='verified' and profile.is_public=true
), company_group as (
  select canonical_id, min(canonical_key) canonical_key,
    (array_agg(commercial_name_en order by approved_at desc) filter (where nullif(btrim(commercial_name_en),'') is not null))[1] name_en,
    (array_agg(commercial_name_ar order by approved_at desc) filter (where nullif(btrim(commercial_name_ar),'') is not null))[1] name_ar,
    (array_agg(scientific_name order by approved_at desc) filter (where nullif(btrim(scientific_name),'') is not null))[1] scientific_name,
    (array_agg(manufacturer order by approved_at desc) filter (where nullif(btrim(manufacturer),'') is not null))[1] manufacturer,
    (array_agg(drug_class order by approved_at desc) filter (where nullif(btrim(drug_class),'') is not null))[1] drug_class,
    (array_agg(route order by approved_at desc) filter (where nullif(btrim(route),'') is not null))[1] route,
    (array_agg(category order by approved_at desc) filter (where nullif(btrim(category),'') is not null))[1] category,
    (array_agg(image_url order by approved_at desc) filter (where nullif(btrim(image_url),'') is not null))[1] image_url,
    (array_agg(product_url order by approved_at desc) filter (where nullif(btrim(product_url),'') is not null))[1] product_url,
    (array_agg(barcode order by approved_at desc) filter (where nullif(btrim(barcode),'') is not null))[1] barcode,
    (array_agg(product_code order by approved_at desc) filter (where nullif(btrim(product_code),'') is not null))[1] product_code,
    count(*)::integer company_product_count,
    array_agg(distinct company_slug order by company_slug) company_slugs,
    max(current_price_egp) filter (where current_price_egp>0) company_max_price,
    min(current_price_egp) filter (where current_price_egp>0) company_min_price,
    max(approved_at) latest_approved_at,
    (array_agg(contribution_id::text order by current_price_egp desc nulls last, approved_at desc))[1] best_source_record
  from company_active group by canonical_id
), price_values as (
  select canonical_id, price::numeric from public.medicine_price_history_v1 where price>0
  union all
  select canonical_id, current_price_egp from company_active where current_price_egp>0
), price_stats as (
  select canonical_id, min(price) min_price, max(price) max_price,
    count(*)::integer observation_count, count(distinct price)::integer distinct_count
  from price_values group by canonical_id
), offer_stats as (
  select offer.canonical_id, count(*)::integer marketplace_offer_count,
    count(distinct offer.seller_profile_id)::integer marketplace_seller_count,
    min(offer.unit_price_egp) lowest_marketplace_price_egp
  from public.marketplace_medicine_offers offer
  join public.marketplace_seller_profiles seller on seller.id=offer.seller_profile_id
  where offer.status='approved' and offer.published_at is not null
    and seller.verification_status='verified' and seller.is_public=true
  group by offer.canonical_id
), existing_rows as (
  select base.canonical_id, base.canonical_key,
    coalesce(company.name_en, base.name_en) name_en,
    coalesce(company.name_ar, base.name_ar) name_ar,
    coalesce(company.scientific_name, base.scientific_name) scientific_name,
    coalesce(company.manufacturer, base.manufacturer) manufacturer,
    coalesce(company.drug_class, base.drug_class) drug_class,
    coalesce(company.route, base.route) route,
    coalesce(company.category, base.category) category,
    coalesce(company.image_url, base.image_url) image_url,
    base.egyptdwa_source_url,
    coalesce(company.barcode, base.barcode) barcode,
    coalesce(company.product_code, base.code) code,
    base.custom_product_code, base.primary_medicines2_id,
    coalesce(prices.max_price,base.current_price_egp) current_price_egp,
    'EGP'::text price_currency,
    coalesce(prices.min_price,base.min_price_egp) min_price_egp,
    coalesce(prices.max_price,base.max_price_egp) max_price_egp,
    coalesce(prices.observation_count,base.price_observation_count) price_observation_count,
    coalesce(prices.distinct_count,base.distinct_price_count) distinct_price_count,
    coalesce(prices.distinct_count,base.distinct_price_count)>1 has_price_history,
    base.source_record_count+coalesce(company.company_product_count,0) source_record_count,
    base.source_count+case when company.canonical_id is null then 0 else 1 end source_count,
    case when company.canonical_id is null then base.source_systems else
      (select array_agg(distinct s order by s) from unnest(base.source_systems||array['company_verified']::text[]) s)
    end source_systems,
    base.has_verified_dataset, base.has_operational_catalog, base.has_egyptdwa_source,
    company.canonical_id is not null has_company_verified_source,
    coalesce(company.company_product_count,0) company_product_count,
    coalesce(company.company_slugs,'{}'::text[]) company_slugs,
    coalesce(offers.marketplace_offer_count,0) marketplace_offer_count,
    coalesce(offers.marketplace_seller_count,0) marketplace_seller_count,
    offers.lowest_marketplace_price_egp,
    case when company.company_max_price is not null and company.company_max_price>=coalesce(base.current_price_egp,0)
      then 'company_verified' else base.current_price_source end current_price_source,
    case when company.company_max_price is not null and company.company_max_price>=coalesce(base.current_price_egp,0)
      then company.best_source_record else base.current_price_source_record end current_price_source_record,
    case when company.company_max_price is not null and company.company_max_price>=coalesce(base.current_price_egp,0)
      then company.latest_approved_at else base.current_price_observed_at end current_price_observed_at,
    case when company.company_max_price is not null and company.company_max_price>=coalesce(base.current_price_egp,0)
      then 'record_date' else base.current_price_date_precision end current_price_date_precision,
    concat_ws(' ',base.search_text,company.name_en,company.name_ar,company.scientific_name,company.manufacturer,
      company.drug_class,company.route,company.category,array_to_string(company.company_slugs,' ')) search_text
  from public.medicine_canonical_products_v1 base
  left join company_group company using(canonical_id)
  left join price_stats prices using(canonical_id)
  left join offer_stats offers using(canonical_id)
), company_only as (
  select company.canonical_id, company.canonical_key, company.name_en, company.name_ar,
    company.scientific_name, company.manufacturer, company.drug_class, company.route, company.category,
    company.image_url, company.product_url egyptdwa_source_url, company.barcode, company.product_code code,
    null::text custom_product_code, null::bigint primary_medicines2_id,
    prices.max_price current_price_egp, 'EGP'::text price_currency,
    prices.min_price min_price_egp, prices.max_price max_price_egp,
    coalesce(prices.observation_count,0) price_observation_count,
    coalesce(prices.distinct_count,0) distinct_count_price_count,
    coalesce(prices.distinct_count,0)>1 has_price_history,
    company.company_product_count source_record_count, 1::integer source_count,
    array['company_verified']::text[] source_systems,
    false has_verified_dataset, false has_operational_catalog, false has_egyptdwa_source,
    true has_company_verified_source, company.company_product_count, company.company_slugs,
    coalesce(offers.marketplace_offer_count,0) marketplace_offer_count,
    coalesce(offers.marketplace_seller_count,0) marketplace_seller_count,
    offers.lowest_marketplace_price_egp,
    'company_verified'::text current_price_source, company.best_source_record current_price_source_record,
    company.latest_approved_at current_price_observed_at, 'record_date'::text current_price_date_precision,
    concat_ws(' ',company.name_en,company.name_ar,company.scientific_name,company.manufacturer,
      company.drug_class,company.route,company.category,array_to_string(company.company_slugs,' ')) search_text
  from company_group company
  left join price_stats prices using(canonical_id)
  left join offer_stats offers using(canonical_id)
  where not exists(select 1 from public.medicine_canonical_products_v1 base where base.canonical_id=company.canonical_id)
)
select * from existing_rows union all select * from company_only;

grant select on public.medicine_encyclopedia_products_v2 to anon, authenticated, service_role;
