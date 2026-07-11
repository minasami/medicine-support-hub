create table if not exists public.company_verified_medicine_products (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique references public.industry_company_contributions(id),
  profile_id uuid not null references public.industry_company_profiles(id),
  organization_id uuid not null references public.organizations(id),
  company_slug text not null,
  canonical_id bigint not null,
  canonical_key text not null,
  commercial_name_en text,
  commercial_name_ar text,
  scientific_name text,
  manufacturer text,
  drug_class text,
  route text,
  category text,
  image_url text,
  product_url text,
  barcode text,
  product_code text,
  current_price_egp numeric check (current_price_egp is null or current_price_egp > 0),
  registration_reference text,
  source_name text not null,
  status text not null default 'active' check (status in ('active','suspended','withdrawn')),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(coalesce(commercial_name_en, commercial_name_ar)), '') is not null)
);
create index if not exists company_verified_medicine_products_canonical_idx on public.company_verified_medicine_products (canonical_id, approved_at desc);
create index if not exists company_verified_medicine_products_profile_idx on public.company_verified_medicine_products (profile_id, status, approved_at desc);
create unique index if not exists company_verified_medicine_products_profile_key_uidx on public.company_verified_medicine_products (profile_id, canonical_key) where status='active';
create index if not exists company_verified_medicine_products_name_en_trgm_idx on public.company_verified_medicine_products using gin (commercial_name_en extensions.gin_trgm_ops);
create index if not exists company_verified_medicine_products_name_ar_trgm_idx on public.company_verified_medicine_products using gin (commercial_name_ar extensions.gin_trgm_ops);
create trigger company_verified_medicine_products_touch_updated_at before update on public.company_verified_medicine_products for each row execute function private.touch_updated_at();
alter table public.company_verified_medicine_products enable row level security;
revoke all on public.company_verified_medicine_products from anon, authenticated;
grant select on public.company_verified_medicine_products to anon, authenticated;
grant all on public.company_verified_medicine_products to service_role;
create policy company_verified_medicine_products_public_read on public.company_verified_medicine_products for select to anon using (
  status='active' and exists (select 1 from public.industry_company_profiles p where p.id=profile_id and p.verification_status='verified' and p.is_public=true)
);
create policy company_verified_medicine_products_authenticated_read on public.company_verified_medicine_products for select to authenticated using (
  (status='active' and exists (select 1 from public.industry_company_profiles p where p.id=profile_id and p.verification_status='verified' and p.is_public=true))
  or (select private.is_org_member(organization_id)) or (select private.is_platform_admin())
);
