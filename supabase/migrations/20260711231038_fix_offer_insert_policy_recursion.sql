drop policy if exists marketplace_offers_member_insert on public.marketplace_medicine_offers;
create policy marketplace_offers_member_insert
on public.marketplace_medicine_offers for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and status in ('draft','submitted')
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and published_at is null
  and (select private.is_org_member(organization_id))
  and exists (
    select 1
    from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and seller.organization_id = organization_id
      and seller.verification_status = 'verified'
  )
  and (
    exists (
      select 1
      from public.medicine_canonical_products_v1 product
      where product.canonical_id = canonical_id
    )
    or exists (
      select 1
      from public.company_verified_medicine_products product
      join public.industry_company_profiles profile on profile.id = product.profile_id
      where product.canonical_id = canonical_id
        and product.status = 'active'
        and profile.verification_status = 'verified'
        and profile.is_public = true
    )
  )
);
