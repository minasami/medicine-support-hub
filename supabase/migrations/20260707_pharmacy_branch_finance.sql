create table if not exists public.pharmacy_branches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  branch_name text not null,
  legal_name text,
  phone text,
  address text,
  city text,
  currency text not null default 'EGP',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharmacy_branch_members (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('owner','accountant','manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(branch_id, user_id)
);

create table if not exists public.pharmacy_finance_entries (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('sale','expense')),
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text,
  receipt_ref text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pharmacy_branches_owner_idx on public.pharmacy_branches(owner_user_id);
create index if not exists pharmacy_branch_members_user_idx on public.pharmacy_branch_members(user_id) where is_active = true;
create index if not exists pharmacy_finance_entries_branch_date_idx on public.pharmacy_finance_entries(branch_id, entry_date desc);
create index if not exists pharmacy_finance_entries_created_by_idx on public.pharmacy_finance_entries(created_by);

alter table public.pharmacy_branches enable row level security;
alter table public.pharmacy_branch_members enable row level security;
alter table public.pharmacy_finance_entries enable row level security;

create or replace function public.is_pharmacy_branch_member(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacy_branch_members m
    where m.branch_id = target_branch
      and m.user_id = (select auth.uid())
      and m.is_active = true
  );
$$;

create or replace function public.is_pharmacy_branch_owner(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pharmacy_branch_members m
    where m.branch_id = target_branch
      and m.user_id = (select auth.uid())
      and m.member_role in ('owner','manager')
      and m.is_active = true
  );
$$;

revoke execute on function public.is_pharmacy_branch_member(uuid) from public, anon;
revoke execute on function public.is_pharmacy_branch_owner(uuid) from public, anon;
grant execute on function public.is_pharmacy_branch_member(uuid) to authenticated;
grant execute on function public.is_pharmacy_branch_owner(uuid) to authenticated;

create policy pharmacy_branches_insert_own on public.pharmacy_branches
for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy pharmacy_branches_read_members on public.pharmacy_branches
for select to authenticated
using (owner_user_id = (select auth.uid()) or public.is_pharmacy_branch_member(id));

create policy pharmacy_branches_update_owner on public.pharmacy_branches
for update to authenticated
using (owner_user_id = (select auth.uid()) or public.is_pharmacy_branch_owner(id))
with check (owner_user_id = (select auth.uid()) or public.is_pharmacy_branch_owner(id));

create policy pharmacy_members_read_branch on public.pharmacy_branch_members
for select to authenticated
using (public.is_pharmacy_branch_member(branch_id) or public.is_pharmacy_branch_owner(branch_id));

create policy pharmacy_members_insert_owner on public.pharmacy_branch_members
for insert to authenticated
with check (public.is_pharmacy_branch_owner(branch_id));

create policy pharmacy_members_update_owner on public.pharmacy_branch_members
for update to authenticated
using (public.is_pharmacy_branch_owner(branch_id))
with check (public.is_pharmacy_branch_owner(branch_id));

create policy pharmacy_finance_read_members on public.pharmacy_finance_entries
for select to authenticated
using (public.is_pharmacy_branch_member(branch_id));

create policy pharmacy_finance_insert_members on public.pharmacy_finance_entries
for insert to authenticated
with check (public.is_pharmacy_branch_member(branch_id) and created_by = (select auth.uid()));

create policy pharmacy_finance_update_creator_or_owner on public.pharmacy_finance_entries
for update to authenticated
using (created_by = (select auth.uid()) or public.is_pharmacy_branch_owner(branch_id))
with check (created_by = (select auth.uid()) or public.is_pharmacy_branch_owner(branch_id));

create or replace view public.pharmacy_branch_finance_summary as
select
  b.id as branch_id,
  b.branch_name,
  b.owner_user_id,
  b.currency,
  coalesce(sum(e.amount) filter (where e.entry_type = 'sale'), 0)::numeric(14,2) as total_sales,
  coalesce(sum(e.amount) filter (where e.entry_type = 'expense'), 0)::numeric(14,2) as total_expenses,
  (coalesce(sum(e.amount) filter (where e.entry_type = 'sale'), 0) - coalesce(sum(e.amount) filter (where e.entry_type = 'expense'), 0))::numeric(14,2) as net_profit,
  count(e.id) as entries_count,
  max(e.entry_date) as last_entry_date
from public.pharmacy_branches b
left join public.pharmacy_finance_entries e on e.branch_id = b.id
group by b.id, b.branch_name, b.owner_user_id, b.currency;
