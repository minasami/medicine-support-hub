create index if not exists marketplace_seller_applications_org_idx on public.marketplace_seller_applications (organization_id) where organization_id is not null;
create index if not exists marketplace_seller_applications_profile_idx on public.marketplace_seller_applications (seller_profile_id) where seller_profile_id is not null;
create index if not exists marketplace_seller_applications_reviewer_idx on public.marketplace_seller_applications (reviewed_by) where reviewed_by is not null;
create index if not exists marketplace_seller_profiles_verifier_idx on public.marketplace_seller_profiles (verified_by) where verified_by is not null;
create index if not exists marketplace_medicine_offers_submitter_idx on public.marketplace_medicine_offers (submitted_by);
create index if not exists marketplace_medicine_offers_reviewer_idx on public.marketplace_medicine_offers (reviewed_by) where reviewed_by is not null;
create index if not exists company_verified_medicine_products_org_idx on public.company_verified_medicine_products (organization_id);
create index if not exists company_verified_medicine_products_approver_idx on public.company_verified_medicine_products (approved_by);
