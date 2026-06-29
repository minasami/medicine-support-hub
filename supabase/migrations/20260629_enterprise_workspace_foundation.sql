alter table public.organizations
  add column if not exists slug text,
  add column if not exists legal_name text,
  add column if not exists mission text,
  add column if not exists vision text,
  add column if not exists logo_url text,
  add column if not exists currency text not null default 'EGP',
  add column if not exists timezone text not null default 'Africa/Cairo';

create unique index if not exists organizations_slug_key
  on public.organizations(slug)
  where slug is not null;

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  start_date date,
  end_date date,
  budget_amount numeric(14,2) not null default 0 check (budget_amount >= 0),
  currency text not null default 'EGP',
  eligibility_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  birthdate date,
  city text,
  primary_condition text,
  risk_level text not null default 'standard' check (risk_level in ('standard','elevated','high','critical')),
  consent_status text not null default 'pending' check (consent_status in ('pending','granted','withdrawn','not_required')),
  status text not null default 'active' check (status in ('active','inactive','graduated','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists programs_organization_id_idx on public.programs(organization_id);
create index if not exists beneficiaries_organization_id_idx on public.beneficiaries(organization_id);
create index if not exists beneficiaries_program_id_idx on public.beneficiaries(program_id);

alter table public.programs enable row level security;
alter table public.beneficiaries enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.is_active = true
  );
$$;

create policy "programs_read" on public.programs
for select to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id));

create policy "programs_write" on public.programs
for all to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id))
with check (public.is_platform_admin() or public.is_org_member(organization_id));

create policy "beneficiaries_read" on public.beneficiaries
for select to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id));

create policy "beneficiaries_write" on public.beneficiaries
for all to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id))
with check (public.is_platform_admin() or public.is_org_member(organization_id));
