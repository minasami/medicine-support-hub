create table if not exists public.beneficiary_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  beneficiary_id uuid not null references public.beneficiaries(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  event_type text not null check (event_type in ('enrollment','eligibility_review','medical_review','approval','dispensing','delivery','follow_up','outcome','note')),
  title text not null,
  description text,
  event_date timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists beneficiary_events_beneficiary_id_idx
  on public.beneficiary_events(beneficiary_id, event_date desc);

create index if not exists beneficiary_events_organization_id_idx
  on public.beneficiary_events(organization_id);

alter table public.beneficiary_events enable row level security;

drop policy if exists beneficiary_events_read on public.beneficiary_events;
create policy beneficiary_events_read on public.beneficiary_events
for select to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id));

drop policy if exists beneficiary_events_write on public.beneficiary_events;
create policy beneficiary_events_write on public.beneficiary_events
for all to authenticated
using (public.is_platform_admin() or public.is_org_member(organization_id))
with check (public.is_platform_admin() or public.is_org_member(organization_id));
