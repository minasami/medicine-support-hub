-- Append-only journey timeline. Direct authenticated inserts are not granted.

create or replace function private.capture_clinical_journey_event()
returns trigger
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
declare payload jsonb:=to_jsonb(new); patient_value uuid; org_value uuid; encounter_value uuid; event_title text; event_summary text;
begin
  patient_value:=(payload->>'patient_id')::uuid;
  org_value:=coalesce((payload->>'organization_id')::uuid,(payload->>'ordering_organization_id')::uuid,(payload->>'performing_organization_id')::uuid,(payload->>'requesting_organization_id')::uuid);
  encounter_value:=(payload->>'encounter_id')::uuid;
  event_title:=case tg_table_name
    when 'clinical_encounters' then 'Encounter '||coalesce(payload->>'status','updated')
    when 'clinical_prescriptions' then 'Prescription '||coalesce(payload->>'status','updated')
    when 'clinical_prescription_items' then coalesce(payload->>'medicine_name','Medicine')||' · '||coalesce(payload->>'dispense_status','updated')
    when 'clinical_service_orders' then coalesce(payload->>'service_name','Service order')||' · '||coalesce(payload->>'status','updated')
    when 'clinical_results' then coalesce(payload->>'title','Clinical result')||' · '||coalesce(payload->>'status','updated')
    when 'insurance_coverages' then 'Insurance coverage '||coalesce(payload->>'status','updated')
    when 'insurance_authorizations' then 'Insurance authorization '||coalesce(payload->>'status','updated')
    else initcap(replace(tg_table_name,'_',' '))||' updated' end;
  event_summary:=coalesce(payload->>'clinical_summary',payload->>'clinical_indication',payload->>'clinical_question',payload->>'summary',payload->>'request_summary',payload->>'instructions');
  insert into public.clinical_journey_events(patient_id,organization_id,encounter_id,resource_type,resource_id,event_type,status,title,summary,actor_user_id,metadata)
  values(patient_value,org_value,encounter_value,tg_table_name,(payload->>'id')::uuid,lower(tg_op),coalesce(payload->>'status',payload->>'dispense_status'),event_title,event_summary,auth.uid(),jsonb_build_object('operation',tg_op));
  return new;
end;
$$;
revoke all on function private.capture_clinical_journey_event() from public,anon,authenticated;

create trigger clinical_encounters_journey_event after insert or update on public.clinical_encounters for each row execute function private.capture_clinical_journey_event();
create trigger clinical_prescriptions_journey_event after insert or update on public.clinical_prescriptions for each row execute function private.capture_clinical_journey_event();
create trigger clinical_prescription_items_journey_event after insert or update on public.clinical_prescription_items for each row execute function private.capture_clinical_journey_event();
create trigger clinical_service_orders_journey_event after insert or update on public.clinical_service_orders for each row execute function private.capture_clinical_journey_event();
create trigger clinical_results_journey_event after insert or update on public.clinical_results for each row execute function private.capture_clinical_journey_event();
create trigger insurance_coverages_journey_event after insert or update on public.insurance_coverages for each row execute function private.capture_clinical_journey_event();
create trigger insurance_authorizations_journey_event after insert or update on public.insurance_authorizations for each row execute function private.capture_clinical_journey_event();

alter table public.clinical_journey_events enable row level security;
revoke all on public.clinical_journey_events from anon,authenticated;
grant select on public.clinical_journey_events to authenticated;
grant all on public.clinical_journey_events to service_role;
create policy clinical_journey_events_read on public.clinical_journey_events for select to authenticated
using ((select private.clinical_can_read_patient(patient_id,'demographics')));

create or replace view public.clinical_patient_timeline_v1 with (security_invoker=true) as
select e.id,e.patient_id,e.organization_id,e.encounter_id,e.resource_type,e.resource_id,e.event_type,e.status,
  e.title,e.summary,e.actor_user_id,e.occurred_at,e.metadata
from public.clinical_journey_events e;
grant select on public.clinical_patient_timeline_v1 to authenticated,service_role;


