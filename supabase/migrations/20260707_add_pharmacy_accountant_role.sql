alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (
  role = any (array[
    'employee',
    'reviewer',
    'physician',
    'pharmacist',
    'pharmacy_assistant',
    'pharmacy_accountant',
    'coordinator',
    'data_entry',
    'branch_manager',
    'cosmetician',
    'admin',
    'platform_admin',
    'super_admin'
  ]::text[])
);
