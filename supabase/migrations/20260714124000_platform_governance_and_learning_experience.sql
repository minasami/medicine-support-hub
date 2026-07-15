-- Unified governance registry and role-based learning experience.
-- Existing RLS policies remain authoritative. The permission registry is an
-- auditable control plane and a reusable source for future policy checks.

create table if not exists public.platform_role_definitions (
  role_key text primary key check (role_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  description text,
  role_level integer not null default 100 check (role_level between 0 and 1000),
  parent_role_key text references public.platform_role_definitions(role_key) on delete set null,
  scope_type text not null default 'platform' check (scope_type in ('platform','organization','branch','clinical','public')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_permissions (
  permission_key text primary key check (permission_key ~ '^[a-z][a-z0-9_.]*$'),
  category text not null,
  label text not null,
  description text,
  risk_level text not null default 'standard' check (risk_level in ('standard','sensitive','clinical','financial','critical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_role_permissions (
  role_key text not null references public.platform_role_definitions(role_key) on delete cascade,
  permission_key text not null references public.platform_permissions(permission_key) on delete cascade,
  allowed boolean not null default true,
  constraints jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  parent_organization_id uuid not null references public.organizations(id) on delete cascade,
  child_organization_id uuid not null references public.organizations(id) on delete cascade,
  relationship_type text not null default 'parent' check (relationship_type in ('parent','affiliate','branch','program_owner','service_network','contracted_provider')),
  is_active boolean not null default true,
  valid_from date,
  valid_until date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_organization_id <> child_organization_id),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  unique(parent_organization_id, child_organization_id, relationship_type)
);

create table if not exists public.platform_approval_policies (
  policy_key text primary key check (policy_key ~ '^[a-z][a-z0-9_.-]*$'),
  queue_key text not null,
  label text not null,
  description text,
  entity_type text,
  required_permission text references public.platform_permissions(permission_key) on delete set null,
  minimum_approvers integer not null default 1 check (minimum_approvers between 1 and 10),
  sla_hours integer not null default 72 check (sla_hours between 1 and 8760),
  escalation_role_key text references public.platform_role_definitions(role_key) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_governance_audit (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_key text,
  action text not null,
  actor_id uuid,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.audit_platform_governance_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.platform_governance_audit(table_name, record_key, action, actor_id, previous_data, new_data)
  values (
    tg_table_name,
    coalesce(to_jsonb(new)->>'role_key', to_jsonb(new)->>'permission_key', to_jsonb(new)->>'policy_key', to_jsonb(new)->>'id',
             to_jsonb(old)->>'role_key', to_jsonb(old)->>'permission_key', to_jsonb(old)->>'policy_key', to_jsonb(old)->>'id'),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.platform_user_has_permission(target_permission text, target_organization uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_catalog
as $$
  with user_roles as (
    select p.role as role_key
    from public.profiles p
    where p.id = auth.uid() and p.is_active = true
    union
    select om.role
    from public.organization_members om
    where om.user_id = auth.uid()
      and om.is_active = true
      and (target_organization is null or om.organization_id = target_organization)
  )
  select private.is_platform_admin()
    or exists (
      select 1
      from user_roles ur
      join public.platform_role_permissions rp on rp.role_key = ur.role_key and rp.allowed
      join public.platform_permissions permission on permission.permission_key = rp.permission_key and permission.is_active
      join public.platform_role_definitions role on role.role_key = rp.role_key and role.is_active
      where rp.permission_key = target_permission
    );
$$;

grant execute on function public.platform_user_has_permission(text, uuid) to authenticated, service_role;

alter table public.learning_courses add column if not exists completion_points integer not null default 100;
alter table public.learning_lessons add column if not exists video_url text;
alter table public.learning_lessons add column if not exists video_provider text;
alter table public.learning_lessons add column if not exists experience_points integer not null default 10;

create table if not exists public.learning_career_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  role_key text not null,
  title_en text not null,
  title_ar text,
  summary_en text not null,
  summary_ar text,
  experience_outcomes text[] not null default '{}',
  certificate_title text,
  minimum_points integer not null default 0 check (minimum_points >= 0),
  is_published boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_career_path_courses (
  career_path_id uuid not null references public.learning_career_paths(id) on delete cascade,
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  course_order integer not null default 1,
  is_required boolean not null default true,
  primary key(career_path_id, course_id)
);

create table if not exists public.learning_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_key text not null,
  points integer not null check (points > 0 and points <= 10000),
  description text,
  created_at timestamptz not null default now(),
  unique(user_id, event_type, event_key)
);
create index if not exists learning_point_events_user_idx on public.learning_point_events(user_id, created_at desc);

create table if not exists public.learning_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  enrollment_id uuid not null references public.learning_enrollments(id) on delete cascade,
  certificate_code text not null unique,
  title text not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  unique(enrollment_id)
);
create index if not exists learning_certificates_user_idx on public.learning_certificates(user_id, issued_at desc);

create or replace function private.issue_learning_completion_rewards()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  course_row public.learning_courses%rowtype;
begin
  if new.status = 'completed' and new.progress_percent = 100
     and (tg_op = 'INSERT' or old.status is distinct from 'completed' or old.progress_percent is distinct from 100) then
    select * into course_row from public.learning_courses where id = new.course_id;
    if found then
      insert into public.learning_point_events(user_id, event_type, event_key, points, description)
      values (new.user_id, 'course_completed', new.course_id::text,
              greatest(1, course_row.completion_points), 'Completed ' || course_row.title_en)
      on conflict(user_id, event_type, event_key) do nothing;

      insert into public.learning_certificates(user_id, course_id, enrollment_id, certificate_code, title, metadata)
      values (new.user_id, new.course_id, new.id,
              upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
              course_row.title_en || ' — Platform Learning Certificate',
              jsonb_build_object('course_slug', course_row.slug, 'version', course_row.version,
                                 'notice', 'Platform onboarding certificate; not a medical or regulatory license'))
      on conflict(enrollment_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_completion_rewards on public.learning_enrollments;
create trigger learning_completion_rewards
after insert or update of status, progress_percent on public.learning_enrollments
for each row execute function private.issue_learning_completion_rewards();

create or replace view public.learning_profile_summary_v1
with (security_invoker = true)
as
select p.id as user_id,
       coalesce(points.total_points, 0)::integer as total_points,
       coalesce(enrollment.completed_courses, 0)::integer as completed_courses,
       coalesce(enrollment.active_courses, 0)::integer as active_courses,
       coalesce(certificates.certificate_count, 0)::integer as certificate_count,
       case
         when coalesce(points.total_points, 0) >= 1000 then 'expert'
         when coalesce(points.total_points, 0) >= 500 then 'advanced'
         when coalesce(points.total_points, 0) >= 200 then 'practitioner'
         when coalesce(points.total_points, 0) >= 100 then 'starter'
         else 'newcomer'
       end as experience_level
from public.profiles p
left join lateral (
  select sum(e.points)::integer total_points from public.learning_point_events e where e.user_id = p.id
) points on true
left join lateral (
  select count(*) filter(where e.status = 'completed')::integer completed_courses,
         count(*) filter(where e.status in ('enrolled','in_progress'))::integer active_courses
  from public.learning_enrollments e where e.user_id = p.id
) enrollment on true
left join lateral (
  select count(*)::integer certificate_count
  from public.learning_certificates c where c.user_id = p.id and c.revoked_at is null
) certificates on true;

create or replace view public.platform_governance_summary_v1
with (security_invoker = true)
as
select
  (select count(*) from public.platform_role_definitions where is_active) active_roles,
  (select count(*) from public.platform_permissions where is_active) active_permissions,
  (select count(*) from public.platform_role_permissions where allowed) active_role_permissions,
  (select count(*) from public.organization_relationships where is_active) active_organization_relationships,
  (select count(*) from public.platform_approval_policies where is_active) active_approval_policies;

-- Timestamp triggers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_role_definitions','platform_permissions','platform_role_permissions',
    'organization_relationships','platform_approval_policies','learning_career_paths'
  ] loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Audit governance mutations.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_role_definitions','platform_permissions','platform_role_permissions',
    'organization_relationships','platform_approval_policies'
  ] loop
    execute format('drop trigger if exists %I_governance_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_governance_audit after insert or update or delete on public.%I for each row execute function private.audit_platform_governance_change()', table_name, table_name);
  end loop;
end $$;

-- RLS and grants.
alter table public.platform_role_definitions enable row level security;
alter table public.platform_permissions enable row level security;
alter table public.platform_role_permissions enable row level security;
alter table public.organization_relationships enable row level security;
alter table public.platform_approval_policies enable row level security;
alter table public.platform_governance_audit enable row level security;
alter table public.learning_career_paths enable row level security;
alter table public.learning_career_path_courses enable row level security;
alter table public.learning_point_events enable row level security;
alter table public.learning_certificates enable row level security;

revoke all on public.platform_role_definitions, public.platform_permissions, public.platform_role_permissions,
  public.organization_relationships, public.platform_approval_policies, public.platform_governance_audit,
  public.learning_career_paths, public.learning_career_path_courses, public.learning_point_events,
  public.learning_certificates from anon, authenticated;

grant select, insert, update, delete on public.platform_role_definitions, public.platform_permissions,
  public.platform_role_permissions, public.organization_relationships, public.platform_approval_policies to authenticated;
grant select on public.platform_governance_audit to authenticated;
grant select on public.learning_career_paths, public.learning_career_path_courses to anon, authenticated;
grant select, insert, update, delete on public.learning_career_paths, public.learning_career_path_courses,
  public.learning_courses, public.learning_lessons to authenticated;
grant select on public.learning_point_events, public.learning_certificates to authenticated;
grant all on public.platform_role_definitions, public.platform_permissions, public.platform_role_permissions,
  public.organization_relationships, public.platform_approval_policies, public.platform_governance_audit,
  public.learning_career_paths, public.learning_career_path_courses, public.learning_point_events,
  public.learning_certificates to service_role;
grant select on public.learning_profile_summary_v1, public.platform_governance_summary_v1 to authenticated, service_role;

-- Admin-only governance policies.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'platform_role_definitions','platform_permissions','platform_role_permissions',
    'organization_relationships','platform_approval_policies','platform_governance_audit'
  ] loop
    execute format('drop policy if exists %I_admin_all on public.%I', table_name, table_name);
    execute format('create policy %I_admin_all on public.%I for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin())', table_name, table_name);
  end loop;
end $$;

drop policy if exists learning_paths_public_read on public.learning_career_paths;
create policy learning_paths_public_read on public.learning_career_paths for select to anon, authenticated using (is_published = true or private.is_platform_admin());
drop policy if exists learning_paths_admin_write on public.learning_career_paths;
create policy learning_paths_admin_write on public.learning_career_paths for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists learning_path_courses_public_read on public.learning_career_path_courses;
create policy learning_path_courses_public_read on public.learning_career_path_courses for select to anon, authenticated
using (exists(select 1 from public.learning_career_paths path where path.id = career_path_id and path.is_published = true) or private.is_platform_admin());
drop policy if exists learning_path_courses_admin_write on public.learning_career_path_courses;
create policy learning_path_courses_admin_write on public.learning_career_path_courses for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists learning_points_own_read on public.learning_point_events;
create policy learning_points_own_read on public.learning_point_events for select to authenticated using (user_id = (select auth.uid()) or private.is_platform_admin());
drop policy if exists learning_certificates_own_read on public.learning_certificates;
create policy learning_certificates_own_read on public.learning_certificates for select to authenticated using (user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists learning_courses_admin_write on public.learning_courses;
create policy learning_courses_admin_write on public.learning_courses for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
drop policy if exists learning_lessons_admin_write on public.learning_lessons;
create policy learning_lessons_admin_write on public.learning_lessons for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

-- Seed platform roles and hierarchy.
insert into public.platform_role_definitions(role_key,label,description,role_level,parent_role_key,scope_type,is_system,is_active)
values
('super_admin','Super Administrator','Ultimate accountable platform owner role.',0,null,'platform',true,true),
('platform_admin','Platform Administrator','Manages platform controls, approvals, governance and safety.',10,'super_admin','platform',true,true),
('admin','Administrator','Operational administration within approved boundaries.',20,'platform_admin','platform',true,true),
('org_admin','Organization Administrator','Manages one organization, its members and local controls.',100,'admin','organization',true,true),
('program_manager','Program Manager','Coordinates organization programs, beneficiaries and delivery.',150,'org_admin','organization',true,true),
('physician','Physician','Documents encounters and creates governed clinical orders.',200,'org_admin','clinical',true,true),
('reviewer','Clinical Reviewer','Reviews medicine support and clinical workflow requests.',210,'program_manager','clinical',true,true),
('pharmacist','Pharmacist','Performs clinical dispensing and pharmacy verification.',220,'org_admin','clinical',true,true),
('pharmacy_assistant','Pharmacy Assistant','Supports fulfillment under pharmacist governance.',230,'pharmacist','organization',true,true),
('diagnostic_provider','Diagnostic Provider','Performs laboratory, radiology or examination workflows.',220,'org_admin','clinical',true,true),
('insurance_reviewer','Insurance Reviewer','Reviews coverage and authorization requests.',220,'org_admin','clinical',true,true),
('branch_manager','Branch Manager','Coordinates a branch and local team.',180,'org_admin','branch',true,true),
('coordinator','Coordinator','Coordinates operational queues and delivery.',250,'program_manager','organization',true,true),
('data_entry','Data Entry Operator','Creates and maintains governed records.',300,'coordinator','organization',true,true),
('cosmetician','Cosmetician','Reviews relevant product workflows.',300,'program_manager','organization',true,true),
('employee','Employee','Uses assigned employee workflows.',500,'org_admin','organization',true,true),
('patient','Patient','Owns and follows their personal care journey.',900,null,'public',true,true)
on conflict(role_key) do update set label=excluded.label,description=excluded.description,role_level=excluded.role_level,
parent_role_key=excluded.parent_role_key,scope_type=excluded.scope_type,is_system=excluded.is_system,is_active=excluded.is_active;

insert into public.platform_permissions(permission_key,category,label,description,risk_level)
values
('platform.manage','platform','Manage platform','Change global platform configuration and release controls.','critical'),
('settings.manage','platform','Manage settings','Edit audited public and operational settings.','sensitive'),
('approvals.review','trust','Review approvals','Review governed content and operational approval queues.','sensitive'),
('users.manage','identity','Manage users','Activate users and assign platform roles.','critical'),
('roles.manage','identity','Manage roles and privileges','Edit hierarchy and permission assignments.','critical'),
('organizations.manage','organizations','Manage organizations','Create organizations, relationships and local governance.','sensitive'),
('learning.manage','learning','Manage learning','Publish courses, videos, paths, points and certificates.','sensitive'),
('clinical.govern','clinical','Govern clinical workflows','Manage clinical access and safety boundaries.','clinical'),
('marketplace.review','marketplace','Review marketplace','Review sellers, offers and commercial trust evidence.','financial'),
('industry.review','industry','Review industry contributions','Review companies and submitted product evidence.','sensitive'),
('notifications.manage','communications','Manage notifications','Create and control platform notification campaigns.','sensitive'),
('data.ingest','data','Manage ingestion','Manage OCR, web ingestion and source review.','sensitive')
on conflict(permission_key) do update set category=excluded.category,label=excluded.label,description=excluded.description,risk_level=excluded.risk_level,is_active=true;

insert into public.platform_role_permissions(role_key,permission_key,allowed)
select role_key, permission_key, true
from (values
  ('super_admin','platform.manage'),('super_admin','settings.manage'),('super_admin','approvals.review'),('super_admin','users.manage'),('super_admin','roles.manage'),('super_admin','organizations.manage'),('super_admin','learning.manage'),('super_admin','clinical.govern'),('super_admin','marketplace.review'),('super_admin','industry.review'),('super_admin','notifications.manage'),('super_admin','data.ingest'),
  ('platform_admin','platform.manage'),('platform_admin','settings.manage'),('platform_admin','approvals.review'),('platform_admin','users.manage'),('platform_admin','roles.manage'),('platform_admin','organizations.manage'),('platform_admin','learning.manage'),('platform_admin','clinical.govern'),('platform_admin','marketplace.review'),('platform_admin','industry.review'),('platform_admin','notifications.manage'),('platform_admin','data.ingest'),
  ('admin','settings.manage'),('admin','approvals.review'),('admin','users.manage'),('admin','organizations.manage'),('admin','learning.manage'),('admin','marketplace.review'),('admin','industry.review'),('admin','notifications.manage'),
  ('org_admin','organizations.manage'),('org_admin','learning.manage'),
  ('reviewer','approvals.review'),('physician','clinical.govern'),('pharmacist','clinical.govern')
) mapping(role_key,permission_key)
on conflict(role_key,permission_key) do update set allowed=excluded.allowed,updated_at=now();

insert into public.platform_approval_policies(policy_key,queue_key,label,description,entity_type,required_permission,minimum_approvers,sla_hours,escalation_role_key)
values
('company-contributions','industry_contributions','Company and product contributions','Review company-submitted knowledge and product evidence.','company_contribution','industry.review',1,72,'platform_admin'),
('marketplace-trust','marketplace_reviews','Marketplace trust','Review seller, offer and marketplace trust evidence.','marketplace','marketplace.review',1,48,'platform_admin'),
('healthcare-entities','healthcare_entity_applications','Healthcare entity applications','Verify provider identity, licensing and organization claims.','healthcare_entity','clinical.govern',1,72,'platform_admin'),
('web-ingestion','web_ingestion_candidates','Web evidence candidates','Human review of attributed web evidence before publication.','web_evidence','data.ingest',1,72,'platform_admin'),
('document-ocr','document_ocr_jobs','Document OCR review','Review extracted document evidence before use.','document','data.ingest',1,48,'platform_admin'),
('community-safety','community_reports','Community safety reports','Review community discussions and reports.','community_report','approvals.review',1,24,'platform_admin')
on conflict(policy_key) do update set queue_key=excluded.queue_key,label=excluded.label,description=excluded.description,
entity_type=excluded.entity_type,required_permission=excluded.required_permission,minimum_approvers=excluded.minimum_approvers,
sla_hours=excluded.sla_hours,escalation_role_key=excluded.escalation_role_key,is_active=true;

insert into public.learning_career_paths(slug,role_key,title_en,title_ar,summary_en,summary_ar,experience_outcomes,certificate_title,minimum_points,is_published,sort_order)
values
('patient-navigation','patient','Confident patient navigator','مسار المريض الواثق','Build the skills to protect your profile, understand consent, and follow medicines, tests, results and approvals.','طوّر مهارات حماية ملفك وفهم الموافقة ومتابعة الأدوية والفحوص والنتائج والموافقات.',array['Protect personal health information','Follow the connected care journey','Communicate safely with providers'],'Patient Navigation Path',100,true,10),
('connected-physician','physician','Connected-care physician','مسار طبيب الرعاية المترابطة','Develop structured documentation, prescribing, diagnostics, referral and authorization experience.','طوّر خبرة التوثيق المنظم والوصف والفحوص والإحالة والموافقات.',array['Document structured encounters','Route complete clinical orders','Coordinate an accountable care team'],'Connected-Care Physician Path',200,true,20),
('clinical-pharmacy','pharmacist','Clinical pharmacy fulfillment','مسار التنفيذ الصيدلي السريري','Progress from safe order review to accountable dispensing and pharmacy operations.','تدرّج من مراجعة الطلب الآمنة إلى الصرف المسؤول وعمليات الصيدلية.',array['Verify prescriptions','Record dispensing evidence','Coordinate inventory and patient fulfillment'],'Clinical Pharmacy Path',200,true,30),
('diagnostic-services','diagnostic_provider','Diagnostic services professional','مسار محترف الخدمات التشخيصية','Learn order intake, scheduling, quality checks and structured result delivery.','تعلّم استلام الطلب والجدولة وفحوص الجودة وإرسال النتائج المنظمة.',array['Manage diagnostic queues','Return trusted structured results','Protect clinical access boundaries'],'Diagnostic Services Path',200,true,40),
('organization-leadership','org_admin','Healthcare organization leader','مسار قائد مؤسسة صحية','Build organization governance, hierarchy, role assignment, training and launch readiness.','طوّر حوكمة المؤسسة والهيكل وتوزيع الأدوار والتدريب والاستعداد للإطلاق.',array['Design least-privilege teams','Operate approval policies','Lead safe platform adoption'],'Organization Leadership Path',300,true,50),
('platform-governance','platform_admin','Platform governance professional','مسار محترف حوكمة المنصة','Master approvals, privacy, clinical safety, data ingestion, releases and platform-wide controls.','أتقن الموافقات والخصوصية والسلامة السريرية وإدخال البيانات والإصدارات وضوابط المنصة.',array['Govern platform permissions','Operate trust and safety queues','Lead auditable releases'],'Platform Governance Path',500,true,60)
on conflict(slug) do update set role_key=excluded.role_key,title_en=excluded.title_en,title_ar=excluded.title_ar,
summary_en=excluded.summary_en,summary_ar=excluded.summary_ar,experience_outcomes=excluded.experience_outcomes,
certificate_title=excluded.certificate_title,minimum_points=excluded.minimum_points,is_published=excluded.is_published,sort_order=excluded.sort_order;

insert into public.learning_career_path_courses(career_path_id,course_id,course_order,is_required)
select path.id, course.id, mapping.course_order, true
from (values
  ('patient-navigation','patient-health-journey',1),
  ('connected-physician','physician-connected-care',1),
  ('clinical-pharmacy','pharmacy-clinical-fulfillment',1),
  ('diagnostic-services','diagnostic-provider-workflow',1),
  ('organization-leadership','institution-platform-onboarding',1),
  ('platform-governance','platform-clinical-governance',1)
) mapping(path_slug,course_slug,course_order)
join public.learning_career_paths path on path.slug=mapping.path_slug
join public.learning_courses course on course.slug=mapping.course_slug
on conflict(career_path_id,course_id) do update set course_order=excluded.course_order,is_required=excluded.is_required;
