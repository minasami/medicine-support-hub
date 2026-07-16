-- A legacy composite foreign key remained after the cascading replacement was
-- added because PostgreSQL truncated its generated constraint name. Both
-- constraints covered the same columns, but the legacy NO ACTION rule blocked
-- canonical company-slug updates before the cascading constraint could run.
alter table public.industry_company_contributions
  drop constraint if exists industry_company_contribution_profile_id_organization_id_c_fkey;

alter table public.industry_company_contributions
  drop constraint if exists industry_company_contributions_profile_id_organization_id_compa;

alter table public.industry_company_contributions
  add constraint industry_company_contributions_profile_org_slug_fkey
  foreign key (profile_id, organization_id, company_slug)
  references public.industry_company_profiles (id, organization_id, company_slug)
  on update cascade
  on delete cascade;

notify pgrst, 'reload schema';
