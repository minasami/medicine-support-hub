create or replace function public.company_profile_directory_page(
  p_query text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table(
  id uuid, company_name text, company_slug text, origin text,
  source_name text, source_currency text, product_count integer,
  active_product_count integer, archived_product_count integer,
  prescription_product_count integer, disease_area_count integer,
  generic_count integer, min_price numeric, max_price numeric,
  therapeutic_areas text[], leading_generics text[], portfolio_sample text[],
  dataset_metadata jsonb, latest_source_update date,
  official_display_name text, official_company_type text,
  official_description text, official_logo_url text, official_country text,
  official_city text, official_therapeutic_areas text[],
  official_product_categories text[], official_capabilities text[],
  official_verified boolean, total_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_catalog
as $$
  with canonical_companies as (
    select
      company.id,
      coalesce(resolution.display_name,company.company_name) as company_name,
      company.company_slug,
      coalesce(resolution.country,company.origin) as origin,
      company.source_name,
      company.source_currency,
      greatest(company.product_count,coalesce(resolution.canonical_product_count,0))::integer as product_count,
      greatest(company.active_product_count,coalesce(resolution.canonical_product_count,0))::integer as active_product_count,
      company.archived_product_count,
      company.prescription_product_count,
      company.disease_area_count,
      company.generic_count,
      company.min_price,
      company.max_price,
      company.therapeutic_areas,
      company.leading_generics,
      company.portfolio_sample,
      company.dataset_metadata || jsonb_build_object(
        'canonicalPortfolio',coalesce(resolution.canonical_product_count,company.product_count),
        'aliasSlugs',coalesce(resolution.alias_slugs,'{}'::text[])
      ) as dataset_metadata,
      company.latest_source_update,
      resolution.alias_slugs
    from public.medicine_company_profiles company
    left join lateral (
      select
        directory.display_name,
        directory.country,
        directory.canonical_product_count,
        directory.alias_slugs
      from public.company_directory_resolutions_v1 directory
      where directory.canonical_company_slug=company.company_slug
      order by (directory.source_company_slug=directory.canonical_company_slug) desc
      limit 1
    ) resolution on true
    where not exists (
      select 1
      from public.company_directory_aliases alias
      where alias.source_company_slug=company.company_slug
        and alias.is_active
    )
  ), filtered as (
    select
      company.*,
      official.display_name as official_display_name,
      official.company_type as official_company_type,
      official.description as official_description,
      official.logo_url as official_logo_url,
      official.country as official_country,
      official.city as official_city,
      official.therapeutic_areas as official_therapeutic_areas,
      official.product_categories as official_product_categories,
      official.capabilities as official_capabilities,
      official.id is not null as official_verified
    from canonical_companies company
    left join lateral (
      select profile.*
      from public.industry_company_profiles profile
      where profile.company_slug=company.company_slug
        and profile.verification_status='verified'
        and profile.is_public=true
      order by profile.updated_at desc
      limit 1
    ) official on true
    where nullif(trim(coalesce(p_query,'')),'') is null
       or company.company_name ilike '%'||trim(p_query)||'%'
       or company.company_slug ilike '%'||trim(p_query)||'%'
       or coalesce(company.origin,'') ilike '%'||trim(p_query)||'%'
       or coalesce(official.display_name,'') ilike '%'||trim(p_query)||'%'
       or coalesce(official.description,'') ilike '%'||trim(p_query)||'%'
       or array_to_string(company.therapeutic_areas,' ') ilike '%'||trim(p_query)||'%'
       or array_to_string(company.leading_generics,' ') ilike '%'||trim(p_query)||'%'
       or array_to_string(company.portfolio_sample,' ') ilike '%'||trim(p_query)||'%'
       or array_to_string(coalesce(official.capabilities,'{}'::text[]),' ') ilike '%'||trim(p_query)||'%'
       or exists (
         select 1
         from public.company_directory_aliases alias
         where alias.canonical_company_slug=company.company_slug
           and alias.is_active
           and (
             alias.source_company_slug ilike '%'||trim(p_query)||'%'
             or coalesce(alias.source_company_name,'') ilike '%'||trim(p_query)||'%'
           )
       )
  )
  select
    filtered.id,filtered.company_name,filtered.company_slug,filtered.origin,
    filtered.source_name,filtered.source_currency,filtered.product_count,
    filtered.active_product_count,filtered.archived_product_count,
    filtered.prescription_product_count,filtered.disease_area_count,
    filtered.generic_count,filtered.min_price,filtered.max_price,
    filtered.therapeutic_areas,filtered.leading_generics,filtered.portfolio_sample,
    filtered.dataset_metadata,filtered.latest_source_update,
    filtered.official_display_name,filtered.official_company_type,
    filtered.official_description,filtered.official_logo_url,
    filtered.official_country,filtered.official_city,
    filtered.official_therapeutic_areas,filtered.official_product_categories,
    filtered.official_capabilities,filtered.official_verified,
    count(*) over() as total_count
  from filtered
  order by filtered.active_product_count desc,filtered.company_name
  limit greatest(1,least(coalesce(p_limit,60),200))
  offset greatest(coalesce(p_offset,0),0);
$$;

revoke all on function public.company_profile_directory_page(text,integer,integer) from public;
grant execute on function public.company_profile_directory_page(text,integer,integer)
  to anon,authenticated,service_role;

notify pgrst, 'reload schema';
