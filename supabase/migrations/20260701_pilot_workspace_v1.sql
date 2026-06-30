alter table public.programs
  add column if not exists pilot_phase text,
  add column if not exists pilot_objective text,
  add column if not exists success_criteria text,
  add column if not exists risks text,
  add column if not exists lessons_learned text,
  add column if not exists sites_count integer not null default 0,
  add column if not exists start_date date,
  add column if not exists end_date date;

create table if not exists public.pilot_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'planned',
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pilot_milestones_program_idx
  on public.pilot_milestones(program_id, due_date);

alter table public.pilot_milestones enable row level security;

drop policy if exists pilot_milestones_select on public.pilot_milestones;
create policy pilot_milestones_select on public.pilot_milestones
for select to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
  )
);

drop policy if exists pilot_milestones_modify on public.pilot_milestones;
create policy pilot_milestones_modify on public.pilot_milestones
for all to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner','admin','manager','program_manager')
  )
)
with check (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = auth.uid()
      and om.is_active = true
      and om.role in ('owner','admin','manager','program_manager')
  )
);
