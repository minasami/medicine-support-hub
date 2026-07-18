-- Cover professional-network foreign keys used by RLS checks and workflow joins.
create index if not exists professional_employment_organization_idx
  on public.professional_employment_records(organization_id)
  where organization_id is not null;
create index if not exists professional_employment_verified_by_idx
  on public.professional_employment_records(verified_by)
  where verified_by is not null;
create index if not exists employment_verification_organization_idx
  on public.employment_verification_requests(organization_id);
create index if not exists employment_verification_requested_by_idx
  on public.employment_verification_requests(requested_by);
create index if not exists employment_verification_reviewed_by_idx
  on public.employment_verification_requests(reviewed_by)
  where reviewed_by is not null;
create index if not exists professional_jobs_organization_idx
  on public.professional_job_posts(organization_id);
create index if not exists professional_jobs_company_profile_idx
  on public.professional_job_posts(company_profile_id);
create index if not exists professional_jobs_posted_by_idx
  on public.professional_job_posts(posted_by);
create index if not exists professional_applications_profile_idx
  on public.professional_job_applications(applicant_profile_id);
create index if not exists professional_applications_applicant_idx
  on public.professional_job_applications(applicant_id);
create index if not exists professional_endorsements_employment_idx
  on public.professional_endorsements(employment_record_id)
  where employment_record_id is not null;
create index if not exists professional_endorsements_author_user_idx
  on public.professional_endorsements(author_user_id);
create index if not exists professional_endorsements_author_organization_idx
  on public.professional_endorsements(author_organization_id)
  where author_organization_id is not null;
