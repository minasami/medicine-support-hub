create or replace function public.refresh_medicine_company_profiles_from_encyclopedia()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_total integer;
begin
  if current_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and not private.is_platform_admin() then
    raise exception 'Only platform administrators or service automation can refresh company profiles.' using errcode = '42501';
  end if;

  with base as (
    select
      lower(regexp_replace(trim(manufacturer), '\s+', ' ', 'g')) as manufacturer_key,
      regexp_replace(trim(manufacturer), '\s+', ' ', 'g') as manufacturer_name,
      canonical_id,
      coalesce(nullif(trim(name_en), ''), nullif(trim(name_ar), ''), 'Medicine ' || canonical_id::text) as product_name,
      nullif(trim(scientific_name), '') as generic_name,
      nullif(trim(coalesce(drug_class, category)), '') as therapy_area,
      current_price_egp
    from public.medicine_encyclopedia_products_v2
    where nullif(trim(manufacturer), '') is not null
      and length(trim(manufacturer)) between 2 and 180
      and lower(trim(manufacturer)) not in ('unknown', 'n/a', 'na', 'none', 'not available', '-', '--')
  ),
  name_counts as (
    select manufacturer_key, manufacturer_name, count(*) as frequency
    from base
    group by manufacturer_key, manufacturer_name
  ),
  preferred_names as (
    select distinct on (manufacturer_key) manufacturer_key, manufacturer_name
    from name_counts
    order by manufacturer_key, frequency desc, manufacturer_name
  ),
  stats as (
    select manufacturer_key,
      count(*)::integer as product_count,
      (count(distinct generic_name) filter (where generic_name is not null))::integer as generic_count,
      (count(distinct therapy_area) filter (where therapy_area is not null))::integer as therapy_count,
      min(current_price_egp) filter (where current_price_egp > 0) as min_price,
      max(current_price_egp) filter (where current_price_egp > 0) as max_price
    from base
    group by manufacturer_key
  ),
  therapy_counts as (
    select manufacturer_key, therapy_area as value, count(*) as frequency
    from base where therapy_area is not null
    group by manufacturer_key, therapy_area
  ),
  therapy_ranked as (
    select *, row_number() over (partition by manufacturer_key order by frequency desc, value) as rn
    from therapy_counts
  ),
  therapies as (
    select manufacturer_key, array_agg(value order by frequency desc, value) as values
    from therapy_ranked where rn <= 12 group by manufacturer_key
  ),
  generic_counts as (
    select manufacturer_key, generic_name as value, count(*) as frequency
    from base where generic_name is not null
    group by manufacturer_key, generic_name
  ),
  generic_ranked as (
    select *, row_number() over (partition by manufacturer_key order by frequency desc, value) as rn
    from generic_counts
  ),
  generics as (
    select manufacturer_key, array_agg(value order by frequency desc, value) as values
    from generic_ranked where rn <= 12 group by manufacturer_key
  ),
  product_ranked as (
    select manufacturer_key, product_name,
      row_number() over (partition by manufacturer_key order by current_price_egp desc nulls last, product_name, canonical_id) as rn
    from base
  ),
  samples as (
    select manufacturer_key, array_agg(product_name order by rn) as values
    from product_ranked where rn <= 12 group by manufacturer_key
  ),
  resolved as (
    select
      coalesce(existing.company_name, names.manufacturer_name) as company_name,
      coalesce(existing.company_slug, public.company_slug_for_name(names.manufacturer_name)) as company_slug,
      existing.origin,
      stats.product_count,
      stats.generic_count,
      stats.therapy_count,
      stats.min_price,
      stats.max_price,
      coalesce(therapies.values, '{}'::text[]) as therapeutic_areas,
      coalesce(generics.values, '{}'::text[]) as leading_generics,
      coalesce(samples.values, '{}'::text[]) as portfolio_sample
    from preferred_names names
    join stats using (manufacturer_key)
    left join therapies using (manufacturer_key)
    left join generics using (manufacturer_key)
    left join samples using (manufacturer_key)
    left join lateral (
      select profile.company_name, profile.company_slug, profile.origin
      from public.medicine_company_profiles profile
      where lower(regexp_replace(trim(profile.company_name), '\s+', ' ', 'g')) = names.manufacturer_key
      order by profile.updated_at desc
      limit 1
    ) existing on true
  )
  insert into public.medicine_company_profiles (
    company_name, company_slug, origin, source_name, source_currency,
    product_count, active_product_count, archived_product_count,
    prescription_product_count, disease_area_count, generic_count,
    min_price, max_price, latest_source_update,
    therapeutic_areas, leading_generics, portfolio_sample, dataset_metadata
  )
  select
    company_name, company_slug, origin,
    'Medicine Support Hub canonical encyclopedia', 'EGP',
    product_count, product_count, 0, 0, therapy_count, generic_count,
    min_price, max_price, current_date,
    therapeutic_areas, leading_generics, portfolio_sample,
    jsonb_build_object(
      'source', 'medicine_encyclopedia_products_v2',
      'portfolioImported', true,
      'derivedFromManufacturerField', true,
      'activeCanonicalProducts', product_count,
      'generatedAt', now(),
      'currency', 'EGP'
    )
  from resolved
  on conflict (company_name) do update set
    origin = coalesce(public.medicine_company_profiles.origin, excluded.origin),
    source_name = case
      when lower(public.medicine_company_profiles.source_name) like '%canonical encyclopedia%' then public.medicine_company_profiles.source_name
      else public.medicine_company_profiles.source_name || ' + canonical encyclopedia'
    end,
    source_currency = excluded.source_currency,
    product_count = excluded.product_count,
    active_product_count = excluded.active_product_count,
    archived_product_count = greatest(public.medicine_company_profiles.archived_product_count, excluded.archived_product_count),
    prescription_product_count = greatest(public.medicine_company_profiles.prescription_product_count, excluded.prescription_product_count),
    disease_area_count = excluded.disease_area_count,
    generic_count = excluded.generic_count,
    min_price = excluded.min_price,
    max_price = excluded.max_price,
    latest_source_update = excluded.latest_source_update,
    therapeutic_areas = excluded.therapeutic_areas,
    leading_generics = excluded.leading_generics,
    portfolio_sample = excluded.portfolio_sample,
    dataset_metadata = public.medicine_company_profiles.dataset_metadata || excluded.dataset_metadata,
    updated_at = now();

  select count(*)::integer into v_total from public.medicine_company_profiles;
  return v_total;
end;
$$;
