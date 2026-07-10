drop policy if exists beneficiaries_write on public.beneficiaries;
create policy beneficiaries_insert on public.beneficiaries
for insert to authenticated
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy beneficiaries_update on public.beneficiaries
for update to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id))
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy beneficiaries_delete on public.beneficiaries
for delete to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id));

drop policy if exists beneficiary_events_write on public.beneficiary_events;
create policy beneficiary_events_insert on public.beneficiary_events
for insert to authenticated
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy beneficiary_events_update on public.beneficiary_events
for update to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id))
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy beneficiary_events_delete on public.beneficiary_events
for delete to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id));

drop policy if exists programs_write on public.programs;
create policy programs_insert on public.programs
for insert to authenticated
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy programs_update on public.programs
for update to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id))
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy programs_delete on public.programs
for delete to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id));

drop policy if exists program_events_write on public.program_events;
create policy program_events_insert on public.program_events
for insert to authenticated
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy program_events_update on public.program_events
for update to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id))
with check ((select public.is_platform_admin()) or public.is_org_member(organization_id));
create policy program_events_delete on public.program_events
for delete to authenticated
using ((select public.is_platform_admin()) or public.is_org_member(organization_id));

drop policy if exists pilot_decisions_admin_v5 on public.pilot_decisions;
create policy pilot_decisions_admin_insert_v7 on public.pilot_decisions
for insert to authenticated
with check ((select public.is_platform_admin()));
create policy pilot_decisions_admin_update_v7 on public.pilot_decisions
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));
create policy pilot_decisions_admin_delete_v7 on public.pilot_decisions
for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists pilot_meetings_admin_v5 on public.pilot_meetings;
create policy pilot_meetings_admin_insert_v7 on public.pilot_meetings
for insert to authenticated
with check ((select public.is_platform_admin()));
create policy pilot_meetings_admin_update_v7 on public.pilot_meetings
for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));
create policy pilot_meetings_admin_delete_v7 on public.pilot_meetings
for delete to authenticated
using ((select public.is_platform_admin()));

drop policy if exists pilot_deliverables_modify on public.pilot_deliverables;
create policy pilot_deliverables_insert on public.pilot_deliverables
for insert to authenticated
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);
create policy pilot_deliverables_update on public.pilot_deliverables
for update to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);
create policy pilot_deliverables_delete on public.pilot_deliverables
for delete to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_deliverables.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);

drop policy if exists pilot_milestones_modify on public.pilot_milestones;
create policy pilot_milestones_insert on public.pilot_milestones
for insert to authenticated
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);
create policy pilot_milestones_update on public.pilot_milestones
for update to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
)
with check (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);
create policy pilot_milestones_delete on public.pilot_milestones
for delete to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = pilot_milestones.organization_id
      and om.user_id = (select auth.uid())
      and om.is_active = true
      and om.role = any (array['owner'::text, 'admin'::text, 'manager'::text, 'program_manager'::text])
  )
);
