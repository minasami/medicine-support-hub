-- A source label such as "A > B" represents two companies, not one company
-- name: A is the toll/contract manufacturer and B is the trademark owner.
-- Preserve the source label while exposing both companies as independent,
-- navigable entities.
create table if not exists public.medicine_product_company_relationships (
  canonical_id bigint not null,
  company_name text not null,
  company_slug text not null,
  relationship_role text not null
    check (relationship_role in ('manufacturer', 'toll_manufacturer', 'trademark_owner')),
  relationship_position smallint not null check (relationship_position in (1, 2)),
  source_manufacturer_label text not null,
  relationship_basis text not null default 'manufacturer_field_delimiter'
    check (relationship_basis in ('manufacturer_field', 'manufacturer_field_delimiter')),
  generated_at timestamptz not null default now(),
  primary key (canonical_id, company_slug, relationship_role)
);

create index if not exists medicine_product_company_relationships_company_idx
  on public.medicine_product_company_relationships (company_slug, canonical_id);
create index if not exists medicine_product_company_relationships_role_idx
  on public.medicine_product_company_relationships (relationship_role, company_slug);

alter table public.medicine_product_company_relationships enable row level security;
revoke all on public.medicine_product_company_relationships from anon, authenticated;
grant select on public.medicine_product_company_relationships to anon, authenticated;
grant all on public.medicine_product_company_relationships to service_role;
drop policy if exists medicine_product_company_relationships_public_read
  on public.medicine_product_company_relationships;
create policy medicine_product_company_relationships_public_read
  on public.medicine_product_company_relationships
  for select to anon, authenticated using (true);

create or replace function private.refresh_medicine_product_company_relationships()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  affected integer;
begin
  truncate table public.medicine_product_company_relationships;

  with source_rows as (
    select
      product.canonical_id,
      regexp_replace(btrim(product.manufacturer), '\s+', ' ', 'g') as source_label
    from private.medicine_search_index_v1 product
    where nullif(btrim(product.manufacturer), '') is not null
  ),
  parsed as (
    select
      source.canonical_id,
      source.source_label,
      strpos(source.source_label, '>') as separator_position
    from source_rows source
  ),
  parties as (
    select
      parsed.canonical_id,
      parsed.source_label,
      regexp_replace(
        btrim(case
          when parsed.separator_position > 0
            then left(parsed.source_label, parsed.separator_position - 1)
          else parsed.source_label
        end),
        '\s+', ' ', 'g'
      ) as company_name,
      case
        when parsed.separator_position > 0 then 'toll_manufacturer'
        else 'manufacturer'
      end::text as relationship_role,
      1::smallint as relationship_position,
      case
        when parsed.separator_position > 0 then 'manufacturer_field_delimiter'
        else 'manufacturer_field'
      end::text as relationship_basis
    from parsed
    union all
    select
      parsed.canonical_id,
      parsed.source_label,
      regexp_replace(
        btrim(substr(parsed.source_label, parsed.separator_position + 1)),
        '\s+', ' ', 'g'
      ) as company_name,
      'trademark_owner'::text,
      2::smallint,
      'manufacturer_field_delimiter'::text
    from parsed
    where parsed.separator_position > 0
  ),
  valid_parties as (
    select *
    from parties
    where nullif(btrim(company_name), '') is not null
      and length(company_name) between 2 and 180
      and lower(company_name) not in
        ('unknown', 'n/a', 'na', 'none', 'not available', '-', '--')
  ),
  resolved as (
    select
      party.*,
      coalesce(profile.company_slug, public.company_slug_for_name(party.company_name)) as company_slug
    from valid_parties party
    left join lateral (
      select existing.company_slug
      from public.medicine_company_profiles existing
      where lower(regexp_replace(btrim(existing.company_name), '\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(party.company_name), '\s+', ' ', 'g'))
      order by existing.updated_at desc
      limit 1
    ) profile on true
  )
  insert into public.medicine_product_company_relationships (
    canonical_id, company_name, company_slug, relationship_role,
    relationship_position, source_manufacturer_label, relationship_basis, generated_at
  )
  select distinct on (canonical_id, company_slug, relationship_role)
    canonical_id, company_name, company_slug, relationship_role,
    relationship_position, source_label, relationship_basis, now()
  from resolved
  order by canonical_id, company_slug, relationship_role, relationship_position, company_name
  on conflict (canonical_id, company_slug, relationship_role) do update set
    company_name = excluded.company_name,
    relationship_position = excluded.relationship_position,
    source_manufacturer_label = excluded.source_manufacturer_label,
    relationship_basis = excluded.relationship_basis,
    generated_at = excluded.generated_at;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.refresh_medicine_product_company_relationships()
  from public, anon, authenticated;
grant execute on function private.refresh_medicine_product_company_relationships()
  to service_role;

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
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not private.is_platform_admin() then
    raise exception 'Only platform administrators or service automation can refresh company profiles.' using errcode = '42501';
  end if;

  perform private.refresh_medicine_product_company_relationships();

  with base as (
    select
      relation.company_slug,
      relation.company_name,
      relation.relationship_role,
      product.canonical_id,
      coalesce(nullif(btrim(product.name_en), ''), nullif(btrim(product.name_ar), ''),
        'Medicine ' || product.canonical_id::text) as product_name,
      nullif(btrim(product.scientific_name), '') as generic_name,
      nullif(btrim(coalesce(product.drug_class, product.category)), '') as therapy_area,
      product.current_price_egp
    from public.medicine_product_company_relationships relation
    join private.medicine_search_index_v1 product using (canonical_id)
  ),
  name_counts as (
    select company_slug, company_name, count(*) as frequency
    from base
    group by company_slug, company_name
  ),
  preferred_names as (
    select distinct on (company_slug) company_slug, company_name
    from name_counts
    order by company_slug, frequency desc, company_name
  ),
  stats as (
    select
      company_slug,
      count(distinct canonical_id)::integer as product_count,
      count(distinct generic_name) filter (where generic_name is not null)::integer as generic_count,
      count(distinct therapy_area) filter (where therapy_area is not null)::integer as therapy_count,
      count(distinct canonical_id) filter (where relationship_role = 'manufacturer')::integer as manufacturer_count,
      count(distinct canonical_id) filter (where relationship_role = 'toll_manufacturer')::integer as toll_manufacturer_count,
      count(distinct canonical_id) filter (where relationship_role = 'trademark_owner')::integer as trademark_owner_count,
      array_agg(distinct relationship_role order by relationship_role) as relationship_roles,
      min(current_price_egp) filter (where current_price_egp > 0) as min_price,
      max(current_price_egp) filter (where current_price_egp > 0) as max_price
    from base
    group by company_slug
  ),
  therapy_counts as (
    select company_slug, therapy_area as value, count(*) as frequency
    from base where therapy_area is not null
    group by company_slug, therapy_area
  ),
  therapy_ranked as (
    select *, row_number() over (partition by company_slug order by frequency desc, value) as rn
    from therapy_counts
  ),
  therapies as (
    select company_slug, array_agg(value order by frequency desc, value) as values
    from therapy_ranked where rn <= 12 group by company_slug
  ),
  generic_counts as (
    select company_slug, generic_name as value, count(*) as frequency
    from base where generic_name is not null
    group by company_slug, generic_name
  ),
  generic_ranked as (
    select *, row_number() over (partition by company_slug order by frequency desc, value) as rn
    from generic_counts
  ),
  generics as (
    select company_slug, array_agg(value order by frequency desc, value) as values
    from generic_ranked where rn <= 12 group by company_slug
  ),
  distinct_products as (
    select company_slug, canonical_id, product_name, max(current_price_egp) as current_price_egp
    from base
    group by company_slug, canonical_id, product_name
  ),
  product_ranked as (
    select company_slug, canonical_id, product_name, current_price_egp,
      row_number() over (
        partition by company_slug
        order by current_price_egp desc nulls last, product_name, canonical_id
      ) as rn
    from distinct_products
  ),
  samples as (
    select company_slug, array_agg(product_name order by rn) as values
    from product_ranked where rn <= 12 group by company_slug
  ),
  resolved as (
    select
      coalesce(existing.company_name, names.company_name) as company_name,
      names.company_slug,
      existing.origin,
      stats.product_count,
      stats.generic_count,
      stats.therapy_count,
      stats.manufacturer_count,
      stats.toll_manufacturer_count,
      stats.trademark_owner_count,
      stats.relationship_roles,
      stats.min_price,
      stats.max_price,
      coalesce(therapies.values, '{}'::text[]) as therapeutic_areas,
      coalesce(generics.values, '{}'::text[]) as leading_generics,
      coalesce(samples.values, '{}'::text[]) as portfolio_sample
    from preferred_names names
    join stats using (company_slug)
    left join therapies using (company_slug)
    left join generics using (company_slug)
    left join samples using (company_slug)
    left join public.medicine_company_profiles existing using (company_slug)
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
      'source', 'medicine_product_company_relationships',
      'portfolioImported', true,
      'derivedFromManufacturerField', true,
      'splitCompanyRelationships', true,
      'relationshipRoles', relationship_roles,
      'manufacturerProducts', manufacturer_count,
      'tollManufacturedProducts', toll_manufacturer_count,
      'trademarkOwnedProducts', trademark_owner_count,
      'activeCanonicalProducts', product_count,
      'generatedAt', now(),
      'currency', 'EGP'
    )
  from resolved
  on conflict (company_name) do update set
    company_slug = excluded.company_slug,
    origin = coalesce(public.medicine_company_profiles.origin, excluded.origin),
    source_name = case
      when lower(public.medicine_company_profiles.source_name) like '%canonical encyclopedia%'
        then public.medicine_company_profiles.source_name
      else public.medicine_company_profiles.source_name || ' + canonical encyclopedia'
    end,
    source_currency = excluded.source_currency,
    product_count = excluded.product_count,
    active_product_count = excluded.active_product_count,
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

  -- Remove obsolete compound or otherwise stale profiles only when they were
  -- generated from the catalog and have no verified/claimed company profile.
  delete from public.medicine_company_profiles stale
  where stale.dataset_metadata ->> 'derivedFromManufacturerField' = 'true'
    and not exists (
      select 1
      from public.medicine_product_company_relationships relation
      where relation.company_slug = stale.company_slug
    )
    and not exists (
      select 1
      from public.industry_company_profiles official
      where official.company_slug = stale.company_slug
    );

  select count(*)::integer into v_total from public.medicine_company_profiles;
  return v_total;
end;
$$;

revoke all on function public.refresh_medicine_company_profiles_from_encyclopedia()
  from public, anon, authenticated;
grant execute on function public.refresh_medicine_company_profiles_from_encyclopedia()
  to service_role;

alter table public.medicine_manufacturer_profiles_generated
  add column if not exists relationship_roles text[] not null default '{}',
  add column if not exists manufacturer_product_count integer not null default 0,
  add column if not exists toll_manufacturer_product_count integer not null default 0,
  add column if not exists trademark_owner_product_count integer not null default 0;

create or replace function private.refresh_medicine_manufacturer_profiles_generated()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  affected integer;
begin
  perform private.refresh_medicine_product_company_relationships();
  truncate table public.medicine_manufacturer_profiles_generated;

  insert into public.medicine_manufacturer_profiles_generated (
    company_slug, company_name, product_count, generic_count, drug_class_count, route_count,
    products_with_images, products_with_price_history, products_with_marketplace_offers,
    min_price_egp, max_price_egp, leading_generics, leading_classes, leading_routes,
    portfolio_sample_ids, portfolio_sample_names, relationship_roles,
    manufacturer_product_count, toll_manufacturer_product_count,
    trademark_owner_product_count, generated_at
  )
  select
    relation.company_slug,
    (array_agg(distinct relation.company_name order by relation.company_name))[1],
    count(distinct product.canonical_id)::integer,
    count(distinct nullif(btrim(product.scientific_name), ''))::integer,
    count(distinct nullif(btrim(product.drug_class), ''))::integer,
    count(distinct nullif(btrim(product.route), ''))::integer,
    count(distinct product.canonical_id) filter (where nullif(btrim(product.image_url), '') is not null)::integer,
    count(distinct product.canonical_id) filter (where product.has_price_history)::integer,
    count(distinct product.canonical_id) filter (where product.marketplace_offer_count > 0)::integer,
    min(product.current_price_egp) filter (where product.current_price_egp > 0),
    max(product.current_price_egp) filter (where product.current_price_egp > 0),
    coalesce((array_agg(distinct product.scientific_name order by product.scientific_name)
      filter (where nullif(btrim(product.scientific_name), '') is not null))[1:12], '{}'::text[]),
    coalesce((array_agg(distinct product.drug_class order by product.drug_class)
      filter (where nullif(btrim(product.drug_class), '') is not null))[1:12], '{}'::text[]),
    coalesce((array_agg(distinct product.route order by product.route)
      filter (where nullif(btrim(product.route), '') is not null))[1:8], '{}'::text[]),
    (array_agg(distinct product.canonical_id order by product.canonical_id))[1:12],
    (array_agg(distinct coalesce(product.name_en, product.name_ar, 'Medicine #' || product.canonical_id::text)
      order by coalesce(product.name_en, product.name_ar, 'Medicine #' || product.canonical_id::text)))[1:12],
    array_agg(distinct relation.relationship_role order by relation.relationship_role),
    count(distinct product.canonical_id) filter (where relation.relationship_role = 'manufacturer')::integer,
    count(distinct product.canonical_id) filter (where relation.relationship_role = 'toll_manufacturer')::integer,
    count(distinct product.canonical_id) filter (where relation.relationship_role = 'trademark_owner')::integer,
    now()
  from public.medicine_product_company_relationships relation
  join private.medicine_search_index_v1 product using (canonical_id)
  group by relation.company_slug;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.refresh_medicine_manufacturer_profiles_generated()
  from public, anon, authenticated;
grant execute on function private.refresh_medicine_manufacturer_profiles_generated()
  to service_role;

create or replace function public.company_medicine_portfolio_page (
  p_company_slug text,
  p_query text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns table (
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
    cross join company
    where exists (
      select 1
      from public.medicine_product_company_relationships relation
      where relation.canonical_id = medicine.canonical_id
        and relation.company_slug = company.company_slug
    )
      and (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or coalesce(medicine.name_en, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(medicine.name_ar, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(medicine.scientific_name, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(medicine.drug_class, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(medicine.category, '') ilike '%' || btrim(p_query) || '%'
      )
  )
  select
    md5('canonical-medicine:' || filtered.canonical_id::text)::uuid,
    coalesce(nullif(filtered.name_en, ''), nullif(filtered.name_ar, ''),
      'Medicine ' || filtered.canonical_id::text),
    '/catalog/' || filtered.canonical_id::text,
    coalesce(nullif(filtered.drug_class, ''), nullif(filtered.category, '')),
    null::text,
    filtered.current_price_egp,
    case when filtered.current_price_egp is null then null
      else filtered.current_price_egp::text || ' EGP' end,
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
  order by filtered.current_price_egp desc nulls last,
    coalesce(filtered.name_en, filtered.name_ar), filtered.canonical_id
  limit greatest(1, least(coalesce(p_limit, 60), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.company_medicine_portfolio_page(text, text, integer, integer)
  to anon, authenticated;

create or replace view public.medicine_manufacturer_company_v1
with (security_invoker = true)
as
select
  medicine.canonical_id,
  medicine.manufacturer,
  relation.company_name,
  relation.company_slug,
  relation.relationship_role,
  relation.relationship_position
from public.medicine_encyclopedia_products_v2 medicine
join public.medicine_product_company_relationships relation using (canonical_id)
where nullif(btrim(medicine.manufacturer), '') is not null;

grant select on public.medicine_manufacturer_company_v1 to anon, authenticated;

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
security definer
set search_path = public, private, pg_catalog
as $$
  with filtered as (
    select product.*
    from private.medicine_search_index_v1 product
    where exists (
      select 1
      from public.medicine_product_company_relationships relation
      where relation.canonical_id = product.canonical_id
        and relation.company_slug = p_company_slug
    )
      and (btrim(coalesce(p_query, '')) = ''
        or product.search_blob ilike '%' || btrim(p_query) || '%')
  )
  select
    filtered.canonical_id, filtered.name_en, filtered.name_ar,
    filtered.scientific_name, filtered.manufacturer, filtered.drug_class,
    filtered.route, filtered.category, filtered.image_url,
    filtered.current_price_egp, filtered.price_currency,
    filtered.has_price_history, filtered.source_count,
    filtered.marketplace_offer_count, count(*) over()
  from filtered
  order by filtered.completeness_score desc,
    filtered.source_count desc nulls last,
    coalesce(filtered.name_en, filtered.name_ar), filtered.canonical_id
  limit greatest(1, least(coalesce(p_limit, 60), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.manufacturer_medicine_portfolio_v1(text, text, integer, integer)
  from public;
grant execute on function public.manufacturer_medicine_portfolio_v1(text, text, integer, integer)
  to anon, authenticated, service_role;
