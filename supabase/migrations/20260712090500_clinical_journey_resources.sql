-- Longitudinal clinical journey resources aligned conceptually with FHIR Patient, Encounter,
-- MedicationRequest, ServiceRequest, DiagnosticReport, Coverage, Claim, Task, and AuditEvent.

create table if not exists public.clinical_encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  practitioner_user_id uuid not null references auth.users(id) on delete restrict,
  encounter_type text not null default 'outpatient' check (encounter_type in ('outpatient','telehealth','emergency','inpatient','home_visit','pharmacy_consultation')),
  status text not null default 'in_progress' check (status in ('planned','arrived','in_progress','completed','cancelled','entered_in_error')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  chief_complaint text,
  clinical_summary text,
  diagnosis_summary text,
  care_plan text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at>=started_at)
);
create index if not exists clinical_encounters_patient_idx on public.clinical_encounters(patient_id,started_at desc);
create index if not exists clinical_encounters_org_idx on public.clinical_encounters(organization_id,status,started_at desc);
create index if not exists clinical_encounters_practitioner_idx on public.clinical_encounters(practitioner_user_id,started_at desc);

create table if not exists public.clinical_prescriptions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references public.clinical_encounters(id) on delete set null,
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  prescriber_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active' check (status in ('draft','active','on_hold','completed','cancelled','entered_in_error')),
  authored_at timestamptz not null default now(),
  valid_until date,
  clinical_indication text,
  instructions text,
  substitution_policy text not null default 'allowed' check (substitution_policy in ('allowed','not_allowed','clinician_approval_required')),
  insurance_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_prescriptions_patient_idx on public.clinical_prescriptions(patient_id,authored_at desc);
create index if not exists clinical_prescriptions_encounter_idx on public.clinical_prescriptions(encounter_id) where encounter_id is not null;
create index if not exists clinical_prescriptions_org_idx on public.clinical_prescriptions(organization_id,status,authored_at desc);

create table if not exists public.clinical_prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.clinical_prescriptions(id) on delete cascade,
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  canonical_medicine_id bigint,
  medicine_name text not null,
  strength text,
  dosage_form text,
  route text,
  dose text not null,
  frequency text not null,
  duration text,
  quantity numeric check (quantity is null or quantity>0),
  quantity_unit text,
  indication text,
  instructions text,
  dispense_status text not null default 'not_started' check (dispense_status in ('not_started','sent_to_pharmacy','partially_dispensed','dispensed','not_dispensed','cancelled')),
  selected_pharmacy_branch_id uuid references public.pharmacy_branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_prescription_items_prescription_idx on public.clinical_prescription_items(prescription_id);
create index if not exists clinical_prescription_items_patient_idx on public.clinical_prescription_items(patient_id,created_at desc);
create index if not exists clinical_prescription_items_medicine_idx on public.clinical_prescription_items(canonical_medicine_id) where canonical_medicine_id is not null;
create index if not exists clinical_prescription_items_pharmacy_idx on public.clinical_prescription_items(selected_pharmacy_branch_id,dispense_status) where selected_pharmacy_branch_id is not null;

create table if not exists public.clinical_service_orders (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references public.clinical_encounters(id) on delete set null,
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  ordering_organization_id uuid not null references public.organizations(id) on delete restrict,
  ordering_practitioner_user_id uuid not null references auth.users(id) on delete restrict,
  destination_organization_id uuid references public.organizations(id) on delete set null,
  service_type text not null check (service_type in ('laboratory','radiology','pharmacy','consultation','procedure','home_care')),
  status text not null default 'draft' check (status in ('draft','active','accepted','scheduled','in_progress','completed','cancelled','rejected','entered_in_error')),
  priority text not null default 'routine' check (priority in ('routine','urgent','asap','stat')),
  code_system text,
  service_code text,
  service_name text not null,
  clinical_question text,
  instructions text,
  insurance_required boolean not null default false,
  scheduled_at timestamptz,
  authored_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_service_orders_patient_idx on public.clinical_service_orders(patient_id,authored_at desc);
create index if not exists clinical_service_orders_ordering_org_idx on public.clinical_service_orders(ordering_organization_id,status,authored_at desc);
create index if not exists clinical_service_orders_destination_idx on public.clinical_service_orders(destination_organization_id,status,priority,authored_at) where destination_organization_id is not null;
create index if not exists clinical_service_orders_encounter_idx on public.clinical_service_orders(encounter_id) where encounter_id is not null;

create table if not exists public.clinical_results (
  id uuid primary key default gen_random_uuid(),
  service_order_id uuid not null references public.clinical_service_orders(id) on delete restrict,
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  performing_organization_id uuid not null references public.organizations(id) on delete restrict,
  result_type text not null check (result_type in ('laboratory_result','radiology_report','imaging_study','procedure_report','clinical_note','other')),
  status text not null default 'preliminary' check (status in ('registered','preliminary','final','amended','corrected','cancelled','entered_in_error')),
  title text not null,
  summary text,
  conclusion text,
  structured_data jsonb not null default '{}'::jsonb,
  report_url text,
  external_reference text,
  issued_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_results_patient_idx on public.clinical_results(patient_id,created_at desc);
create index if not exists clinical_results_order_idx on public.clinical_results(service_order_id,status,created_at desc);
create index if not exists clinical_results_org_idx on public.clinical_results(performing_organization_id,status,created_at desc);

create table if not exists public.insurance_coverages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  payer_organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_name text,
  member_match_key bytea,
  member_last4 text,
  status text not null default 'active' check (status in ('draft','active','cancelled','expired','entered_in_error')),
  valid_from date,
  valid_until date,
  coverage_details jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until>=valid_from),
  check ((member_match_key is null and member_last4 is null) or (member_match_key is not null and length(member_last4)=4))
);
create index if not exists insurance_coverages_patient_idx on public.insurance_coverages(patient_id,status,valid_until);
create index if not exists insurance_coverages_payer_idx on public.insurance_coverages(payer_organization_id,status,valid_until);

create table if not exists public.insurance_authorizations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  coverage_id uuid not null references public.insurance_coverages(id) on delete restrict,
  encounter_id uuid references public.clinical_encounters(id) on delete set null,
  prescription_id uuid references public.clinical_prescriptions(id) on delete set null,
  service_order_id uuid references public.clinical_service_orders(id) on delete set null,
  requesting_organization_id uuid not null references public.organizations(id) on delete restrict,
  payer_organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','submitted','pending_information','approved','partially_approved','denied','cancelled','expired')),
  external_reference text,
  requested_amount numeric check (requested_amount is null or requested_amount>=0),
  approved_amount numeric check (approved_amount is null or approved_amount>=0),
  currency text not null default 'EGP',
  request_summary text not null,
  decision_reason text,
  submitted_at timestamptz,
  decided_at timestamptz,
  expires_at timestamptz,
  requested_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(prescription_id,service_order_id,encounter_id)>=1)
);
create index if not exists insurance_authorizations_patient_idx on public.insurance_authorizations(patient_id,created_at desc);
create index if not exists insurance_authorizations_payer_idx on public.insurance_authorizations(payer_organization_id,status,created_at);
create index if not exists insurance_authorizations_requester_idx on public.insurance_authorizations(requesting_organization_id,status,created_at);

create table if not exists public.clinical_journey_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  encounter_id uuid references public.clinical_encounters(id) on delete set null,
  resource_type text not null,
  resource_id uuid,
  event_type text not null,
  status text,
  title text not null,
  summary text,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists clinical_journey_events_patient_idx on public.clinical_journey_events(patient_id,occurred_at desc,id);
create index if not exists clinical_journey_events_resource_idx on public.clinical_journey_events(resource_type,resource_id,occurred_at desc);
create index if not exists clinical_journey_events_org_idx on public.clinical_journey_events(organization_id,occurred_at desc) where organization_id is not null;

create trigger clinical_encounters_touch_updated_at before update on public.clinical_encounters for each row execute function private.touch_updated_at();
create trigger clinical_prescriptions_touch_updated_at before update on public.clinical_prescriptions for each row execute function private.touch_updated_at();
create trigger clinical_prescription_items_touch_updated_at before update on public.clinical_prescription_items for each row execute function private.touch_updated_at();
create trigger clinical_service_orders_touch_updated_at before update on public.clinical_service_orders for each row execute function private.touch_updated_at();
create trigger clinical_results_touch_updated_at before update on public.clinical_results for each row execute function private.touch_updated_at();
create trigger insurance_coverages_touch_updated_at before update on public.insurance_coverages for each row execute function private.touch_updated_at();
create trigger insurance_authorizations_touch_updated_at before update on public.insurance_authorizations for each row execute function private.touch_updated_at();
