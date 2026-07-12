-- Diagnostic orders are visible to the care team and the selected performing organization only.

alter table public.clinical_service_orders enable row level security;
alter table public.clinical_results enable row level security;
revoke all on public.clinical_service_orders,public.clinical_results from anon,authenticated;
grant select,insert,update on public.clinical_service_orders,public.clinical_results to authenticated;
grant all on public.clinical_service_orders,public.clinical_results to service_role;

create policy clinical_service_orders_read on public.clinical_service_orders for select to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'diagnostics'))
  or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id)))
);
create policy clinical_service_orders_insert on public.clinical_service_orders for insert to authenticated
with check (
  ordering_practitioner_user_id=(select auth.uid())
  and (select private.clinical_can_write_patient(patient_id,ordering_organization_id,'diagnostics'))
);
create policy clinical_service_orders_update on public.clinical_service_orders for update to authenticated
using (
  (select private.clinical_can_write_patient(patient_id,ordering_organization_id,'diagnostics'))
  or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id)))
)
with check (
  (select private.clinical_can_write_patient(patient_id,ordering_organization_id,'diagnostics'))
  or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id)))
);

create policy clinical_results_read on public.clinical_results for select to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'diagnostics'))
  or (select private.is_org_member(performing_organization_id))
);
create policy clinical_results_insert on public.clinical_results for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (select private.is_org_member(performing_organization_id))
  and exists(
    select 1 from public.clinical_service_orders o
    where o.id=service_order_id and o.patient_id=patient_id and o.destination_organization_id=performing_organization_id
  )
);
create policy clinical_results_update on public.clinical_results for update to authenticated
using ((select private.is_org_member(performing_organization_id)))
with check ((select private.is_org_member(performing_organization_id)));
