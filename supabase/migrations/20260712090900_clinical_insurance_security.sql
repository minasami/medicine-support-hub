-- Coverage and prior-authorization access for patient care teams and payer organizations.

alter table public.insurance_coverages enable row level security;
alter table public.insurance_authorizations enable row level security;
revoke all on public.insurance_coverages,public.insurance_authorizations from anon,authenticated;
grant select,insert,update on public.insurance_coverages,public.insurance_authorizations to authenticated;
grant all on public.insurance_coverages,public.insurance_authorizations to service_role;

create policy insurance_coverages_read on public.insurance_coverages for select to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'insurance'))
  or (select private.is_org_member(payer_organization_id))
);
create policy insurance_coverages_insert on public.insurance_coverages for insert to authenticated
with check (
  created_by=(select auth.uid())
  and ((select private.clinical_can_read_patient(patient_id,'insurance')) or (select private.is_org_member(payer_organization_id)))
);
create policy insurance_coverages_update on public.insurance_coverages for update to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'insurance'))
  or (select private.is_org_member(payer_organization_id))
)
with check (
  (select private.clinical_can_read_patient(patient_id,'insurance'))
  or (select private.is_org_member(payer_organization_id))
);

create policy insurance_authorizations_read on public.insurance_authorizations for select to authenticated
using (
  (select private.clinical_can_read_patient(patient_id,'insurance'))
  or (select private.is_org_member(requesting_organization_id))
  or (select private.is_org_member(payer_organization_id))
);
create policy insurance_authorizations_insert on public.insurance_authorizations for insert to authenticated
with check (
  requested_by=(select auth.uid())
  and (select private.is_org_member(requesting_organization_id))
  and (select private.clinical_can_read_patient(patient_id,'insurance'))
);
create policy insurance_authorizations_update on public.insurance_authorizations for update to authenticated
using (
  (select private.is_org_member(requesting_organization_id))
  or (select private.is_org_member(payer_organization_id))
)
with check (
  (select private.is_org_member(requesting_organization_id))
  or (select private.is_org_member(payer_organization_id))
);
