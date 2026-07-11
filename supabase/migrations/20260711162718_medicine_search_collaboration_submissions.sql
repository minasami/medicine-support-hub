create table if not exists public.medicine_collaboration_submissions (
  id uuid primary key default gen_random_uuid(),
  canonical_id bigint not null,
  contribution_type text not null check (contribution_type in ('correction','price_observation','availability_update','product_evidence','educational_resource','patient_support_connection')),
  title text not null,
  summary text not null,
  proposed_price_egp numeric,
  evidence_urls text[] not null default '{}',
  submitted_by uuid not null references auth.users(id) on delete cascade,
  organization_name text,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(title)) >= 3),
  check (length(btrim(summary)) >= 10),
  check (proposed_price_egp is null or proposed_price_egp > 0),
  check (contribution_type <> 'price_observation' or proposed_price_egp is not null)
);

create index if not exists medicine_collaboration_submissions_product_idx on public.medicine_collaboration_submissions (canonical_id, status, created_at desc);
create index if not exists medicine_collaboration_submissions_submitter_idx on public.medicine_collaboration_submissions (submitted_by, created_at desc);
create index if not exists medicine_collaboration_submissions_status_idx on public.medicine_collaboration_submissions (status, created_at asc);
create unique index if not exists medicine_collaboration_submissions_active_key on public.medicine_collaboration_submissions (canonical_id, submitted_by, contribution_type) where status in ('submitted','under_review');

create or replace function private.validate_medicine_collaboration_submission()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from public.medicine_canonical_products_v1 product where product.canonical_id = new.canonical_id) then
    raise exception 'Canonical medicine product not found.' using errcode = '23503';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists medicine_collaboration_submission_validate on public.medicine_collaboration_submissions;
create trigger medicine_collaboration_submission_validate before insert or update on public.medicine_collaboration_submissions for each row execute function private.validate_medicine_collaboration_submission();

alter table public.medicine_collaboration_submissions enable row level security;
revoke all on table public.medicine_collaboration_submissions from anon, authenticated;
grant select, insert on table public.medicine_collaboration_submissions to authenticated;
grant select on table public.medicine_collaboration_submissions to anon;
grant all on table public.medicine_collaboration_submissions to service_role;

drop policy if exists medicine_collaboration_public_read on public.medicine_collaboration_submissions;
create policy medicine_collaboration_public_read on public.medicine_collaboration_submissions for select to anon using (status = 'approved');

drop policy if exists medicine_collaboration_authenticated_read on public.medicine_collaboration_submissions;
create policy medicine_collaboration_authenticated_read on public.medicine_collaboration_submissions for select to authenticated using (status = 'approved' or submitted_by = (select auth.uid()) or (select private.is_platform_admin()));

drop policy if exists medicine_collaboration_insert on public.medicine_collaboration_submissions;
create policy medicine_collaboration_insert on public.medicine_collaboration_submissions for insert to authenticated with check (
  submitted_by = (select auth.uid()) and status = 'submitted' and reviewed_by is null and reviewed_at is null and review_notes is null
);

create or replace view public.medicine_approved_contributions_v1 with (security_invoker = true) as
select submission.id, submission.canonical_id, submission.contribution_type, submission.title, submission.summary,
  submission.proposed_price_egp, submission.evidence_urls, submission.organization_name, submission.created_at, submission.reviewed_at
from public.medicine_collaboration_submissions submission
where submission.status = 'approved';
grant select on public.medicine_approved_contributions_v1 to anon, authenticated;

create or replace function private.review_medicine_collaboration_submission(target_submission uuid, decision text, reviewer_notes text default null)
returns public.medicine_collaboration_submissions
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare result_row public.medicine_collaboration_submissions%rowtype;
begin
  if not private.is_platform_admin() then raise exception 'Only platform administrators can review medicine contributions.' using errcode = '42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode = '22023'; end if;
  update public.medicine_collaboration_submissions
  set status = decision, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = reviewer_notes
  where id = target_submission and status in ('submitted','under_review') returning * into result_row;
  if result_row.id is null then raise exception 'Medicine contribution not found or already reviewed.' using errcode = 'P0002'; end if;
  return result_row;
end;
$$;

create or replace function public.review_medicine_collaboration_submission(target_submission uuid, decision text, reviewer_notes text default null)
returns public.medicine_collaboration_submissions
language sql
security invoker
set search_path = private, public, pg_catalog
as $$ select private.review_medicine_collaboration_submission(target_submission, decision, reviewer_notes); $$;

revoke all on function public.review_medicine_collaboration_submission(uuid,text,text) from public, anon;
grant execute on function public.review_medicine_collaboration_submission(uuid,text,text) to authenticated, service_role;
revoke all on function private.review_medicine_collaboration_submission(uuid,text,text) from public, anon, authenticated;
grant execute on function private.review_medicine_collaboration_submission(uuid,text,text) to service_role;
