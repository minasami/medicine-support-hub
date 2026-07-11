create or replace function public.search_medicines_catalog_index(p_query text, p_limit integer default 60)
returns table (
  entity_type text,
  entity_key text,
  title text,
  subtitle text,
  href text,
  category text,
  weight numeric
)
language sql stable security invoker
set search_path = public
as $$
  select
    'catalog_product'::text,
    product.canonical_id::text,
    coalesce(nullif(product.name_en, ''), nullif(product.name_ar, ''), 'Product #' || product.canonical_id::text),
    concat_ws(' · ', nullif(product.name_ar, ''), product.scientific_name, product.manufacturer,
      case when product.current_price_egp is not null then product.current_price_egp::text || ' EGP' end,
      case when product.has_price_history then product.distinct_price_count::text || ' price points' end),
    '/catalog/' || product.canonical_id::text,
    coalesce(product.drug_class, product.category, 'medicine catalog'),
    (30 + case when product.has_verified_dataset then 10 else 0 end + least(product.source_count, 5))::numeric
  from public.search_medicine_canonical_v1(
    p_query := p_query,
    p_limit := greatest(1, least(coalesce(p_limit, 60), 100))
  ) product;
$$;

revoke all on function public.search_medicines_catalog_index(text, integer) from public;
grant execute on function public.search_medicines_catalog_index(text, integer) to anon, authenticated;
