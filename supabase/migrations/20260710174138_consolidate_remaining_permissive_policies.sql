drop policy if exists medicine_enrichments_admin_all on public.medicine_enrichments;
drop policy if exists medicine_enrichments_public_verified_read on public.medicine_enrichments;
create policy medicine_enrichments_anon_verified_read on public.medicine_enrichments
for select to anon
using (confidence = 'verified'::text);
create policy medicine_enrichments_authenticated_read on public.medicine_enrichments
for select to authenticated
using ((confidence = 'verified'::text) or (select public.is_platform_admin()));
create policy medicine_enrichments_admin_insert on public.medicine_enrichments
for insert to authenticated
with check ((select public.is_platform_admin()));
create policy medicine_enrichments_admin_update on public.medicine_enrichments
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));
create policy medicine_enrichments_admin_delete on public.medicine_enrichments
for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists platform_delivery_registry_admin_all on public.platform_delivery_registry;
drop policy if exists platform_delivery_registry_public_read on public.platform_delivery_registry;
create policy platform_delivery_registry_anon_read on public.platform_delivery_registry
for select to anon
using (public_safe = true);
create policy platform_delivery_registry_authenticated_read on public.platform_delivery_registry
for select to authenticated
using ((public_safe = true) or (select public.is_platform_admin()));
create policy platform_delivery_registry_admin_insert on public.platform_delivery_registry
for insert to authenticated
with check ((select public.is_platform_admin()));
create policy platform_delivery_registry_admin_update on public.platform_delivery_registry
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));
create policy platform_delivery_registry_admin_delete on public.platform_delivery_registry
for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists verified_medicine_source_products_admin_all on public.verified_medicine_source_products;
drop policy if exists verified_medicine_source_products_public_read_active on public.verified_medicine_source_products;
create policy verified_medicine_source_products_anon_read_active on public.verified_medicine_source_products
for select to anon
using (duplicate_status = 'active'::text);
create policy verified_medicine_source_products_authenticated_read on public.verified_medicine_source_products
for select to authenticated
using ((duplicate_status = 'active'::text) or (select public.is_platform_admin()));
create policy verified_medicine_source_products_admin_insert on public.verified_medicine_source_products
for insert to authenticated
with check ((select public.is_platform_admin()));
create policy verified_medicine_source_products_admin_update on public.verified_medicine_source_products
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));
create policy verified_medicine_source_products_admin_delete on public.verified_medicine_source_products
for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists pharmacy_sale_lines_member_access on public.pharmacy_sale_lines;
create policy pharmacy_sale_lines_insert on public.pharmacy_sale_lines
for insert to authenticated
with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_sale_lines_update on public.pharmacy_sale_lines
for update to authenticated
using (public.is_pharmacy_branch_member(branch_id))
with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_sale_lines_delete on public.pharmacy_sale_lines
for delete to authenticated
using (public.is_pharmacy_branch_member(branch_id));

drop policy if exists pharmacy_members_insert_branch_creator on public.pharmacy_branch_members;
drop policy if exists pharmacy_members_insert_by_branch_owner on public.pharmacy_branch_members;
drop policy if exists pharmacy_members_insert_owner on public.pharmacy_branch_members;
create policy pharmacy_members_insert_authorized on public.pharmacy_branch_members
for insert to authenticated
with check (
  (
    user_id = (select auth.uid())
    and member_role = 'owner'::text
    and exists (
      select 1
      from public.pharmacy_branches b
      where b.id = pharmacy_branch_members.branch_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  or (
    member_role = any (array['accountant'::text, 'manager'::text])
    and exists (
      select 1
      from public.pharmacy_branches b
      where b.id = pharmacy_branch_members.branch_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  or public.is_pharmacy_branch_owner(branch_id)
);

drop policy if exists patient_requests_own_insert on public.medicine_requests;
drop policy if exists medicine_requests_owner_read on public.medicine_requests;
drop policy if exists patient_requests_own_read on public.medicine_requests;
drop policy if exists reviewer_requests_read on public.medicine_requests;
create policy medicine_requests_authenticated_read on public.medicine_requests
for select to authenticated
using (
  patient_user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = any (array['admin'::text, 'platform_admin'::text, 'super_admin'::text, 'reviewer'::text])
  )
);

drop policy if exists profiles_admin_read_by_owner on public.profiles;
drop policy if exists profiles_own_read on public.profiles;
create policy profiles_authenticated_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid
);

drop policy if exists profiles_admin_update_by_owner on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_authenticated_update on public.profiles
for update to authenticated
using (
  id = (select auth.uid())
  or (select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid
)
with check (
  id = (select auth.uid())
  or (select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid
);
