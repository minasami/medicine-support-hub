create extension if not exists pg_trgm;

create index if not exists medicines2_active_idx on public.medicines2(active);
create index if not exists medicines2_name_en_trgm_idx on public.medicines2 using gin (name_en gin_trgm_ops);
create index if not exists medicines2_name_ar_trgm_idx on public.medicines2 using gin (name_ar gin_trgm_ops);
create index if not exists medicines2_barcode_idx on public.medicines2(barcode) where barcode is not null;
create index if not exists medicines2_code_idx on public.medicines2(code) where code is not null;

create or replace view public.medicines_catalog_search_index
with (security_invoker = true)
as
select
  'catalog_product'::text as entity_type,
  id::text as entity_key,
  coalesce(nullif(name_en,''), nullif(name_ar,''), 'Product #' || id::text) as title,
  concat_ws(' · ', nullif(name_ar,''), barcode, code, case when price is not null then price::text || ' EGP' end) as subtitle,
  '/medicines/' || id::text as href,
  'medicine catalog'::text as category,
  case when barcode is not null then 30 else 20 end as weight,
  to_tsvector('simple', concat_ws(' ', name_en, name_ar, barcode, code, custom_product_code)) as search_vector
from public.medicines2
where coalesce(active, true) = true;

grant select on public.medicines_catalog_search_index to anon, authenticated;
