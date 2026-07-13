create table if not exists public.medicine_experience_reports (
  id uuid primary key default gen_random_uuid(), canonical_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('reported_benefit','side_effect','adverse_effect','quality_issue','other')),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  severity text not null default 'unknown' check (severity in ('mild','moderate','serious','unknown')),
  occurred_at date, evidence_urls text[] not null default '{}', is_anonymous boolean not null default true,
  emergency_acknowledged boolean not null default false,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','escalated')),
  moderation_notes text, reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists medicine_experience_reports_medicine_idx on public.medicine_experience_reports(canonical_id,status,report_type,created_at desc);
create index if not exists medicine_experience_reports_user_idx on public.medicine_experience_reports(user_id,status,created_at desc);
create table if not exists public.medicine_public_experience_reports (
  id uuid primary key, canonical_id bigint not null, report_type text not null, title text not null,
  description text not null, severity text not null, occurred_at date, evidence_urls text[] not null default '{}',
  reporter_name text not null, created_at timestamptz not null
);
create index if not exists medicine_public_experience_reports_idx on public.medicine_public_experience_reports(canonical_id,report_type,created_at desc);
create trigger medicine_experience_reports_touch_updated_at before update on public.medicine_experience_reports for each row execute function private.touch_updated_at();
alter table public.medicine_experience_reports enable row level security;
alter table public.medicine_public_experience_reports enable row level security;
revoke all on public.medicine_experience_reports,public.medicine_public_experience_reports from anon,authenticated;
grant select,insert,update on public.medicine_experience_reports to authenticated;
grant select on public.medicine_public_experience_reports to anon,authenticated;
grant all on public.medicine_experience_reports,public.medicine_public_experience_reports to service_role;
create policy experience_reports_own_or_admin_select on public.medicine_experience_reports for select to authenticated using (user_id=(select auth.uid()) or (select private.is_platform_admin()));
create policy experience_reports_own_insert on public.medicine_experience_reports for insert to authenticated with check (
  user_id=(select auth.uid()) and status='submitted' and reviewed_by is null and reviewed_at is null and moderation_notes is null
  and (severity<>'serious' or emergency_acknowledged=true)
  and exists(select 1 from public.medicine_encyclopedia_products_v2 p where p.canonical_id=medicine_experience_reports.canonical_id)
);
create policy experience_reports_pending_own_or_admin_update on public.medicine_experience_reports for update to authenticated using ((user_id=(select auth.uid()) and status='submitted') or (select private.is_platform_admin())) with check ((user_id=(select auth.uid()) and status='submitted' and reviewed_by is null and reviewed_at is null) or (select private.is_platform_admin()));
create policy public_experience_reports_read on public.medicine_public_experience_reports for select to anon,authenticated using (true);
create or replace function private.sync_public_medicine_experience_report()
returns trigger language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare v_name text;
begin
  if tg_op='DELETE' or new.status<>'approved' then delete from public.medicine_public_experience_reports where id=old.id;
  else
    select case when new.is_anonymous then 'Community member' else coalesce(nullif(btrim(p.full_name),''),'Community member') end into v_name from public.profiles p where p.id=new.user_id;
    insert into public.medicine_public_experience_reports(id,canonical_id,report_type,title,description,severity,occurred_at,evidence_urls,reporter_name,created_at)
    values(new.id,new.canonical_id,new.report_type,new.title,new.description,new.severity,new.occurred_at,new.evidence_urls,coalesce(v_name,'Community member'),new.created_at)
    on conflict(id) do update set report_type=excluded.report_type,title=excluded.title,description=excluded.description,severity=excluded.severity,occurred_at=excluded.occurred_at,evidence_urls=excluded.evidence_urls,reporter_name=excluded.reporter_name;
  end if;
  return coalesce(new,old);
end;
$$;
revoke all on function private.sync_public_medicine_experience_report() from public,anon,authenticated;
create trigger medicine_experience_reports_sync_public after insert or update or delete on public.medicine_experience_reports for each row execute function private.sync_public_medicine_experience_report();
