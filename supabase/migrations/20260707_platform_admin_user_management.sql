alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null and length(trim(username)) > 0;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role = any (array[
    'employee',
    'reviewer',
    'physician',
    'pharmacist',
    'pharmacy_assistant',
    'coordinator',
    'data_entry',
    'branch_manager',
    'cosmetician',
    'admin',
    'platform_admin',
    'super_admin'
  ]::text[])
);

create table if not exists public.platform_admin_user_audit (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.platform_admin_user_audit enable row level security;

drop policy if exists platform_admin_user_audit_read_admins on public.platform_admin_user_audit;
create policy platform_admin_user_audit_read_admins
on public.platform_admin_user_audit
for select
to authenticated
using (public.is_platform_admin());
