-- Learning Center track for hospital-channel KAMs and medical reps.

insert into public.learning_courses(
  slug,title_en,title_ar,summary_en,summary_ar,audience_roles,audience_organization_types,
  learning_outcomes,level,version,is_published,sort_order
) values (
  'hospital-channel-market-access',
  'Hospital channel and market access for field teams',
  'القناة المستشفية والوصول للسوق لفرق الميدان',
  'Prepare for hospital visits, formulary discussions, and account planning using Egyptian market-access context and the Hospital Channel Toolkit.',
  'استعد لزيارات المستشفيات ونقاشات الدستور وتخطيط الحسابات باستخدام سياق الوصول للسوق في مصر وأدوات القناة المستشفية.',
  array['kam','medical_rep','sales','marketing','pharmacist'],
  array['pharma_company','hospital','clinic'],
  array[
    'Map hospital decision layers before a visit',
    'Frame access, adoption, and budget impact in Egyptian terms',
    'Use talking points without over-claiming',
    'Contribute field intelligence with provenance'
  ],
  'intermediate',
  '1.0',
  true,
  80
)
on conflict (slug) do update set
  title_en=excluded.title_en,
  title_ar=excluded.title_ar,
  summary_en=excluded.summary_en,
  summary_ar=excluded.summary_ar,
  audience_roles=excluded.audience_roles,
  audience_organization_types=excluded.audience_organization_types,
  learning_outcomes=excluded.learning_outcomes,
  level=excluded.level,
  version=excluded.version,
  is_published=excluded.is_published,
  sort_order=excluded.sort_order;

insert into public.learning_lessons(course_id,lesson_slug,title_en,title_ar,summary_en,summary_ar,duration_minutes,lesson_order,content,is_published)
select c.id,v.lesson_slug,v.title_en,v.title_ar,v.summary_en,v.summary_ar,v.duration_minutes,v.lesson_order,v.content,true
from public.learning_courses c
join (values
('hospital-channel-market-access','egypt-hospital-trends','Understand Egypt hospital-channel trends','افهم اتجاهات القناة المستشفية في مصر','Private group centralization, UHI expansion, localization, and supply reliability.','مركزة القرار في المجموعات الخاصة وتوسع التأمين والتوطين وموثوقية الإمداد.',8,1,jsonb_build_object(
  'toolkit','docs/hospital-channel-toolkit/01-hospital-line-industry-trends-egypt.md',
  'steps',array['Read current hospital-line trends','Note group vs site decisions','Check UHI and UPA implications for the account']
)),
('hospital-channel-market-access','formulary-drivers','Prepare for formulary and P&T conversations','الاستعداد لنقاش الدستور ولجنة الدواء','Clinical fit, quality, supply, economics, and stakeholders.','الملاءمة السريرية والجودة والإمداد والاقتصاد وأصحاب المصلحة.',10,2,jsonb_build_object(
  'toolkit','docs/hospital-channel-toolkit/02-formulary-and-pt-decision-drivers.md',
  'steps',array['Map decision layers','Identify clinical and procurement owners','Prepare one clinical and one supply point']
)),
('hospital-channel-market-access','access-language','Use market-access language without over-claiming','استخدم لغة الوصول للسوق بدون مبالغة','Access, adoption, budget impact, NICE vs Egypt vs IQWiG.','الوصول والتبني وأثر الميزانية والفرق بين NICE ومصر وIQWiG.',12,3,jsonb_build_object(
  'toolkit','docs/hospital-channel-toolkit/03-market-access-and-hta-overview.md',
  'related',array['docs/hospital-channel-toolkit/05-nice-vs-egyptian-hta.md','docs/hospital-channel-toolkit/09-iqwig-vs-nice.md'],
  'steps',array['Explain access vs adoption','Use budget impact before QALY talk','Bring international HTA back to Egyptian realities']
)),
('hospital-channel-market-access','account-plan-and-share','Plan the visit and share useful notes','خطط للزيارة وشارك ملاحظات مفيدة','Use the checklist, talking points, and contribution form.','استخدم قائمة التخطيط ونقاط الحديث ونموذج المساهمة.',10,4,jsonb_build_object(
  'toolkit','docs/hospital-channel-toolkit/07-account-planning-checklist.md',
  'related',array['docs/hospital-channel-toolkit/06-talking-points-templates.md','docs/hospital-channel-toolkit/contribution-form.md'],
  'steps',array['Complete the 5-minute pre-call version','Adapt one talking-point template','Submit one field note with source or field-observation tag']
))
) as v(course_slug,lesson_slug,title_en,title_ar,summary_en,summary_ar,duration_minutes,lesson_order,content)
on c.slug = v.course_slug
on conflict (course_id, lesson_slug) do update set
  title_en=excluded.title_en,
  title_ar=excluded.title_ar,
  summary_en=excluded.summary_en,
  summary_ar=excluded.summary_ar,
  duration_minutes=excluded.duration_minutes,
  lesson_order=excluded.lesson_order,
  content=excluded.content,
  is_published=true;
