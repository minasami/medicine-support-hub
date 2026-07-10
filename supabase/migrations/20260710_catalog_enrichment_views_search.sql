-- Public-safe enriched catalog and indexed search functions.

create or replace view public.medicines_catalog_enriched_v1
with (security_invoker = true)
as
select
  catalog.*,
  coalesce(catalog.category, egyptdwa.category_name) display_category,
  egyptdwa.category_name egyptdwa_category,
  egyptdwa.category_url egyptdwa_category_url,
  egyptdwa.image_url egyptdwa_image_url,
  egyptdwa.source_url egyptdwa_source_url,
  egyptdwa.product_views egyptdwa_product_views,
  egyptdwa.category_views egyptdwa_category_views,
  egyptdwa.observed_price egyptdwa_observed_price,
  egyptdwa.observed_currency egyptdwa_observed_currency,
  egyptdwa.match_method egyptdwa_match_method,
  egyptdwa.match_score egyptdwa_match_score,
  netmeds.generic_name international_generic_name,
  netmeds.disease_area international_disease_area,
  netmeds.prescription_required international_prescription_signal,
  netmeds.manufacturer_name international_manufacturer,
  netmeds.manufacturer_origin international_manufacturer_origin,
  netmeds.source_url international_source_url,
  netmeds.image_url international_image_url,
  netmeds.observed_price_text international_observed_price_text,
  netmeds.observed_currency international_observed_currency,
  netmeds.match_method international_match_method,
  netmeds.match_score international_match_score,
  ((egyptdwa.id is not null)::integer +
   (netmeds.id is not null)::integer) enrichment_source_count
from public.medicines_catalog catalog
left join public.medicine_catalog_source_evidence egyptdwa
  on egyptdwa.medicines2_id = catalog.id
 and egyptdwa.source_system = 'egyptdwa'
 and egyptdwa.confidence = 'verified'
left join public.medicine_catalog_source_evidence netmeds
  on netmeds.medicines2_id = catalog.id
 and netmeds.source_system = 'netmeds'
 and netmeds.confidence = 'verified';

grant select on public.medicines_catalog_enriched_v1 to anon, authenticated;

create or replace view public.medicines_catalog_metrics
with (security_invoker = true)
as
select
  count(*)::bigint total_active,
  count(*) filter (where dosage_form is not null)::bigint with_dosage_form,
  count(*) filter (where strength is not null)::bigint with_strength,
  count(*) filter (where barcode is not null)::bigint with_barcode,
  count(*) filter (where price is not null)::bigint with_price,
  count(*) filter (where legacy_medicine_id is not null)::bigint with_legacy_compatibility,
  count(*) filter (where egyptdwa_source_url is not null)::bigint with_egyptdwa_evidence,
  count(*) filter (where international_source_url is not null)::bigint with_international_product_evidence,
  (select count(*) from public.international_ingredient_reference)::bigint
    international_ingredient_references
from public.medicines_catalog_enriched_v1;

grant select on public.medicines_catalog_metrics to anon, authenticated;

create index if not exists medicines2_active_name_en_btree_idx
  on public.medicines2(name_en, id)
  where coalesce(active, true) = true;
create index if not exists medicines2_active_name_ar_btree_idx
  on public.medicines2(name_ar, id)
  where coalesce(active, true) = true;

create or replace function public.search_medicines_catalog(
  p_query text,
  p_limit integer default 50
)
returns setof public.medicines_catalog_enriched_v1
language plpgsql stable security invoker
set search_path = public, extensions
as $$
declare
  q text := trim(coalesce(p_query, ''));
  row_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if q = '' then
    return query
    with first_ids as (
      select m.id
      from public.medicines2 m
      where coalesce(m.active, true)
      order by m.name_en nulls last, m.name_ar nulls last, m.id
      limit row_limit
    )
    select enriched.*
    from first_ids
    join public.medicines_catalog_enriched_v1 enriched
      on enriched.id = first_ids.id
    order by enriched.name_en nulls last,
      enriched.name_ar nulls last, enriched.id;
    return;
  end if;

  return query
  with candidates as (
    select m.id, 2000::numeric score
    from public.medicines2 m
    where coalesce(m.active, true)
      and (m.barcode = q or m.code = q or m.custom_product_code = q)

    union all

    select m.id,
      (1000 + extensions.similarity(m.name_en, q) * 100)::numeric score
    from public.medicines2 m
    where length(q) >= 2 and coalesce(m.active, true)
      and m.name_en is not null
      and (m.name_en operator(extensions.%) q
        or m.name_en ilike '%' || q || '%')

    union all

    select m.id,
      (1000 + extensions.similarity(m.name_ar, q) * 100)::numeric score
    from public.medicines2 m
    where length(q) >= 2 and coalesce(m.active, true)
      and m.name_ar is not null
      and (m.name_ar operator(extensions.%) q
        or m.name_ar ilike '%' || q || '%')
  ), ranked as (
    select candidates.id, max(candidates.score) score
    from candidates
    group by candidates.id
    order by max(candidates.score) desc, candidates.id
    limit row_limit
  )
  select enriched.*
  from ranked
  join public.medicines_catalog_enriched_v1 enriched
    on enriched.id = ranked.id
  order by ranked.score desc,
    coalesce(enriched.name_en, enriched.name_ar), enriched.id;
end;
$$;

revoke all on function public.search_medicines_catalog(text, integer) from public;
grant execute on function public.search_medicines_catalog(text, integer)
  to anon, authenticated;

create or replace function public.search_medicines_catalog_index(
  p_query text,
  p_limit integer default 60
)
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
    product.id::text,
    coalesce(nullif(product.name_en, ''), nullif(product.name_ar, ''),
      'Product #' || product.id::text),
    concat_ws(' · ', nullif(product.name_ar, ''), product.barcode,
      product.code,
      case when product.price is not null
        then product.price::text || ' EGP' end,
      product.display_category),
    '/catalog/' || product.id::text,
    coalesce(product.display_category, 'medicine catalog'),
    (case when product.barcode is not null then 30 else 20 end +
      case when product.enrichment_source_count > 0 then 5 else 0 end)::numeric
  from public.search_medicines_catalog(p_query, p_limit) product;
$$;

revoke all on function public.search_medicines_catalog_index(text, integer) from public;
grant execute on function public.search_medicines_catalog_index(text, integer)
  to anon, authenticated;

create or replace function public.resolve_legacy_medicine_catalog(
  p_legacy_medicine_id integer
)
returns setof public.medicines_catalog_enriched_v1
language sql stable security invoker
set search_path = public
as $$
  select product.*
  from public.medicines_catalog_enriched_v1 product
  where product.legacy_medicine_id = p_legacy_medicine_id
  limit 1;
$$;

revoke all on function public.resolve_legacy_medicine_catalog(integer) from public;
grant execute on function public.resolve_legacy_medicine_catalog(integer)
  to anon, authenticated;

create or replace view public.medicine_catalog_enrichment_metrics
with (security_invoker = true)
as
select
  count(*) filter (
    where source_system = 'egyptdwa' and confidence = 'verified'
  )::bigint verified_egyptdwa_products,
  count(*) filter (
    where source_system = 'netmeds' and confidence = 'verified'
  )::bigint verified_netmeds_products,
  count(*) filter (where confidence = 'review_required')::bigint
    review_required_products,
  (select count(*) from public.international_ingredient_reference)::bigint
    international_ingredient_references,
  max(updated_at) latest_evidence_update
from public.medicine_catalog_source_evidence;

grant select on public.medicine_catalog_enrichment_metrics to anon, authenticated;
