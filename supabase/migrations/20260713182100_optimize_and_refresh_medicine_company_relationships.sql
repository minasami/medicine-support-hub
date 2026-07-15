-- The initial schema migration intentionally avoids a full-catalog refresh so
-- DDL remains reliable on constrained projects. This follow-up uses the
-- canonical public cache, precomputes profile keys once, handles chained arrow
-- labels, and then builds the data in bounded operations.
alter table public.medicine_product_company_relationships
  drop constraint if exists medicine_product_company_relationsh_relationship_position_check;
alter table public.medicine_product_company_relationships
  add constraint medicine_company_relationship_position_check
  check (relationship_position between 1 and 8);

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
    from public.medicine_encyclopedia_products_v2 product
    where nullif(btrim(product.manufacturer), '') is not null
  ),
  parties as (
    select
      source.canonical_id,
      source.source_label,
      source.source_label as company_name,
      'manufacturer'::text as relationship_role,
      1::smallint as relationship_position,
      'manufacturer_field'::text as relationship_basis
    from source_rows source
    where source.source_label not like '%>%'
    union all
    select
      source.canonical_id,
      source.source_label,
      regexp_replace(btrim(split.company_name), '\s+', ' ', 'g'),
      case when split.relationship_position = 1
        then 'toll_manufacturer' else 'trademark_owner' end::text,
      split.relationship_position::smallint,
      'manufacturer_field_delimiter'::text
    from source_rows source
    cross join lateral regexp_split_to_table(
      source.source_label, '\s*-*>\s*'
    ) with ordinality as split(company_name, relationship_position)
    where source.source_label like '%>%'
      and split.relationship_position <= 8
  ),
  valid_parties as (
    select
      parties.*,
      lower(regexp_replace(btrim(company_name), '\s+', ' ', 'g')) as company_key
    from parties
    where nullif(btrim(company_name), '') is not null
      and length(company_name) between 2 and 180
      and lower(company_name) not in
        ('unknown', 'n/a', 'na', 'none', 'not available', '-', '--')
  ),
  existing_profiles as (
    select distinct on (company_key) company_key, company_slug
    from (
      select
        lower(regexp_replace(btrim(company_name), '\s+', ' ', 'g')) as company_key,
        company_slug,
        updated_at
      from public.medicine_company_profiles
    ) profiles
    order by company_key, updated_at desc
  ),
  resolved as (
    select
      party.*,
      coalesce(profile.company_slug,
        public.company_slug_for_name(party.company_name)) as company_slug
    from valid_parties party
    left join existing_profiles profile using (company_key)
  )
  insert into public.medicine_product_company_relationships (
    canonical_id, company_name, company_slug, relationship_role,
    relationship_position, source_manufacturer_label,
    relationship_basis, generated_at
  )
  select distinct on (canonical_id, company_slug, relationship_role)
    canonical_id, company_name, company_slug, relationship_role,
    relationship_position, source_label, relationship_basis, now()
  from resolved
  order by canonical_id, company_slug, relationship_role,
    relationship_position, company_name;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.refresh_medicine_product_company_relationships()
  from public, anon, authenticated;
grant execute on function private.refresh_medicine_product_company_relationships()
  to service_role;

-- Both aggregators need only the canonical public cache. Replacing the private
-- search-index reference avoids repeated expensive view planning during a
-- complete refresh while preserving their reviewed definitions and grants.
do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef(
    'public.refresh_medicine_company_profiles_from_encyclopedia()'::regprocedure
  );
  execute replace(
    function_definition,
    'private.medicine_search_index_v1',
    'public.medicine_encyclopedia_products_v2'
  );

  function_definition := pg_get_functiondef(
    'private.refresh_medicine_manufacturer_profiles_generated()'::regprocedure
  );
  execute replace(
    function_definition,
    'private.medicine_search_index_v1',
    'public.medicine_encyclopedia_products_v2'
  );
end;
$$;

select public.refresh_medicine_company_profiles_from_encyclopedia();
select private.refresh_medicine_manufacturer_profiles_generated();
