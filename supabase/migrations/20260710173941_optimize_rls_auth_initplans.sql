alter policy pilot_milestones_select
on public.pilot_milestones
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
  )
);

alter policy pilot_milestones_modify
on public.pilot_milestones
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);

alter policy pilot_deliverables_select
on public.pilot_deliverables
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
  )
);

alter policy pilot_deliverables_modify
on public.pilot_deliverables
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);

alter policy pilot_sites_select_v3
on public.pilot_sites
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_sites.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
  )
);

alter policy pilot_decisions_select_v6
on public.pilot_decisions
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_decisions.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
  )
);

alter policy pilot_meetings_select_v6
on public.pilot_meetings
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = pilot_meetings.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
  )
);

alter policy pharmacy_members_insert_by_branch_owner
on public.pharmacy_branch_members
with check (
  member_role = any (array['accountant'::text, 'manager'::text])
  and exists (
    select 1
    from public.pharmacy_branches b
    where b.id = pharmacy_branch_members.branch_id
      and b.owner_user_id = (select auth.uid())
  )
);
