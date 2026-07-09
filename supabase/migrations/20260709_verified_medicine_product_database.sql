create table if not exists public.medicine_company_profiles (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  company_slug text not null unique,
  origin text,
  source_name text not null default 'User-verified medicines CSV',
  product_count integer not null default 0,
  active_product_count integer not null default 0,
  archived_product_count integer not null default 0,
  prescription_product_count integer not null default 0,
  disease_area_count integer not null default 0,
  generic_count integer not null default 0,
  min_price numeric,
  max_price numeric,
  latest_source_update date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.verified_medicine_source_products (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default 'User-verified medicines CSV',
  source_product_key text not null,
  product_name text not null,
  product_url text,
  disease_name text,
  disease_url text,
  final_price numeric,
  listed_price_text text,
  price_currency text not null default 'INR',
  prescription_required text,
  drug_variant text,
  company_name text,
  company_slug text,
  company_origin text,
  generic_name text,
  drug_content_summary text,
  image_urls text,
  specification_key text not null,
  duplicate_status text not null default 'active',
  archived_reason text,
  active_price_kept numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_medicine_source_products_duplicate_status_check check (duplicate_status in ('active','archived_lower_price')),
  unique(source_name, source_product_key)
);

create index if not exists verified_medicine_source_products_product_idx on public.verified_medicine_source_products using gin(to_tsvector('simple', coalesce(product_name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(company_name,'') || ' ' || coalesce(disease_name,'')));
create index if not exists verified_medicine_source_products_company_idx on public.verified_medicine_source_products(company_slug);
create index if not exists verified_medicine_source_products_generic_idx on public.verified_medicine_source_products(generic_name);
create index if not exists verified_medicine_source_products_disease_idx on public.verified_medicine_source_products(disease_name);
create index if not exists verified_medicine_source_products_price_idx on public.verified_medicine_source_products(final_price);
create index if not exists verified_medicine_source_products_status_idx on public.verified_medicine_source_products(duplicate_status);

alter table public.medicine_company_profiles enable row level security;
alter table public.verified_medicine_source_products enable row level security;

drop policy if exists medicine_company_profiles_public_read on public.medicine_company_profiles;
create policy medicine_company_profiles_public_read
on public.medicine_company_profiles
for select
to anon, authenticated
using (true);

drop policy if exists verified_medicine_source_products_public_read_active on public.verified_medicine_source_products;
create policy verified_medicine_source_products_public_read_active
on public.verified_medicine_source_products
for select
to anon, authenticated
using (duplicate_status = 'active');

drop policy if exists verified_medicine_source_products_admin_all on public.verified_medicine_source_products;
create policy verified_medicine_source_products_admin_all
on public.verified_medicine_source_products
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace view public.verified_medicine_product_filter_facets
with (security_invoker = true)
as
select 'company'::text as facet_type, company_name as facet_value, count(*)::int as records
from public.verified_medicine_source_products
where duplicate_status = 'active' and company_name is not null
group by company_name
union all
select 'disease'::text as facet_type, disease_name as facet_value, count(*)::int as records
from public.verified_medicine_source_products
where duplicate_status = 'active' and disease_name is not null
group by disease_name
union all
select 'generic'::text as facet_type, generic_name as facet_value, count(*)::int as records
from public.verified_medicine_source_products
where duplicate_status = 'active' and generic_name is not null
group by generic_name
union all
select 'prescription'::text as facet_type, prescription_required as facet_value, count(*)::int as records
from public.verified_medicine_source_products
where duplicate_status = 'active' and prescription_required is not null
group by prescription_required;

grant select on public.verified_medicine_product_filter_facets to anon, authenticated;
