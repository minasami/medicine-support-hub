-- Connected company types, governed medicine-data intake, distribution visibility, and representative messaging.

alter table public.industry_company_profile_claims
  drop constraint if exists industry_company_profile_claims_company_type_check;
alter table public.industry_company_profile_claims
  add constraint industry_company_profile_claims_company_type_check check (company_type in (
    'pharma_company','toll_manufacturer','medical_products_company','medical_device_company',
    'diagnostics_company','biotech_company','supplier','distributor','healthcare_company'
  ));
alter table public.industry_company_profile_claims
  add column if not exists trademark_owner_company_slug text;
alter table public.industry_company_profile_claims
  add constraint industry_company_claim_trademark_owner_slug_check
  check (trademark_owner_company_slug is null or trademark_owner_company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') not valid;
alter table public.industry_company_profile_claims validate constraint industry_company_claim_trademark_owner_slug_check;

alter table public.industry_company_profiles
  drop constraint if exists industry_company_profiles_company_type_check;
alter table public.industry_company_profiles
  add constraint industry_company_profiles_company_type_check check (company_type in (
    'pharma_company','toll_manufacturer','medical_products_company','medical_device_company',
    'diagnostics_company','biotech_company','supplier','distributor','healthcare_company'
  ));
alter table public.industry_company_profiles
  add column if not exists trademark_owner_company_slug text;

create table if not exists public.company_business_relationships (
  id uuid primary key default gen_random_uuid(),
  source_company_slug text not null,
  target_company_slug text not null,
  relationship_type text not null check (relationship_type in ('toll_manufacturer_for','parent_group','subsidiary','distribution_partner','other')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','inactive')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_company_slug,target_company_slug,relationship_type),
  check (source_company_slug <> target_company_slug)
);

create table if not exists public.medicine_catalog_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  company_profile_id uuid references public.industry_company_profiles(id) on delete set null,
  submitter_kind text not null default 'individual' check (submitter_kind in ('individual','company_representative')),
  submission_kind text not null check (submission_kind in ('medicine_addition','medicine_correction','dataset','spreadsheet','database_export')),
  title text not null,
  medicine_name text,
  manufacturer_name text,
  description text,
  source_url text,
  file_paths text[] not null default '{}',
  file_names text[] not null default '{}',
  declared_row_count integer check (declared_row_count is null or declared_row_count >= 0),
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  assigned_reviewer uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(title)) >= 3),
  check (submission_kind not in ('medicine_addition','medicine_correction') or nullif(btrim(medicine_name),'') is not null),
  check (submission_kind in ('medicine_addition','medicine_correction') or cardinality(file_paths) > 0)
);

create table if not exists public.medicine_distribution_availability (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.industry_company_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  canonical_id bigint,
  medicine_name text not null,
  channel_type text not null check (channel_type in ('pharmacy','pharmaceutical_warehouse','pharmaceutical_distributor')),
  channel_name text not null,
  country text,
  governorate text,
  city text,
  area text,
  availability_status text not null default 'available' check (availability_status in ('available','limited','out_of_stock','preorder','discontinued')),
  available_from date,
  source_url text,
  representative_name text,
  representative_email text,
  representative_phone text,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_area_representatives (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.industry_company_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role_title text,
  country text,
  governorate text,
  city text,
  area text,
  email text,
  phone text,
  whatsapp_phone text,
  channels text[] not null default '{}',
  is_public boolean not null default true,
  status text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','inactive')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(btrim(email),'') is not null or nullif(btrim(phone),'') is not null)
);

create table if not exists public.company_representative_messages (
  id uuid primary key default gen_random_uuid(),
  representative_id uuid not null references public.company_area_representatives(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'unread' check (status in ('unread','read','replied','archived','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(subject)) >= 3),
  check (length(btrim(body)) >= 5)
);

create index if not exists medicine_catalog_submissions_status_idx on public.medicine_catalog_submissions(status,created_at);
create index if not exists medicine_catalog_submissions_submitter_idx on public.medicine_catalog_submissions(submitted_by,created_at desc);
create index if not exists medicine_distribution_company_idx on public.medicine_distribution_availability(company_profile_id,status,medicine_name);
create index if not exists medicine_distribution_area_idx on public.medicine_distribution_availability(country,governorate,city,area);
create index if not exists company_area_representatives_company_idx on public.company_area_representatives(company_profile_id,status,country,governorate,city);
create index if not exists company_representative_messages_recipient_idx on public.company_representative_messages(representative_id,status,created_at desc);

create or replace function private.can_review_industry_data()
returns boolean language sql stable security definer set search_path=public,private,pg_catalog
as $$ select private.is_platform_admin() or public.platform_user_has_permission('industry.review',null); $$;
revoke all on function private.can_review_industry_data() from public,anon;
grant execute on function private.can_review_industry_data() to authenticated,service_role;

alter table public.company_business_relationships enable row level security;
alter table public.medicine_catalog_submissions enable row level security;
alter table public.medicine_distribution_availability enable row level security;
alter table public.company_area_representatives enable row level security;
alter table public.company_representative_messages enable row level security;

revoke all on public.company_business_relationships,public.medicine_catalog_submissions,
  public.medicine_distribution_availability,public.company_area_representatives,
  public.company_representative_messages from anon,authenticated;
grant select,insert on public.company_business_relationships,public.medicine_catalog_submissions,
  public.medicine_distribution_availability,public.company_area_representatives,
  public.company_representative_messages to authenticated;
grant update on public.company_representative_messages to authenticated;
grant select on public.company_business_relationships,public.medicine_distribution_availability,
  public.company_area_representatives to anon;
grant all on public.company_business_relationships,public.medicine_catalog_submissions,
  public.medicine_distribution_availability,public.company_area_representatives,
  public.company_representative_messages to service_role;

create policy company_relationships_public_read on public.company_business_relationships for select to anon,authenticated
using(status='approved' or submitted_by=(select auth.uid()) or private.can_review_industry_data());
create policy company_relationships_member_insert on public.company_business_relationships for insert to authenticated
with check(submitted_by=(select auth.uid()));

create policy medicine_catalog_submission_own_or_reviewer_read on public.medicine_catalog_submissions for select to authenticated
using(submitted_by=(select auth.uid()) or private.can_review_industry_data());
create policy medicine_catalog_submission_own_insert on public.medicine_catalog_submissions for insert to authenticated
with check(submitted_by=(select auth.uid()) and status='submitted' and reviewed_by is null);

create policy distribution_public_read on public.medicine_distribution_availability for select to anon,authenticated
using(status='approved' or submitted_by=(select auth.uid()) or private.is_org_member(organization_id) or private.can_review_industry_data());
create policy distribution_company_insert on public.medicine_distribution_availability for insert to authenticated
with check(submitted_by=(select auth.uid()) and private.is_org_member(organization_id) and status='submitted');

create policy representatives_public_read on public.company_area_representatives for select to anon,authenticated
using((status='approved' and is_public) or submitted_by=(select auth.uid()) or private.is_org_member(organization_id) or private.can_review_industry_data());
create policy representatives_company_insert on public.company_area_representatives for insert to authenticated
with check(submitted_by=(select auth.uid()) and private.is_org_member(organization_id) and status='submitted');

create policy representative_messages_sender_or_company_read on public.company_representative_messages for select to authenticated
using(sender_user_id=(select auth.uid()) or private.is_org_member(organization_id) or private.can_review_industry_data());
create policy representative_messages_sender_insert on public.company_representative_messages for insert to authenticated
with check(sender_user_id=(select auth.uid()) and exists(select 1 from public.company_area_representatives r where r.id=representative_id and r.organization_id=company_representative_messages.organization_id and r.status='approved'));
create policy representative_messages_company_update on public.company_representative_messages for update to authenticated
using(private.is_org_member(organization_id) or private.can_review_industry_data())
with check(private.is_org_member(organization_id) or private.can_review_industry_data());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('medicine-data-submissions','medicine-data-submissions',false,26214400,array[
  'text/csv','application/json','application/pdf','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet','application/zip'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy medicine_data_files_owner_insert on storage.objects for insert to authenticated
with check(bucket_id='medicine-data-submissions' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy medicine_data_files_owner_or_reviewer_read on storage.objects for select to authenticated
using(bucket_id='medicine-data-submissions' and ((storage.foldername(name))[1]=(select auth.uid())::text or private.can_review_industry_data()));

create or replace function public.review_medicine_catalog_submission(target_submission uuid,decision text,reviewer_notes text default null)
returns public.medicine_catalog_submissions language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare result public.medicine_catalog_submissions%rowtype;
begin
  if not private.can_review_industry_data() then raise exception 'Industry review permission required.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode='22023'; end if;
  update public.medicine_catalog_submissions set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes,updated_at=now()
  where id=target_submission and status in ('submitted','under_review') returning * into result;
  if result.id is null then raise exception 'Submission not found or already reviewed.' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function public.review_medicine_distribution_submission(target_submission uuid,decision text,reviewer_notes text default null)
returns public.medicine_distribution_availability language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare result public.medicine_distribution_availability%rowtype;
begin
  if not private.can_review_industry_data() then raise exception 'Industry review permission required.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode='22023'; end if;
  update public.medicine_distribution_availability set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes,updated_at=now()
  where id=target_submission and status in ('submitted','under_review') returning * into result;
  if result.id is null then raise exception 'Availability submission not found or already reviewed.' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function public.review_company_area_representative(target_submission uuid,decision text,reviewer_notes text default null)
returns public.company_area_representatives language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare result public.company_area_representatives%rowtype;
begin
  if not private.can_review_industry_data() then raise exception 'Industry review permission required.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode='22023'; end if;
  update public.company_area_representatives set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes,updated_at=now()
  where id=target_submission and status in ('submitted','under_review') returning * into result;
  if result.id is null then raise exception 'Representative submission not found or already reviewed.' using errcode='P0002'; end if;
  return result;
end $$;

revoke all on function public.review_medicine_catalog_submission(uuid,text,text),
  public.review_medicine_distribution_submission(uuid,text,text),
  public.review_company_area_representative(uuid,text,text) from public,anon;
grant execute on function public.review_medicine_catalog_submission(uuid,text,text),
  public.review_medicine_distribution_submission(uuid,text,text),
  public.review_company_area_representative(uuid,text,text) to authenticated,service_role;

create or replace function private.sync_toll_manufacturer_relationship()
returns trigger language plpgsql security definer set search_path=public,private,pg_catalog as $$
begin
  if new.status='approved' and new.company_type='toll_manufacturer' and new.trademark_owner_company_slug is not null and new.profile_id is not null then
    update public.industry_company_profiles set trademark_owner_company_slug=new.trademark_owner_company_slug where id=new.profile_id;
    insert into public.company_business_relationships(source_company_slug,target_company_slug,relationship_type,status,submitted_by,reviewed_by,reviewed_at,notes)
    values(coalesce(new.company_slug,(select company_slug from public.industry_company_profiles where id=new.profile_id)),new.trademark_owner_company_slug,'toll_manufacturer_for','approved',new.requested_by,new.reviewed_by,new.reviewed_at,'Approved with company profile claim')
    on conflict(source_company_slug,target_company_slug,relationship_type) do update set status='approved',reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,updated_at=now();
  end if;
  return new;
end $$;
drop trigger if exists sync_toll_manufacturer_relationship on public.industry_company_profile_claims;
create trigger sync_toll_manufacturer_relationship after update of status on public.industry_company_profile_claims
for each row when(new.status='approved') execute function private.sync_toll_manufacturer_relationship();

insert into public.platform_approval_policies(policy_key,queue_key,label,description,entity_type,required_permission,minimum_approvers,sla_hours,escalation_role_key)
values('medicine-data-intake','medicine_catalog_submissions','Medicine additions and bulk datasets','Review individual and company medicine additions, spreadsheets, and database exports.','medicine_data_submission','industry.review',1,72,'platform_admin')
on conflict(policy_key) do update set queue_key=excluded.queue_key,label=excluded.label,description=excluded.description,required_permission=excluded.required_permission,is_active=true;
