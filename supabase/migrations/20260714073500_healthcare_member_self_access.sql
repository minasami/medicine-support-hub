-- Let authenticated staff discover only their own active organization memberships.

grant select on public.organization_members to authenticated;

create policy organization_members_self_read
on public.organization_members for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_platform_admin()));

comment on policy organization_members_self_read on public.organization_members is
  'A user may list only their own memberships; platform administrators may inspect all memberships.';
