-- Allow the first owner membership row to be inserted immediately after a user creates a branch.
-- Existing policy pharmacy_members_insert_owner only allows an already-active owner/manager
-- to insert members, which blocks the bootstrap owner row for a brand-new branch.

create policy pharmacy_members_insert_branch_creator
on public.pharmacy_branch_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and member_role = 'owner'
  and exists (
    select 1
    from public.pharmacy_branches b
    where b.id = branch_id
      and b.owner_user_id = (select auth.uid())
  )
);
