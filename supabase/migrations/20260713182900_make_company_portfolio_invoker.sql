-- Public company portfolios can be served entirely from public RLS-protected
-- objects, so this RPC no longer needs definer privileges.
create or replace function public.manufacturer_medicine_portfolio_v1 (
  p_company_slug text,
  p_query text default '',
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
  canonical_id bigint, name_en text, name_ar text, scientific_name text,
  manufacturer text, drug_class text, route text, category text,
  image_url text, current_price_egp numeric, price_currency text,
  has_price_history boolean, source_count integer,
  marketplace_offer_count integer, total_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with filtered as (
    select product.*
    from public.medicine_encyclopedia_products_v2 product
    where exists (
      select 1
      from public.medicine_product_company_relationships relation
      where relation.canonical_id = product.canonical_id
        and relation.company_slug = p_company_slug
    )
      and (
        btrim(coalesce(p_query, '')) = ''
        or coalesce(product.name_en, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(product.name_ar, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(product.scientific_name, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(product.manufacturer, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(product.drug_class, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(product.category, '') ilike '%' || btrim(p_query) || '%'
      )
  )
  select
    filtered.canonical_id, filtered.name_en, filtered.name_ar,
    filtered.scientific_name, filtered.manufacturer, filtered.drug_class,
    filtered.route, filtered.category, filtered.image_url,
    filtered.current_price_egp, filtered.price_currency,
    filtered.has_price_history, filtered.source_count,
    filtered.marketplace_offer_count, count(*) over()
  from filtered
  order by filtered.source_count desc nulls last,
    coalesce(filtered.name_en, filtered.name_ar), filtered.canonical_id
  limit greatest(1, least(coalesce(p_limit, 60), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.manufacturer_medicine_portfolio_v1(text, text, integer, integer)
  from public;
grant execute on function public.manufacturer_medicine_portfolio_v1(text, text, integer, integer)
  to anon, authenticated, service_role;
