create table if not exists public.user_billing_accounts(
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  subscription_status text not null default 'inactive' check(subscription_status in ('inactive','trialing','active','past_due','canceled','unpaid','paused','incomplete','incomplete_expired')),
  plan_code text not null default 'free' check(plan_code in ('free','pro')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.user_billing_accounts enable row level security;
revoke all on public.user_billing_accounts from anon,authenticated;
grant select on public.user_billing_accounts to authenticated;
grant all on public.user_billing_accounts to service_role;
drop policy if exists user_billing_accounts_own_select on public.user_billing_accounts;
create policy user_billing_accounts_own_select on public.user_billing_accounts for select to authenticated using(user_id=(select auth.uid()));
create index if not exists user_billing_accounts_status_idx on public.user_billing_accounts(subscription_status,plan_code);

create or replace function public.my_plan_entitlement()
returns table(plan_code text,subscription_status text,current_period_end timestamptz,cancel_at_period_end boolean)
language sql stable security invoker set search_path=public,pg_catalog
as $$ select coalesce(b.plan_code,'free'),coalesce(b.subscription_status,'inactive'),b.current_period_end,coalesce(b.cancel_at_period_end,false) from (select auth.uid() user_id) u left join public.user_billing_accounts b using(user_id); $$;
revoke all on function public.my_plan_entitlement() from public,anon;
grant execute on function public.my_plan_entitlement() to authenticated;
