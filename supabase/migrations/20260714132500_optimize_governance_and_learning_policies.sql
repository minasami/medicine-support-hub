-- Cover new governance/learning foreign keys and avoid duplicate permissive
-- SELECT policies for authenticated learners and administrators.

create index if not exists learning_career_path_courses_course_idx
  on public.learning_career_path_courses(course_id);
create index if not exists learning_certificates_course_idx
  on public.learning_certificates(course_id);
create index if not exists organization_relationships_child_idx
  on public.organization_relationships(child_organization_id);
create index if not exists organization_relationships_created_by_idx
  on public.organization_relationships(created_by);
create index if not exists platform_approval_policies_escalation_role_idx
  on public.platform_approval_policies(escalation_role_key);
create index if not exists platform_approval_policies_permission_idx
  on public.platform_approval_policies(required_permission);
create index if not exists platform_role_definitions_parent_idx
  on public.platform_role_definitions(parent_role_key);
create index if not exists platform_role_permissions_approved_by_idx
  on public.platform_role_permissions(approved_by);
create index if not exists platform_role_permissions_permission_idx
  on public.platform_role_permissions(permission_key);

-- Keep public/authenticated read policies separate from administrator mutation
-- policies so SELECT evaluates only one permissive policy per role.
drop policy if exists learning_paths_admin_write on public.learning_career_paths;
create policy learning_paths_admin_insert
  on public.learning_career_paths for insert to authenticated
  with check (private.is_platform_admin());
create policy learning_paths_admin_update
  on public.learning_career_paths for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
create policy learning_paths_admin_delete
  on public.learning_career_paths for delete to authenticated
  using (private.is_platform_admin());

drop policy if exists learning_path_courses_admin_write on public.learning_career_path_courses;
create policy learning_path_courses_admin_insert
  on public.learning_career_path_courses for insert to authenticated
  with check (private.is_platform_admin());
create policy learning_path_courses_admin_update
  on public.learning_career_path_courses for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
create policy learning_path_courses_admin_delete
  on public.learning_career_path_courses for delete to authenticated
  using (private.is_platform_admin());

drop policy if exists learning_courses_admin_write on public.learning_courses;
create policy learning_courses_admin_insert
  on public.learning_courses for insert to authenticated
  with check (private.is_platform_admin());
create policy learning_courses_admin_update
  on public.learning_courses for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
create policy learning_courses_admin_delete
  on public.learning_courses for delete to authenticated
  using (private.is_platform_admin());

drop policy if exists learning_lessons_admin_write on public.learning_lessons;
create policy learning_lessons_admin_insert
  on public.learning_lessons for insert to authenticated
  with check (private.is_platform_admin());
create policy learning_lessons_admin_update
  on public.learning_lessons for update to authenticated
  using (private.is_platform_admin())
  with check (private.is_platform_admin());
create policy learning_lessons_admin_delete
  on public.learning_lessons for delete to authenticated
  using (private.is_platform_admin());
