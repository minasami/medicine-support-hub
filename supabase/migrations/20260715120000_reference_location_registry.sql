create table if not exists public.reference_locations (
  id uuid primary key default gen_random_uuid(),
  geoname_id bigint unique,
  name text not null,
  normalized_name text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  country text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  admin1 text,
  admin1_code text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone text,
  population bigint check (population is null or population >= 0),
  source text not null default 'open_meteo_geocoding',
  source_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reference_locations_natural_key_uidx
  on public.reference_locations(country_code, normalized_name, coalesce(admin1_code, ''));
create index if not exists reference_locations_country_name_idx
  on public.reference_locations(country_code, normalized_name);
create index if not exists reference_locations_coordinates_idx
  on public.reference_locations(latitude, longitude);

alter table public.reference_locations enable row level security;
drop policy if exists reference_locations_public_read on public.reference_locations;
create policy reference_locations_public_read
  on public.reference_locations for select
  to anon, authenticated
  using (true);
revoke insert, update, delete on public.reference_locations from anon, authenticated;
grant select on public.reference_locations to anon, authenticated;

create or replace function public.register_reference_location(
  p_geoname_id bigint,
  p_name text,
  p_country text,
  p_country_code text,
  p_admin1 text default null,
  p_admin1_code text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_timezone text default null,
  p_population bigint default null,
  p_source text default 'open_meteo_geocoding'
)
returns public.reference_locations
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare result public.reference_locations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_country),'') is null then raise exception 'City and country are required.' using errcode='22023'; end if;
  if upper(trim(p_country_code)) !~ '^[A-Z]{2}$' then raise exception 'A two-letter country code is required.' using errcode='22023'; end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Valid coordinates are required.' using errcode='22023'; end if;

  insert into public.reference_locations(
    geoname_id,name,country,country_code,admin1,admin1_code,
    latitude,longitude,timezone,population,source,source_url,created_by
  ) values (
    p_geoname_id,trim(p_name),trim(p_country),upper(trim(p_country_code)),
    nullif(trim(p_admin1),''),nullif(trim(p_admin1_code),''),
    p_latitude,p_longitude,nullif(trim(p_timezone),''),p_population,
    coalesce(nullif(trim(p_source),''),'open_meteo_geocoding'),
    'https://geocoding-api.open-meteo.com/',auth.uid()
  )
  on conflict (geoname_id) do update set
    name=excluded.name,
    country=excluded.country,
    country_code=excluded.country_code,
    admin1=excluded.admin1,
    admin1_code=excluded.admin1_code,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    timezone=excluded.timezone,
    population=excluded.population,
    source=excluded.source,
    source_url=excluded.source_url,
    updated_at=now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.register_reference_location(bigint,text,text,text,text,text,double precision,double precision,text,bigint,text) from public, anon;
grant execute on function public.register_reference_location(bigint,text,text,text,text,text,double precision,double precision,text,bigint,text) to authenticated, service_role;
