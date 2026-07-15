-- Server-to-server PostgREST calls run as the database service_role but do not
-- always populate request.jwt.claim.role. EXECUTE is already revoked from
-- public/anon/authenticated, so grants are the reliable authorization boundary.

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

update private.care_network_push_outbox
set status='pending',locked_at=null,last_dispatched_at=null,next_attempt_at=now(),last_error=null,updated_at=now()
where status in ('pending','failed','processing') and expires_at>now();

select private.dispatch_due_care_network_pushes(20);
