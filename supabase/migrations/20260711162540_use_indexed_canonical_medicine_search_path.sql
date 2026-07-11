create or replace function public.search_medicine_canonical_v1(
  p_query text default '',
  p_manufacturer text default null,
  p_drug_class text default null,
  p_route text default null,
  p_scientific_name text default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_has_price_history boolean default null,
  p_verified_only boolean default null,
  p_sort text default 'relevance',
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  canonical_id bigint,
  name_en text,
  name_ar text,
  scientific_name text,
  manufacturer text,
  drug_class text,
  route text,
  category text,
  image_url text,
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
  current_price_source text,
  relevance numeric,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, extensions, pg_catalog
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  row_limit integer := greatest(1, least(coalesce(p_limit, 60), 100));
  row_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
  sort_mode text := case when p_sort in ('relevance','name','price_high','price_low','history','sources') then p_sort else 'relevance' end;
begin
  if q = '' then
    return query
    with filtered as (
      select product.*, 0::numeric relevance_score
      from public.medicine_canonical_products_v1 product
      where (p_manufacturer is null or product.manufacturer = p_manufacturer)
        and (p_drug_class is null or product.drug_class = p_drug_class)
        and (p_route is null or product.route = p_route)
        and (p_scientific_name is null or product.scientific_name ilike '%' || p_scientific_name || '%')
        and (p_min_price is null or product.current_price_egp >= p_min_price)
        and (p_max_price is null or product.current_price_egp <= p_max_price)
        and (p_has_price_history is null or product.has_price_history = p_has_price_history)
        and (p_verified_only is null or not p_verified_only or product.has_verified_dataset)
    ), counted as (
      select filtered.*, count(*) over() total_rows from filtered
    )
    select counted.canonical_id, counted.name_en, counted.name_ar, counted.scientific_name,
      counted.manufacturer, counted.drug_class, counted.route, counted.category, counted.image_url,
      counted.barcode, counted.code, counted.current_price_egp, counted.price_currency,
      counted.min_price_egp, counted.max_price_egp, counted.price_observation_count,
      counted.distinct_price_count, counted.has_price_history, counted.source_record_count,
      counted.source_count, counted.source_systems, counted.has_verified_dataset,
      counted.current_price_source, counted.relevance_score, counted.total_rows
    from counted
    order by
      case when sort_mode = 'price_high' then counted.current_price_egp end desc nulls last,
      case when sort_mode = 'price_low' then counted.current_price_egp end asc nulls last,
      case when sort_mode = 'history' then counted.distinct_price_count end desc,
      case when sort_mode = 'sources' then counted.source_count end desc,
      coalesce(counted.name_en, counted.name_ar), counted.canonical_id
    limit row_limit offset row_offset;
    return;
  end if;

  return query
  with candidates as (
    select product.*,
      case
        when product.barcode = q or product.code = q then 10000::numeric
        when lower(coalesce(product.name_en, '')) = lower(q) or lower(coalesce(product.name_ar, '')) = lower(q) then 9000::numeric
        when lower(coalesce(product.name_en, '')) like lower(q) || '%' or lower(coalesce(product.name_ar, '')) like lower(q) || '%' then 7000::numeric
        else (5000 + greatest(
          extensions.similarity(coalesce(product.name_en, ''), q),
          extensions.similarity(coalesce(product.name_ar, ''), q),
          extensions.similarity(coalesce(product.scientific_name, ''), q),
          extensions.similarity(coalesce(product.manufacturer, ''), q)
        ) * 100)::numeric
      end relevance_score
    from public.medicine_canonical_products_v1 product
    where (product.barcode = q or product.code = q or product.search_text ilike '%' || q || '%')
      and (p_manufacturer is null or product.manufacturer = p_manufacturer)
      and (p_drug_class is null or product.drug_class = p_drug_class)
      and (p_route is null or product.route = p_route)
      and (p_scientific_name is null or product.scientific_name ilike '%' || p_scientific_name || '%')
      and (p_min_price is null or product.current_price_egp >= p_min_price)
      and (p_max_price is null or product.current_price_egp <= p_max_price)
      and (p_has_price_history is null or product.has_price_history = p_has_price_history)
      and (p_verified_only is null or not p_verified_only or product.has_verified_dataset)
  ), counted as (
    select candidates.*, count(*) over() total_rows from candidates
  )
  select counted.canonical_id, counted.name_en, counted.name_ar, counted.scientific_name,
    counted.manufacturer, counted.drug_class, counted.route, counted.category, counted.image_url,
    counted.barcode, counted.code, counted.current_price_egp, counted.price_currency,
    counted.min_price_egp, counted.max_price_egp, counted.price_observation_count,
    counted.distinct_price_count, counted.has_price_history, counted.source_record_count,
    counted.source_count, counted.source_systems, counted.has_verified_dataset,
    counted.current_price_source, counted.relevance_score, counted.total_rows
  from counted
  order by
    case when sort_mode = 'relevance' then counted.relevance_score end desc,
    case when sort_mode = 'price_high' then counted.current_price_egp end desc nulls last,
    case when sort_mode = 'price_low' then counted.current_price_egp end asc nulls last,
    case when sort_mode = 'history' then counted.distinct_price_count end desc,
    case when sort_mode = 'sources' then counted.source_count end desc,
    case when sort_mode = 'name' then coalesce(counted.name_en, counted.name_ar) end asc,
    coalesce(counted.name_en, counted.name_ar), counted.canonical_id
  limit row_limit offset row_offset;
end;
$$;

revoke all on function public.search_medicine_canonical_v1(text,text,text,text,text,numeric,numeric,boolean,boolean,text,integer,integer) from public;
grant execute on function public.search_medicine_canonical_v1(text,text,text,text,text,numeric,numeric,boolean,boolean,text,integer,integer) to anon, authenticated;
