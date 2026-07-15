-- SECURITY DEFINER functions inherit EXECUTE for PUBLIC unless explicitly revoked.
-- Keep the permission helper callable only by signed-in users and trusted server code.

revoke all on function public.platform_user_has_permission(text, uuid) from public;
revoke all on function public.platform_user_has_permission(text, uuid) from anon;
grant execute on function public.platform_user_has_permission(text, uuid) to authenticated, service_role;
