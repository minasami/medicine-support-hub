-- NGO Chronic Medicine Support MVP schema

create table if not exists public.ngo_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  city text,
  contact_email text,
  contact_phone text,
  default_currency text not null default 'EGP',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_members (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'case_worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (ngo_id, user_id)
);

create table if not exists public.ngo_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  full_name text not null,
  national_id text,
  phone text,
  address text,
  city text,
  birthdate date,
  gender text,
  monthly_income numeric(12,2),
  household_size integer,
  vulnerability_score integer,
  primary_diagnosis text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ngo_beneficiary_conditions (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references public.ngo_beneficiaries(id) on delete cascade,
  disease_name text not null,
  icd10_code text,
  severity text,
  diagnosed_at date,
  risk_level text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_budgets (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  name text not null,
  total_budget numeric(14,2) not null default 0,
  committed_amount numeric(14,2) not null default 0,
  spent_amount numeric(14,2) not null default 0,
  currency text not null default 'EGP',
  start_date date,
  end_date date,
  donor_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_medicine_requests (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  beneficiary_id uuid not null references public.ngo_beneficiaries(id) on delete cascade,
  requested_by_user_id uuid,
  budget_id uuid references public.ngo_budgets(id),
  status text not null default 'submitted',
  urgency text not null default 'normal',
  prescription_url text,
  reviewer_notes text,
  finance_notes text,
  estimated_monthly_cost numeric(14,2) not null default 0,
  approved_monthly_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ngo_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ngo_medicine_requests(id) on delete cascade,
  medicine_id integer references public.medicines(id),
  medicine_name text not null,
  active_ingredient text,
  strength text,
  dosage_form text,
  requested_quantity integer not null default 1,
  monthly_quantity integer not null default 1,
  estimated_unit_cost numeric(14,2) not null default 0,
  approved_medicine_id integer references public.medicines(id),
  approved_unit_cost numeric(14,2),
  alternative_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_suppliers (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  name text not null,
  partner_type text not null default 'supplier',
  contact_person text,
  phone text,
  email text,
  address text,
  discount_terms text,
  donation_terms text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ngo_impact_metrics (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references public.ngo_workspaces(id) on delete cascade,
  disease_name text,
  period_start date,
  period_end date,
  beneficiaries_supported integer not null default 0,
  treatment_months_funded integer not null default 0,
  estimated_health_impact text,
  assumptions text,
  created_at timestamptz not null default now()
);

create index if not exists ngo_members_user_idx on public.ngo_members(user_id);
create index if not exists ngo_beneficiaries_ngo_idx on public.ngo_beneficiaries(ngo_id);
create index if not exists ngo_requests_ngo_idx on public.ngo_medicine_requests(ngo_id);
create index if not exists ngo_requests_beneficiary_idx on public.ngo_medicine_requests(beneficiary_id);
