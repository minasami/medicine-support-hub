create index if not exists industry_company_profiles_verified_by_idx
  on public.industry_company_profiles (verified_by);

create index if not exists industry_company_profile_claims_organization_idx
  on public.industry_company_profile_claims (organization_id);

create index if not exists industry_company_profile_claims_profile_idx
  on public.industry_company_profile_claims (profile_id);

create index if not exists industry_company_profile_claims_reviewed_by_idx
  on public.industry_company_profile_claims (reviewed_by);

create index if not exists industry_company_contributions_profile_org_slug_idx
  on public.industry_company_contributions (profile_id, organization_id, company_slug);

create index if not exists industry_company_contributions_reviewed_by_idx
  on public.industry_company_contributions (reviewed_by);
