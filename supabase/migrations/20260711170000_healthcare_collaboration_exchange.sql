create table if not exists public.industry_opportunity_responses (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.industry_company_contributions(id) on delete cascade,
  company_slug text not null,
  respondent_id uuid not null references auth.users(id) on delete cascade,
  respondent_type text not null default 'other'
    check (respondent_type in (
      'ngo',
      'pharmacy',
      'hospital',
      'clinic',
      'clinician',
      'distributor',
      'supplier',
      'researcher',
      'patient_support_organization',
      'government',
      'other'
    )),
  organization_name text,
  contact_email text not null,
  country text,
  city text,
  message text not null,
  capabilities text[] not null default '{}',
  status text not null default 'submitted'
    check (status in ('submitted','contacted','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in contact_email) > 1),
  check (length(trim(message)) >= 20)
);

create unique index if not exists industry_opportunity_responses_unique_active
  on public.industry_opportunity_responses (contribution_id, respondent_id)
  where status <> 'withdrawn';
create index if not exists industry_opportunity_responses_company_idx
  on public.industry_opportunity_responses (company_slug, created_at desc);
create index if not exists industry_opportunity_responses_respondent_idx
  on public.industry_opportunity_responses (respondent_id, created_at desc);
create index if not exists industry_opportunity_responses_contribution_idx
  on public.industry_opportunity_responses (contribution_id, created_at desc);

create or replace view public.industry_collaboration_opportunities
with (security_invoker = true)
as
select
  contribution.id,
  contribution.profile_id,
  contribution.organization_id,
  contribution.company_slug,
  profile.display_name as company_name,
  profile.logo_url,
  profile.company_type,
  profile.country as company_country,
  contribution.contribution_type,
  contribution.title,
  contribution.summary,
  contribution.payload,
  contribution.evidence_urls,
  contribution.published_at,
  contribution.updated_at,
  coalesce(contribution.payload ->> 'opportunity_type', contribution.contribution_type) as opportunity_type,
  contribution.payload ->> 'audience' as audience,
  contribution.payload ->> 'geography' as geography,
  contribution.payload ->> 'deadline' as deadline,
  contribution.payload ->> 'contact_route' as contact_route,
  contribution.payload ->> 'expected_outcome' as expected_outcome
from public.industry_company_contributions contribution
join public.industry_company_profiles profile
  on profile.id = contribution.profile_id
where contribution.status = 'approved'
  and contribution.published_at is not null
  and profile.verification_status = 'verified'
  and profile.is_public = true
  and contribution.contribution_type in (
    'partnership_opportunity',
    'patient_support_program',
    'educational_resource'
  );

alter table public.industry_opportunity_responses enable row level security;
revoke all on table public.industry_opportunity_responses from anon, authenticated;
grant select, insert on table public.industry_opportunity_responses to authenticated;
grant all on table public.industry_opportunity_responses to service_role;
grant select on table public.industry_collaboration_opportunities to anon, authenticated;

create policy industry_opportunity_responses_read
on public.industry_opportunity_responses
for select
to authenticated
using (
  respondent_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1
    from public.industry_company_contributions contribution
    where contribution.id = industry_opportunity_responses.contribution_id
      and (select private.is_org_member(contribution.organization_id))
  )
);

create policy industry_opportunity_responses_insert
on public.industry_opportunity_responses
for insert
to authenticated
with check (
  respondent_id = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1
    from public.industry_company_contributions contribution
    join public.industry_company_profiles profile
      on profile.id = contribution.profile_id
    where contribution.id = industry_opportunity_responses.contribution_id
      and contribution.company_slug = industry_opportunity_responses.company_slug
      and contribution.status = 'approved'
      and contribution.published_at is not null
      and contribution.contribution_type in (
        'partnership_opportunity',
        'patient_support_program',
        'educational_resource'
      )
      and profile.verification_status = 'verified'
      and profile.is_public = true
  )
);

drop trigger if exists industry_opportunity_responses_touch_updated_at on public.industry_opportunity_responses;
create trigger industry_opportunity_responses_touch_updated_at
before update on public.industry_opportunity_responses
for each row execute function private.touch_updated_at();

comment on table public.industry_opportunity_responses is
  'Authenticated stakeholder responses to reviewed, public company collaboration opportunities.';
comment on view public.industry_collaboration_opportunities is
  'Public-safe reviewed opportunities from verified company contributions.';
