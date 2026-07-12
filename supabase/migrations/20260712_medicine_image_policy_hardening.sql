-- Complete the administrator image-review performance hardening.

create index if not exists medicine_image_candidates_created_by_idx
  on public.medicine_image_candidates(created_by) where created_by is not null;
create index if not exists medicine_image_candidates_reviewed_by_idx
  on public.medicine_image_candidates(reviewed_by) where reviewed_by is not null;

drop policy if exists medicine_image_candidates_admin_select on public.medicine_image_candidates;
drop policy if exists medicine_image_candidates_public_approved_select on public.medicine_image_candidates;
create policy medicine_image_candidates_anon_approved_select
on public.medicine_image_candidates for select to anon
using (status='approved');
create policy medicine_image_candidates_authenticated_select
on public.medicine_image_candidates for select to authenticated
using (status='approved' or (select private.is_platform_admin()));

drop policy if exists medicine_image_candidates_admin_insert on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_insert
on public.medicine_image_candidates for insert to authenticated
with check (
  (select private.is_platform_admin())
  and coalesce(created_by,(select auth.uid()))=(select auth.uid())
);

drop policy if exists medicine_image_candidates_admin_update on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_update
on public.medicine_image_candidates for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));

drop policy if exists medicine_image_candidates_admin_delete on public.medicine_image_candidates;
create policy medicine_image_candidates_admin_delete
on public.medicine_image_candidates for delete to authenticated
using ((select private.is_platform_admin()));
