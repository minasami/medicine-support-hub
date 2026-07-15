alter table public.user_billing_accounts drop constraint if exists user_billing_accounts_plan_code_check;
alter table public.user_billing_accounts rename column plan_code to subscription_code;
alter table public.user_billing_accounts alter column subscription_code set default 'none';
update public.user_billing_accounts set subscription_code='none' where subscription_code='free';
drop function if exists public.my_plan_entitlement();

create table if not exists public.platform_payment_requests(
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  purpose text not null check(purpose in ('donation','marketplace_order','patient_service','company_service','company_subscription')),
  target_type text not null,target_id text not null,description text not null,
  mode text not null check(mode in ('payment','subscription')),
  amount_minor bigint check(amount_minor is null or amount_minor>0),
  currency text not null default 'usd' check(currency ~ '^[a-z]{3}$'),stripe_price_id text,
  status text not null default 'pending' check(status in ('pending','checkout_created','paid','failed','expired','canceled','refunded')),
  idempotency_key text not null unique,expires_at timestamptz,metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check((mode='payment' and amount_minor is not null and stripe_price_id is null) or (mode='subscription' and stripe_price_id is not null))
);
create table if not exists public.platform_payment_transactions(
  id uuid primary key default gen_random_uuid(),payment_request_id uuid not null references public.platform_payment_requests(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,stripe_checkout_session_id text unique,stripe_payment_intent_id text unique,
  stripe_subscription_id text unique,amount_minor bigint,currency text,payment_status text not null default 'pending',
  fulfillment_status text not null default 'unreviewed' check(fulfillment_status in ('unreviewed','approved','in_progress','fulfilled','rejected','refunded')),
  paid_at timestamptz,refunded_at timestamptz,metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.stripe_webhook_events(
  stripe_event_id text primary key,event_type text not null,livemode boolean not null,payload_sha256 text not null,
  processing_status text not null default 'received' check(processing_status in ('received','processed','ignored','failed')),
  error_message text,received_at timestamptz not null default now(),processed_at timestamptz
);
alter table public.platform_payment_requests enable row level security;
alter table public.platform_payment_transactions enable row level security;
alter table public.stripe_webhook_events enable row level security;
revoke all on public.platform_payment_requests,public.platform_payment_transactions,public.stripe_webhook_events from anon,authenticated;
grant select on public.platform_payment_requests,public.platform_payment_transactions to authenticated;
grant all on public.platform_payment_requests,public.platform_payment_transactions,public.stripe_webhook_events to service_role;
create policy payment_requests_own_select on public.platform_payment_requests for select to authenticated using(user_id=(select auth.uid()));
create policy payment_transactions_own_select on public.platform_payment_transactions for select to authenticated using(user_id=(select auth.uid()));
create index if not exists platform_payment_requests_user_idx on public.platform_payment_requests(user_id,created_at desc);
create index if not exists platform_payment_requests_target_idx on public.platform_payment_requests(purpose,target_type,target_id);
create index if not exists platform_payment_transactions_request_idx on public.platform_payment_transactions(payment_request_id);
create index if not exists platform_payment_transactions_user_idx on public.platform_payment_transactions(user_id,created_at desc);

create or replace function public.my_billing_summary()
returns table(subscription_code text,subscription_status text,current_period_end timestamptz,cancel_at_period_end boolean)
language sql stable security invoker set search_path=public,pg_catalog
as $$ select coalesce(b.subscription_code,'none'),coalesce(b.subscription_status,'inactive'),b.current_period_end,coalesce(b.cancel_at_period_end,false) from (select auth.uid() user_id) u left join public.user_billing_accounts b using(user_id); $$;
revoke all on function public.my_billing_summary() from public,anon;
grant execute on function public.my_billing_summary() to authenticated;
