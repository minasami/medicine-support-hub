create table if not exists public.platform_public_settings (
  key text primary key,
  value text not null,
  description text,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.platform_public_settings(key,value,description,is_public)
values('web_push_vapid_public_key','BAKipaik3jQNi59X8Ojxzbvj-zeUxC2slD3cZYAM0O-BCYtUi36NUsC_YEw0cDOudX1fZd3lZfvWB_VULxwA2h8','Public VAPID key used by the installed web app to create push subscriptions.',true)
on conflict(key) do update set value=excluded.value,description=excluded.description,is_public=true,updated_at=now();

alter table public.push_subscriptions alter column user_id drop not null;
alter table public.push_subscriptions add column if not exists device_id uuid;
alter table public.push_subscriptions add column if not exists platform text;
alter table public.push_subscriptions add column if not exists last_error text;
update public.push_subscriptions set device_id=coalesce(device_id,gen_random_uuid()) where device_id is null;
alter table public.push_subscriptions alter column device_id set default gen_random_uuid();
alter table public.push_subscriptions alter column device_id set not null;
create index if not exists push_subscriptions_enabled_idx on public.push_subscriptions(is_enabled,updated_at desc) where is_enabled;

create or replace function public.register_push_subscription(
  p_device_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_key text,
  p_topics text[] default array['platform_updates'],
  p_locale text default null,
  p_user_agent text default null,
  p_platform text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare
  v_id uuid;
  v_topics text[];
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint)>3000 then
    raise exception 'Invalid push endpoint.' using errcode='22023';
  end if;
  if length(coalesce(p_p256dh,''))<20 or length(coalesce(p_auth_key,''))<8 then
    raise exception 'Invalid push subscription keys.' using errcode='22023';
  end if;
  select coalesce(array_agg(distinct topic),array['platform_updates']) into v_topics
  from unnest(coalesce(p_topics,array['platform_updates'])) topic
  where topic in ('platform_updates','medicine_updates','company_updates','marketplace_updates','learning_updates','favorite_updates');
  if cardinality(v_topics)=0 then v_topics:=array['platform_updates']; end if;

  insert into public.push_subscriptions(user_id,device_id,endpoint,p256dh,auth_key,user_agent,locale,topics,is_enabled,failure_count,last_seen_at,platform,last_error)
  values(auth.uid(),p_device_id,p_endpoint,p_p256dh,p_auth_key,left(p_user_agent,500),left(p_locale,20),v_topics,true,0,now(),left(p_platform,120),null)
  on conflict(endpoint) do update set
    user_id=coalesce(auth.uid(),public.push_subscriptions.user_id),
    device_id=excluded.device_id,
    p256dh=excluded.p256dh,
    auth_key=excluded.auth_key,
    user_agent=excluded.user_agent,
    locale=excluded.locale,
    topics=excluded.topics,
    is_enabled=true,
    failure_count=0,
    last_seen_at=now(),
    platform=excluded.platform,
    last_error=null,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.register_push_subscription(uuid,text,text,text,text[],text,text,text) to anon,authenticated;

create or replace function public.unregister_push_subscription(p_device_id uuid,p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
declare v_count integer;
begin
  update public.push_subscriptions set is_enabled=false,updated_at=now()
  where endpoint=p_endpoint and (device_id=p_device_id or (auth.uid() is not null and user_id=auth.uid()));
  get diagnostics v_count=row_count;
  return v_count>0;
end;
$$;
grant execute on function public.unregister_push_subscription(uuid,text) to anon,authenticated;

create or replace function public.recent_platform_notifications(p_limit integer default 20)
returns table(id uuid,title text,body text,target_url text,notification_topic text,icon_url text,image_url text,completed_at timestamptz)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select campaign.id,campaign.title,campaign.body,campaign.target_url,campaign.notification_topic,campaign.icon_url,campaign.image_url,campaign.completed_at
  from public.notification_campaigns campaign
  where campaign.status='sent' and campaign.completed_at is not null
  order by campaign.completed_at desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;
grant execute on function public.recent_platform_notifications(integer) to anon,authenticated;

create or replace function public.get_web_push_credentials()
returns table(public_key text,private_key text,subject text)
language plpgsql
security definer
set search_path=public,vault,pg_catalog
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Service role required.' using errcode='42501';
  end if;
  return query select
    (select value from public.platform_public_settings where key='web_push_vapid_public_key'),
    (select decrypted_secret from vault.decrypted_secrets where name='medicine_support_hub_vapid_private_key' order by created_at desc limit 1),
    'mailto:jesussavedmina@gmail.com'::text;
end;
$$;
revoke all on function public.get_web_push_credentials() from public,anon,authenticated;
grant execute on function public.get_web_push_credentials() to service_role;

alter table public.platform_public_settings enable row level security;
drop policy if exists "platform public settings read" on public.platform_public_settings;
create policy "platform public settings read" on public.platform_public_settings for select to anon,authenticated using(is_public);
drop policy if exists "platform public settings admin manage" on public.platform_public_settings;
create policy "platform public settings admin manage" on public.platform_public_settings for all to authenticated using(private.is_platform_admin()) with check(private.is_platform_admin());
