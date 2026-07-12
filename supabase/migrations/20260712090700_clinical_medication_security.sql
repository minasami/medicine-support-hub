-- Least-privilege access for encounters and medication orders.

alter table public.clinical_encounters enable row level security;
alter table public.clinical_prescriptions enable row level security;
alter table public.clinical_prescription_items enable row level security;
revoke all on public.clinical_encounters,public.clinical_prescriptions,public.clinical_prescription_items from anon,authenticated;
grant select,insert,update on public.clinical_encounters,public.clinical_prescriptions,public.clinical_prescription_items to authenticated;
grant all on public.clinical_encounters,public.clinical_prescriptions,public.clinical_prescription_items to service_role;

create policy clinical_encounters_read on public.clinical_encounters for select to authenticated
using ((select private.clinical_can_read_patient(patient_id,'encounters')));
create policy clinical_encounters_insert on public.clinical_encounters for insert to authenticated
with check (practitioner_user_id=(select auth.uid()) and (select private.clinical_can_write_patient(patient_id,organization_id,'encounters')));
create policy clinical_encounters_update on public.clinical_encounters for update to authenticated
using ((select private.clinical_can_write_patient(patient_id,organization_id,'encounters')))
with check ((select private.clinical_can_write_patient(patient_id,organization_id,'encounters')));

create policy clinical_prescriptions_read on public.clinical_prescriptions for select to authenticated
using ((select private.clinical_can_read_patient(patient_id,'medications')));
create policy clinical_prescriptions_insert on public.clinical_prescriptions for insert to authenticated
with check (prescriber_user_id=(select auth.uid()) and (select private.clinical_can_write_patient(patient_id,organization_id,'medications')));
create policy clinical_prescriptions_update on public.clinical_prescriptions for update to authenticated
using ((select private.clinical_can_write_patient(patient_id,organization_id,'medications')))
with check ((select private.clinical_can_write_patient(patient_id,organization_id,'medications')));

create policy clinical_prescription_items_read on public.clinical_prescription_items for select to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'medications'))
  or (selected_pharmacy_branch_id is not null and (select private.is_pharmacy_branch_member(selected_pharmacy_branch_id)))
);
create policy clinical_prescription_items_insert on public.clinical_prescription_items for insert to authenticated
with check (exists(
  select 1 from public.clinical_prescriptions p
  where p.id=prescription_id and p.patient_id=patient_id
    and private.clinical_can_write_patient(patient_id,p.organization_id,'medications')
));
create policy clinical_prescription_items_update on public.clinical_prescription_items for update to authenticated
using (
  exists(select 1 from public.clinical_prescriptions p where p.id=prescription_id and private.clinical_can_write_patient(patient_id,p.organization_id,'medications'))
  or (selected_pharmacy_branch_id is not null and (select private.is_pharmacy_branch_member(selected_pharmacy_branch_id)))
)
with check (
  exists(select 1 from public.clinical_prescriptions p where p.id=prescription_id and private.clinical_can_write_patient(patient_id,p.organization_id,'medications'))
  or (selected_pharmacy_branch_id is not null and (select private.is_pharmacy_branch_member(selected_pharmacy_branch_id)))
);
