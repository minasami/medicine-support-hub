-- Precompute the connected public medicine discovery document.
-- This avoids rebuilding the multi-source encyclopedia and image preference graph per search request.

create materialized view private.medicine_search_index_v1 as
select
  product.canonical_id,
  product.name_en,
  product.name_ar,
  product.scientific_name,
  product.manufacturer,
  product.drug_class,
  product.route,
  product.category,
  preferred.image_url,
  preferred.source_page_url as image_source_url,
  preferred.source_domain as image_source_domain,
  preferred.source_kind as image_source_kind,
  coalesce(preferred.authenticity_score,0)::integer as image_authenticity_score,
  coalesce(preferred.match_score,0)::integer as image_match_score,
  coalesce(preferred.image_is_reviewed,false) as image_is_verified,
  product.barcode,
  product.code,
  product.current_price_egp,
  product.price_currency,
  product.min_price_egp,
  product.max_price_egp,
  product.price_observation_count,
  product.distinct_price_count,
  product.has_price_history,
  product.source_record_count,
  product.source_count,
  product.source_systems,
  product.has_verified_dataset,
  product.has_company_verified_source,
  product.marketplace_offer_count,
  product.marketplace_seller_count,
  product.lowest_marketplace_price_egp,
  product.current_price_source,
  lower(concat_ws(' ', product.name_en, product.name_ar, product.scientific_name, product.manufacturer,
    product.drug_class, product.route, product.category, product.barcode, product.code,
    array_to_string(product.source_systems,' '), product.search_text)) as search_blob,
  to_tsvector('simple', lower(concat_ws(' ', product.name_en, product.name_ar, product.scientific_name,
    product.manufacturer, product.drug_class, product.route, product.category, product.barcode,
    product.code, array_to_string(product.source_systems,' '), product.search_text))) as search_vector,
  (
    (case when nullif(btrim(coalesce(product.name_en,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.name_ar,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.scientific_name,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.manufacturer,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.drug_class,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.route,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.category,'')),'') is not null then 1 else 0 end) +
    (case when preferred.image_url is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.barcode,'')),'') is not null then 1 else 0 end) +
    (case when nullif(btrim(coalesce(product.code,'')),'') is not null then 1 else 0 end) +
    (case when product.current_price_egp is not null then 1 else 0 end) +
    (case when product.has_verified_dataset or product.has_company_verified_source or product.source_count > 1 then 1 else 0 end) +
    (case when product.has_price_history then 1 else 0 end) +
    (case when product.marketplace_offer_count > 0 then 1 else 0 end)
  )::integer as complete_field_count,
  (
    (case when nullif(btrim(coalesce(product.name_en,'')),'') is not null then 8 else 0 end) +
    (case when nullif(btrim(coalesce(product.name_ar,'')),'') is not null then 8 else 0 end) +
    (case when nullif(btrim(coalesce(product.scientific_name,'')),'') is not null then 12 else 0 end) +
    (case when nullif(btrim(coalesce(product.manufacturer,'')),'') is not null then 10 else 0 end) +
    (case when nullif(btrim(coalesce(product.drug_class,'')),'') is not null then 8 else 0 end) +
    (case when nullif(btrim(coalesce(product.route,'')),'') is not null then 6 else 0 end) +
    (case when nullif(btrim(coalesce(product.category,'')),'') is not null then 6 else 0 end) +
    (case when preferred.image_url is not null then 12 else 0 end) +
    (case when nullif(btrim(coalesce(product.barcode,'')),'') is not null then 8 else 0 end) +
    (case when nullif(btrim(coalesce(product.code,'')),'') is not null then 4 else 0 end) +
    (case when product.current_price_egp is not null then 8 else 0 end) +
    (case when product.has_verified_dataset or product.has_company_verified_source or product.source_count > 1 then 6 else 0 end) +
    (case when product.has_price_history then 2 else 0 end) +
    (case when product.marketplace_offer_count > 0 then 2 else 0 end)
  )::integer as completeness_score,
  now() as indexed_at
from public.medicine_encyclopedia_products_v2 product
left join public.medicine_preferred_images_v1 preferred using(canonical_id)
with data;

create unique index medicine_search_index_v1_id_idx on private.medicine_search_index_v1(canonical_id);
create index medicine_search_index_v1_vector_idx on private.medicine_search_index_v1 using gin(search_vector);
create index medicine_search_index_v1_name_en_trgm_idx on private.medicine_search_index_v1 using gin(name_en extensions.gin_trgm_ops);
create index medicine_search_index_v1_name_ar_trgm_idx on private.medicine_search_index_v1 using gin(name_ar extensions.gin_trgm_ops);
create index medicine_search_index_v1_scientific_trgm_idx on private.medicine_search_index_v1 using gin(scientific_name extensions.gin_trgm_ops);
create index medicine_search_index_v1_manufacturer_trgm_idx on private.medicine_search_index_v1 using gin(manufacturer extensions.gin_trgm_ops);
create index medicine_search_index_v1_class_trgm_idx on private.medicine_search_index_v1 using gin(drug_class extensions.gin_trgm_ops);
create index medicine_search_index_v1_route_trgm_idx on private.medicine_search_index_v1 using gin(route extensions.gin_trgm_ops);
create index medicine_search_index_v1_category_trgm_idx on private.medicine_search_index_v1 using gin(category extensions.gin_trgm_ops);
create index medicine_search_index_v1_barcode_lower_idx on private.medicine_search_index_v1(lower(barcode)) where barcode is not null;
create index medicine_search_index_v1_code_lower_idx on private.medicine_search_index_v1(lower(code)) where code is not null;
create index medicine_search_index_v1_completeness_idx on private.medicine_search_index_v1(completeness_score desc, image_authenticity_score desc, source_count desc, canonical_id);
create index medicine_search_index_v1_price_idx on private.medicine_search_index_v1(current_price_egp) where current_price_egp is not null;
create index medicine_search_index_v1_sources_idx on private.medicine_search_index_v1 using gin(source_systems);

create or replace function public.refresh_medicine_search_index_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  row_count bigint;
  refreshed timestamptz := clock_timestamp();
begin
  refresh materialized view private.medicine_search_index_v1;
  select count(*) into row_count from private.medicine_search_index_v1;
  return jsonb_build_object('refreshed_at',refreshed,'products',row_count);
end;
$$;

revoke all on function public.refresh_medicine_search_index_v1() from public, anon, authenticated;
grant execute on function public.refresh_medicine_search_index_v1() to service_role;

create or replace function public.search_medicine_encyclopedia_v4(
  p_query text default '',
  p_manufacturer text default null,
  p_drug_class text default null,
  p_route text default null,
  p_category text default null,
  p_scientific_name text default null,
  p_source_system text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_has_price_history boolean default null,
  p_verified_only boolean default null,
  p_has_marketplace_offers boolean default null,
  p_has_image boolean default null,
  p_min_completeness integer default null,
  p_query_mode text default 'all',
  p_sort text default 'best',
  p_limit integer default 36,
  p_offset integer default 0
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
language plpgsql
stable
set search_path = public, private, extensions, pg_catalog
as $$
declare
  q text := btrim(coalesce(p_query,''));
  q_normalized text := lower(regexp_replace(btrim(coalesce(p_query,'')), '\s+', ' ', 'g'));
  row_limit integer := greatest(1,least(coalesce(p_limit,36),100));
  row_offset integer := greatest(0,least(coalesce(p_offset,0),10000));
  query_mode text := case when p_query_mode in ('all','any') then p_query_mode else 'all' end;
  sort_mode text := case when p_sort in ('best','relevance','completeness','name','price_high','price_low','history','sources','offers') then p_sort else 'best' end;
  text_query tsquery;
begin
  if q <> '' then
    if query_mode='any' then
      text_query := websearch_to_tsquery('simple', regexp_replace(q_normalized,'\s+',' OR ','g'));
    else
      text_query := plainto_tsquery('simple',q_normalized);
    end if;
  end if;

  return query
  with terms as (
    select distinct term from regexp_split_to_table(q_normalized,'\s+') term where length(term)>=2
  ), term_total as (
    select count(*)::integer total_terms from terms
  ), candidates as (
    select indexed.*,
      matched.matched_terms,
      term_total.total_terms,
      case
        when q='' then 0::numeric
        when lower(coalesce(indexed.barcode,''))=q_normalized or lower(coalesce(indexed.code,''))=q_normalized then 10000::numeric
        when lower(coalesce(indexed.name_en,''))=q_normalized or lower(coalesce(indexed.name_ar,''))=q_normalized then 9500::numeric
        when lower(coalesce(indexed.name_en,'')) like q_normalized||'%' or lower(coalesce(indexed.name_ar,'')) like q_normalized||'%' then 8200::numeric
        when indexed.search_blob like '%'||q_normalized||'%' then 7200::numeric
        else (5000 + matched.matched_terms*260 + greatest(
          similarity(coalesce(indexed.name_en,''),q),similarity(coalesce(indexed.name_ar,''),q),
          similarity(coalesce(indexed.scientific_name,''),q),similarity(coalesce(indexed.manufacturer,''),q)
        )*200 + indexed.completeness_score)::numeric
      end relevance_score,
      case
        when q='' then 'complete_record'
        when lower(coalesce(indexed.barcode,''))=q_normalized or lower(coalesce(indexed.code,''))=q_normalized then 'exact_identifier'
        when lower(coalesce(indexed.name_en,''))=q_normalized or lower(coalesce(indexed.name_ar,''))=q_normalized then 'exact_name'
        when lower(coalesce(indexed.name_en,'')) like q_normalized||'%' or lower(coalesce(indexed.name_ar,'')) like q_normalized||'%' then 'name_prefix'
        when indexed.search_blob like '%'||q_normalized||'%' then 'exact_phrase'
        when matched.matched_terms=term_total.total_terms and term_total.total_terms>0 then 'all_terms'
        when matched.matched_terms>0 then 'partial_terms'
        else 'fuzzy'
      end match_reason_value
    from private.medicine_search_index_v1 indexed
    cross join term_total
    cross join lateral (
      select count(*)::integer matched_terms from terms where indexed.search_blob like '%'||terms.term||'%'
    ) matched
    where (
      q=''
      or lower(coalesce(indexed.barcode,''))=q_normalized
      or lower(coalesce(indexed.code,''))=q_normalized
      or indexed.search_vector @@ text_query
      or indexed.name_en % q
      or indexed.name_ar % q
      or indexed.scientific_name % q
      or indexed.manufacturer % q
    )
      and (p_manufacturer is null or indexed.manufacturer ilike '%'||btrim(p_manufacturer)||'%')
      and (p_drug_class is null or indexed.drug_class ilike '%'||btrim(p_drug_class)||'%')
      and (p_route is null or indexed.route ilike '%'||btrim(p_route)||'%')
      and (p_category is null or indexed.category ilike '%'||btrim(p_category)||'%')
      and (p_scientific_name is null or indexed.scientific_name ilike '%'||btrim(p_scientific_name)||'%')
      and (p_source_system is null or p_source_system=any(indexed.source_systems))
      and (p_min_price is null or indexed.current_price_egp>=p_min_price)
      and (p_max_price is null or indexed.current_price_egp<=p_max_price)
      and (p_has_price_history is null or indexed.has_price_history=p_has_price_history)
      and (p_verified_only is null or not p_verified_only or indexed.has_verified_dataset or indexed.has_company_verified_source)
      and (p_has_marketplace_offers is null or ((indexed.marketplace_offer_count>0)=p_has_marketplace_offers))
      and (p_has_image is null or ((indexed.image_url is not null)=p_has_image))
      and (p_min_completeness is null or indexed.completeness_score>=greatest(0,least(p_min_completeness,100)))
  ), counted as (
    select candidates.*,count(*) over() total_rows from candidates
  )
  select counted.canonical_id,counted.name_en,counted.name_ar,counted.scientific_name,counted.manufacturer,
    counted.drug_class,counted.route,counted.category,counted.image_url,counted.image_source_url,
    counted.image_source_domain,counted.image_source_kind,counted.image_authenticity_score,counted.image_match_score,
    counted.image_is_verified,counted.barcode,counted.code,counted.current_price_egp,counted.price_currency,
    counted.min_price_egp,counted.max_price_egp,counted.price_observation_count,counted.distinct_price_count,
    counted.has_price_history,counted.source_record_count,counted.source_count,counted.source_systems,
    counted.has_verified_dataset,counted.has_company_verified_source,counted.marketplace_offer_count,
    counted.marketplace_seller_count,counted.lowest_marketplace_price_egp,counted.current_price_source,
    counted.complete_field_count,14,counted.completeness_score,counted.completeness_score,
    counted.relevance_score,counted.match_reason_value,counted.matched_terms,counted.total_rows
  from counted
  order by
    case when sort_mode in ('best','relevance') and q<>'' then counted.relevance_score end desc,
    case when sort_mode in ('best','completeness') then counted.completeness_score end desc,
    case when sort_mode='price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode='price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode='history' then counted.distinct_price_count end desc,
    case when sort_mode='sources' then counted.source_count end desc,
    case when sort_mode='offers' then counted.marketplace_offer_count end desc,
    case when sort_mode='name' then coalesce(counted.name_en,counted.name_ar) end asc,
    counted.relevance_score desc,counted.completeness_score desc,counted.image_authenticity_score desc,
    counted.source_count desc,coalesce(counted.name_en,counted.name_ar),counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;

grant execute on function public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) to anon,authenticated;
