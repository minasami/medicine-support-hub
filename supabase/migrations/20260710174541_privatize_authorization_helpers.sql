create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.is_platform_admin() set schema private;
alter function public.is_org_member(uuid) set schema private;
alter function public.is_pharmacy_branch_member(uuid) set schema private;
alter function public.is_pharmacy_branch_owner(uuid) set schema private;

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.is_pharmacy_branch_member(uuid) from public, anon;
revoke all on function private.is_pharmacy_branch_owner(uuid) from public, anon;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.is_pharmacy_branch_member(uuid) to authenticated, service_role;
grant execute on function private.is_pharmacy_branch_owner(uuid) to authenticated, service_role;

create function public.is_platform_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, pg_catalog
as $$ select private.is_platform_admin(); $$;

create function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security invoker
set search_path = private, pg_catalog
as $$ select private.is_org_member(target_org); $$;

create function public.is_pharmacy_branch_member(target_branch uuid)
returns boolean
language sql
stable
security invoker
set search_path = private, pg_catalog
as $$ select private.is_pharmacy_branch_member(target_branch); $$;

create function public.is_pharmacy_branch_owner(target_branch uuid)
returns boolean
language sql
stable
security invoker
set search_path = private, pg_catalog
as $$ select private.is_pharmacy_branch_owner(target_branch); $$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_pharmacy_branch_member(uuid) from public, anon;
revoke all on function public.is_pharmacy_branch_owner(uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_pharmacy_branch_member(uuid) to authenticated, service_role;
grant execute on function public.is_pharmacy_branch_owner(uuid) to authenticated, service_role;
