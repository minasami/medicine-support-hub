-- Cover every clinical/provider foreign-key lookup before these tables receive
-- production traffic. PostgreSQL does not create indexes on the referencing
-- side of a foreign key automatically.

create index if not exists clinical_identity_search_audit_patient_fk_idx
  on private.clinical_identity_search_audit(matched_patient_id);
create index if not exists clinical_identity_search_audit_org_fk_idx
  on private.clinical_identity_search_audit(organization_id);
create index if not exists clinical_patient_claim_invites_claimed_by_fk_idx
  on private.clinical_patient_claim_invites(claimed_by);
create index if not exists clinical_patient_claim_invites_created_by_fk_idx
  on private.clinical_patient_claim_invites(created_by);

create index if not exists clinical_journey_events_actor_fk_idx
  on public.clinical_journey_events(actor_user_id);
create index if not exists clinical_journey_events_encounter_fk_idx
  on public.clinical_journey_events(encounter_id);
create index if not exists clinical_patient_access_granted_by_fk_idx
  on public.clinical_patient_access(granted_by);
create index if not exists clinical_patient_access_requested_by_fk_idx
  on public.clinical_patient_access(requested_by);
create index if not exists clinical_patients_created_by_fk_idx
  on public.clinical_patients(created_by);
create index if not exists clinical_prescriptions_prescriber_fk_idx
  on public.clinical_prescriptions(prescriber_user_id);
create index if not exists clinical_queue_entries_assignee_fk_idx
  on public.clinical_queue_entries(assigned_practitioner_user_id);
create index if not exists clinical_queue_entries_created_by_fk_idx
  on public.clinical_queue_entries(created_by);
create index if not exists clinical_results_created_by_fk_idx
  on public.clinical_results(created_by);
create index if not exists clinical_results_verified_by_fk_idx
  on public.clinical_results(verified_by);
create index if not exists clinical_service_orders_practitioner_fk_idx
  on public.clinical_service_orders(ordering_practitioner_user_id);

create index if not exists healthcare_appointments_practitioner_fk_idx
  on public.healthcare_appointments(assigned_practitioner_user_id);
create index if not exists healthcare_appointments_patient_fk_idx
  on public.healthcare_appointments(patient_id);
create index if not exists healthcare_appointments_profile_fk_idx
  on public.healthcare_appointments(profile_id);
create index if not exists healthcare_commission_events_contract_fk_idx
  on public.healthcare_commission_events(contract_id);
create index if not exists healthcare_commission_events_recorded_by_fk_idx
  on public.healthcare_commission_events(recorded_by);
create index if not exists healthcare_entity_applications_result_org_fk_idx
  on public.healthcare_entity_applications(result_organization_id);
create index if not exists healthcare_entity_applications_result_profile_fk_idx
  on public.healthcare_entity_applications(result_profile_id);
create index if not exists healthcare_entity_applications_reviewer_fk_idx
  on public.healthcare_entity_applications(reviewed_by);
create index if not exists healthcare_entity_applications_target_profile_fk_idx
  on public.healthcare_entity_applications(target_profile_id);
create index if not exists healthcare_entity_messages_profile_fk_idx
  on public.healthcare_entity_messages(profile_id);
create index if not exists healthcare_entity_profiles_verifier_fk_idx
  on public.healthcare_entity_profiles(verified_by);
create index if not exists healthcare_provider_contracts_approver_fk_idx
  on public.healthcare_provider_contracts(approved_by);
create index if not exists healthcare_provider_contracts_destination_fk_idx
  on public.healthcare_provider_contracts(destination_organization_id);
create index if not exists healthcare_routing_requests_acceptor_fk_idx
  on public.healthcare_routing_requests(accepted_by);
create index if not exists healthcare_routing_requests_contract_fk_idx
  on public.healthcare_routing_requests(contract_id);
create index if not exists healthcare_routing_requests_destination_profile_fk_idx
  on public.healthcare_routing_requests(destination_profile_id);
create index if not exists healthcare_routing_requests_prescription_fk_idx
  on public.healthcare_routing_requests(prescription_id);
create index if not exists healthcare_routing_requests_requester_fk_idx
  on public.healthcare_routing_requests(requested_by);
create index if not exists healthcare_routing_requests_service_order_fk_idx
  on public.healthcare_routing_requests(service_order_id);
