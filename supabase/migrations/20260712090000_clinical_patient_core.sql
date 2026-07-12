-- Clinical patient and consent core. Sensitive identifiers are represented only by a keyed match value.

create table if not exists public.clinical_patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  home_organization_id uuid references public.organizations(id) on delete set null,
  full_name text not null check (length(btrim(full_name)) >= 2),
  phone text,
  email text,
  birthdate date,
  sex_at_birth text check (sex_at_birth is null or sex_at_birth in ('female','male','intersex','unknown','not_recorded')),
  gender_identity text,
  city text,
  country_code text not null default 'EG' check (country_code ~ '^[A-Z]{2}$'),
  identity_type text,
  identity_match_key bytea,
  identity_last4 text,
  status text not null default 'active' check (status in ('active','inactive','deceased','merged')),
  identity_verification_status text not null default 'invited' check (identity_verification_status in ('invited','self_claimed','staff_verified','externally_verified','unverified')),
  consent_basis text not null default 'treatment' check (consent_basis in ('patient_requested','treatment','emergency','legal_guardian','institutional_program')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((identity_match_key is null and identity_last4 is null) or (identity_match_key is not null and length(identity_last4)=4))
);
create unique index if not exists clinical_patients_identity_uidx
  on public.clinical_patients(country_code,identity_type,identity_match_key)
  where identity_match_key is not null;
create index if not exists clinical_patients_user_idx on public.clinical_patients(user_id) where user_id is not null;
create index if not exists clinical_patients_home_org_idx on public.clinical_patients(home_organization_id,status,full_name);
create index if not exists clinical_patients_name_trgm_idx on public.clinical_patients using gin (full_name extensions.gin_trgm_ops);

create table if not exists public.clinical_patient_access (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  practitioner_user_id uuid references auth.users(id) on delete cascade,
  access_level text not null default 'care_team' check (access_level in ('care_team','consulting','pharmacy_fulfillment','diagnostic_fulfillment','insurance_review','read_only')),
  scopes text[] not null default array['demographics','encounters','medications','diagnostics']::text[],
  status text not null default 'requested' check (status in ('requested','granted','denied','revoked','expired')),
  consent_basis text not null default 'treatment' check (consent_basis in ('patient_requested','treatment','emergency','legal_guardian','institutional_program')),
  reason text,
  requested_by uuid not null references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(scopes)>0)
);
create unique index if not exists clinical_patient_access_active_uidx
  on public.clinical_patient_access(patient_id,organization_id,coalesce(practitioner_user_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('requested','granted');
create index if not exists clinical_patient_access_patient_idx on public.clinical_patient_access(patient_id,status,expires_at);
create index if not exists clinical_patient_access_org_idx on public.clinical_patient_access(organization_id,status,patient_id);
create index if not exists clinical_patient_access_practitioner_idx on public.clinical_patient_access(practitioner_user_id,status,patient_id) where practitioner_user_id is not null;

create trigger clinical_patients_touch_updated_at before update on public.clinical_patients
for each row execute function private.touch_updated_at();
create trigger clinical_patient_access_touch_updated_at before update on public.clinical_patient_access
for each row execute function private.touch_updated_at();

alter table public.clinical_patients enable row level security;
alter table public.clinical_patient_access enable row level security;
revoke all on public.clinical_patients,public.clinical_patient_access from anon,authenticated;
grant all on public.clinical_patients,public.clinical_patient_access to service_role;
