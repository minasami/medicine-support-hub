create table if not exists public.healthcare_journey_stages (
  stage_key text primary key,
  sort_order integer not null,
  title_en text not null,
  title_ar text not null,
  summary_en text not null,
  summary_ar text not null,
  primary_actor text not null,
  lifecycle_status text not null check (lifecycle_status in ('live','pilot','gated','planned')),
  public_route text,
  staff_route text,
  learning_course_slug text,
  source_systems text[] not null default '{}',
  required_capabilities text[] not null default '{}',
  release_gate text,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.healthcare_journey_stages enable row level security;

drop policy if exists healthcare_journey_stages_public_read on public.healthcare_journey_stages;
create policy healthcare_journey_stages_public_read
on public.healthcare_journey_stages
for select
to anon, authenticated
using (is_public = true);

revoke all on public.healthcare_journey_stages from public, anon, authenticated;
grant select on public.healthcare_journey_stages to anon, authenticated;

insert into public.healthcare_journey_stages (
  stage_key,sort_order,title_en,title_ar,summary_en,summary_ar,primary_actor,lifecycle_status,
  public_route,staff_route,learning_course_slug,source_systems,required_capabilities,release_gate,is_public
) values
('patient-profile',10,'Patient identity and profile','هوية وملف المريض','Patients create and maintain an account used for support requests and future consent-based clinical linking.','ينشئ المرضى حسابًا ويحافظون عليه لاستخدامه في طلبات الدعم والربط السريري المستقبلي القائم على الموافقة.','patient','live','/account',null,'patient-health-journey',array['patient_accounts','profiles'],array['identity minimization','consent','account recovery'],null,true),
('medicine-discovery',20,'Medicine discovery and evidence','اكتشاف الدواء والأدلة','Search canonical medicines, source-backed prices, product images, companies, and reviewed marketplace signals.','ابحث في الأدوية الموحدة والأسعار المدعومة بالمصادر والصور والشركات وإشارات السوق المراجعة.','patient','live','/medicines',null,'patient-health-journey',array['canonical medicines','price history','marketplace'],array['source attribution','search relevance','public safety'],null,true),
('physician-care',30,'Physician assessment and prescribing','تقييم الطبيب والوصف الدوائي','The current physician workspace supports authorization workflows. Structured encounters and electronic prescribing remain security-gated.','تدعم مساحة الطبيب الحالية مسارات التفويض، بينما تظل المقابلات المنظمة والوصف الإلكتروني مقيدين بمراجعة الأمان.','physician','gated',null,'/physician','physician-connected-care',array['medicine requests','clinical assistant'],array['patient-scoped access','prescription signing','clinical audit'],'Independent authorization, identity, consent, and clinical-safety review required before activation.',true),
('diagnostics',40,'Laboratory and radiology coordination','تنسيق المعامل والأشعة','Training and architecture exist for diagnostic ordering and results, but protected clinical routing is not publicly released.','يتوفر التدريب والتصميم لطلبات ونتائج التشخيص، لكن التوجيه السريري المحمي لم يُطرح بعد.','diagnostic_provider','planned',null,null,'diagnostic-provider-workflow',array['learning platform'],array['service orders','result provenance','DICOMweb/FHIR mapping'],'Clinical authorization and organization-routing policies must pass independent review.',true),
('insurance',50,'Insurance eligibility and authorization','الأهلية وموافقات التأمين','The payer training track is live; coverage and prior-authorization transactions remain a planned protected workflow.','مسار تدريب جهات الدفع متاح، بينما تظل معاملات التغطية والموافقة المسبقة مسارًا محميًا مخططًا.','insurance_reviewer','planned',null,null,'payer-authorization-workflow',array['learning platform'],array['coverage verification','prior authorization','decision audit'],'Payer contracts, policy rules, appeals, and privacy controls must be implemented and validated.',true),
('pharmacy-fulfillment',60,'Pharmacy dispensing and fulfillment','صرف الدواء وتنفيذه بالصيدلية','Operational pharmacy, inventory, purchasing, sales, and marketplace workflows are live; clinical e-prescription dispensing remains gated.','مسارات تشغيل الصيدلية والمخزون والمشتريات والمبيعات والسوق متاحة، بينما يظل صرف الوصفة الإلكترونية السريري مقيدًا.','pharmacist','live','/marketplace','/pharmacy','pharmacy-clinical-fulfillment',array['pharmacy operations','marketplace','inventory'],array['licensed-user verification','dispensing audit','stock privacy'],'Electronic prescription validation must be activated only with the clinical release.',true),
('support-fulfillment',70,'Medicine support and delivery','دعم الدواء والتوصيل','Patients can request medicine support, staff can review and fulfill requests, and users can track progress.','يمكن للمرضى طلب دعم الدواء، ويمكن للفرق مراجعة الطلبات وتنفيذها وتتبع تقدمها.','patient','live','/request','/dashboard','patient-health-journey',array['medicine requests','review','fulfillment','delivery'],array['request attribution','status history','operational audit'],null,true),
('longitudinal-record',80,'Longitudinal health record','السجل الصحي الطولي','A privacy-minimized clinical foundation exists in draft, but encounters, prescriptions, results, authorizations, and timeline access are not release-enabled.','يوجد أساس سريري محدود البيانات في وضع المسودة، لكن المقابلات والوصفات والنتائج والموافقات والوصول إلى الخط الزمني غير مفعلة للإطلاق.','patient','gated',null,null,'patient-health-journey',array['clinical draft foundation'],array['FHIR resources','consent','break-glass access','immutable audit','retention'],'Independent security review, tenant-isolation tests, identity-secret management, and clinical governance approval required.',true),
('learning-adoption',90,'Training and institutional adoption','التدريب وتبني المؤسسات','Seven bilingual role-based tracks guide patients, physicians, pharmacies, diagnostics, payers, institutions, and platform governors.','توجه سبعة مسارات ثنائية اللغة المرضى والأطباء والصيدليات والتشخيص وجهات الدفع والمؤسسات وحوكمة المنصة.','institution_admin','live','/learn',null,'institution-platform-onboarding',array['learning courses','private progress'],array['role onboarding','workflow competency','governance training'],null,true),
('governance-automation',100,'Governance, automation, and source review','الحوكمة والأتمتة ومراجعة المصادر','Administrators control settings, approvals, OCR, governed web ingestion, search refresh, and evidence review.','يتحكم المسؤولون في الإعدادات والموافقات والتعرف الضوئي والإدخال المنضبط من الويب وتحديث البحث ومراجعة الأدلة.','platform_admin','live','/security','/admin/control-center','platform-clinical-governance',array['control center','OCR','Firecrawl','review queues'],array['human review','secret isolation','domain allow-lists','audit history'],null,true)
on conflict (stage_key) do update set
  sort_order=excluded.sort_order,title_en=excluded.title_en,title_ar=excluded.title_ar,
  summary_en=excluded.summary_en,summary_ar=excluded.summary_ar,primary_actor=excluded.primary_actor,
  lifecycle_status=excluded.lifecycle_status,public_route=excluded.public_route,staff_route=excluded.staff_route,
  learning_course_slug=excluded.learning_course_slug,source_systems=excluded.source_systems,
  required_capabilities=excluded.required_capabilities,release_gate=excluded.release_gate,
  is_public=excluded.is_public,updated_at=now();

create or replace view public.healthcare_journey_public_v1
with (security_invoker = true)
as
select
  stage_key,sort_order,title_en,title_ar,summary_en,summary_ar,primary_actor,lifecycle_status,
  public_route,staff_route,learning_course_slug,
  case when learning_course_slug is null then null else '/learn?course=' || learning_course_slug end as learning_route,
  source_systems,required_capabilities,release_gate,updated_at
from public.healthcare_journey_stages
where is_public = true;

grant select on public.healthcare_journey_public_v1 to anon, authenticated;

create or replace view public.healthcare_journey_readiness_v1
with (security_invoker = true)
as
select
  count(*)::integer as total_stages,
  count(*) filter (where lifecycle_status='live')::integer as live_stages,
  count(*) filter (where lifecycle_status='pilot')::integer as pilot_stages,
  count(*) filter (where lifecycle_status='gated')::integer as gated_stages,
  count(*) filter (where lifecycle_status='planned')::integer as planned_stages,
  count(*) filter (where learning_course_slug is not null)::integer as stages_with_training,
  false as certified_ehr,
  false as clinical_release_ready,
  max(updated_at) as updated_at
from public.healthcare_journey_stages
where is_public = true;

grant select on public.healthcare_journey_readiness_v1 to anon, authenticated;
notify pgrst, 'reload schema';
