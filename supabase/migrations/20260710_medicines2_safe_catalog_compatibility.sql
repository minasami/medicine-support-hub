alter table public.medicines2 enable row level security;

drop policy if exists medicines2_active_read on public.medicines2;
create policy medicines2_active_read
on public.medicines2
for select
to anon, authenticated
using (coalesce(active, true) = true);

revoke all privileges on table public.medicines2 from anon, authenticated;
grant select (id, created_at, active, price, barcode, name_ar, name_en, code, custom_product_code) on public.medicines2 to anon, authenticated;

create table if not exists public.medicine_catalog_v2_map (
  medicines2_id bigint primary key references public.medicines2(id) on delete cascade,
  legacy_medicine_id integer unique references public.medicines(id) on delete set null,
  match_method text not null default 'normalized_name_unique',
  confidence text not null default 'verified' check (confidence in ('verified','review_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medicine_catalog_v2_map enable row level security;

drop policy if exists medicine_catalog_v2_map_public_read on public.medicine_catalog_v2_map;
create policy medicine_catalog_v2_map_public_read
on public.medicine_catalog_v2_map
for select
to anon, authenticated
using (confidence = 'verified');

with old_norm as (
  select id, lower(regexp_replace(coalesce(name_en,''), '[^a-zA-Z0-9]+', '', 'g')) as norm
  from public.medicines
), new_norm as (
  select id, lower(regexp_replace(coalesce(name_en,''), '[^a-zA-Z0-9]+', '', 'g')) as norm
  from public.medicines2
), old_unique as (
  select norm, min(id) as id from old_norm where norm <> '' group by norm having count(*) = 1
), new_unique as (
  select norm, min(id) as id from new_norm where norm <> '' group by norm having count(*) = 1
)
insert into public.medicine_catalog_v2_map (medicines2_id, legacy_medicine_id, match_method, confidence)
select n.id, o.id, 'normalized_name_unique', 'verified'
from new_unique n
join old_unique o using (norm)
on conflict (medicines2_id) do update set
  legacy_medicine_id = excluded.legacy_medicine_id,
  match_method = excluded.match_method,
  confidence = excluded.confidence,
  updated_at = now();

grant select on public.medicine_catalog_v2_map to anon, authenticated;

create or replace view public.medicines_catalog
with (security_invoker = true)
as
select
  m2.id,
  map.legacy_medicine_id,
  m2.name_en,
  m2.name_ar,
  legacy.dosage_form,
  legacy.strength,
  legacy.category,
  legacy.manufacturer,
  legacy.active_ingredient,
  legacy.atc_code,
  m2.barcode,
  coalesce(m2.active, true) as is_active,
  m2.price,
  'EGP'::text as price_currency,
  m2.code,
  m2.custom_product_code,
  m2.created_at
from public.medicines2 m2
left join public.medicine_catalog_v2_map map on map.medicines2_id = m2.id and map.confidence = 'verified'
left join public.medicines legacy on legacy.id = map.legacy_medicine_id
where coalesce(m2.active, true) = true;

grant select on public.medicines_catalog to anon, authenticated;

create or replace view public.medicines_catalog_metrics
with (security_invoker = true)
as
select
  count(*)::bigint as total_active,
  count(*) filter (where dosage_form is not null)::bigint as with_dosage_form,
  count(*) filter (where strength is not null)::bigint as with_strength,
  count(*) filter (where barcode is not null)::bigint as with_barcode,
  count(*) filter (where price is not null)::bigint as with_price,
  count(*) filter (where legacy_medicine_id is not null)::bigint as with_legacy_compatibility
from public.medicines_catalog;

grant select on public.medicines_catalog_metrics to anon, authenticated;
