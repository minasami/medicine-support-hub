-- Private operational alerts for care-network enrollment requests.
-- Application inserts never depend on push delivery succeeding: in-app alerts
-- and an outbox are written transactionally, while pg_net and pg_cron deliver
-- and retry the encrypted web-push message asynchronously.

alter table public.user_notifications
  add column if not exists data jsonb not null default '{}'::jsonb;

create index if not exists user_notifications_entity_created_idx
  on public.user_notifications(entity_type, entity_key, created_at desc);

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_notification_topic_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_notification_topic_check
  check (notification_topic in (
    'platform_updates','medicine_updates','company_updates','marketplace_updates',
    'learning_updates','favorite_updates','care_network_requests'
  ));

create or replace function public.recent_platform_notifications(p_limit integer default 20)
returns table(
  id uuid,
  title text,
  body text,
  target_url text,
  notification_topic text,
  icon_url text,
  image_url text,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path=public,pg_catalog
as $$
  select campaign.id,campaign.title,campaign.body,campaign.target_url,
    campaign.notification_topic,campaign.icon_url,campaign.image_url,campaign.completed_at
  from public.notification_campaigns campaign
  where campaign.status='sent'
    and campaign.completed_at is not null
    and coalesce(campaign.data->>'visibility','public')='public'
  order by campaign.completed_at desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;
grant execute on function public.recent_platform_notifications(integer) to anon,authenticated;

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
  where topic in (
    'platform_updates','medicine_updates','company_updates','marketplace_updates',
    'learning_updates','favorite_updates','care_network_requests'
  );
  if cardinality(v_topics)=0 then v_topics:=array['platform_updates']; end if;

  insert into public.push_subscriptions(
    user_id,device_id,endpoint,p256dh,auth_key,user_agent,locale,topics,is_enabled,
    failure_count,last_seen_at,platform,last_error
  )
  values(
    auth.uid(),p_device_id,p_endpoint,p_p256dh,p_auth_key,left(p_user_agent,500),
    left(p_locale,20),v_topics,true,0,now(),left(p_platform,120),null
  )
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

update public.push_subscriptions subscription
set topics=(
  select array_agg(distinct topic)
  from unnest(subscription.topics || array['care_network_requests']) topic
), updated_at=now()
from public.profiles profile
where profile.id=subscription.user_id
  and profile.is_active
  and profile.role in ('admin','platform_admin','super_admin')
  and not ('care_network_requests'=any(subscription.topics));

create table if not exists private.care_network_push_outbox (
  application_id uuid primary key references public.healthcare_entity_applications(id) on delete cascade,
  delivery_token text not null unique check (delivery_token ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count>=0),
  last_dispatched_at timestamptz,
  locked_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists care_network_push_outbox_due_idx
  on private.care_network_push_outbox(status,next_attempt_at,last_dispatched_at)
  where status in ('pending','failed','processing');
revoke all on table private.care_network_push_outbox from public,anon,authenticated;

create or replace function private.dispatch_care_network_push(target_application uuid)
returns bigint
language plpgsql
security definer
set search_path=public,private,net,pg_catalog
as $$
declare
  job private.care_network_push_outbox%rowtype;
  request_id bigint;
begin
  select * into job
  from private.care_network_push_outbox
  where application_id=target_application
    and status in ('pending','failed','processing')
    and next_attempt_at<=now()
    and expires_at>now()
    and (last_dispatched_at is null or last_dispatched_at<now()-interval '2 minutes')
  for update;
  if not found then return null; end if;

  update private.care_network_push_outbox
  set last_dispatched_at=now(),updated_at=now()
  where application_id=target_application;

  select net.http_post(
    url:='https://edgbirxeafstvqdpxgxv.supabase.co/functions/v1/notify-care-network-enrollment',
    body:=jsonb_build_object(
      'application_id',job.application_id,
      'delivery_token',job.delivery_token
    ),
    params:='{}'::jsonb,
    headers:='{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds:=5000
  ) into request_id;
  return request_id;
exception when others then
  update private.care_network_push_outbox
  set status='failed',last_error=left(sqlerrm,1000),next_attempt_at=now()+interval '5 minutes',updated_at=now()
  where application_id=target_application;
  return null;
end;
$$;
revoke all on function private.dispatch_care_network_push(uuid) from public,anon,authenticated;

create or replace function private.dispatch_due_care_network_pushes(batch_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  row record;
  dispatched integer:=0;
begin
  for row in
    select application_id
    from private.care_network_push_outbox
    where status in ('pending','failed','processing')
      and next_attempt_at<=now()
      and expires_at>now()
      and (last_dispatched_at is null or last_dispatched_at<now()-interval '10 minutes')
    order by created_at
    limit greatest(1,least(coalesce(batch_limit,20),100))
  loop
    if private.dispatch_care_network_push(row.application_id) is not null then
      dispatched:=dispatched+1;
    end if;
  end loop;
  return dispatched;
end;
$$;
revoke all on function private.dispatch_due_care_network_pushes(integer) from public,anon,authenticated;

create or replace function public.claim_care_network_push_job(
  p_application_id uuid,
  p_delivery_token text
)
returns table(
  application_id uuid,
  requested_name text,
  entity_type text,
  city text,
  country text,
  submitted_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  claimed_id uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Service role required.' using errcode='42501';
  end if;
  update private.care_network_push_outbox
  set status='processing',attempt_count=attempt_count+1,locked_at=now(),last_error=null,updated_at=now()
  where care_network_push_outbox.application_id=p_application_id
    and delivery_token=p_delivery_token
    and expires_at>now()
    and (
      status in ('pending','failed')
      or (status='processing' and locked_at<now()-interval '10 minutes')
    )
  returning care_network_push_outbox.application_id into claimed_id;
  if claimed_id is null then
    raise exception 'Push job is invalid, expired, or already claimed.' using errcode='P0002';
  end if;
  return query
  select application.id,application.requested_name,application.entity_type,
    application.city,application.country,application.submitted_by,application.created_at
  from public.healthcare_entity_applications application
  where application.id=claimed_id and application.status in ('pending','under_review');
end;
$$;
revoke all on function public.claim_care_network_push_job(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_care_network_push_job(uuid,text) to service_role;

create or replace function public.complete_care_network_push_job(
  p_application_id uuid,
  p_delivery_token text,
  p_status text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  changed integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'Service role required.' using errcode='42501';
  end if;
  if p_status not in ('sent','failed') then
    raise exception 'Invalid completion status.' using errcode='22023';
  end if;
  update private.care_network_push_outbox
  set status=p_status,
      completed_at=case when p_status='sent' then now() else null end,
      next_attempt_at=case when p_status='failed' then now()+interval '5 minutes' else next_attempt_at end,
      last_error=case when p_status='failed' then left(coalesce(p_error,'Push delivery failed'),1000) else null end,
      updated_at=now()
  where application_id=p_application_id and delivery_token=p_delivery_token;
  get diagnostics changed=row_count;
  return changed>0;
end;
$$;
revoke all on function public.complete_care_network_push_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_care_network_push_job(uuid,text,text,text) to service_role;

create or replace function private.queue_care_network_enrollment_notification()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  token text:=encode(gen_random_bytes(32),'hex');
  location_text text;
begin
  location_text:=concat_ws(', ',nullif(btrim(new.city),''),nullif(btrim(new.country),''));
  insert into public.user_notifications(
    user_id,title,body,target_url,notification_topic,entity_type,entity_key,data
  )
  select profile.id,
    'New care network enrollment request',
    left(new.requested_name||' applied as '||replace(new.entity_type,'_',' ')||
      case when location_text<>'' then ' in '||location_text else '' end||
      '. Review identity, licensing and evidence.',500),
    '/admin?tab=care-network&request='||new.id::text,
    'care_network_requests',
    'healthcare_entity_application',
    new.id::text,
    jsonb_build_object(
      'application_id',new.id,
      'requested_name',new.requested_name,
      'entity_type',new.entity_type,
      'city',new.city,
      'country',new.country,
      'status',new.status,
      'contains_protected_health_information',false
    )
  from public.profiles profile
  where profile.is_active and profile.role in ('admin','platform_admin','super_admin');

  insert into private.care_network_push_outbox(application_id,delivery_token)
  values(new.id,token)
  on conflict(application_id) do nothing;

  begin
    perform private.dispatch_care_network_push(new.id);
  exception when others then
    update private.care_network_push_outbox
    set status='failed',last_error=left(sqlerrm,1000),next_attempt_at=now()+interval '5 minutes',updated_at=now()
    where application_id=new.id;
  end;
  return new;
end;
$$;
revoke all on function private.queue_care_network_enrollment_notification() from public,anon,authenticated;

drop trigger if exists healthcare_entity_application_notify_admins on public.healthcare_entity_applications;
create trigger healthcare_entity_application_notify_admins
after insert on public.healthcare_entity_applications
for each row execute function private.queue_care_network_enrollment_notification();

create or replace function private.resolve_care_network_enrollment_notifications()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
begin
  if old.status in ('pending','under_review') and new.status in ('approved','rejected') then
    update public.user_notifications
    set read_at=coalesce(read_at,now()),
        body=left(body||' Decision: '||case when new.status='approved' then 'approved' else 'refused' end||'.',500)
    where entity_type='healthcare_entity_application' and entity_key=new.id::text;
  end if;
  return new;
end;
$$;
revoke all on function private.resolve_care_network_enrollment_notifications() from public,anon,authenticated;

drop trigger if exists healthcare_entity_application_resolve_notifications on public.healthcare_entity_applications;
create trigger healthcare_entity_application_resolve_notifications
after update of status on public.healthcare_entity_applications
for each row execute function private.resolve_care_network_enrollment_notifications();

-- Backfill open applications without duplicating existing admin notification cards.
insert into public.user_notifications(
  user_id,title,body,target_url,notification_topic,entity_type,entity_key,data
)
select profile.id,
  'New care network enrollment request',
  left(application.requested_name||' applied as '||replace(application.entity_type,'_',' ')||'. Review identity, licensing and evidence.',500),
  '/admin?tab=care-network&request='||application.id::text,
  'care_network_requests','healthcare_entity_application',application.id::text,
  jsonb_build_object(
    'application_id',application.id,
    'requested_name',application.requested_name,
    'entity_type',application.entity_type,
    'city',application.city,
    'country',application.country,
    'status',application.status,
    'contains_protected_health_information',false
  )
from public.healthcare_entity_applications application
cross join public.profiles profile
where application.status in ('pending','under_review')
  and profile.is_active and profile.role in ('admin','platform_admin','super_admin')
  and not exists(
    select 1 from public.user_notifications notification
    where notification.user_id=profile.id
      and notification.entity_type='healthcare_entity_application'
      and notification.entity_key=application.id::text
  );

insert into private.care_network_push_outbox(application_id,delivery_token)
select application.id,encode(gen_random_bytes(32),'hex')
from public.healthcare_entity_applications application
where application.status in ('pending','under_review')
on conflict(application_id) do nothing;

select cron.unschedule('care-network-push-retry')
where exists(select 1 from cron.job where jobname='care-network-push-retry');
select cron.schedule(
  'care-network-push-retry',
  '*/5 * * * *',
  'select private.dispatch_due_care_network_pushes(20);'
);

select private.dispatch_due_care_network_pushes(20);
