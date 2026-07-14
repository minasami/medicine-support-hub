-- Public provider discovery and private cross-organization care coordination.
-- Public directory data is intentionally separated from private organization and clinical records.

create table if not exists public.healthcare_entity_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  entity_type text not null check (entity_type in ('physician','clinic','polyclinic','hospital','pharmacy','laboratory','radiology_center','diagnostic_center')),
  display_name text not null check (length(btrim(display_name)) between 2 and 180),
  summary text,
  logo_url text,
  country text,
  city text,
  address text,
  public_email text,
  public_phone text,
  website_url text,
  specialties text[] not null default '{}',
  services text[] not null default '{}',
  languages text[] not null default '{}',
  appointment_modes text[] not null default '{}',
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  accepting_patients boolean not null default false,
  license_authority text,
  license_number text,
  license_expiry date,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','suspended','rejected')),
  is_public boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists healthcare_entity_profiles_public_idx
  on public.healthcare_entity_profiles(entity_type,verification_status,is_public,country,city,display_name);
create index if not exists healthcare_entity_profiles_location_idx
  on public.healthcare_entity_profiles(latitude,longitude)
  where latitude is not null and longitude is not null and verification_status='verified' and is_public=true;

create table if not exists public.healthcare_entity_applications (
  id uuid primary key default gen_random_uuid(),
  application_type text not null check (application_type in ('create_new','claim_existing')),
  target_profile_id uuid references public.healthcare_entity_profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('physician','clinic','polyclinic','hospital','pharmacy','laboratory','radiology_center','diagnostic_center')),
  requested_name text not null check (length(btrim(requested_name)) between 2 and 180),
  work_email text not null check (position('@' in work_email)>1),
  contact_phone text,
  country text,
  city text,
  address text,
  website_url text,
  license_authority text,
  license_number text not null check (length(btrim(license_number))>=3),
  license_expiry date,
  specialties text[] not null default '{}',
  services text[] not null default '{}',
  evidence_urls text[] not null default '{}',
  notes text,
  status text not null default 'pending' check (status in ('pending','under_review','approved','rejected','withdrawn')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  result_profile_id uuid references public.healthcare_entity_profiles(id) on delete set null,
  result_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((application_type='claim_existing' and target_profile_id is not null) or (application_type='create_new' and target_profile_id is null))
);

create unique index if not exists healthcare_entity_applications_active_uidx
  on public.healthcare_entity_applications(submitted_by,lower(btrim(requested_name)),entity_type)
  where status in ('pending','under_review','approved');
create index if not exists healthcare_entity_applications_status_idx
  on public.healthcare_entity_applications(status,created_at);

create table if not exists public.healthcare_entity_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.healthcare_entity_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (length(btrim(subject)) between 2 and 160),
  message text not null check (length(btrim(message)) between 10 and 3000),
  reply_email text,
  reply_phone text,
  status text not null default 'submitted' check (status in ('submitted','read','replied','closed','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists healthcare_entity_messages_sender_idx on public.healthcare_entity_messages(sender_user_id,created_at desc);
create index if not exists healthcare_entity_messages_org_idx on public.healthcare_entity_messages(organization_id,status,created_at desc);

create table if not exists public.healthcare_appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.healthcare_entity_profiles(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  patient_user_id uuid not null references auth.users(id) on delete restrict,
  patient_id uuid references public.clinical_patients(id) on delete restrict,
  appointment_type text not null default 'outpatient' check (appointment_type in ('outpatient','telehealth','home_visit','follow_up','diagnostic','pharmacy_consultation')),
  requested_start timestamptz not null,
  requested_end timestamptz,
  reason text not null check (length(btrim(reason)) between 5 and 1000),
  status text not null default 'requested' check (status in ('requested','offered','confirmed','checked_in','in_progress','completed','cancelled','declined','no_show')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  assigned_practitioner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_end is null or requested_end>requested_start),
  check (scheduled_end is null or scheduled_start is null or scheduled_end>scheduled_start)
);
create index if not exists healthcare_appointments_patient_idx on public.healthcare_appointments(patient_user_id,created_at desc);
create index if not exists healthcare_appointments_org_idx on public.healthcare_appointments(organization_id,status,coalesce(scheduled_start,requested_start));

create table if not exists public.clinical_queue_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid unique references public.healthcare_appointments(id) on delete set null,
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assigned_practitioner_user_id uuid references auth.users(id) on delete set null,
  queue_number integer check (queue_number is null or queue_number>0),
  priority text not null default 'routine' check (priority in ('routine','urgent','asap','stat')),
  status text not null default 'waiting' check (status in ('scheduled','checked_in','waiting','called','roomed','with_clinician','completed','cancelled','no_show')),
  checked_in_at timestamptz,
  called_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinical_queue_entries_org_idx on public.clinical_queue_entries(organization_id,status,priority,created_at);
create index if not exists clinical_queue_entries_patient_idx on public.clinical_queue_entries(patient_id,created_at desc);

create table if not exists public.healthcare_provider_contracts (
  id uuid primary key default gen_random_uuid(),
  source_organization_id uuid not null references public.organizations(id) on delete restrict,
  destination_organization_id uuid not null references public.organizations(id) on delete restrict,
  service_types text[] not null default '{}',
  commission_model text not null default 'none' check (commission_model in ('none','percentage','fixed')),
  commission_rate numeric(7,4) check (commission_rate is null or commission_rate between 0 and 100),
  commission_fixed_amount numeric(14,2) check (commission_fixed_amount is null or commission_fixed_amount>=0),
  currency text not null default 'EGP',
  status text not null default 'draft' check (status in ('draft','pending','active','paused','expired','terminated')),
  effective_from date,
  effective_until date,
  terms_summary text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_organization_id<>destination_organization_id),
  check (effective_until is null or effective_from is null or effective_until>=effective_from),
  check ((commission_model='percentage' and commission_rate is not null and commission_fixed_amount is null)
    or (commission_model='fixed' and commission_fixed_amount is not null and commission_rate is null)
    or (commission_model='none' and commission_rate is null and commission_fixed_amount is null))
);
create index if not exists healthcare_provider_contracts_parties_idx
  on public.healthcare_provider_contracts(source_organization_id,destination_organization_id,status);

create table if not exists public.healthcare_routing_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete restrict,
  source_organization_id uuid not null references public.organizations(id) on delete restrict,
  prescription_id uuid references public.clinical_prescriptions(id) on delete restrict,
  service_order_id uuid references public.clinical_service_orders(id) on delete restrict,
  destination_type text not null check (destination_type in ('pharmacy','laboratory','radiology_center','diagnostic_center','clinic','hospital')),
  destination_profile_id uuid references public.healthcare_entity_profiles(id) on delete set null,
  destination_organization_id uuid references public.organizations(id) on delete set null,
  contract_id uuid references public.healthcare_provider_contracts(id) on delete set null,
  selection_method text not null default 'patient_selected' check (selection_method in ('patient_selected','nearest','connected','contracted','manual')),
  consent_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','offered','accepted','scheduled','in_progress','fulfilled','declined','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(prescription_id,service_order_id)=1),
  check ((destination_profile_id is null and destination_organization_id is null) or (destination_profile_id is not null and destination_organization_id is not null)),
  check (status='draft' or consent_confirmed=true)
);
create index if not exists healthcare_routing_requests_source_idx on public.healthcare_routing_requests(source_organization_id,status,created_at desc);
create index if not exists healthcare_routing_requests_destination_idx on public.healthcare_routing_requests(destination_organization_id,status,created_at) where destination_organization_id is not null;
create index if not exists healthcare_routing_requests_patient_idx on public.healthcare_routing_requests(patient_id,created_at desc);

create table if not exists public.healthcare_commission_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.healthcare_provider_contracts(id) on delete restrict,
  routing_request_id uuid not null unique references public.healthcare_routing_requests(id) on delete restrict,
  gross_amount numeric(14,2) not null check (gross_amount>=0),
  commission_amount numeric(14,2) not null check (commission_amount>=0 and commission_amount<=gross_amount),
  currency text not null default 'EGP',
  status text not null default 'recorded' check (status in ('recorded','approved','invoiced','settled','waived','reversed')),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger healthcare_entity_profiles_touch_updated_at before update on public.healthcare_entity_profiles for each row execute function private.touch_updated_at();
create trigger healthcare_entity_applications_touch_updated_at before update on public.healthcare_entity_applications for each row execute function private.touch_updated_at();
create trigger healthcare_entity_messages_touch_updated_at before update on public.healthcare_entity_messages for each row execute function private.touch_updated_at();
create trigger healthcare_appointments_touch_updated_at before update on public.healthcare_appointments for each row execute function private.touch_updated_at();
create trigger clinical_queue_entries_touch_updated_at before update on public.clinical_queue_entries for each row execute function private.touch_updated_at();
create trigger healthcare_provider_contracts_touch_updated_at before update on public.healthcare_provider_contracts for each row execute function private.touch_updated_at();
create trigger healthcare_routing_requests_touch_updated_at before update on public.healthcare_routing_requests for each row execute function private.touch_updated_at();
create trigger healthcare_commission_events_touch_updated_at before update on public.healthcare_commission_events for each row execute function private.touch_updated_at();

create or replace function private.clinical_can_manage_queue(target_patient uuid,target_org uuid)
returns boolean
language sql stable security definer
set search_path=public,private,pg_catalog
as $$
  select private.is_platform_admin()
    or (
      exists(
        select 1 from public.organization_members m
        where m.organization_id=target_org and m.user_id=auth.uid() and m.is_active=true
          and m.role in ('org_admin','clinic_admin','receptionist','front_desk','physician','nurse')
      )
      and exists(
        select 1 from public.clinical_patient_access a
        where a.patient_id=target_patient and a.organization_id=target_org and a.status='granted'
          and (a.expires_at is null or a.expires_at>now())
          and ('all'=any(a.scopes) or 'encounters'=any(a.scopes) or 'clinical_write'=any(a.scopes))
      )
    );
$$;
revoke all on function private.clinical_can_manage_queue(uuid,uuid) from public,anon;
grant execute on function private.clinical_can_manage_queue(uuid,uuid) to authenticated,service_role;

create or replace function private.enforce_healthcare_routing_request()
returns trigger
language plpgsql security invoker
set search_path=public,private,pg_catalog
as $$
begin
  if new.prescription_id is not null and not exists(
    select 1 from public.clinical_prescriptions p
    where p.id=new.prescription_id and p.patient_id=new.patient_id and p.organization_id=new.source_organization_id
  ) then raise exception 'Prescription does not match this patient and source organization.' using errcode='23514'; end if;
  if new.service_order_id is not null and not exists(
    select 1 from public.clinical_service_orders o
    where o.id=new.service_order_id and o.patient_id=new.patient_id and o.ordering_organization_id=new.source_organization_id
  ) then raise exception 'Service order does not match this patient and source organization.' using errcode='23514'; end if;
  if new.destination_profile_id is not null and not exists(
    select 1 from public.healthcare_entity_profiles p
    where p.id=new.destination_profile_id and p.organization_id=new.destination_organization_id
      and p.entity_type=new.destination_type and p.verification_status='verified' and p.is_public=true
  ) then raise exception 'Destination profile does not match the selected organization and service type.' using errcode='23514'; end if;
  if new.contract_id is not null and not exists(
    select 1 from public.healthcare_provider_contracts c
    where c.id=new.contract_id and c.source_organization_id=new.source_organization_id
      and c.destination_organization_id=new.destination_organization_id and c.status='active'
      and (c.effective_from is null or c.effective_from<=current_date)
      and (c.effective_until is null or c.effective_until>=current_date)
  ) then raise exception 'Contract is not active for the selected organizations.' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_healthcare_routing_request() from public,anon,authenticated;
create trigger healthcare_routing_requests_enforce before insert or update on public.healthcare_routing_requests
for each row execute function private.enforce_healthcare_routing_request();

alter table public.healthcare_entity_profiles enable row level security;
alter table public.healthcare_entity_applications enable row level security;
alter table public.healthcare_entity_messages enable row level security;
alter table public.healthcare_appointments enable row level security;
alter table public.clinical_queue_entries enable row level security;
alter table public.healthcare_provider_contracts enable row level security;
alter table public.healthcare_routing_requests enable row level security;
alter table public.healthcare_commission_events enable row level security;

revoke all on public.healthcare_entity_profiles,public.healthcare_entity_applications,public.healthcare_entity_messages,
  public.healthcare_appointments,public.clinical_queue_entries,public.healthcare_provider_contracts,
  public.healthcare_routing_requests,public.healthcare_commission_events from anon,authenticated;

grant select on public.healthcare_entity_profiles to anon,authenticated;
grant update (display_name,summary,logo_url,country,city,address,public_email,public_phone,website_url,specialties,services,languages,appointment_modes,latitude,longitude,accepting_patients,updated_at)
  on public.healthcare_entity_profiles to authenticated;
grant select,insert on public.healthcare_entity_applications,public.healthcare_entity_messages,public.healthcare_appointments to authenticated;
grant update (status,updated_at) on public.healthcare_entity_messages to authenticated;
grant update (status,scheduled_start,scheduled_end,assigned_practitioner_user_id,updated_at) on public.healthcare_appointments to authenticated;
grant select,insert,update on public.clinical_queue_entries,public.healthcare_provider_contracts,public.healthcare_routing_requests to authenticated;
grant select on public.healthcare_commission_events to authenticated;
grant all on public.healthcare_entity_profiles,public.healthcare_entity_applications,public.healthcare_entity_messages,
  public.healthcare_appointments,public.clinical_queue_entries,public.healthcare_provider_contracts,
  public.healthcare_routing_requests,public.healthcare_commission_events to service_role;

create policy healthcare_entity_profiles_public_read on public.healthcare_entity_profiles for select to anon
using (verification_status='verified' and is_public=true);
create policy healthcare_entity_profiles_authenticated_read on public.healthcare_entity_profiles for select to authenticated
using ((verification_status='verified' and is_public=true) or (select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy healthcare_entity_profiles_member_update on public.healthcare_entity_profiles for update to authenticated
using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()))
with check ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));

create policy healthcare_entity_applications_insert on public.healthcare_entity_applications for insert to authenticated
with check (submitted_by=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null and review_notes is null and result_profile_id is null and result_organization_id is null);
create policy healthcare_entity_applications_read on public.healthcare_entity_applications for select to authenticated
using (submitted_by=(select auth.uid()) or (select private.is_platform_admin()));

create policy healthcare_entity_messages_insert on public.healthcare_entity_messages for insert to authenticated
with check (sender_user_id=(select auth.uid()) and status='submitted' and exists(
  select 1 from public.healthcare_entity_profiles p where p.id=profile_id and p.organization_id=organization_id and p.verification_status='verified' and p.is_public=true
));
create policy healthcare_entity_messages_read on public.healthcare_entity_messages for select to authenticated
using (sender_user_id=(select auth.uid()) or (select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy healthcare_entity_messages_update on public.healthcare_entity_messages for update to authenticated
using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()))
with check ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));

create policy healthcare_appointments_insert on public.healthcare_appointments for insert to authenticated
with check (patient_user_id=(select auth.uid()) and status='requested' and assigned_practitioner_user_id is null and scheduled_start is null and scheduled_end is null
  and (patient_id is null or exists(select 1 from public.clinical_patients p where p.id=patient_id and p.user_id=(select auth.uid())))
  and exists(select 1 from public.healthcare_entity_profiles p where p.id=profile_id and p.organization_id=organization_id and p.verification_status='verified' and p.is_public=true and p.accepting_patients=true));
create policy healthcare_appointments_read on public.healthcare_appointments for select to authenticated
using (patient_user_id=(select auth.uid()) or (select private.is_org_member(organization_id)) or (select private.is_platform_admin()));
create policy healthcare_appointments_update on public.healthcare_appointments for update to authenticated
using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()))
with check ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));

create policy clinical_queue_entries_read on public.clinical_queue_entries for select to authenticated
using ((select private.clinical_can_read_patient(patient_id,'encounters')) or (select private.clinical_can_manage_queue(patient_id,organization_id)));
create policy clinical_queue_entries_insert on public.clinical_queue_entries for insert to authenticated
with check (created_by=(select auth.uid()) and (select private.clinical_can_manage_queue(patient_id,organization_id)));
create policy clinical_queue_entries_update on public.clinical_queue_entries for update to authenticated
using ((select private.clinical_can_manage_queue(patient_id,organization_id)))
with check ((select private.clinical_can_manage_queue(patient_id,organization_id)));

create policy healthcare_provider_contracts_read on public.healthcare_provider_contracts for select to authenticated
using ((select private.is_org_member(source_organization_id)) or (select private.is_org_member(destination_organization_id)) or (select private.is_platform_admin()));
create policy healthcare_provider_contracts_insert on public.healthcare_provider_contracts for insert to authenticated
with check ((select private.is_platform_admin()) and status in ('draft','pending'));
create policy healthcare_provider_contracts_update on public.healthcare_provider_contracts for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));

create policy healthcare_routing_requests_read on public.healthcare_routing_requests for select to authenticated
using ((select private.clinical_can_read_patient(patient_id,'demographics')) or (select private.is_org_member(source_organization_id))
  or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id))) or (select private.is_platform_admin()));
create policy healthcare_routing_requests_insert on public.healthcare_routing_requests for insert to authenticated
with check (requested_by=(select auth.uid()) and (select private.clinical_can_write_patient(patient_id,source_organization_id,
  case when prescription_id is not null then 'medications' else 'diagnostics' end)));
create policy healthcare_routing_requests_update on public.healthcare_routing_requests for update to authenticated
using ((select private.is_org_member(source_organization_id)) or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id))) or (select private.is_platform_admin()))
with check ((select private.is_org_member(source_organization_id)) or (destination_organization_id is not null and (select private.is_org_member(destination_organization_id))) or (select private.is_platform_admin()));

create policy healthcare_commission_events_read on public.healthcare_commission_events for select to authenticated
using ((select private.is_platform_admin()) or exists(select 1 from public.healthcare_provider_contracts c where c.id=contract_id and ((select private.is_org_member(c.source_organization_id)) or (select private.is_org_member(c.destination_organization_id)))));

create or replace function private.review_healthcare_entity_application_impl(target_application uuid,decision text,reviewer_notes text default null)
returns public.healthcare_entity_applications
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
declare app public.healthcare_entity_applications%rowtype; result_row public.healthcare_entity_applications%rowtype;
  org_id uuid; profile_id uuid; base_slug text; candidate_slug text; suffix integer:=1;
begin
  if not private.is_platform_admin() then raise exception 'Only platform administrators can review healthcare entities.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode='22023'; end if;
  select * into app from public.healthcare_entity_applications where id=target_application for update;
  if not found then raise exception 'Healthcare entity application not found.' using errcode='P0002'; end if;
  if app.status not in ('pending','under_review') then raise exception 'This application has already been reviewed.' using errcode='22023'; end if;

  if decision='approved' and app.application_type='claim_existing' then
    select p.organization_id,p.id into org_id,profile_id from public.healthcare_entity_profiles p
    where p.id=app.target_profile_id and p.verification_status='verified';
    if org_id is null then raise exception 'The requested healthcare entity no longer exists.' using errcode='P0002'; end if;
  elsif decision='approved' then
    insert into public.organizations(name,organization_type,country,city,contact_email,contact_phone,website,is_active)
    values(btrim(app.requested_name),app.entity_type,app.country,app.city,app.work_email,app.contact_phone,app.website_url,true)
    returning id into org_id;
    base_slug:=trim(both '-' from regexp_replace(lower(btrim(app.requested_name)),'[^a-z0-9]+','-','g'));
    if base_slug='' then base_slug:='provider'; end if;
    candidate_slug:=base_slug;
    while exists(select 1 from public.healthcare_entity_profiles where slug=candidate_slug) loop suffix:=suffix+1; candidate_slug:=base_slug||'-'||suffix; end loop;
    insert into public.healthcare_entity_profiles(organization_id,slug,entity_type,display_name,country,city,address,public_email,public_phone,website_url,
      specialties,services,license_authority,license_number,license_expiry,verification_status,is_public,verified_by,verified_at)
    values(org_id,candidate_slug,app.entity_type,btrim(app.requested_name),app.country,app.city,app.address,app.work_email,app.contact_phone,app.website_url,
      app.specialties,app.services,app.license_authority,app.license_number,app.license_expiry,'verified',true,auth.uid(),now())
    returning id into profile_id;
  end if;

  if decision='approved' then
    insert into public.organization_members(organization_id,user_id,role,is_active)
    values(org_id,app.submitted_by,'org_admin',true)
    on conflict(organization_id,user_id) do update set role='org_admin',is_active=true;
  end if;

  update public.healthcare_entity_applications set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(btrim(reviewer_notes),''),
    result_profile_id=case when decision='approved' then profile_id else null end,
    result_organization_id=case when decision='approved' then org_id else null end
  where id=target_application returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.review_healthcare_entity_application(target_application uuid,decision text,reviewer_notes text default null)
returns public.healthcare_entity_applications
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select private.review_healthcare_entity_application_impl(target_application,decision,reviewer_notes); $$;

revoke all on function private.review_healthcare_entity_application_impl(uuid,text,text) from public,anon,authenticated;
grant execute on function private.review_healthcare_entity_application_impl(uuid,text,text) to authenticated,service_role;
revoke all on function public.review_healthcare_entity_application(uuid,text,text) from public,anon;
grant execute on function public.review_healthcare_entity_application(uuid,text,text) to authenticated,service_role;

create or replace view public.healthcare_provider_directory_v1 with (security_invoker=true) as
select id,organization_id,slug,entity_type,display_name,summary,logo_url,country,city,address,public_email,public_phone,website_url,
  specialties,services,languages,appointment_modes,latitude,longitude,accepting_patients,license_authority,license_expiry,verified_at
from public.healthcare_entity_profiles
where verification_status='verified' and is_public=true;
grant select on public.healthcare_provider_directory_v1 to anon,authenticated,service_role;

comment on table public.healthcare_entity_profiles is 'Reviewed public healthcare provider profiles linked one-to-one with private platform organizations.';
comment on table public.healthcare_routing_requests is 'Consent-gated routing of prescriptions or diagnostic orders to one selected provider; never broadcast to all providers.';
comment on table public.healthcare_commission_events is 'Internal commission accounting records only; no automated Stripe payout or provider settlement is implied.';
