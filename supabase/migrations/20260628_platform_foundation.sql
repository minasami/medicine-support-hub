create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'ngo',
  country text,
  city text,
  contact_email text,
  contact_phone text,
  website text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'org_admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organizations_type_idx on public.organizations(organization_type);
create index if not exists organization_members_user_idx on public.organization_members(user_id);
