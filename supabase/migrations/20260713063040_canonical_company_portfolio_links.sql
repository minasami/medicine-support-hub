drop function if exists public.company_medicine_portfolio_page(text, text, integer, integer);

create function public.company_medicine_portfolio_page(
  p_company_slug text,
  p_query text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table(
  id uuid, product_name text, product_url text, disease_name text, disease_url text,
  final_price numeric, listed_price_text text, price_currency text,
  prescription_required text, drug_variant text, company_name text,
  company_slug text, company_origin text, generic_name text, image_urls text,
  source_name text, total_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with company as (
    select profile.company_name, profile.company_slug, profile.origin
    from public.medicine_company_profiles profile
    where profile.company_slug = p_company_slug
    limit 1
  ),
  filtered as (
    select medicine.*, company.company_name, company.company_slug, company.origin
    from public.medicine_encyclopedia_products_v2 medicine
    join company on lower(regexp_replace(trim(medicine.manufacturer), '\s+', ' ', 'g')) = lower(regexp_replace(trim(company.company_name), '\s+', ' ', 'g'))
    where nullif(trim(medicine.manufacturer), '') is not null
      and (
        nullif(trim(coalesce(p_query, '')), '') is null
        or coalesce(medicine.name_en, '') ilike '%' || trim(p_query) || '%'
        or coalesce(medicine.name_ar, '') ilike '%' || trim(p_query) || '%'
        or coalesce(medicine.scientific_name, '') ilike '%' || trim(p_query) || '%'
        or coalesce(medicine.drug_class, '') ilike '%' || trim(p_query) || '%'
        or coalesce(medicine.category, '') ilike '%' || trim(p_query) || '%'
      )
  )
  select
    md5('canonical-medicine:' || filtered.canonical_id::text)::uuid,
    coalesce(nullif(filtered.name_en, ''), nullif(filtered.name_ar, ''), 'Medicine ' || filtered.canonical_id::text),
    '/catalog/' || filtered.canonical_id::text,
    coalesce(nullif(filtered.drug_class, ''), nullif(filtered.category, '')),
    null::text,
    filtered.current_price_egp,
    case when filtered.current_price_egp is null then null else filtered.current_price_egp::text || ' EGP' end,
    coalesce(filtered.price_currency, 'EGP'),
    null::text,
    coalesce(nullif(filtered.route, ''), nullif(filtered.category, '')),
    filtered.company_name,
    filtered.company_slug,
    filtered.origin,
    filtered.scientific_name,
    filtered.image_url,
    'Medicine Support Hub canonical encyclopedia',
    count(*) over()
  from filtered
  order by filtered.current_price_egp desc nulls last, coalesce(filtered.name_en, filtered.name_ar), filtered.canonical_id
  limit greatest(1, least(coalesce(p_limit, 60), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.company_medicine_portfolio_page(text, text, integer, integer) to anon, authenticated;

create or replace view public.medicine_manufacturer_company_v1
with (security_invoker = true)
as
select medicine.canonical_id, medicine.manufacturer, profile.company_name, profile.company_slug
from public.medicine_encyclopedia_products_v2 medicine
join public.medicine_company_profiles profile
  on lower(regexp_replace(trim(medicine.manufacturer), '\s+', ' ', 'g')) = lower(regexp_replace(trim(profile.company_name), '\s+', ' ', 'g'))
where nullif(trim(medicine.manufacturer), '') is not null;

grant select on public.medicine_manufacturer_company_v1 to anon, authenticated;
