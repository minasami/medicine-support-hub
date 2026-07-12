-- Versioned medicine search with tolerant multi-term matching and partial filters.
-- v3 remains available for compatibility.

create or replace view public.medicine_encyclopedia_facets_v4
with (security_invoker = true)
as
select 'manufacturer'::text facet_type, manufacturer facet_value, count(*)::bigint product_count
from public.medicine_encyclopedia_products_v2
where nullif(btrim(manufacturer),'') is not null
group by manufacturer
union all
select 'drug_class', drug_class, count(*)::bigint
from public.medicine_encyclopedia_products_v2
where nullif(btrim(drug_class),'') is not null
group by drug_class
union all
select 'route', route, count(*)::bigint
from public.medicine_encyclopedia_products_v2
where nullif(btrim(route),'') is not null
group by route
union all
select 'category', category, count(*)::bigint
from public.medicine_encyclopedia_products_v2
where nullif(btrim(category),'') is not null
group by category
union all
select 'source_system', source_system, count(*)::bigint
from public.medicine_encyclopedia_products_v2 product
cross join lateral unnest(product.source_systems) source_system
group by source_system;

grant select on public.medicine_encyclopedia_facets_v4 to anon, authenticated;

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
  canonical_id bigint,
  name_en text,
  name_ar text,
  scientific_name text,
  manufacturer text,
  drug_class text,
  route text,
  category text,
  image_url text,
  image_source_url text,
  image_source_domain text,
  image_source_kind text,
  image_authenticity_score integer,
  image_match_score integer,
  image_is_verified boolean,
  barcode text,
  code text,
  current_price_egp numeric,
  price_currency text,
  min_price_egp numeric,
  max_price_egp numeric,
  price_observation_count integer,
  distinct_price_count integer,
  has_price_history boolean,
  source_record_count integer,
  source_count integer,
  source_systems text[],
  has_verified_dataset boolean,
  has_company_verified_source boolean,
  marketplace_offer_count integer,
  marketplace_seller_count integer,
  lowest_marketplace_price_egp numeric,
  current_price_source text,
  complete_field_count integer,
  available_field_count integer,
  completeness_score integer,
  completeness_percent integer,
  relevance numeric,
  match_reason text,
  matched_terms integer,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions, pg_catalog
as $$
declare
  q text := btrim(coalesce(p_query,''));
  q_normalized text := lower(regexp_replace(btrim(coalesce(p_query,'')), '\s+', ' ', 'g'));
  row_limit integer := greatest(1, least(coalesce(p_limit,36),100));
  row_offset integer := greatest(0, least(coalesce(p_offset,0),10000));
  query_mode text := case when p_query_mode in ('all','any') then p_query_mode else 'all' end;
  sort_mode text := case when p_sort in ('best','relevance','completeness','name','price_high','price_low','history','sources','offers') then p_sort else 'best' end;
begin
  return query
  with enriched as (
    select product.*,
      preferred.image_url as preferred_image_url,
      preferred.source_page_url as preferred_image_source_url,
      preferred.source_domain as preferred_image_source_domain,
      preferred.source_kind as preferred_image_source_kind,
      coalesce(preferred.authenticity_score,0)::integer as preferred_image_authenticity_score,
      coalesce(preferred.match_score,0)::integer as preferred_image_match_score,
      coalesce(preferred.image_is_reviewed,false) as preferred_image_is_verified,
      lower(concat_ws(' ', product.name_en, product.name_ar, product.scientific_name, product.manufacturer,
        product.drug_class, product.route, product.category, product.barcode, product.code,
        array_to_string(product.source_systems,' '), product.search_text)) as search_blob,
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
      )::integer as complete_fields,
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
      )::integer as completeness_points
    from public.medicine_encyclopedia_products_v2 product
    left join public.medicine_preferred_images_v1 preferred using(canonical_id)
  ), terms as (
    select distinct term
    from regexp_split_to_table(q_normalized,'\s+') term
    where length(term) >= 2
  ), term_total as (
    select count(*)::integer total_terms from terms
  ), scored as (
    select enriched.*,
      matches.matched_terms,
      term_total.total_terms,
      case
        when q='' then 0::numeric
        when lower(coalesce(enriched.barcode,''))=q_normalized or lower(coalesce(enriched.code,''))=q_normalized then 10000::numeric
        when lower(coalesce(enriched.name_en,''))=q_normalized or lower(coalesce(enriched.name_ar,''))=q_normalized then 9500::numeric
        when lower(coalesce(enriched.name_en,'')) like q_normalized||'%' or lower(coalesce(enriched.name_ar,'')) like q_normalized||'%' then 8200::numeric
        when enriched.search_blob like '%'||q_normalized||'%' then 7200::numeric
        else (4800 + matches.matched_terms*260 + greatest(
          extensions.similarity(coalesce(enriched.name_en,''),q),
          extensions.similarity(coalesce(enriched.name_ar,''),q),
          extensions.similarity(coalesce(enriched.scientific_name,''),q),
          extensions.similarity(coalesce(enriched.manufacturer,''),q)
        )*200 + enriched.completeness_points)::numeric
      end as relevance_score,
      case
        when q='' then 'complete_record'
        when lower(coalesce(enriched.barcode,''))=q_normalized or lower(coalesce(enriched.code,''))=q_normalized then 'exact_identifier'
        when lower(coalesce(enriched.name_en,''))=q_normalized or lower(coalesce(enriched.name_ar,''))=q_normalized then 'exact_name'
        when lower(coalesce(enriched.name_en,'')) like q_normalized||'%' or lower(coalesce(enriched.name_ar,'')) like q_normalized||'%' then 'name_prefix'
        when enriched.search_blob like '%'||q_normalized||'%' then 'exact_phrase'
        when matches.matched_terms = term_total.total_terms and term_total.total_terms > 0 then 'all_terms'
        when matches.matched_terms > 0 then 'partial_terms'
        else 'fuzzy'
      end as match_reason_value
    from enriched
    cross join term_total
    cross join lateral (
      select count(*)::integer matched_terms
      from terms
      where enriched.search_blob like '%'||terms.term||'%'
    ) matches
    where (
      q=''
      or lower(coalesce(enriched.barcode,''))=q_normalized
      or lower(coalesce(enriched.code,''))=q_normalized
      or enriched.search_blob like '%'||q_normalized||'%'
      or (query_mode='all' and term_total.total_terms>0 and matches.matched_terms=term_total.total_terms)
      or (query_mode='any' and matches.matched_terms>0)
      or greatest(
        extensions.similarity(coalesce(enriched.name_en,''),q),
        extensions.similarity(coalesce(enriched.name_ar,''),q),
        extensions.similarity(coalesce(enriched.scientific_name,''),q),
        extensions.similarity(coalesce(enriched.manufacturer,''),q)
      ) >= 0.22
    )
      and (p_manufacturer is null or enriched.manufacturer ilike '%'||btrim(p_manufacturer)||'%')
      and (p_drug_class is null or enriched.drug_class ilike '%'||btrim(p_drug_class)||'%')
      and (p_route is null or enriched.route ilike '%'||btrim(p_route)||'%')
      and (p_category is null or enriched.category ilike '%'||btrim(p_category)||'%')
      and (p_scientific_name is null or enriched.scientific_name ilike '%'||btrim(p_scientific_name)||'%')
      and (p_source_system is null or p_source_system = any(enriched.source_systems))
      and (p_min_price is null or enriched.current_price_egp >= p_min_price)
      and (p_max_price is null or enriched.current_price_egp <= p_max_price)
      and (p_has_price_history is null or enriched.has_price_history = p_has_price_history)
      and (p_verified_only is null or not p_verified_only or enriched.has_verified_dataset or enriched.has_company_verified_source)
      and (p_has_marketplace_offers is null or ((enriched.marketplace_offer_count>0)=p_has_marketplace_offers))
      and (p_has_image is null or ((enriched.preferred_image_url is not null)=p_has_image))
      and (p_min_completeness is null or enriched.completeness_points >= greatest(0,least(p_min_completeness,100)))
  ), counted as (
    select scored.*, count(*) over() total_rows from scored
  )
  select counted.canonical_id,counted.name_en,counted.name_ar,counted.scientific_name,
    counted.manufacturer,counted.drug_class,counted.route,counted.category,
    counted.preferred_image_url,counted.preferred_image_source_url,counted.preferred_image_source_domain,
    counted.preferred_image_source_kind,counted.preferred_image_authenticity_score,
    counted.preferred_image_match_score,counted.preferred_image_is_verified,
    counted.barcode,counted.code,counted.current_price_egp,counted.price_currency,
    counted.min_price_egp,counted.max_price_egp,counted.price_observation_count,
    counted.distinct_price_count,counted.has_price_history,counted.source_record_count,
    counted.source_count,counted.source_systems,counted.has_verified_dataset,
    counted.has_company_verified_source,counted.marketplace_offer_count,counted.marketplace_seller_count,
    counted.lowest_marketplace_price_egp,counted.current_price_source,
    counted.complete_fields,14,counted.completeness_points,counted.completeness_points,
    counted.relevance_score,counted.match_reason_value,counted.matched_terms,counted.total_rows
  from counted
  order by
    case when sort_mode in ('best','relevance') and q<>'' then counted.relevance_score end desc,
    case when sort_mode in ('best','completeness') then counted.completeness_points end desc,
    case when sort_mode='price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode='price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode='history' then counted.distinct_price_count end desc,
    case when sort_mode='sources' then counted.source_count end desc,
    case when sort_mode='offers' then counted.marketplace_offer_count end desc,
    case when sort_mode='name' then coalesce(counted.name_en,counted.name_ar) end asc,
    counted.relevance_score desc,
    counted.completeness_points desc,
    counted.preferred_image_authenticity_score desc,
    counted.source_count desc,
    coalesce(counted.name_en,counted.name_ar), counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;

grant execute on function public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) to anon, authenticated;
