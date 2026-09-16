-- 90-day reviewer-queue pilot (GitHub issue #139).
-- Synthetic / consented demo data only. Not a TPA claims system.
-- Separate from medicine_enrichment_import_queue.

create table if not exists public.support_review_queue (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  requester_label text not null,
  medicine_name text not null,
  evidence_ok boolean not null default false,
  status text not null default 'open'
    check (status in ('open', 'waiting', 'done')),
  decision text
    check (decision is null or decision in ('approve', 'query', 'decline', 'wait')),
  reason text,
  owner_label text,
  is_repeat_14d boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.support_review_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_review_queue(id) on delete cascade,
  at timestamptz not null default now(),
  actor_label text not null,
  from_status text,
  to_status text not null,
  decision text,
  reason text
);

create index if not exists support_review_queue_status_opened_idx
  on public.support_review_queue (status, opened_at);
create index if not exists support_review_queue_requester_med_idx
  on public.support_review_queue (requester_label, medicine_name, opened_at desc);
create index if not exists support_review_events_ticket_idx
  on public.support_review_events (ticket_id, at desc);

create or replace function public.support_review_mark_repeats()
returns trigger
language plpgsql
as $$
begin
  new.is_repeat_14d := exists (
    select 1
    from public.support_review_queue q
    where q.requester_label = new.requester_label
      and lower(q.medicine_name) = lower(new.medicine_name)
      and q.id is distinct from new.id
      and q.opened_at >= new.opened_at - interval '14 days'
  );
  return new;
end;
$$;

drop trigger if exists support_review_queue_repeat_trg on public.support_review_queue;
create trigger support_review_queue_repeat_trg
before insert on public.support_review_queue
for each row
execute function public.support_review_mark_repeats();

create or replace function public.decide_support_review_ticket(
  p_ticket_id uuid,
  p_decision text,
  p_reason text,
  p_evidence_ok boolean default null,
  p_actor_label text default null
)
returns public.support_review_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.support_review_queue%rowtype;
  v_from text;
  v_to text;
  v_actor text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;

  if p_decision not in ('approve', 'query', 'decline', 'wait') then
    raise exception 'Decision must be approve, query, decline, or wait.';
  end if;

  if p_reason is null or length(trim(p_reason)) < 8 then
    raise exception 'Reason sentence is required (at least 8 characters).';
  end if;

  select * into v_row
  from public.support_review_queue
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Ticket not found.';
  end if;

  v_from := v_row.status;
  v_actor := coalesce(nullif(trim(p_actor_label), ''), 'reviewer');

  if p_evidence_ok is not null then
    v_row.evidence_ok := p_evidence_ok;
  end if;

  if p_decision = 'approve' then
    if not v_row.evidence_ok then
      raise exception 'Cannot approve: evidence_ok must be true.';
    end if;
    v_to := 'done';
    v_row.closed_at := now();
  elsif p_decision = 'decline' then
    v_to := 'done';
    v_row.closed_at := now();
  else
    v_to := 'waiting';
    v_row.closed_at := null;
  end if;

  update public.support_review_queue
  set status = v_to,
      decision = p_decision,
      reason = trim(p_reason),
      evidence_ok = v_row.evidence_ok,
      owner_label = v_actor,
      closed_at = v_row.closed_at
  where id = p_ticket_id
  returning * into v_row;

  insert into public.support_review_events (
    ticket_id, actor_label, from_status, to_status, decision, reason
  ) values (
    p_ticket_id, v_actor, v_from, v_to, p_decision, trim(p_reason)
  );

  return v_row;
end;
$$;

alter table public.support_review_queue enable row level security;
alter table public.support_review_events enable row level security;

drop policy if exists support_review_queue_select_auth on public.support_review_queue;
drop policy if exists support_review_queue_insert_auth on public.support_review_queue;
drop policy if exists support_review_events_select_auth on public.support_review_events;

create policy support_review_queue_select_auth
  on public.support_review_queue for select
  to authenticated
  using (true);

create policy support_review_queue_insert_auth
  on public.support_review_queue for insert
  to authenticated
  with check (true);

create policy support_review_events_select_auth
  on public.support_review_events for select
  to authenticated
  using (true);

grant select, insert on public.support_review_queue to authenticated;
grant select on public.support_review_events to authenticated;
grant execute on function public.decide_support_review_ticket(uuid, text, text, boolean, text) to authenticated;

insert into public.support_review_queue (
  opened_at, requester_label, medicine_name, evidence_ok, status
)
select *
from (
  values
    (now() - interval '18 hours', 'Demo-R1 pharmacist friend', 'Concor 5mg', true, 'open'),
    (now() - interval '6 hours', 'Demo-R1 pharmacist friend', 'Concor 5mg', true, 'open'),
    (now() - interval '40 hours', 'Demo-R2 foundation colleague', 'Insulin glargine', false, 'open'),
    (now() - interval '9 hours', 'Demo-R2 foundation colleague', 'Panadol Extra', true, 'open'),
    (now() - interval '3 hours', 'Demo-R3 NGO coordinator', 'Augmentin 1g', true, 'open'),
    (now() - interval '27 hours', 'Demo-R3 NGO coordinator', 'Augmentin 1g', true, 'open'),
    (now() - interval '2 hours', 'Demo-R4 reviewer self-test', 'Vitamin D3 50000 IU', true, 'open'),
    (now() - interval '55 hours', 'Demo-R4 reviewer self-test', 'Cataflam 50mg', false, 'waiting'),
    (now() - interval '8 hours', 'Demo-R5 synthetic only', 'Antinal 220mg', true, 'open'),
    (now() - interval '1 hours', 'Demo-R5 synthetic only', 'Congestal', false, 'open')
) as seed(opened_at, requester_label, medicine_name, evidence_ok, status)
where not exists (select 1 from public.support_review_queue limit 1);

insert into public.support_review_events (ticket_id, actor_label, from_status, to_status, reason)
select id, 'seed', null, status, 'Synthetic pilot seed. Not a patient record.'
from public.support_review_queue q
where not exists (
  select 1 from public.support_review_events e where e.ticket_id = q.id
);
