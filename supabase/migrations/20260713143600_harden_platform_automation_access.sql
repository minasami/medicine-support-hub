-- Keep the automation health view within the caller's RLS context and remove
-- the implicit write privileges granted to API roles on the view.
alter view public.platform_automation_health set (security_invoker = true);

revoke all on public.platform_automation_health from public, anon, authenticated;
grant select on public.platform_automation_health to authenticated, service_role;

-- Anonymous requests have no auth.uid(), so the scheduler's internal admin
-- check alone is not a sufficient API boundary. Restrict execution explicitly.
revoke all on function public.enqueue_due_platform_automation_jobs() from public, anon;
grant execute on function public.enqueue_due_platform_automation_jobs() to authenticated, service_role;

revoke all on function public.is_platform_automation_admin() from public, anon;
grant execute on function public.is_platform_automation_admin() to authenticated, service_role;
