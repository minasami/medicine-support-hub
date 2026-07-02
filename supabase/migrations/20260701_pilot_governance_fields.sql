alter table public.programs
  add column if not exists pilot_approval_status text not null default 'not_submitted',
  add column if not exists pilot_approval_notes text,
  add column if not exists pilot_approved_at timestamptz,
  add column if not exists pilot_approved_by_name text,
  add column if not exists launch_decision text;
