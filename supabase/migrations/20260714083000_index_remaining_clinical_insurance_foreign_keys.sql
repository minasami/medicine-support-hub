-- Cover the remaining clinical insurance foreign keys reported by the
-- Supabase performance advisor. Existing composite patient, payer, and
-- requesting-organization indexes already cover those foreign keys.

create index if not exists insurance_authorizations_coverage_fk_idx
  on public.insurance_authorizations (coverage_id);

create index if not exists insurance_authorizations_decided_by_fk_idx
  on public.insurance_authorizations (decided_by);

create index if not exists insurance_authorizations_encounter_fk_idx
  on public.insurance_authorizations (encounter_id);

create index if not exists insurance_authorizations_prescription_fk_idx
  on public.insurance_authorizations (prescription_id);

create index if not exists insurance_authorizations_requested_by_fk_idx
  on public.insurance_authorizations (requested_by);

create index if not exists insurance_authorizations_service_order_fk_idx
  on public.insurance_authorizations (service_order_id);

create index if not exists insurance_coverages_created_by_fk_idx
  on public.insurance_coverages (created_by);
