create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  locale text,
  topics text[] not null default array['platform_updates']::text[],
  is_enabled boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id,is_enabled);
create index if not exists push_subscriptions_topics_gin_idx on public.push_subscriptions using gin(topics);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  platform_updates boolean not null default true,
  medicine_updates boolean not null default true,
  company_updates boolean not null default true,
  marketplace_updates boolean not null default true,
  learning_updates boolean not null default true,
  favorite_updates boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 500),
  audience_type text not null default 'all' check (audience_type in ('all','users','role','topic','medicine','company')),
  audience_values text[] not null default '{}',
  notification_topic text not null default 'platform_updates' check (notification_topic in ('platform_updates','medicine_updates','company_updates','marketplace_updates','learning_updates','favorite_updates')),
  target_url text,
  icon_url text,
  image_url text,
  data jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled','failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  attempted_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notification_campaigns_status_idx on public.notification_campaigns(status,scheduled_at,created_at desc);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.notification_campaigns(id) on delete set null,
  title text not null,
  body text not null,
  target_url text,
  notification_topic text not null default 'platform_updates',
  entity_type text,
  entity_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_idx on public.user_notifications(user_id,read_at,created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sent','failed','expired','opened')),
  provider_status integer,
  failure_reason text,
  sent_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_deliveries_campaign_idx on public.notification_deliveries(campaign_id,status);
create index if not exists notification_deliveries_user_idx on public.notification_deliveries(user_id,created_at desc);

create trigger push_subscriptions_touch_updated_at before update on public.push_subscriptions for each row execute function private.touch_updated_at();
create trigger notification_preferences_touch_updated_at before update on public.notification_preferences for each row execute function private.touch_updated_at();
create trigger notification_campaigns_touch_updated_at before update on public.notification_campaigns for each row execute function private.touch_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_campaigns enable row level security;
alter table public.user_notifications enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.push_subscriptions,public.notification_preferences,public.notification_campaigns,public.user_notifications,public.notification_deliveries from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
grant select,insert,update on public.notification_campaigns to authenticated;
grant select,update on public.user_notifications to authenticated;
grant select on public.notification_deliveries to authenticated;
grant all on public.push_subscriptions,public.notification_preferences,public.notification_campaigns,public.user_notifications,public.notification_deliveries to service_role;

create policy push_subscriptions_own_select on public.push_subscriptions for select to authenticated using (user_id=(select auth.uid()));
create policy push_subscriptions_own_insert on public.push_subscriptions for insert to authenticated with check (user_id=(select auth.uid()));
create policy push_subscriptions_own_update on public.push_subscriptions for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy push_subscriptions_own_delete on public.push_subscriptions for delete to authenticated using (user_id=(select auth.uid()));

create policy notification_preferences_own_select on public.notification_preferences for select to authenticated using (user_id=(select auth.uid()));
create policy notification_preferences_own_insert on public.notification_preferences for insert to authenticated with check (user_id=(select auth.uid()));
create policy notification_preferences_own_update on public.notification_preferences for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy notification_campaigns_admin_select on public.notification_campaigns for select to authenticated using ((select private.is_platform_admin()));
create policy notification_campaigns_admin_insert on public.notification_campaigns for insert to authenticated with check ((select private.is_platform_admin()) and created_by=(select auth.uid()));
create policy notification_campaigns_admin_update on public.notification_campaigns for update to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy user_notifications_own_select on public.user_notifications for select to authenticated using (user_id=(select auth.uid()));
create policy user_notifications_own_update on public.user_notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy notification_deliveries_own_or_admin_select on public.notification_deliveries for select to authenticated using (user_id=(select auth.uid()) or (select private.is_platform_admin()));
