-- Cache public medicine aggregates so guest page loads do not rescan the full catalog.

create table if not exists public.medicine_search_facets_cache_v1 (
  facet_type text not null,
  facet_value text not null,
  product_count bigint not null default 0 check (product_count >= 0),
  refreshed_at timestamptz not null default now(),
  primary key (facet_type, facet_value),
  check (facet_type in ('manufacturer','drug_class','route','category','source_system'))
);

create index if not exists medicine_search_facets_cache_v1_rank_idx
  on public.medicine_search_facets_cache_v1(facet_type, product_count desc, facet_value);

alter table public.medicine_search_facets_cache_v1 enable row level security;
drop policy if exists medicine_search_facets_cache_public_read on public.medicine_search_facets_cache_v1;
create policy medicine_search_facets_cache_public_read
  on public.medicine_search_facets_cache_v1 for select to anon, authenticated using (true);
revoke all on public.medicine_search_facets_cache_v1 from public;
grant select on public.medicine_search_facets_cache_v1 to anon, authenticated, service_role;
grant insert, update, delete on public.medicine_search_facets_cache_v1 to service_role;

create table if not exists public.medicine_search_metrics_cache_v1 (
  singleton boolean primary key default true check (singleton),
  canonical_products bigint not null default 0,
  verified_dataset_products bigint not null default 0,
  operational_catalog_products bigint not null default 0,
  products_with_price_history bigint not null default 0,
  products_with_current_price bigint not null default 0,
  manufacturers bigint not null default 0,
  scientific_names bigint not null default 0,
  drug_classes bigint not null default 0,
  routes bigint not null default 0,
  source_records_merged bigint not null default 0,
  refreshed_at timestamptz not null default now()
);

alter table public.medicine_search_metrics_cache_v1 enable row level security;
drop policy if exists medicine_search_metrics_cache_public_read on public.medicine_search_metrics_cache_v1;
create policy medicine_search_metrics_cache_public_read
  on public.medicine_search_metrics_cache_v1 for select to anon, authenticated using (true);
revoke all on public.medicine_search_metrics_cache_v1 from public;
grant select on public.medicine_search_metrics_cache_v1 to anon, authenticated, service_role;
grant insert, update, delete on public.medicine_search_metrics_cache_v1 to service_role;

create or replace function public.refresh_medicine_search_caches_v1()
returns jsonb language plpgsql security definer
set search_path = public, private, pg_catalog
as $$
declare
  refreshed timestamptz := clock_timestamp();
  facet_rows bigint;
  product_rows bigint;
begin
  delete from public.medicine_search_facets_cache_v1;
  insert into public.medicine_search_facets_cache_v1(facet_type,facet_value,product_count,refreshed_at)
  select 'manufacturer',manufacturer,count(*),refreshed from private.medicine_search_index_v1 where nullif(btrim(manufacturer),'') is not null group by manufacturer
  union all select 'drug_class',drug_class,count(*),refreshed from private.medicine_search_index_v1 where nullif(btrim(drug_class),'') is not null group by drug_class
  union all select 'route',route,count(*),refreshed from private.medicine_search_index_v1 where nullif(btrim(route),'') is not null group by route
  union all select 'category',category,count(*),refreshed from private.medicine_search_index_v1 where nullif(btrim(category),'') is not null group by category
  union all select 'source_system',source_system,count(*),refreshed from private.medicine_search_index_v1 product cross join lateral unnest(product.source_systems) source_system group by source_system;
  get diagnostics facet_rows = row_count;

  insert into public.medicine_search_metrics_cache_v1(
    singleton,canonical_products,verified_dataset_products,operational_catalog_products,
    products_with_price_history,products_with_current_price,manufacturers,scientific_names,
    drug_classes,routes,source_records_merged,refreshed_at
  )
  select true,count(*)::bigint,
    count(*) filter(where has_verified_dataset)::bigint,
    count(*) filter(where 'medicines2'=any(source_systems))::bigint,
    count(*) filter(where has_price_history)::bigint,
    count(*) filter(where current_price_egp is not null)::bigint,
    count(distinct manufacturer) filter(where nullif(btrim(manufacturer),'') is not null)::bigint,
    count(distinct scientific_name) filter(where nullif(btrim(scientific_name),'') is not null)::bigint,
    count(distinct drug_class) filter(where nullif(btrim(drug_class),'') is not null)::bigint,
    count(distinct route) filter(where nullif(btrim(route),'') is not null)::bigint,
    coalesce(sum(source_record_count),0)::bigint,refreshed
  from private.medicine_search_index_v1
  on conflict(singleton) do update set
    canonical_products=excluded.canonical_products,
    verified_dataset_products=excluded.verified_dataset_products,
    operational_catalog_products=excluded.operational_catalog_products,
    products_with_price_history=excluded.products_with_price_history,
    products_with_current_price=excluded.products_with_current_price,
    manufacturers=excluded.manufacturers,
    scientific_names=excluded.scientific_names,
    drug_classes=excluded.drug_classes,
    routes=excluded.routes,
    source_records_merged=excluded.source_records_merged,
    refreshed_at=excluded.refreshed_at;

  select canonical_products into product_rows from public.medicine_search_metrics_cache_v1 where singleton=true;
  analyze public.medicine_search_facets_cache_v1;
  analyze public.medicine_search_metrics_cache_v1;
  return jsonb_build_object('refreshed_at',refreshed,'products',coalesce(product_rows,0),'facets',coalesce(facet_rows,0));
end;
$$;

revoke all on function public.refresh_medicine_search_caches_v1() from public, anon, authenticated;
grant execute on function public.refresh_medicine_search_caches_v1() to service_role;

create or replace view public.medicine_encyclopedia_facets_v4 with (security_invoker=true) as
select facet_type,facet_value,product_count from public.medicine_search_facets_cache_v1;
grant select on public.medicine_encyclopedia_facets_v4 to anon, authenticated, service_role;

create or replace view public.medicine_encyclopedia_facets_featured_v1 with (security_invoker=true) as
select facet_type,facet_value,product_count
from (
  select cache.*,row_number() over(partition by facet_type order by product_count desc,facet_value) facet_rank
  from public.medicine_search_facets_cache_v1 cache
) ranked
where facet_rank <= case facet_type
  when 'manufacturer' then 600 when 'drug_class' then 400 when 'category' then 100
  when 'route' then 50 when 'source_system' then 50 else 100 end;
grant select on public.medicine_encyclopedia_facets_featured_v1 to anon, authenticated, service_role;

create or replace view public.medicine_canonical_metrics_v1 with (security_invoker=true) as
select canonical_products,verified_dataset_products,operational_catalog_products,
  products_with_price_history,products_with_current_price,manufacturers,scientific_names,
  drug_classes,routes,source_records_merged
from public.medicine_search_metrics_cache_v1 where singleton=true;
grant select on public.medicine_canonical_metrics_v1 to anon, authenticated, service_role;

select public.refresh_medicine_search_caches_v1();
