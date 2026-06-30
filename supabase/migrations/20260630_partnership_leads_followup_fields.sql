alter table public.partnership_leads
  add column if not exists admin_notes text,
  add column if not exists follow_up_at timestamptz,
  add column if not exists last_contacted_at timestamptz;

create index if not exists partnership_leads_follow_up_idx
  on public.partnership_leads(follow_up_at)
  where follow_up_at is not null;
