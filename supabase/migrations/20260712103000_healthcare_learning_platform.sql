-- Public role-based healthcare learning catalog with private learner progress.
-- This migration is intentionally idempotent because the connected project already received
-- the same schema through controlled split migrations.

create table if not exists public.learning_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title_en text not null,
  title_ar text,
  summary_en text not null,
  summary_ar text,
  audience_roles text[] not null default '{}',
  audience_organization_types text[] not null default '{}',
  learning_outcomes text[] not null default '{}',
  level text not null default 'foundation' check (level in ('foundation','intermediate','advanced','administrator')),
  version text not null default '1.0',
  is_published boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  lesson_slug text not null,
  title_en text not null,
  title_ar text,
  summary_en text not null,
  summary_ar text,
  duration_minutes integer not null default 5 check (duration_minutes between 1 and 240),
  lesson_order integer not null default 1,
  content jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,lesson_slug)
);
create index if not exists learning_lessons_course_idx on public.learning_lessons(course_id,lesson_order);

create table if not exists public.learning_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.learning_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'enrolled' check (status in ('enrolled','in_progress','completed','expired')),
  completed_lesson_slugs text[] not null default '{}',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id,user_id)
);
create index if not exists learning_enrollments_user_idx on public.learning_enrollments(user_id,status,last_activity_at desc);

drop trigger if exists learning_courses_touch_updated_at on public.learning_courses;
create trigger learning_courses_touch_updated_at before update on public.learning_courses
for each row execute function private.touch_updated_at();
drop trigger if exists learning_lessons_touch_updated_at on public.learning_lessons;
create trigger learning_lessons_touch_updated_at before update on public.learning_lessons
for each row execute function private.touch_updated_at();
drop trigger if exists learning_enrollments_touch_updated_at on public.learning_enrollments;
create trigger learning_enrollments_touch_updated_at before update on public.learning_enrollments
for each row execute function private.touch_updated_at();

alter table public.learning_courses enable row level security;
alter table public.learning_lessons enable row level security;
alter table public.learning_enrollments enable row level security;
revoke all on public.learning_courses,public.learning_lessons,public.learning_enrollments from anon,authenticated;
grant select on public.learning_courses,public.learning_lessons to anon,authenticated;
grant select,insert,update on public.learning_enrollments to authenticated;
grant all on public.learning_courses,public.learning_lessons,public.learning_enrollments to service_role;

drop policy if exists learning_courses_public_read on public.learning_courses;
create policy learning_courses_public_read on public.learning_courses for select to anon,authenticated using (is_published=true);
drop policy if exists learning_lessons_public_read on public.learning_lessons;
create policy learning_lessons_public_read on public.learning_lessons for select to anon,authenticated
using (is_published=true and exists(select 1 from public.learning_courses c where c.id=course_id and c.is_published=true));
drop policy if exists learning_enrollments_own_read on public.learning_enrollments;
create policy learning_enrollments_own_read on public.learning_enrollments for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists learning_enrollments_own_insert on public.learning_enrollments;
create policy learning_enrollments_own_insert on public.learning_enrollments for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.learning_courses c where c.id=course_id and c.is_published=true));
drop policy if exists learning_enrollments_own_update on public.learning_enrollments;
create policy learning_enrollments_own_update on public.learning_enrollments for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create or replace view public.learning_catalog_v1 with (security_invoker=true) as
select c.id,c.slug,c.title_en,c.title_ar,c.summary_en,c.summary_ar,c.audience_roles,c.audience_organization_types,
  c.learning_outcomes,c.level,c.version,c.sort_order,count(l.id)::integer lesson_count,
  coalesce(sum(l.duration_minutes),0)::integer estimated_minutes
from public.learning_courses c
left join public.learning_lessons l on l.course_id=c.id and l.is_published=true
where c.is_published=true
group by c.id;
grant select on public.learning_catalog_v1 to anon,authenticated,service_role;

insert into public.learning_courses(slug,title_en,title_ar,summary_en,summary_ar,audience_roles,audience_organization_types,learning_outcomes,level,is_published,sort_order)
values
('patient-health-journey','Your connected healthcare journey','رحلتك الصحية المترابطة','Learn how to protect your health profile, understand consent, follow prescriptions and diagnostic orders, receive results, and track insurance decisions.','تعلّم كيفية حماية ملفك الصحي وفهم الموافقة ومتابعة الوصفات وطلبات الفحوص والنتائج وقرارات التأمين.',array['patient'],array['patient'],array['Protect your patient profile','Understand care-team access','Follow orders, results, medicines, and approvals'],'foundation',true,10),
('physician-connected-care','Physician connected-care workflow','مسار الرعاية المترابطة للطبيب','Learn the governed workflow for patient identification, encounter documentation, structured prescriptions, diagnostics, and payer authorization.','تعلّم المسار المنضبط لتحديد المريض وتوثيق الزيارة والوصفات المنظمة والفحوص وموافقة جهة التأمين.',array['physician'],array['clinic','hospital'],array['Use privacy-safe patient matching','Create structured prescriptions','Route laboratory, imaging, pharmacy, and insurance work'],'foundation',true,20),
('pharmacy-clinical-fulfillment','Pharmacy clinical fulfillment','تنفيذ الوصفات بالصيدلية','Receive routed prescription items, verify the patient and order, document dispensing, and preserve audit evidence.','استقبل بنود الوصفات المحالة وتحقق من المريض والطلب وسجّل الصرف وأدلة المراجعة.',array['pharmacist','pharmacy_assistant'],array['commercial_pharmacy','pharmacy_partner'],array['Receive routed medication orders','Record safe dispensing status','Connect fulfillment to the patient journey'],'foundation',true,30),
('diagnostic-provider-workflow','Laboratory and radiology workflow','مسار المعامل والأشعة','Accept clinical service orders, schedule or perform services, and return structured results and reports to the authorized care team.','اقبل طلبات الخدمات السريرية وجدول أو نفّذ الخدمة وأعد النتائج والتقارير المنظمة لفريق الرعاية المصرح له.',array['diagnostic_provider'],array['laboratory','radiology_center','hospital'],array['Manage diagnostic queues','Return structured results','Protect patient access boundaries'],'foundation',true,40),
('payer-authorization-workflow','Insurance authorization workflow','مسار موافقات التأمين','Review coverage and prior-authorization requests, request missing information, and return attributable decisions.','راجع التغطية وطلبات الموافقة المسبقة واطلب المعلومات الناقصة وأعد قرارات منسوبة.',array['insurance_reviewer'],array['insurance_company','payer'],array['Review requested services safely','Document approval decisions','Connect decisions to care orders'],'foundation',true,50),
('institution-platform-onboarding','Institution platform onboarding','تهيئة المؤسسات على المنصة','Configure organization membership, access, operating roles, training assignments, governance, and launch readiness.','اضبط عضوية المؤسسة والوصول والأدوار التشغيلية والتدريب والحوكمة والاستعداد للإطلاق.',array['org_admin','program_manager'],array['clinic','hospital','laboratory','radiology_center','insurance_company','ngo','pharmacy'],array['Configure a governed workspace','Assign least-privilege roles','Prepare staff and launch controls'],'administrator',true,60),
('platform-clinical-governance','Clinical platform governance','حوكمة المنصة السريرية','Operate identity, consent, audit, interoperability, content, security, incident, and release-readiness controls.','شغّل ضوابط الهوية والموافقة والتدقيق والتوافق والمحتوى والأمن والحوادث والاستعداد للإطلاق.',array['platform_admin','super_admin'],array['platform_owner'],array['Audit access and identity search','Review interoperability boundaries','Manage safe production releases'],'administrator',true,70)
on conflict(slug) do update set title_en=excluded.title_en,title_ar=excluded.title_ar,summary_en=excluded.summary_en,
  summary_ar=excluded.summary_ar,audience_roles=excluded.audience_roles,audience_organization_types=excluded.audience_organization_types,
  learning_outcomes=excluded.learning_outcomes,level=excluded.level,is_published=excluded.is_published,sort_order=excluded.sort_order;

insert into public.learning_lessons(course_id,lesson_slug,title_en,title_ar,summary_en,summary_ar,duration_minutes,lesson_order,content,is_published)
select c.id,v.lesson_slug,v.title_en,v.title_ar,v.summary_en,v.summary_ar,v.duration_minutes,v.lesson_order,v.content,true
from public.learning_courses c
join (values
('patient-health-journey','privacy-and-consent','Protect your record and understand access','حماية السجل وفهم الوصول','Understand profile protection, care-team access, and how a connected journey should be followed.','افهم حماية الملف ووصول فريق الرعاية وكيفية متابعة الرحلة المترابطة.',7,1,jsonb_build_object('steps',array['Use your own account','Review care-team requests','Grant only necessary access','Report incorrect information safely'])),
('patient-health-journey','follow-the-journey','Follow your care journey','متابعة رحلة الرعاية','Understand encounters, prescriptions, diagnostic orders, results, dispensing, and payer decisions.','افهم الزيارات والوصفات وطلبات الفحوص والنتائج والصرف وقرارات التأمين.',8,2,jsonb_build_object('steps',array['Review active care items','Read final results','Check authorization status','Confirm medicine fulfillment'])),
('physician-connected-care','patient-match','Find or create the right patient','العثور على المريض الصحيح أو إنشاؤه','Use organization-scoped patient search and understand the exact-identity safety boundary.','استخدم بحث المرضى المقيد بالمؤسسة وافهم حدود أمان مطابقة الهوية الدقيقة.',9,1,jsonb_build_object('steps',array['Choose your organization','Search accessible patients by name','Use exact identity matching only when approved','Request consent before opening unrelated records'])),
('physician-connected-care','encounter-to-orders','From encounter to complete care plan','من الزيارة إلى خطة رعاية كاملة','Document the encounter, prescribe medicines, order diagnostics, and request insurance authorization.','سجّل الزيارة والوصفة والفحوص وطلب موافقة التأمين.',12,2,jsonb_build_object('steps',array['Start encounter','Document clinical summary','Add medicine items','Add lab or radiology orders','Submit authorization when required'])),
('pharmacy-clinical-fulfillment','dispense-safely','Receive and dispense safely','استلام وصرف آمن','Work only from routed prescription items and record outcomes without changing the prescriber order.','اعمل من بنود الوصفات المحالة وسجّل النتائج دون تغيير أمر الطبيب.',10,1,jsonb_build_object('steps',array['Verify routed item','Confirm medicine and quantity','Check prescription requirements','Record partial or complete dispensing'])),
('diagnostic-provider-workflow','order-to-result','Turn an order into a trusted result','تحويل الطلب إلى نتيجة موثوقة','Accept the assigned order and return a preliminary or final structured result.','اقبل الطلب المحال وأعد نتيجة منظمة أولية أو نهائية.',10,1,jsonb_build_object('steps',array['Review clinical question','Accept or schedule order','Perform service','Attach structured result and report','Verify final result'])),
('payer-authorization-workflow','coverage-decision','Review and decide authorization','مراجعة واتخاذ قرار الموافقة','Connect coverage, requested service, evidence, approved amount, and decision reason.','اربط التغطية والخدمة المطلوبة والأدلة والمبلغ المعتمد وسبب القرار.',10,1,jsonb_build_object('steps',array['Verify coverage','Review linked care request','Request missing information','Record a human-reviewed decision'])),
('institution-platform-onboarding','launch-workspace','Prepare an institution for launch','إعداد المؤسسة للإطلاق','Configure the workspace, people, roles, access, training, and operational checks.','اضبط مساحة العمل والأشخاص والأدوار والوصول والتدريب والفحوص التشغيلية.',15,1,jsonb_build_object('steps',array['Verify organization profile','Assign roles','Enroll staff in training','Test one complete workflow','Approve launch checklist'])),
('platform-clinical-governance','release-gates','Clinical release and safety gates','بوابات الإطلاق والسلامة السريرية','Use explicit security, privacy, interoperability, recovery, and clinical-governance gates before production claims.','استخدم بوابات واضحة للأمن والخصوصية والتوافق والتعافي والحوكمة قبل ادعاءات الجاهزية.',15,1,jsonb_build_object('steps',array['Review row-level security','Test consent boundaries','Validate audit evidence','Verify backup and recovery','Complete clinical and legal review']))
) as v(course_slug,lesson_slug,title_en,title_ar,summary_en,summary_ar,duration_minutes,lesson_order,content)
on c.slug=v.course_slug
on conflict(course_id,lesson_slug) do update set title_en=excluded.title_en,title_ar=excluded.title_ar,
  summary_en=excluded.summary_en,summary_ar=excluded.summary_ar,duration_minutes=excluded.duration_minutes,
  lesson_order=excluded.lesson_order,content=excluded.content,is_published=true;
