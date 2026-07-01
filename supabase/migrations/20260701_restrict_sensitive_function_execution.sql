revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
