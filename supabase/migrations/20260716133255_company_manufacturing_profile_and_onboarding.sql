alter table public.industry_company_profiles
  add column if not exists services text[] not null default '{}',
  add column if not exists differentiators text;

grant update (services, differentiators)
  on table public.industry_company_profiles
  to authenticated;

comment on column public.industry_company_profiles.services is
  'Reviewed services offered by the company, including manufacturing, formulation, packaging, regulatory, laboratory, or distribution services.';

comment on column public.industry_company_profiles.differentiators is
  'Company-authored explanation of distinctive technology, certifications, expertise, capacity, quality systems, markets, or outcomes.';

alter table public.industry_company_profile_claims
  add column if not exists approval_email_sent_at timestamptz;

comment on column public.industry_company_profile_claims.approval_email_sent_at is
  'Timestamp recorded after the approved representative email is accepted by the transactional email provider.';
