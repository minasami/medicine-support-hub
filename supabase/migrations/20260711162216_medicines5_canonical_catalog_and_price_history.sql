-- Canonical medicines layer built from preserved source tables.
-- Raw medicines2, medicines3, and medicines5 records are never deleted or overwritten.

create schema if not exists private;

create or replace function private.normalize_medicine_identity(value text)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select nullif(
    btrim(regexp_replace(regexp_replace(lower(coalesce(value, '')), '[^[:alnum:]]+', ' ', 'g'), '\s+', ' ', 'g')),
    ''
  );
$$;

create table if not exists public.medicine_source_registry (
  source_system text primary key,
  display_name text not null,
  default_currency text not null default 'EGP',
  imported_at timestamptz not null default now(),
  date_precision text not null default 'import_date' check (date_precision in ('record_date','import_date','unknown')),
  verification_status text not null default 'source_backed' check (verification_status in ('verified','operational_catalog','source_backed','international_context')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.medicine_source_registry (source_system, display_name, default_currency, imported_at, date_precision, verification_status, notes)
values
  ('medicines2', 'Medicines2 operational Egyptian catalog', 'EGP', now(), 'record_date', 'operational_catalog', 'Operational Egyptian catalog. Record created_at is used as the observation timestamp where available.'),
  ('medicines3', 'EgyptDwa source dataset', 'EGP', '2026-07-11 00:00:00+00', 'import_date', 'source_backed', 'Source import date is shown because source rows do not include an effective price date.'),
  ('medicines5', 'Verified Egyptian medicines dataset', 'EGP', '2026-07-11 00:00:00+00', 'import_date', 'verified', 'Verified source preferred for product metadata. Import date is shown because rows do not include an effective price date.')
on conflict (source_system) do update set
  display_name = excluded.display_name,
  default_currency = excluded.default_currency,
  date_precision = excluded.date_precision,
  verification_status = excluded.verification_status,
  notes = excluded.notes,
  updated_at = now();

alter table public.medicine_source_registry enable row level security;
revoke all on table public.medicine_source_registry from anon, authenticated;
grant select on table public.medicine_source_registry to anon, authenticated;
grant all on table public.medicine_source_registry to service_role;
drop policy if exists medicine_source_registry_public_read on public.medicine_source_registry;
create policy medicine_source_registry_public_read on public.medicine_source_registry for select to anon, authenticated using (true);

drop view if exists public.medicine_price_history_v1 cascade;
drop view if exists public.medicine_canonical_products_v1 cascade;
drop materialized view if exists private.medicine_price_history_v1 cascade;
drop materialized view if exists private.medicine_canonical_products_v1 cascade;
drop materialized view if exists private.medicine_source_records_v1 cascade;

create materialized view private.medicine_source_records_v1 as
with
m5_base as (
  select distinct
    private.normalize_medicine_identity(coalesce(nullif(commercial_name_en, ''), nullif(commercial_name_ar, ''))) primary_name_key,
    private.normalize_medicine_identity(commercial_name_en) en_key,
    private.normalize_medicine_identity(commercial_name_ar) ar_key,
    commercial_name_en name_en,
    commercial_name_ar name_ar,
    scientific_name,
    manufacturer,
    drug_class,
    route,
    price_egp::numeric price_egp,
    md5(concat_ws('|', coalesce(commercial_name_en, ''), coalesce(commercial_name_ar, ''), coalesce(scientific_name, ''), coalesce(manufacturer, ''), coalesce(drug_class, ''), coalesce(route, ''), coalesce(price_egp::text, ''))) source_record_key
  from public.medicines5
  where private.normalize_medicine_identity(coalesce(nullif(commercial_name_en, ''), nullif(commercial_name_ar, ''))) is not null
),
m5_rows as (
  select 'name|' || primary_name_key canonical_key, source_record_key, name_en, name_ar, scientific_name, manufacturer, drug_class, route, price_egp
  from m5_base
),
m5_aliases_raw as (
  select en_key alias_key, 'name|' || primary_name_key canonical_key from m5_base where en_key is not null
  union all
  select ar_key alias_key, 'name|' || primary_name_key canonical_key from m5_base where ar_key is not null
),
m5_aliases as (
  select alias_key, min(canonical_key) canonical_key
  from m5_aliases_raw
  group by alias_key
  having count(distinct canonical_key) = 1
),
m2_base as (
  select m.id, m.created_at, m.name_en, m.name_ar, m.barcode, m.code, m.custom_product_code, m.price::numeric price_egp,
    private.normalize_medicine_identity(m.name_en) en_key,
    private.normalize_medicine_identity(m.name_ar) ar_key,
    private.normalize_medicine_identity(coalesce(nullif(m.name_en, ''), nullif(m.name_ar, ''), nullif(m.barcode, ''), nullif(m.code, ''), 'medicine-' || m.id::text)) primary_name_key
  from public.medicines2 m
  where coalesce(m.active, true)
),
m2_rows as (
  select coalesce(en_alias.canonical_key, ar_alias.canonical_key, 'name|' || base.primary_name_key) canonical_key, base.*
  from m2_base base
  left join m5_aliases en_alias on en_alias.alias_key = base.en_key
  left join m5_aliases ar_alias on ar_alias.alias_key = base.ar_key
),
m3_base as (
  select private.normalize_medicine_identity("Medicine Name") name_key, "Medicine Name" name_ar, "Category title" category,
    "Image" image_url, "Medicine Name link" source_url, "Price"::numeric price_egp,
    md5(concat_ws('|', coalesce("Medicine Name", ''), coalesce("Category title", ''), coalesce("Medicine Name link", ''), coalesce("Price"::text, ''))) source_record_key
  from public.medicines3
  where private.normalize_medicine_identity("Medicine Name") is not null
),
m3_rows as (
  select coalesce(alias.canonical_key, 'name|' || base.name_key) canonical_key, base.*
  from m3_base base
  left join m5_aliases alias on alias.alias_key = base.name_key
),
combined as (
  select ('x' || substr(md5(row.canonical_key), 1, 15))::bit(60)::bigint canonical_id, row.canonical_key,
    'medicines5'::text source_system, row.source_record_key, 30::integer source_priority,
    row.name_en, row.name_ar, row.scientific_name, row.manufacturer, row.drug_class, row.route,
    null::text category, null::text image_url, null::text source_url, null::text barcode, null::text code, null::text custom_product_code,
    row.price_egp, registry.default_currency currency, registry.imported_at observed_at, registry.date_precision, registry.verification_status
  from m5_rows row join public.medicine_source_registry registry on registry.source_system = 'medicines5'
  union all
  select ('x' || substr(md5(row.canonical_key), 1, 15))::bit(60)::bigint, row.canonical_key,
    'medicines2', row.id::text, 20, row.name_en, row.name_ar, null, null, null, null, null, null, null,
    row.barcode, row.code, row.custom_product_code, row.price_egp, registry.default_currency,
    coalesce(row.created_at, registry.imported_at), case when row.created_at is not null then 'record_date' else registry.date_precision end,
    registry.verification_status
  from m2_rows row join public.medicine_source_registry registry on registry.source_system = 'medicines2'
  union all
  select ('x' || substr(md5(row.canonical_key), 1, 15))::bit(60)::bigint, row.canonical_key,
    'medicines3', row.source_record_key, 10, null, row.name_ar, null, null, null, null, row.category, row.image_url, row.source_url,
    null, null, null, row.price_egp, registry.default_currency, registry.imported_at, registry.date_precision, registry.verification_status
  from m3_rows row join public.medicine_source_registry registry on registry.source_system = 'medicines3'
)
select * from combined;

create unique index medicine_source_records_v1_source_key_uidx on private.medicine_source_records_v1 (source_system, source_record_key);
create index medicine_source_records_v1_canonical_idx on private.medicine_source_records_v1 (canonical_id);
create index medicine_source_records_v1_price_idx on private.medicine_source_records_v1 (canonical_id, price_egp desc) where price_egp is not null and price_egp > 0;
create index medicine_source_records_v1_source_idx on private.medicine_source_records_v1 (source_system, canonical_id);

create materialized view private.medicine_canonical_products_v1 as
with aggregate_rows as (
  select canonical_id, min(canonical_key) canonical_key, count(*)::integer source_record_count,
    count(distinct source_system)::integer source_count, array_agg(distinct source_system order by source_system) source_systems,
    max(price_egp) filter (where currency = 'EGP' and price_egp > 0) current_price_egp,
    min(price_egp) filter (where currency = 'EGP' and price_egp > 0) min_price_egp,
    count(*) filter (where currency = 'EGP' and price_egp > 0)::integer price_observation_count,
    count(distinct price_egp) filter (where currency = 'EGP' and price_egp > 0)::integer distinct_price_count,
    bool_or(source_system = 'medicines5') has_verified_dataset,
    bool_or(source_system = 'medicines2') has_operational_catalog,
    bool_or(source_system = 'medicines3') has_egyptdwa_source
  from private.medicine_source_records_v1 group by canonical_id
),
best_m5 as (
  select distinct on (canonical_id) canonical_id, name_en, name_ar, scientific_name, manufacturer, drug_class, route
  from private.medicine_source_records_v1 where source_system = 'medicines5'
  order by canonical_id, price_egp desc nulls last, source_record_key
),
best_m2 as (
  select distinct on (canonical_id) canonical_id, source_record_key, name_en, name_ar, barcode, code, custom_product_code
  from private.medicine_source_records_v1 where source_system = 'medicines2'
  order by canonical_id, price_egp desc nulls last, source_record_key
),
best_m3 as (
  select distinct on (canonical_id) canonical_id, name_ar, category, image_url, source_url
  from private.medicine_source_records_v1 where source_system = 'medicines3'
  order by canonical_id, price_egp desc nulls last, source_record_key
),
best_price as (
  select distinct on (canonical_id) canonical_id, source_system current_price_source, source_record_key current_price_source_record,
    observed_at current_price_observed_at, date_precision current_price_date_precision
  from private.medicine_source_records_v1 where currency = 'EGP' and price_egp > 0
  order by canonical_id, price_egp desc, source_priority desc, observed_at desc nulls last, source_record_key
)
select aggregate_rows.canonical_id, aggregate_rows.canonical_key,
  coalesce(nullif(best_m5.name_en, ''), nullif(best_m2.name_en, '')) name_en,
  coalesce(nullif(best_m5.name_ar, ''), nullif(best_m2.name_ar, ''), nullif(best_m3.name_ar, '')) name_ar,
  best_m5.scientific_name, best_m5.manufacturer, best_m5.drug_class, best_m5.route,
  best_m3.category, best_m3.image_url, best_m3.source_url egyptdwa_source_url,
  best_m2.barcode, best_m2.code, best_m2.custom_product_code, nullif(best_m2.source_record_key, '')::bigint primary_medicines2_id,
  aggregate_rows.current_price_egp, 'EGP'::text price_currency, aggregate_rows.min_price_egp,
  aggregate_rows.current_price_egp max_price_egp, aggregate_rows.price_observation_count, aggregate_rows.distinct_price_count,
  (aggregate_rows.distinct_price_count > 1) has_price_history, aggregate_rows.source_record_count, aggregate_rows.source_count,
  aggregate_rows.source_systems, aggregate_rows.has_verified_dataset, aggregate_rows.has_operational_catalog, aggregate_rows.has_egyptdwa_source,
  best_price.current_price_source, best_price.current_price_source_record, best_price.current_price_observed_at, best_price.current_price_date_precision,
  concat_ws(' ', best_m5.name_en, best_m5.name_ar, best_m2.name_en, best_m2.name_ar, best_m3.name_ar, best_m5.scientific_name,
    best_m5.manufacturer, best_m5.drug_class, best_m5.route, best_m3.category, best_m2.barcode, best_m2.code, best_m2.custom_product_code) search_text
from aggregate_rows
left join best_m5 using (canonical_id)
left join best_m2 using (canonical_id)
left join best_m3 using (canonical_id)
left join best_price using (canonical_id);

create unique index medicine_canonical_products_v1_id_uidx on private.medicine_canonical_products_v1 (canonical_id);
create unique index medicine_canonical_products_v1_key_uidx on private.medicine_canonical_products_v1 (canonical_key);
create index medicine_canonical_products_v1_name_en_idx on private.medicine_canonical_products_v1 (name_en, canonical_id);
create index medicine_canonical_products_v1_name_ar_idx on private.medicine_canonical_products_v1 (name_ar, canonical_id);
create index medicine_canonical_products_v1_manufacturer_idx on private.medicine_canonical_products_v1 (manufacturer, canonical_id);
create index medicine_canonical_products_v1_class_idx on private.medicine_canonical_products_v1 (drug_class, canonical_id);
create index medicine_canonical_products_v1_route_idx on private.medicine_canonical_products_v1 (route, canonical_id);
create index medicine_canonical_products_v1_price_idx on private.medicine_canonical_products_v1 (current_price_egp, canonical_id);
create index medicine_canonical_products_v1_history_idx on private.medicine_canonical_products_v1 (has_price_history, canonical_id);
create index medicine_canonical_products_v1_search_trgm_idx on private.medicine_canonical_products_v1 using gin (search_text extensions.gin_trgm_ops);
create index medicine_canonical_products_v1_name_en_trgm_idx on private.medicine_canonical_products_v1 using gin (name_en extensions.gin_trgm_ops);
create index medicine_canonical_products_v1_name_ar_trgm_idx on private.medicine_canonical_products_v1 using gin (name_ar extensions.gin_trgm_ops);
create index medicine_canonical_products_v1_barcode_idx on private.medicine_canonical_products_v1 (barcode) where barcode is not null;
create index medicine_canonical_products_v1_code_idx on private.medicine_canonical_products_v1 (code) where code is not null;

create materialized view private.medicine_price_history_v1 as
with grouped as (
  select source.canonical_id, source.price_egp price, source.currency, source.source_system, registry.display_name source_name,
    min(source.observed_at) first_observed_at, max(source.observed_at) last_observed_at, source.date_precision,
    count(*)::integer source_record_count
  from private.medicine_source_records_v1 source
  join public.medicine_source_registry registry using (source_system)
  where source.price_egp is not null and source.price_egp > 0
  group by source.canonical_id, source.price_egp, source.currency, source.source_system, registry.display_name, source.date_precision
)
select grouped.*, product.current_price_egp, (grouped.price = product.current_price_egp) is_current_candidate,
  grouped.price - lag(grouped.price) over (partition by grouped.canonical_id, grouped.currency order by grouped.last_observed_at, grouped.price, grouped.source_system) price_delta_from_previous
from grouped join private.medicine_canonical_products_v1 product using (canonical_id);

create index medicine_price_history_v1_product_idx on private.medicine_price_history_v1 (canonical_id, last_observed_at desc, price desc);
create index medicine_price_history_v1_current_idx on private.medicine_price_history_v1 (canonical_id, is_current_candidate) where is_current_candidate;

grant usage on schema private to anon, authenticated, service_role;
grant select on private.medicine_source_records_v1 to anon, authenticated, service_role;
grant select on private.medicine_canonical_products_v1 to anon, authenticated, service_role;
grant select on private.medicine_price_history_v1 to anon, authenticated, service_role;

create or replace view public.medicine_canonical_products_v1 with (security_invoker = true) as
select ('x' || substr(md5(product.canonical_key), 1, 13))::bit(52)::bigint canonical_id,
  product.canonical_key, product.name_en, product.name_ar, product.scientific_name, product.manufacturer, product.drug_class,
  product.route, product.category, product.image_url, product.egyptdwa_source_url, product.barcode, product.code,
  product.custom_product_code, product.primary_medicines2_id, product.current_price_egp, product.price_currency,
  product.min_price_egp, product.max_price_egp, product.price_observation_count, product.distinct_price_count,
  product.has_price_history, product.source_record_count, product.source_count, product.source_systems,
  product.has_verified_dataset, product.has_operational_catalog, product.has_egyptdwa_source, product.current_price_source,
  product.current_price_source_record, product.current_price_observed_at, product.current_price_date_precision, product.search_text
from private.medicine_canonical_products_v1 product;

create or replace view public.medicine_price_history_v1 with (security_invoker = true) as
select ('x' || substr(md5(product.canonical_key), 1, 13))::bit(52)::bigint canonical_id,
  history.price, history.currency, history.source_system, history.source_name, history.first_observed_at, history.last_observed_at,
  history.date_precision, history.source_record_count, history.current_price_egp, history.is_current_candidate, history.price_delta_from_previous
from private.medicine_price_history_v1 history
join private.medicine_canonical_products_v1 product on product.canonical_id = history.canonical_id;

create or replace view public.medicine_catalog_id_map_v1 with (security_invoker = true) as
select ('x' || substr(md5(product.canonical_key), 1, 13))::bit(52)::bigint canonical_id,
  source.source_system, source.source_record_key, source.canonical_key
from private.medicine_source_records_v1 source
join private.medicine_canonical_products_v1 product on product.canonical_id = source.canonical_id;

create or replace view public.medicine_search_facets_v1 with (security_invoker = true) as
select 'manufacturer'::text facet_type, manufacturer facet_value, count(*)::bigint product_count
from public.medicine_canonical_products_v1 where nullif(btrim(manufacturer), '') is not null group by manufacturer
union all
select 'drug_class', drug_class, count(*)::bigint from public.medicine_canonical_products_v1 where nullif(btrim(drug_class), '') is not null group by drug_class
union all
select 'route', route, count(*)::bigint from public.medicine_canonical_products_v1 where nullif(btrim(route), '') is not null group by route;

create or replace view public.medicine_canonical_metrics_v1 with (security_invoker = true) as
select count(*)::bigint canonical_products,
  count(*) filter (where has_verified_dataset)::bigint verified_dataset_products,
  count(*) filter (where has_operational_catalog)::bigint operational_catalog_products,
  count(*) filter (where has_price_history)::bigint products_with_price_history,
  count(*) filter (where current_price_egp is not null)::bigint products_with_current_price,
  count(distinct manufacturer) filter (where manufacturer is not null)::bigint manufacturers,
  count(distinct scientific_name) filter (where scientific_name is not null)::bigint scientific_names,
  count(distinct drug_class) filter (where drug_class is not null)::bigint drug_classes,
  count(distinct route) filter (where route is not null)::bigint routes,
  sum(source_record_count)::bigint source_records_merged
from public.medicine_canonical_products_v1;

grant select on public.medicine_canonical_products_v1 to anon, authenticated, service_role;
grant select on public.medicine_price_history_v1 to anon, authenticated, service_role;
grant select on public.medicine_catalog_id_map_v1 to anon, authenticated, service_role;
grant select on public.medicine_search_facets_v1 to anon, authenticated, service_role;
grant select on public.medicine_canonical_metrics_v1 to anon, authenticated, service_role;

create or replace function private.refresh_medicine_canonical_v1()
returns void
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  refresh materialized view private.medicine_source_records_v1;
  refresh materialized view private.medicine_canonical_products_v1;
  refresh materialized view private.medicine_price_history_v1;
end;
$$;
revoke all on function private.refresh_medicine_canonical_v1() from public, anon, authenticated;
grant execute on function private.refresh_medicine_canonical_v1() to service_role;
