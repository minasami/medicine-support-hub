create table if not exists public.pilot_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  decision text not null,
  rationale text,
  owner_name text,
  decision_date date not null default current_date,
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  meeting_at timestamptz not null,
  attendees text,
  agenda text,
  notes text,
  actions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_decisions_program_idx on public.pilot_decisions(program_id, decision_date desc);
create index if not exists pilot_meetings_program_idx on public.pilot_meetings(program_id, meeting_at desc);
alter table public.pilot_decisions enable row level security;
alter table public.pilot_meetings enable row level security;
create policy pilot_decisions_admin_v5 on public.pilot_decisions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy pilot_meetings_admin_v5 on public.pilot_meetings for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
