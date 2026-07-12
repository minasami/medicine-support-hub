-- Separate empty browsing, primary indexed search, and fuzzy fallback so PostgreSQL can use each index.

create index if not exists medicine_search_index_v1_name_en_lower_idx
  on private.medicine_search_index_v1(lower(name_en)) where name_en is not null;
create index if not exists medicine_search_index_v1_name_ar_lower_idx
  on private.medicine_search_index_v1(lower(name_ar)) where name_ar is not null;

create or replace function public.search_medicine_encyclopedia_v4(
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
language plpgsql
stable
set search_path = public,private,extensions,pg_catalog
as $$
declare
  q text:=btrim(coalesce(p_query,''));
  q_normalized text:=lower(regexp_replace(btrim(coalesce(p_query,'')),'\s+',' ','g'));
  row_limit integer:=greatest(1,least(coalesce(p_limit,36),100));
  row_offset integer:=greatest(0,least(coalesce(p_offset,0),10000));
  query_mode text:=case when p_query_mode in ('all','any') then p_query_mode else 'all' end;
  sort_mode text:=case when p_sort in ('best','relevance','completeness','name','price_high','price_low','history','sources','offers') then p_sort else 'best' end;
  text_query tsquery;
begin
  if q='' then
    return query
    with filtered as (
      select indexed.*
      from private.medicine_search_index_v1 indexed
      where (p_manufacturer is null or indexed.manufacturer ilike '%'||btrim(p_manufacturer)||'%')
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
      select filtered.*,count(*) over() total_rows from filtered
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
      0::numeric,'complete_record'::text,0,counted.total_rows
    from counted
    order by
      case when sort_mode in ('best','completeness','relevance') then counted.completeness_score end desc,
      case when sort_mode='price_high' then counted.current_price_egp end desc nulls last,
      case when sort_mode='price_low' then counted.current_price_egp end asc nulls last,
      case when sort_mode='history' then counted.distinct_price_count end desc,
      case when sort_mode='sources' then counted.source_count end desc,
      case when sort_mode='offers' then counted.marketplace_offer_count end desc,
      case when sort_mode='name' then coalesce(counted.name_en,counted.name_ar) end asc,
      counted.image_authenticity_score desc,counted.source_count desc,
      coalesce(counted.name_en,counted.name_ar),counted.canonical_id
    limit row_limit offset row_offset;
    return;
  end if;

  if query_mode='any' then
    text_query:=websearch_to_tsquery('simple',regexp_replace(q_normalized,'\s+',' OR ','g'));
  else
    text_query:=plainto_tsquery('simple',q_normalized);
  end if;

  return query
  with terms as (
    select distinct term from regexp_split_to_table(q_normalized,'\s+') term where length(term)>=2
  ),term_total as (
    select count(*)::integer total_terms from terms
  ),primary_ids as materialized (
    select indexed.canonical_id from private.medicine_search_index_v1 indexed where indexed.search_vector@@text_query
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed where lower(indexed.barcode)=q_normalized
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed where lower(indexed.code)=q_normalized
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed where lower(indexed.name_en)=q_normalized
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed where lower(indexed.name_ar)=q_normalized
  ),primary_state as (
    select exists(select 1 from primary_ids) has_primary
  ),fuzzy_ids as materialized (
    select indexed.canonical_id from private.medicine_search_index_v1 indexed cross join primary_state
      where not primary_state.has_primary and indexed.name_en % q
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed cross join primary_state
      where not primary_state.has_primary and indexed.name_ar % q
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed cross join primary_state
      where not primary_state.has_primary and indexed.scientific_name % q
    union
    select indexed.canonical_id from private.medicine_search_index_v1 indexed cross join primary_state
      where not primary_state.has_primary and indexed.manufacturer % q
  ),candidate_ids as (
    select canonical_id from primary_ids
    union all
    select canonical_id from fuzzy_ids
  ),filtered as (
    select indexed.*
    from candidate_ids ids
    join private.medicine_search_index_v1 indexed using(canonical_id)
    where (p_manufacturer is null or indexed.manufacturer ilike '%'||btrim(p_manufacturer)||'%')
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
  ),candidates as (
    select indexed.*,matched.matched_terms,term_total.total_terms,
      case
        when lower(coalesce(indexed.barcode,''))=q_normalized or lower(coalesce(indexed.code,''))=q_normalized then 10000::numeric
        when lower(coalesce(indexed.name_en,''))=q_normalized or lower(coalesce(indexed.name_ar,''))=q_normalized then 9500::numeric
        when lower(coalesce(indexed.name_en,'')) like q_normalized||'%' or lower(coalesce(indexed.name_ar,'')) like q_normalized||'%' then 8200::numeric
        when indexed.search_blob like '%'||q_normalized||'%' then 7200::numeric
        else (5000+matched.matched_terms*260+greatest(
          similarity(coalesce(indexed.name_en,''),q),similarity(coalesce(indexed.name_ar,''),q),
          similarity(coalesce(indexed.scientific_name,''),q),similarity(coalesce(indexed.manufacturer,''),q)
        )*200+indexed.completeness_score)::numeric
      end relevance_score,
      case
        when lower(coalesce(indexed.barcode,''))=q_normalized or lower(coalesce(indexed.code,''))=q_normalized then 'exact_identifier'
        when lower(coalesce(indexed.name_en,''))=q_normalized or lower(coalesce(indexed.name_ar,''))=q_normalized then 'exact_name'
        when lower(coalesce(indexed.name_en,'')) like q_normalized||'%' or lower(coalesce(indexed.name_ar,'')) like q_normalized||'%' then 'name_prefix'
        when indexed.search_blob like '%'||q_normalized||'%' then 'exact_phrase'
        when matched.matched_terms=term_total.total_terms and term_total.total_terms>0 then 'all_terms'
        when matched.matched_terms>0 then 'partial_terms'
        else 'fuzzy'
      end match_reason_value
    from filtered indexed cross join term_total
    cross join lateral(select count(*)::integer matched_terms from terms where indexed.search_blob like '%'||terms.term||'%') matched
  ),counted as (
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
    case when sort_mode in ('best','relevance') then counted.relevance_score end desc,
    case when sort_mode='completeness' then counted.completeness_score end desc,
    case when sort_mode='price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode='price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode='history' then counted.distinct_price_count end desc,
    case when sort_mode='sources' then counted.source_count end desc,
    case when sort_mode='offers' then counted.marketplace_offer_count end desc,
    case when sort_mode='name' then coalesce(counted.name_en,counted.name_ar) end asc,
    counted.completeness_score desc,counted.image_authenticity_score desc,counted.source_count desc,
    coalesce(counted.name_en,counted.name_ar),counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;
