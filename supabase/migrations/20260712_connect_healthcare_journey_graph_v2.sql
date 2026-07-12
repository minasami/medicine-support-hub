create or replace view public.platform_connection_graph_nodes
with (security_invoker = true)
as
select v.node_type, v.node_key, v.label, v.href, v.parent_key, v.weight
from (values
  ('module'::text,'journey'::text,'Connected healthcare journey'::text,'/journey'::text,null::text,100::integer),
  ('module','learning','Healthcare learning center','/learn',null,95),
  ('module','medicines','Medicine search and evidence','/medicines',null,100),
  ('module','marketplace','Verified B2B medicine marketplace','/marketplace',null,90),
  ('module','verified-products','Verified product database','/verified-products',null,85),
  ('module','companies','Healthcare company profiles','/companies',null,90),
  ('module','industry','Industry contribution network','/industry',null,85),
  ('module','industry-opportunities','Industry opportunities','/industry/opportunities','industry',70),
  ('module','generics','Generic medicine directory','/generics','medicines',80),
  ('module','diseases','Disease-area directory','/diseases','medicines',80),
  ('module','search','Universal healthcare search','/search',null,95),
  ('module','network','Healthcare knowledge graph','/network',null,90),
  ('module','integrations','Platform integration hub','/integrations',null,90),
  ('module','account','Patient account and profile','/account','journey',85),
  ('module','request','Medicine support request','/request','journey',85),
  ('module','track','Request tracking','/track','journey',75),
  ('module','clinical-assistant','Clinical assistant','/clinical-assistant','journey',70),
  ('module','physician','Physician authorization workspace','/physician','portal',65),
  ('module','pharmacy','Pharmacy operations','/pharmacy','portal',85),
  ('module','pharmacy-reports','Pharmacy reports','/pharmacy/reports','pharmacy',70),
  ('module','delivery','Delivery coordination','/delivery','portal',65),
  ('module','ngo','NGO healthcare operations','/ngo',null,80),
  ('module','workspace','Institutional program workspace','/workspace','portal',80),
  ('module','impact','Healthcare impact reporting','/impact','workspace',75),
  ('module','medicine-enrichment-admin','Medicine evidence review','/admin/medicine-enrichment','control-center',65),
  ('module','control-center','Platform control center','/admin/control-center','portal',75),
  ('module','portal','Secure staff portal','/portal',null,80)
) as v(node_type,node_key,label,href,parent_key,weight)
union all
select 'journey_stage'::text,'journey:' || stage_key,title_en,'/journey#' || stage_key,'journey'::text,
  case lifecycle_status when 'live' then 10 when 'pilot' then 7 when 'gated' then 4 else 2 end::integer
from public.healthcare_journey_public_v1
union all
select 'course'::text,'course:' || slug,title_en,'/learn#' || slug,'learning'::text,5::integer
from public.learning_courses where is_published = true
union all
select 'company'::text,company_slug,company_name,'/companies?company=' || company_slug,'companies'::text,active_product_count::integer
from public.medicine_company_profiles
union all
select 'industry_company'::text,'industry:' || company_slug,display_name,'/companies/' || company_slug,'industry'::text,
  greatest(coalesce(array_length(capabilities,1),0) + coalesce(array_length(product_categories,1),0),1)::integer
from public.industry_company_profiles where verification_status='verified' and is_public=true
union all
select 'generic'::text,lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')),generic_name,
  '/verified-products?generic=' || replace(generic_name, ' ', '%20'),'verified-products'::text,count(*)::integer
from public.verified_medicine_source_products where duplicate_status='active' and generic_name is not null group by generic_name
union all
select 'disease'::text,lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')),disease_name,
  '/verified-products?disease=' || replace(disease_name, ' ', '%20'),'verified-products'::text,count(*)::integer
from public.verified_medicine_source_products where duplicate_status='active' and disease_name is not null group by disease_name
union all
select 'source'::text,lower(regexp_replace(source_name, '[^a-zA-Z0-9]+', '-', 'g')),source_name,
  '/integrations'::text,'integrations'::text,count(*)::integer
from public.medicine_enrichments where confidence='verified' group by source_name;

grant select on public.platform_connection_graph_nodes to anon, authenticated;

create or replace view public.platform_connection_graph_edges
with (security_invoker = true)
as
select v.source_key,v.target_key,v.relation,v.weight
from (values
  ('journey'::text,'account'::text,'starts_with'::text,10::integer),
  ('journey','medicines','discovers',10),('journey','learning','trains_through',10),
  ('journey','request','requests_support',9),('journey','marketplace','connects_supply',8),
  ('journey','pharmacy','fulfills_through',8),('journey','physician','coordinates_clinical_review',5),
  ('journey','impact','measures_outcomes',6),('learning','journey','explains',10),
  ('medicines','marketplace','compares_offers',9),('medicines','verified-products','cross_references',8),
  ('medicines','companies','links_manufacturers',8),('medicines','generics','organized_by',7),
  ('medicines','diseases','organized_by',7),('medicines','clinical-assistant','supports_review',6),
  ('marketplace','pharmacy','fulfilled_by',8),('marketplace','companies','connects_sellers',7),
  ('industry','companies','maintains_profiles',9),('industry','industry-opportunities','publishes',8),
  ('industry','marketplace','connects_supply',8),('request','medicines','selects',8),
  ('request','track','creates_tracking',8),('request','workspace','creates_case',7),
  ('workspace','impact','feeds',9),('ngo','workspace','operates_programs',8),('ngo','impact','reports',8),
  ('pharmacy','pharmacy-reports','feeds',9),('pharmacy','marketplace','sources_from',7),
  ('pharmacy','learning','trains_through',7),('physician','clinical-assistant','uses',7),
  ('physician','medicines','reviews',7),('delivery','track','updates',7),
  ('portal','physician','routes_to',5),('portal','pharmacy','routes_to',5),
  ('portal','workspace','routes_to',5),('portal','control-center','routes_to',5),
  ('control-center','integrations','governs',9),('control-center','medicine-enrichment-admin','governs',9),
  ('control-center','search','refreshes',8),('integrations','network','publishes_graph',9),
  ('integrations','search','publishes_search',9),('integrations','journey','documents_status',8),
  ('network','search','supports_discovery',8),('search','journey','routes_users',7),('search','medicines','finds',9)
) as v(source_key,target_key,relation,weight)
union all
select 'journey'::text,'journey:' || stage_key,'contains'::text,
  case lifecycle_status when 'live' then 10 when 'pilot' then 7 when 'gated' then 4 else 2 end::integer
from public.healthcare_journey_public_v1
union all
select 'journey:' || stage_key,'course:' || learning_course_slug,'trained_by'::text,8::integer
from public.healthcare_journey_public_v1 where learning_course_slug is not null
union all
select 'learning'::text,'course:' || slug,'contains'::text,5::integer
from public.learning_courses where is_published=true
union all
select 'journey:' || stage_key,
  case stage_key when 'patient-profile' then 'account' when 'medicine-discovery' then 'medicines'
    when 'physician-care' then 'physician' when 'pharmacy-fulfillment' then 'pharmacy'
    when 'support-fulfillment' then 'request' when 'learning-adoption' then 'learning'
    when 'governance-automation' then 'control-center' else 'journey' end,
  case lifecycle_status when 'live' then 'opens_live_service' when 'gated' then 'release_gated' else 'planned_connection' end,
  case lifecycle_status when 'live' then 10 when 'gated' then 4 else 2 end::integer
from public.healthcare_journey_public_v1
union all
select company_slug,'verified-products'::text,'has_products'::text,active_product_count::integer from public.medicine_company_profiles
union all
select 'industry'::text,'industry:' || company_slug,'verifies_profile'::text,1::integer
from public.industry_company_profiles where verification_status='verified' and is_public=true
union all
select lower(regexp_replace(generic_name, '[^a-zA-Z0-9]+', '-', 'g')),'verified-products'::text,'filters_products'::text,count(*)::integer
from public.verified_medicine_source_products where duplicate_status='active' and generic_name is not null group by generic_name
union all
select lower(regexp_replace(disease_name, '[^a-zA-Z0-9]+', '-', 'g')),'verified-products'::text,'filters_products'::text,count(*)::integer
from public.verified_medicine_source_products where duplicate_status='active' and disease_name is not null group by disease_name
union all
select lower(regexp_replace(source_name, '[^a-zA-Z0-9]+', '-', 'g')),'medicines'::text,'source_enriches'::text,count(*)::integer
from public.medicine_enrichments where confidence='verified' group by source_name;

grant select on public.platform_connection_graph_edges to anon, authenticated;

create or replace view public.platform_related_navigation
with (security_invoker = true)
as
select * from (values
  ('module'::text,'journey'::text,'Healthcare learning center'::text,'/learn'::text,'Open role-based training for every connected stage.'::text,100::integer),
  ('module','journey','Medicine search and evidence','/medicines','Start with canonical medicine discovery and source-backed evidence.',98),
  ('module','journey','Create patient profile','/account','Create the patient account that begins supported workflows.',96),
  ('module','journey','Request medicine support','/request','Start a live medicine-support request.',94),
  ('module','journey','Verified medicine marketplace','/marketplace','Connect medicine evidence to reviewed institutional supply offers.',90),
  ('module','learning','Connected healthcare journey','/journey','See how every role and course fits into the end-to-end journey.',100),
  ('module','learning','Secure staff portal','/portal','Continue from training into an authorized workspace.',90),
  ('module','medicines','Verified marketplace','/marketplace','Compare reviewed institutional offers linked to canonical medicines.',100),
  ('module','medicines','Verified product database','/verified-products','Browse source-backed products linked to the encyclopedia.',95),
  ('module','medicines','Universal healthcare search','/search','Search across medicines, organizations, learning, and platform services.',92),
  ('module','marketplace','Medicine evidence','/medicines','Review canonical medicine evidence before considering an offer.',100),
  ('module','marketplace','Healthcare companies','/companies','Inspect verified company and seller profiles.',92),
  ('module','marketplace','Industry network','/industry','Understand reviewed industry participation and contribution rules.',88),
  ('module','companies','Industry contribution network','/industry','Claim and improve a verified healthcare company profile.',100),
  ('module','companies','Verified product database','/verified-products','Open source-backed company product intelligence.',95),
  ('module','companies','Verified marketplace','/marketplace','Find reviewed institutional supply participation.',88),
  ('module','industry','Company profiles','/companies','Explore verified healthcare company profiles.',100),
  ('module','industry','Industry opportunities','/industry/opportunities','Open reviewed support, education, and partnership opportunities.',96),
  ('module','industry','Verified marketplace','/marketplace','Connect approved companies to accountable B2B supply.',90),
  ('module','request','Medicine search','/medicines','Find the requested product in the canonical medicine catalog.',96),
  ('module','request','Track request','/track','Follow an existing medicine-support request.',94),
  ('module','request','Patient account','/account','Save and reuse patient profile information.',90),
  ('module','pharmacy','Pharmacy reports','/pharmacy/reports','Turn pharmacy operations into stock, movement, finance, and access reports.',100),
  ('module','pharmacy','Verified marketplace','/marketplace','Connect pharmacy operations to reviewed institutional supply.',92),
  ('module','pharmacy','Pharmacy training','/learn#pharmacy-clinical-fulfillment','Train staff on safe connected fulfillment.',90),
  ('module','workspace','Impact reporting','/impact','Connect program work to measurable health outcomes.',100),
  ('module','workspace','Institution training','/learn#institution-platform-onboarding','Train institutional users before controlled operation.',92),
  ('module','integrations','Platform network','/network','Open the live graph of platform modules, journey stages, courses, and evidence.',100),
  ('module','integrations','Universal search','/search','Search the connected platform from one place.',98),
  ('module','integrations','Connected journey','/journey','See live, planned, and security-gated healthcare connections.',96),
  ('module','control-center','Integration hub','/integrations','Review governed provider, evidence, and automation connections.',100),
  ('module','control-center','Medicine evidence review','/admin/medicine-enrichment','Review source-backed medicine candidates before publication.',96),
  ('module','network','Connected healthcare journey','/journey','Navigate the role-aware journey represented by the graph.',100),
  ('module','network','Universal search','/search','Search the entities represented in the graph.',96),
  ('module','search','Connected healthcare journey','/journey','Use the journey map to choose the correct next workflow.',98),
  ('module','search','Medicine search','/medicines','Use the dedicated medicine engine for rich product filters.',96)
) as v(context_type,context_key,related_title,related_href,reason,priority)
union all
select 'company'::text,company_slug,'Products by ' || company_name,'/verified-products?company=' || company_slug,'Open all active verified products for this company.',100::integer from public.medicine_company_profiles
union all
select 'company'::text,company_slug,'Universal search for ' || company_name,'/search?query=' || replace(company_name,' ','%20'),'Search the full platform for this company.',80::integer from public.medicine_company_profiles
union all
select 'generic'::text,lower(regexp_replace(generic_name,'[^a-zA-Z0-9]+','-','g')),'Products containing ' || generic_name,'/verified-products?generic=' || replace(generic_name,' ','%20'),'Open active verified products for this generic ingredient.',100::integer
from public.verified_medicine_source_products where duplicate_status='active' and generic_name is not null group by generic_name
union all
select 'disease'::text,lower(regexp_replace(disease_name,'[^a-zA-Z0-9]+','-','g')),'Products for ' || disease_name,'/verified-products?disease=' || replace(disease_name,' ','%20'),'Open active verified products in this disease area.',100::integer
from public.verified_medicine_source_products where duplicate_status='active' and disease_name is not null group by disease_name;

grant select on public.platform_related_navigation to anon, authenticated;

create or replace view public.platform_universal_search_index
with (security_invoker = true)
as
select case when node_type='module' then 'module' else node_type end::text as entity_type,node_key::text as entity_key,label::text as title,
  case node_type when 'journey_stage' then 'Connected healthcare journey stage' when 'course' then 'Role-based healthcare training' when 'industry_company' then 'Verified healthcare company' else null end::text as subtitle,
  href::text,node_type::text as category,weight::integer,
  to_tsvector('simple',coalesce(label,'') || ' ' || coalesce(node_type,'') || ' ' || coalesce(parent_key,'') || ' healthcare journey learning platform workflow') as search_vector
from public.platform_connection_graph_nodes where node_type in ('module','journey_stage','course','industry_company')
union all
select 'verified_product',id::text,product_name,concat_ws(' · ',generic_name,company_name,disease_name,prescription_required,final_price::text || ' ' || price_currency),
  '/verified-products?query=' || replace(product_name,' ','%20'),'product',coalesce(final_price,0)::integer,
  to_tsvector('simple',coalesce(product_name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(company_name,'') || ' ' || coalesce(disease_name,'') || ' ' || coalesce(prescription_required,''))
from public.verified_medicine_source_products where duplicate_status='active'
union all
select 'company',company_slug,company_name,concat_ws(' · ',active_product_count::text || ' active products',generic_count::text || ' generics',disease_area_count::text || ' disease areas'),
  '/companies?company=' || company_slug,'company',active_product_count,to_tsvector('simple',coalesce(company_name,'') || ' ' || coalesce(origin,'') || ' company manufacturer profile')
from public.medicine_company_profiles
union all
select 'generic',lower(regexp_replace(generic_name,'[^a-zA-Z0-9]+','-','g')),generic_name,count(*)::text || ' active product records',
  '/verified-products?generic=' || replace(generic_name,' ','%20'),'generic',count(*)::integer,to_tsvector('simple',coalesce(generic_name,'') || ' generic ingredient active substance')
from public.verified_medicine_source_products where duplicate_status='active' and generic_name is not null group by generic_name
union all
select 'disease_area',lower(regexp_replace(disease_name,'[^a-zA-Z0-9]+','-','g')),disease_name,count(*)::text || ' active product records',
  '/verified-products?disease=' || replace(disease_name,' ','%20'),'disease',count(*)::integer,to_tsvector('simple',coalesce(disease_name,'') || ' disease therapy area indication category')
from public.verified_medicine_source_products where duplicate_status='active' and disease_name is not null group by disease_name
union all
select 'medicine_enrichment_source',lower(regexp_replace(source_name,'[^a-zA-Z0-9]+','-','g')),source_name,count(*)::text || ' verified enrichment records',
  '/integrations','source',count(*)::integer,to_tsvector('simple',coalesce(source_name,'') || ' source dataset enrichment verification')
from public.medicine_enrichments where confidence='verified' group by source_name;

grant select on public.platform_universal_search_index to anon, authenticated;

insert into public.platform_delivery_registry(workstream_key,workstream_name,status,priority,github_url,notion_url,production_url,source_of_truth,public_safe,notes)
values
('connected-healthcare-journey','Connected healthcare journey and training','active','high','https://github.com/minasami/medicine-support-hub/issues/74','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/journey','supabase',true,'Role-aware map of live, planned, and security-gated healthcare stages with direct service and training routes.'),
('clinical-release-gates','Clinical record security and release gates','planned','urgent','https://github.com/minasami/medicine-support-hub/pull/92','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/journey','supabase',false,'Protected patient discovery, prescribing, diagnostics, insurance, and longitudinal records remain blocked pending independent authorization, consent, tenant-isolation, identity-secret, clinical-governance, and interoperability review.'),
('governed-automation','Governed OCR and web evidence automation','active','high','https://github.com/minasami/medicine-support-hub/pull/97','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/integrations','supabase',true,'Supports managed or separately hosted Firecrawl, bounded allow-listed jobs, private candidates, provenance, and mandatory human approval; automatic publication is disabled.')
on conflict(workstream_key) do update set workstream_name=excluded.workstream_name,status=excluded.status,priority=excluded.priority,
  github_url=excluded.github_url,notion_url=excluded.notion_url,production_url=excluded.production_url,
  source_of_truth=excluded.source_of_truth,public_safe=excluded.public_safe,notes=excluded.notes,updated_at=now();

notify pgrst,'reload schema';
