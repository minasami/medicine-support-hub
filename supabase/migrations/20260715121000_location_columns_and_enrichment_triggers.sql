alter table public.industry_company_profile_claims
  add column if not exists country_code text,
  add column if not exists admin1_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_geoname_id bigint,
  add column if not exists location_source text,
  add column if not exists timezone text;

alter table public.industry_company_profiles
  add column if not exists country_code text,
  add column if not exists admin1_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_geoname_id bigint,
  add column if not exists location_source text,
  add column if not exists timezone text;

alter table public.healthcare_entity_applications
  add column if not exists country_code text,
  add column if not exists admin1_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_geoname_id bigint,
  add column if not exists location_source text,
  add column if not exists timezone text;

alter table public.healthcare_entity_profiles
  add column if not exists country_code text,
  add column if not exists admin1_code text,
  add column if not exists location_geoname_id bigint,
  add column if not exists location_source text,
  add column if not exists timezone text;

alter table public.organizations
  add column if not exists country_code text,
  add column if not exists admin1_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_geoname_id bigint,
  add column if not exists location_source text,
  add column if not exists timezone text;

create or replace function private.enrich_location_fields()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare match public.reference_locations%rowtype;
begin
  if nullif(trim(new.city),'') is null or nullif(trim(new.country),'') is null then return new; end if;
  select * into match
  from public.reference_locations location
  where location.normalized_name = lower(regexp_replace(trim(new.city), '\s+', ' ', 'g'))
    and (
      lower(location.country) = lower(trim(new.country))
      or location.country_code = upper(trim(coalesce(new.country_code,'')))
    )
  order by location.population desc nulls last, location.updated_at desc
  limit 1;
  if found then
    new.country := match.country;
    new.city := match.name;
    new.country_code := match.country_code;
    new.admin1_code := match.admin1_code;
    new.latitude := match.latitude;
    new.longitude := match.longitude;
    new.location_geoname_id := match.geoname_id;
    new.location_source := match.source;
    new.timezone := match.timezone;
  end if;
  return new;
end;
$$;
revoke all on function private.enrich_location_fields() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'industry_company_profile_claims',
    'industry_company_profiles',
    'healthcare_entity_applications',
    'healthcare_entity_profiles',
    'organizations'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_enrich_location', table_name);
    execute format(
      'create trigger %I before insert or update of country,city,country_code on public.%I for each row execute function private.enrich_location_fields()',
      table_name || '_enrich_location', table_name
    );
  end loop;
end $$;

create index if not exists industry_claims_country_city_idx on public.industry_company_profile_claims(country_code, city);
create index if not exists industry_profiles_country_city_idx on public.industry_company_profiles(country_code, city);
create index if not exists healthcare_applications_country_city_idx on public.healthcare_entity_applications(country_code, city);
create index if not exists healthcare_profiles_country_city_idx on public.healthcare_entity_profiles(country_code, city);
create index if not exists organizations_country_city_idx on public.organizations(country_code, city);
