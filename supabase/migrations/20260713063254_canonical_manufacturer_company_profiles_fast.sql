create or replace function public.medicine_manufacturer_slug(value text)
returns text language sql immutable set search_path=pg_catalog as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(value,'')),'[^a-z0-9]+','-','g')),''),'manufacturer-'||substr(md5(coalesce(value,'')),1,12));
$$;
revoke all on function public.medicine_manufacturer_slug(text) from public;
grant execute on function public.medicine_manufacturer_slug(text) to anon,authenticated,service_role;

create table if not exists public.medicine_manufacturer_profiles_generated (
  company_slug text primary key, company_name text not null, product_count integer not null default 0,
  generic_count integer not null default 0, drug_class_count integer not null default 0, route_count integer not null default 0,
  products_with_images integer not null default 0, products_with_price_history integer not null default 0,
  products_with_marketplace_offers integer not null default 0, min_price_egp numeric, max_price_egp numeric,
  leading_generics text[] not null default '{}', leading_classes text[] not null default '{}', leading_routes text[] not null default '{}',
  portfolio_sample_ids bigint[] not null default '{}', portfolio_sample_names text[] not null default '{}',
  source_name text not null default 'Canonical medicine encyclopedia', generated_at timestamptz not null default now()
);
create index if not exists medicine_manufacturer_profiles_generated_count_idx on public.medicine_manufacturer_profiles_generated(product_count desc,company_name);
alter table public.medicine_manufacturer_profiles_generated enable row level security;
revoke all on public.medicine_manufacturer_profiles_generated from anon,authenticated;
grant select on public.medicine_manufacturer_profiles_generated to anon,authenticated;
grant all on public.medicine_manufacturer_profiles_generated to service_role;
create policy manufacturer_profiles_public_read on public.medicine_manufacturer_profiles_generated for select to anon,authenticated using (true);

create or replace function private.refresh_medicine_manufacturer_profiles_generated()
returns integer language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare affected integer;
begin
  truncate table public.medicine_manufacturer_profiles_generated;
  insert into public.medicine_manufacturer_profiles_generated(
    company_slug,company_name,product_count,generic_count,drug_class_count,route_count,products_with_images,
    products_with_price_history,products_with_marketplace_offers,min_price_egp,max_price_egp,
    leading_generics,leading_classes,leading_routes,portfolio_sample_ids,portfolio_sample_names,generated_at
  )
  select public.medicine_manufacturer_slug(manufacturer),
    (array_agg(manufacturer order by completeness_score desc,canonical_id))[1],
    count(*)::integer,
    count(distinct nullif(btrim(scientific_name),''))::integer,
    count(distinct nullif(btrim(drug_class),''))::integer,
    count(distinct nullif(btrim(route),''))::integer,
    count(*) filter(where nullif(btrim(image_url),'') is not null)::integer,
    count(*) filter(where has_price_history)::integer,
    count(*) filter(where marketplace_offer_count>0)::integer,
    min(current_price_egp) filter(where current_price_egp>0),
    max(current_price_egp) filter(where current_price_egp>0),
    coalesce((array_agg(distinct scientific_name) filter(where nullif(btrim(scientific_name),'') is not null))[1:12],'{}'::text[]),
    coalesce((array_agg(distinct drug_class) filter(where nullif(btrim(drug_class),'') is not null))[1:12],'{}'::text[]),
    coalesce((array_agg(distinct route) filter(where nullif(btrim(route),'') is not null))[1:8],'{}'::text[]),
    (array_agg(canonical_id order by completeness_score desc,source_count desc,canonical_id))[1:12],
    (array_agg(coalesce(name_en,name_ar,'Medicine #'||canonical_id::text) order by completeness_score desc,source_count desc,canonical_id))[1:12],now()
  from private.medicine_search_index_v1
  where nullif(btrim(manufacturer),'') is not null
  group by public.medicine_manufacturer_slug(manufacturer);
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function private.refresh_medicine_manufacturer_profiles_generated() from public,anon,authenticated;
grant execute on function private.refresh_medicine_manufacturer_profiles_generated() to service_role;

create or replace function public.refresh_medicine_manufacturer_profiles_generated()
returns integer language plpgsql security definer set search_path=public,private,pg_catalog as $$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
  return private.refresh_medicine_manufacturer_profiles_generated();
end;
$$;
revoke all on function public.refresh_medicine_manufacturer_profiles_generated() from public,anon;
grant execute on function public.refresh_medicine_manufacturer_profiles_generated() to authenticated,service_role;

create or replace function public.manufacturer_medicine_portfolio_v1(p_company_slug text,p_query text default '',p_limit integer default 60,p_offset integer default 0)
returns table(canonical_id bigint,name_en text,name_ar text,scientific_name text,manufacturer text,drug_class text,route text,category text,image_url text,current_price_egp numeric,price_currency text,has_price_history boolean,source_count integer,marketplace_offer_count integer,total_count bigint)
language sql stable security definer set search_path=public,private,pg_catalog as $$
  with filtered as (
    select p.* from private.medicine_search_index_v1 p
    where public.medicine_manufacturer_slug(p.manufacturer)=p_company_slug
      and (btrim(coalesce(p_query,''))='' or p.search_blob ilike '%'||btrim(p_query)||'%')
  )
  select f.canonical_id,f.name_en,f.name_ar,f.scientific_name,f.manufacturer,f.drug_class,f.route,f.category,f.image_url,
    f.current_price_egp,f.price_currency,f.has_price_history,f.source_count,f.marketplace_offer_count,count(*) over()
  from filtered f
  order by f.completeness_score desc,f.source_count desc nulls last,coalesce(f.name_en,f.name_ar),f.canonical_id
  limit greatest(1,least(coalesce(p_limit,60),100)) offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.manufacturer_medicine_portfolio_v1(text,text,integer,integer) from public;
grant execute on function public.manufacturer_medicine_portfolio_v1(text,text,integer,integer) to anon,authenticated,service_role;
select private.refresh_medicine_manufacturer_profiles_generated();
