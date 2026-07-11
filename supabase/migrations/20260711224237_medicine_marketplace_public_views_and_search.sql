create or replace view public.medicine_encyclopedia_price_history_v2 with (security_invoker = true) as
select history.canonical_id, history.price, history.currency, history.source_system, history.source_name,
  history.first_observed_at, history.last_observed_at, history.date_precision, history.source_record_count,
  product.current_price_egp, (history.price=product.current_price_egp) is_current_candidate,
  history.price_delta_from_previous
from public.medicine_price_history_v1 history
join public.medicine_encyclopedia_products_v2 product using(canonical_id)
union all
select company.canonical_id, company.current_price_egp price, 'EGP'::text currency,
  'company_verified'::text source_system,
  'Verified company portfolio: '||profile.display_name source_name,
  company.approved_at first_observed_at, company.approved_at last_observed_at,
  'record_date'::text date_precision, 1::integer source_record_count,
  product.current_price_egp, (company.current_price_egp=product.current_price_egp) is_current_candidate,
  null::numeric price_delta_from_previous
from public.company_verified_medicine_products company
join public.industry_company_profiles profile on profile.id=company.profile_id
join public.medicine_encyclopedia_products_v2 product using(canonical_id)
where company.status='active' and company.current_price_egp>0
  and profile.verification_status='verified' and profile.is_public=true;

grant select on public.medicine_encyclopedia_price_history_v2 to anon, authenticated, service_role;

create or replace view public.medicine_encyclopedia_facets_v2 with (security_invoker = true) as
select 'manufacturer'::text facet_type, manufacturer facet_value, count(*)::bigint product_count
from public.medicine_encyclopedia_products_v2 where nullif(btrim(manufacturer),'') is not null group by manufacturer
union all
select 'drug_class', drug_class, count(*)::bigint
from public.medicine_encyclopedia_products_v2 where nullif(btrim(drug_class),'') is not null group by drug_class
union all
select 'route', route, count(*)::bigint
from public.medicine_encyclopedia_products_v2 where nullif(btrim(route),'') is not null group by route;

grant select on public.medicine_encyclopedia_facets_v2 to anon, authenticated, service_role;

create or replace view public.marketplace_public_offers_v1 with (security_invoker = true) as
select offer.id, offer.canonical_id, offer.seller_profile_id, seller.seller_slug,
  seller.display_name seller_name, seller.seller_type, seller.logo_url seller_logo_url,
  seller.country seller_country, seller.city seller_city, seller.service_areas,
  seller.fulfillment_modes, seller.advantages seller_advantages,
  offer.seller_sku, offer.offer_title, offer.unit_price_egp, offer.list_price_egp,
  offer.minimum_order_quantity, offer.packaging, offer.stock_status, offer.lead_time_days,
  offer.minimum_expiry_months, offer.delivery_scope, offer.advantages, offer.payment_terms,
  offer.cold_chain_supported, offer.prescription_handling, offer.published_at,
  product.name_en, product.name_ar, product.scientific_name, product.manufacturer,
  product.current_price_egp encyclopedia_price_egp,
  case when product.current_price_egp>0
    then round(((product.current_price_egp-offer.unit_price_egp)/product.current_price_egp)*100,2)
    else null end price_difference_percent
from public.marketplace_medicine_offers offer
join public.marketplace_seller_profiles seller on seller.id=offer.seller_profile_id
join public.medicine_encyclopedia_products_v2 product on product.canonical_id=offer.canonical_id
where offer.status='approved' and offer.published_at is not null
  and seller.verification_status='verified' and seller.is_public=true;

grant select on public.marketplace_public_offers_v1 to anon, authenticated, service_role;

create or replace function public.search_medicine_encyclopedia_v2(
  p_query text default '', p_manufacturer text default null, p_drug_class text default null,
  p_route text default null, p_scientific_name text default null,
  p_min_price numeric default null, p_max_price numeric default null,
  p_has_price_history boolean default null, p_verified_only boolean default null,
  p_has_marketplace_offers boolean default null, p_sort text default 'relevance',
  p_limit integer default 60, p_offset integer default 0
)
returns table(
  canonical_id bigint, name_en text, name_ar text, scientific_name text, manufacturer text,
  drug_class text, route text, category text, image_url text, barcode text, code text,
  current_price_egp numeric, price_currency text, min_price_egp numeric, max_price_egp numeric,
  price_observation_count integer, distinct_price_count integer, has_price_history boolean,
  source_record_count integer, source_count integer, source_systems text[], has_verified_dataset boolean,
  has_company_verified_source boolean, marketplace_offer_count integer, marketplace_seller_count integer,
  lowest_marketplace_price_egp numeric, current_price_source text, relevance numeric, total_count bigint
)
language plpgsql
stable
set search_path=public,extensions,pg_catalog
as $$
declare
  q text:=btrim(coalesce(p_query,''));
  row_limit integer:=greatest(1,least(coalesce(p_limit,60),100));
  row_offset integer:=greatest(0,least(coalesce(p_offset,0),10000));
  sort_mode text:=case when p_sort in ('relevance','name','price_high','price_low','history','sources','offers') then p_sort else 'relevance' end;
begin
  return query
  with candidates as (
    select product.*,
      case when q='' then 0::numeric
        when product.barcode=q or product.code=q then 10000::numeric
        when lower(coalesce(product.name_en,''))=lower(q) or lower(coalesce(product.name_ar,''))=lower(q) then 9000::numeric
        when lower(coalesce(product.name_en,'')) like lower(q)||'%' or lower(coalesce(product.name_ar,'')) like lower(q)||'%' then 7000::numeric
        else (5000+greatest(
          extensions.similarity(coalesce(product.name_en,''),q),
          extensions.similarity(coalesce(product.name_ar,''),q),
          extensions.similarity(coalesce(product.scientific_name,''),q),
          extensions.similarity(coalesce(product.manufacturer,''),q)
        )*100)::numeric end relevance_score
    from public.medicine_encyclopedia_products_v2 product
    where (q='' or product.barcode=q or product.code=q or product.search_text ilike '%'||q||'%')
      and (p_manufacturer is null or product.manufacturer=p_manufacturer)
      and (p_drug_class is null or product.drug_class=p_drug_class)
      and (p_route is null or product.route=p_route)
      and (p_scientific_name is null or product.scientific_name ilike '%'||p_scientific_name||'%')
      and (p_min_price is null or product.current_price_egp>=p_min_price)
      and (p_max_price is null or product.current_price_egp<=p_max_price)
      and (p_has_price_history is null or product.has_price_history=p_has_price_history)
      and (p_verified_only is null or not p_verified_only or product.has_verified_dataset or product.has_company_verified_source)
      and (p_has_marketplace_offers is null or ((product.marketplace_offer_count>0)=p_has_marketplace_offers))
  ), counted as (
    select candidates.*,count(*) over() total_rows from candidates
  )
  select counted.canonical_id,counted.name_en,counted.name_ar,counted.scientific_name,
    counted.manufacturer,counted.drug_class,counted.route,counted.category,counted.image_url,
    counted.barcode,counted.code,counted.current_price_egp,counted.price_currency,
    counted.min_price_egp,counted.max_price_egp,counted.price_observation_count,
    counted.distinct_price_count,counted.has_price_history,counted.source_record_count,
    counted.source_count,counted.source_systems,counted.has_verified_dataset,
    counted.has_company_verified_source,counted.marketplace_offer_count,counted.marketplace_seller_count,
    counted.lowest_marketplace_price_egp,counted.current_price_source,counted.relevance_score,counted.total_rows
  from counted
  order by
    case when sort_mode='relevance' then counted.relevance_score end desc,
    case when sort_mode='price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode='price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode='history' then counted.distinct_price_count end desc,
    case when sort_mode='sources' then counted.source_count end desc,
    case when sort_mode='offers' then counted.marketplace_offer_count end desc,
    case when sort_mode='name' then coalesce(counted.name_en,counted.name_ar) end asc,
    coalesce(counted.name_en,counted.name_ar),counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;

grant execute on function public.search_medicine_encyclopedia_v2(text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer) to anon,authenticated,service_role;

drop policy if exists marketplace_offers_member_insert on public.marketplace_medicine_offers;
create policy marketplace_offers_member_insert
on public.marketplace_medicine_offers for insert to authenticated
with check (
  submitted_by=(select auth.uid()) and status in ('draft','submitted')
  and reviewed_by is null and reviewed_at is null and review_notes is null and published_at is null
  and (select private.is_org_member(organization_id))
  and exists(select 1 from public.marketplace_seller_profiles seller where seller.id=seller_profile_id and seller.organization_id=organization_id and seller.verification_status='verified')
  and exists(select 1 from public.medicine_encyclopedia_products_v2 product where product.canonical_id=canonical_id)
);
