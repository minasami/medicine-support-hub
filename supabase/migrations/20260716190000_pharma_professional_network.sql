-- Consent-based pharmaceutical careers and employment verification.
-- The model intentionally excludes secret scores, anonymous reviews, dismissal reasons, and blacklists.

create table if not exists public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) >= 3),
  headline text,
  professional_type text not null default 'other' check (professional_type in ('medical_representative','sales_representative','pharmacist','pharmacy_assistant','product_manager','medical_scientific_liaison','specialist','other')),
  summary text,
  city text,
  country text,
  years_experience integer not null default 0 check (years_experience between 0 and 70),
  skills text[] not null default '{}',
  open_to_work boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public','private')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','partially_verified','verified','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.professional_employment_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  professional_name text not null,
  company_name text not null check (length(trim(company_name)) >= 2),
  title text not null check (length(trim(title)) >= 2),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text,
  verification_status text not null default 'self_reported' check (verification_status in ('self_reported','pending','verified','declined','disputed','revoked')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_current and end_date is null) or (not is_current and (end_date is null or end_date >= start_date)))
);

create table if not exists public.employment_verification_requests (
  id uuid primary key default gen_random_uuid(),
  employment_record_id uuid not null references public.professional_employment_records(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requester_note text,
  status text not null default 'pending' check (status in ('pending','approved','declined','withdrawn','disputed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists employment_verification_open_key on public.employment_verification_requests(employment_record_id) where status = 'pending';

create table if not exists public.professional_job_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_profile_id uuid not null references public.industry_company_profiles(id) on delete restrict,
  company_name text not null,
  company_slug text not null,
  posted_by uuid not null references auth.users(id) on delete restrict,
  title text not null check (length(trim(title)) >= 3),
  employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','internship','temporary')),
  workplace_type text not null default 'on_site' check (workplace_type in ('on_site','hybrid','remote')),
  city text,
  country text,
  description text not null check (length(trim(description)) >= 20),
  requirements text,
  skills text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','paused','closed','archived')),
  published_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null),
  check (closes_at is null or closes_at > created_at)
);

create table if not exists public.professional_job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.professional_job_posts(id) on delete cascade,
  applicant_profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  cover_note text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','shortlisted','interview','accepted','declined','withdrawn','hired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, applicant_profile_id)
);

create table if not exists public.professional_endorsements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  employment_record_id uuid references public.professional_employment_records(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  author_organization_id uuid references public.organizations(id) on delete set null,
  relationship text not null,
  body text not null check (length(trim(body)) between 20 and 2000),
  skills text[] not null default '{}',
  consent_status text not null default 'pending' check (consent_status in ('pending','accepted','declined','withdrawn','disputed')),
  professional_response text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_public or consent_status = 'accepted')
);

create index if not exists professional_profiles_public_idx on public.professional_profiles(visibility,open_to_work,professional_type);
create index if not exists professional_employment_profile_idx on public.professional_employment_records(profile_id,start_date desc);
create index if not exists professional_job_posts_public_idx on public.professional_job_posts(status,published_at desc);
create index if not exists professional_job_applications_job_idx on public.professional_job_applications(job_id,status);
create index if not exists professional_endorsements_profile_idx on public.professional_endorsements(profile_id,consent_status);

create or replace function private.jobs_touch_updated_at() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$ begin new.updated_at := now(); return new; end; $$;
create or replace function private.reset_changed_employment_verification() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if (new.organization_id,new.company_name,new.title,new.start_date,new.end_date,new.is_current) is distinct from (old.organization_id,old.company_name,old.title,old.start_date,old.end_date,old.is_current) then
    new.verification_status := 'self_reported'; new.verified_by := null; new.verified_at := null;
  end if;
  return new;
end; $$;

create trigger professional_profiles_touch before update on public.professional_profiles for each row execute function private.jobs_touch_updated_at();
create trigger professional_employment_touch before update on public.professional_employment_records for each row execute function private.jobs_touch_updated_at();
create trigger professional_employment_reset before update on public.professional_employment_records for each row execute function private.reset_changed_employment_verification();
create trigger employment_verification_touch before update on public.employment_verification_requests for each row execute function private.jobs_touch_updated_at();
create trigger professional_job_posts_touch before update on public.professional_job_posts for each row execute function private.jobs_touch_updated_at();
create trigger professional_job_applications_touch before update on public.professional_job_applications for each row execute function private.jobs_touch_updated_at();
create trigger professional_endorsements_touch before update on public.professional_endorsements for each row execute function private.jobs_touch_updated_at();

create or replace function public.review_employment_verification(target_request uuid, decision text, reviewer_note text default null)
returns public.employment_verification_requests language plpgsql security definer set search_path = public,pg_catalog as $$
declare request_row public.employment_verification_requests%rowtype; result_row public.employment_verification_requests%rowtype; target_profile uuid;
begin
  if decision not in ('approved','declined') then raise exception 'Decision must be approved or declined.' using errcode='22023'; end if;
  select * into request_row from public.employment_verification_requests where id=target_request for update;
  if not found then raise exception 'Verification request not found.' using errcode='P0002'; end if;
  if request_row.status <> 'pending' then raise exception 'Verification request is no longer pending.' using errcode='22023'; end if;
  if not (public.is_platform_admin() or public.is_org_member(request_row.organization_id)) then raise exception 'Not authorized to review this request.' using errcode='42501'; end if;
  update public.employment_verification_requests set status=decision,reviewed_by=auth.uid(),reviewer_note=review_employment_verification.reviewer_note,reviewed_at=now() where id=target_request returning * into result_row;
  update public.professional_employment_records set verification_status=case when decision='approved' then 'verified' else 'declined' end,verified_by=case when decision='approved' then auth.uid() else null end,verified_at=case when decision='approved' then now() else null end where id=request_row.employment_record_id returning profile_id into target_profile;
  update public.professional_profiles p set verification_status=case when exists(select 1 from public.professional_employment_records e where e.profile_id=target_profile and e.verification_status='verified') then 'partially_verified' else 'unverified' end where p.id=target_profile and p.verification_status <> 'suspended';
  return result_row;
end; $$;

create or replace function public.respond_professional_endorsement(target_endorsement uuid, decision text, professional_response text default null)
returns public.professional_endorsements language plpgsql security definer set search_path = public,pg_catalog as $$
declare row_value public.professional_endorsements%rowtype;
begin
  if decision not in ('accepted','declined','disputed') then raise exception 'Decision is invalid.' using errcode='22023'; end if;
  update public.professional_endorsements e set consent_status=decision,professional_response=respond_professional_endorsement.professional_response,is_public=(decision='accepted') where e.id=target_endorsement and exists(select 1 from public.professional_profiles p where p.id=e.profile_id and p.user_id=auth.uid()) and e.consent_status='pending' returning * into row_value;
  if not found then raise exception 'Endorsement not found or not actionable.' using errcode='P0002'; end if;
  return row_value;
end; $$;

create or replace function public.review_professional_job_application(target_application uuid, decision text)
returns public.professional_job_applications language plpgsql security definer set search_path = public,pg_catalog as $$
declare application_row public.professional_job_applications%rowtype; result_row public.professional_job_applications%rowtype; target_organization uuid;
begin
  if decision not in ('reviewing','shortlisted','interview','accepted','declined','withdrawn','hired') then
    raise exception 'Application decision is invalid.' using errcode='22023';
  end if;
  select * into application_row from public.professional_job_applications where id=target_application for update;
  if not found then raise exception 'Application not found.' using errcode='P0002'; end if;
  select organization_id into target_organization from public.professional_job_posts where id=application_row.job_id;
  if decision='withdrawn' then
    if application_row.applicant_id<>auth.uid() then raise exception 'Only the applicant can withdraw this application.' using errcode='42501'; end if;
  elsif not (public.is_platform_admin() or public.is_org_member(target_organization)) then
    raise exception 'Verified company access required.' using errcode='42501';
  end if;
  if application_row.status in ('declined','withdrawn','hired') then
    raise exception 'This application is no longer actionable.' using errcode='22023';
  end if;
  update public.professional_job_applications set status=decision where id=target_application returning * into result_row;
  return result_row;
end; $$;

alter table public.professional_profiles enable row level security;
alter table public.professional_employment_records enable row level security;
alter table public.employment_verification_requests enable row level security;
alter table public.professional_job_posts enable row level security;
alter table public.professional_job_applications enable row level security;
alter table public.professional_endorsements enable row level security;

revoke all on table public.professional_profiles,public.professional_employment_records,public.employment_verification_requests,public.professional_job_posts,public.professional_job_applications,public.professional_endorsements from anon,authenticated;
grant select on public.professional_profiles,public.professional_employment_records,public.professional_job_posts,public.professional_endorsements to anon,authenticated;
grant select on public.employment_verification_requests,public.professional_job_applications to authenticated;
grant insert (user_id,full_name,headline,professional_type,summary,city,country,years_experience,skills,open_to_work,visibility) on public.professional_profiles to authenticated;
grant update (full_name,headline,professional_type,summary,city,country,years_experience,skills,open_to_work,visibility) on public.professional_profiles to authenticated;
grant insert (profile_id,organization_id,professional_name,company_name,title,start_date,end_date,is_current,description,is_public) on public.professional_employment_records to authenticated;
grant update (organization_id,company_name,title,start_date,end_date,is_current,description,is_public) on public.professional_employment_records to authenticated;
grant insert (employment_record_id,organization_id,requested_by,requester_note) on public.employment_verification_requests to authenticated;
grant insert (organization_id,company_profile_id,company_name,company_slug,posted_by,title,employment_type,workplace_type,city,country,description,requirements,skills,status,published_at,closes_at) on public.professional_job_posts to authenticated;
grant insert (job_id,applicant_profile_id,applicant_id,cover_note,status) on public.professional_job_applications to authenticated;
grant insert (profile_id,employment_record_id,author_user_id,author_organization_id,relationship,body,skills,consent_status,is_public) on public.professional_endorsements to authenticated;
grant all on public.professional_profiles,public.professional_employment_records,public.employment_verification_requests,public.professional_job_posts,public.professional_job_applications,public.professional_endorsements to service_role;
revoke all on function public.review_employment_verification(uuid,text,text),public.respond_professional_endorsement(uuid,text,text),public.review_professional_job_application(uuid,text) from public;
grant execute on function public.review_employment_verification(uuid,text,text),public.respond_professional_endorsement(uuid,text,text),public.review_professional_job_application(uuid,text) to authenticated;

create policy professional_profiles_public_read on public.professional_profiles for select to anon using (visibility='public' and verification_status<>'suspended');
create policy professional_profiles_authenticated_read on public.professional_profiles for select to authenticated using (
  user_id=auth.uid()
  or (visibility='public' and verification_status<>'suspended')
  or public.is_platform_admin()
  or exists(
    select 1
    from public.professional_job_applications application
    join public.professional_job_posts job on job.id=application.job_id
    where application.applicant_profile_id=professional_profiles.id
      and public.is_org_member(job.organization_id)
  )
);
create policy professional_profiles_insert_own on public.professional_profiles for insert to authenticated with check (user_id=auth.uid() and verification_status='unverified');
create policy professional_profiles_update_own on public.professional_profiles for update to authenticated using (user_id=auth.uid() or public.is_platform_admin()) with check (user_id=auth.uid() or public.is_platform_admin());

create policy employment_public_read on public.professional_employment_records for select to anon using (is_public and verification_status='verified' and exists(select 1 from public.professional_profiles p where p.id=profile_id and p.visibility='public'));
create policy employment_authenticated_read on public.professional_employment_records for select to authenticated using (exists(select 1 from public.professional_profiles p where p.id=profile_id and p.user_id=auth.uid()) or (is_public and verification_status='verified' and exists(select 1 from public.professional_profiles p where p.id=profile_id and p.visibility='public')) or (organization_id is not null and public.is_org_member(organization_id)) or public.is_platform_admin());
create policy employment_insert_own on public.professional_employment_records for insert to authenticated with check (verification_status='self_reported' and verified_by is null and verified_at is null and exists(select 1 from public.professional_profiles p where p.id=profile_id and p.user_id=auth.uid()));
create policy employment_update_own on public.professional_employment_records for update to authenticated using (exists(select 1 from public.professional_profiles p where p.id=profile_id and p.user_id=auth.uid()) or public.is_platform_admin()) with check (exists(select 1 from public.professional_profiles p where p.id=profile_id and p.user_id=auth.uid()) or public.is_platform_admin());

create policy verification_read on public.employment_verification_requests for select to authenticated using (requested_by=auth.uid() or public.is_org_member(organization_id) or public.is_platform_admin());
create policy verification_insert_own on public.employment_verification_requests for insert to authenticated with check (requested_by=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null and exists(select 1 from public.professional_employment_records e join public.professional_profiles p on p.id=e.profile_id where e.id=employment_record_id and p.user_id=auth.uid() and e.organization_id=employment_verification_requests.organization_id));

create policy jobs_public_read on public.professional_job_posts for select to anon using (status='published' and published_at<=now() and (closes_at is null or closes_at>now()));
create policy jobs_authenticated_read on public.professional_job_posts for select to authenticated using ((status='published' and published_at<=now() and (closes_at is null or closes_at>now())) or posted_by=auth.uid() or public.is_org_member(organization_id) or public.is_platform_admin());
create policy jobs_insert_verified_company on public.professional_job_posts for insert to authenticated with check (posted_by=auth.uid() and status='published' and (public.is_org_member(organization_id) or public.is_platform_admin()) and exists(select 1 from public.industry_company_profiles c where c.id=company_profile_id and c.organization_id=professional_job_posts.organization_id and c.display_name=company_name and c.company_slug=professional_job_posts.company_slug and c.verification_status='verified' and c.is_public));

create policy applications_read on public.professional_job_applications for select to authenticated using (applicant_id=auth.uid() or exists(select 1 from public.professional_job_posts j where j.id=job_id and public.is_org_member(j.organization_id)) or public.is_platform_admin());
create policy applications_insert_own on public.professional_job_applications for insert to authenticated with check (applicant_id=auth.uid() and status='submitted' and exists(select 1 from public.professional_profiles p where p.id=applicant_profile_id and p.user_id=auth.uid()) and exists(select 1 from public.professional_job_posts j where j.id=job_id and j.status='published' and (j.closes_at is null or j.closes_at>now())));

create policy endorsements_public_read on public.professional_endorsements for select to anon using (is_public and consent_status='accepted' and exists(select 1 from public.professional_profiles p where p.id=profile_id and p.visibility='public'));
create policy endorsements_authenticated_read on public.professional_endorsements for select to authenticated using (author_user_id=auth.uid() or exists(select 1 from public.professional_profiles p where p.id=profile_id and p.user_id=auth.uid()) or (is_public and consent_status='accepted') or public.is_platform_admin());
create policy endorsements_insert_attributable on public.professional_endorsements for insert to authenticated with check (author_user_id=auth.uid() and consent_status='pending' and not is_public and (author_organization_id is null or public.is_org_member(author_organization_id)) and not exists(select 1 from public.professional_profiles self_profile where self_profile.id=profile_id and self_profile.user_id=auth.uid()));
