-- Add a bounded browse plan for empty guest searches while preserving the indexed v4 search plan.

create or replace function public.search_medicine_encyclopedia_v5(
  p_query text default '',p_manufacturer text default null,p_drug_class text default null,
  p_route text default null,p_category text default null,p_scientific_name text default null,
  p_source_system text default null,p_min_price numeric default null,p_max_price numeric default null,
  p_has_price_history boolean default null,p_verified_only boolean default null,
  p_has_marketplace_offers boolean default null,p_has_image boolean default null,
  p_min_completeness integer default null,p_query_mode text default 'all',p_sort text default 'best',
  p_limit integer default 36,p_offset integer default 0
)
returns table(
  canonical_id bigint,name_en text,name_ar text,scientific_name text,manufacturer text,drug_class text,
  route text,category text,image_url text,image_source_url text,image_source_domain text,image_source_kind text,
  image_authenticity_score integer,image_match_score integer,image_is_verified boolean,barcode text,code text,
  current_price_egp numeric,price_currency text,min_price_egp numeric,max_price_egp numeric,
  price_observation_count integer,distinct_price_count integer,has_price_history boolean,source_record_count integer,
  source_count integer,source_systems text[],has_verified_dataset boolean,has_company_verified_source boolean,
  marketplace_offer_count integer,marketplace_seller_count integer,lowest_marketplace_price_egp numeric,
  current_price_source text,complete_field_count integer,available_field_count integer,completeness_score integer,
  completeness_percent integer,relevance numeric,match_reason text,matched_terms integer,total_count bigint
)
language plpgsql stable security definer
set search_path = public,private,extensions,pg_catalog
as $$
declare
  q text:=btrim(coalesce(p_query,''));
  row_limit integer:=greatest(1,least(coalesce(p_limit,36),100));
  row_offset integer:=greatest(0,least(coalesce(p_offset,0),10000));
  total_products bigint;
begin
  if q=''
    and p_manufacturer is null and p_drug_class is null and p_route is null
    and p_category is null and p_scientific_name is null and p_source_system is null
    and p_min_price is null and p_max_price is null and p_has_price_history is null
    and p_verified_only is null and p_has_marketplace_offers is null and p_has_image is null
    and p_min_completeness is null and coalesce(p_sort,'best') in ('best','relevance','completeness')
  then
    select canonical_products into total_products
    from public.medicine_search_metrics_cache_v1 where singleton=true;
    if total_products is null then
      select count(*) into total_products from private.medicine_search_index_v1;
    end if;

    return query
    select indexed.canonical_id,indexed.name_en,indexed.name_ar,indexed.scientific_name,indexed.manufacturer,
      indexed.drug_class,indexed.route,indexed.category,indexed.image_url,indexed.image_source_url,
      indexed.image_source_domain,indexed.image_source_kind,indexed.image_authenticity_score,indexed.image_match_score,
      indexed.image_is_verified,indexed.barcode,indexed.code,indexed.current_price_egp,indexed.price_currency,
      indexed.min_price_egp,indexed.max_price_egp,indexed.price_observation_count,indexed.distinct_price_count,
      indexed.has_price_history,indexed.source_record_count,indexed.source_count,indexed.source_systems,
      indexed.has_verified_dataset,indexed.has_company_verified_source,indexed.marketplace_offer_count,
      indexed.marketplace_seller_count,indexed.lowest_marketplace_price_egp,indexed.current_price_source,
      indexed.complete_field_count,14,indexed.completeness_score,indexed.completeness_score,
      0::numeric,'complete_record'::text,0,total_products
    from private.medicine_search_index_v1 indexed
    order by indexed.completeness_score desc,indexed.image_authenticity_score desc,indexed.source_count desc,indexed.canonical_id
    limit row_limit offset row_offset;
    return;
  end if;

  return query
  select legacy.* from public.search_medicine_encyclopedia_v4_legacy(
    p_query,p_manufacturer,p_drug_class,p_route,p_category,p_scientific_name,p_source_system,
    p_min_price,p_max_price,p_has_price_history,p_verified_only,p_has_marketplace_offers,p_has_image,
    p_min_completeness,p_query_mode,p_sort,p_limit,p_offset
  ) legacy;
end;
$$;

revoke all on function public.search_medicine_encyclopedia_v5(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) from public;
grant execute on function public.search_medicine_encyclopedia_v5(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) to anon,authenticated,service_role;
