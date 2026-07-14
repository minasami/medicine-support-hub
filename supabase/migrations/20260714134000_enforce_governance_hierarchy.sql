-- Align the effective RLS authority boundary with the governance hierarchy.
-- The platform owner account is promoted first in the same transaction, so the
-- owner retains access while ordinary `admin` becomes an operational role.

update public.profiles p
set role = 'super_admin', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('jesussavedmina@gmail.com')
  and p.is_active = true;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('platform_admin', 'super_admin')
  );
$$;

revoke all on function private.is_platform_admin() from public;
revoke all on function private.is_platform_admin() from anon;
grant execute on function private.is_platform_admin() to authenticated, service_role;

insert into public.platform_role_definitions(
  role_key, label, description, role_level, parent_role_key,
  scope_type, is_system, is_active
)
values
  ('company_admin', 'Company Administrator',
   'Manages an approved company profile, organization members, evidence and portfolio contributions.',
   140, 'org_admin', 'organization', true, true),
  ('pharmacy_accountant', 'Pharmacy Accountant',
   'Manages authorized pharmacy finance, reconciliation and reporting without clinical dispensing authority.',
   235, 'branch_manager', 'organization', true, true)
on conflict (role_key) do update
set label = excluded.label,
    description = excluded.description,
    role_level = excluded.role_level,
    parent_role_key = excluded.parent_role_key,
    scope_type = excluded.scope_type,
    is_system = excluded.is_system,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.platform_permissions(
  permission_key, category, label, description, risk_level, is_active
)
values
  ('company.profile.manage', 'industry', 'Manage company profile',
   'Maintain an approved company profile, its members and governed portfolio evidence.', 'sensitive', true),
  ('pharmacy.finance.manage', 'pharmacy', 'Manage pharmacy finance',
   'Manage authorized pharmacy financial records, reconciliation and reporting.', 'financial', true)
on conflict (permission_key) do update
set category = excluded.category,
    label = excluded.label,
    description = excluded.description,
    risk_level = excluded.risk_level,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.platform_role_permissions(role_key, permission_key, allowed)
values
  ('super_admin', 'company.profile.manage', true),
  ('super_admin', 'pharmacy.finance.manage', true),
  ('platform_admin', 'company.profile.manage', true),
  ('platform_admin', 'pharmacy.finance.manage', true),
  ('company_admin', 'company.profile.manage', true),
  ('pharmacy_accountant', 'pharmacy.finance.manage', true)
on conflict (role_key, permission_key) do update
set allowed = excluded.allowed,
    approved_at = now(),
    updated_at = now();
