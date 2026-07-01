create table if not exists public.pilot_deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'planned',
  owner_name text,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_deliverables_program_idx
  on public.pilot_deliverables(program_id, due_date);

alter table public.pilot_deliverables enable row level security;
