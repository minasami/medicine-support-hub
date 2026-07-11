create or replace view public.industry_connection_graph_nodes
with (security_invoker = true)
as
select
  'module'::text as node_type,
  'industry'::text as node_key,
  'Industry contribution network'::text as label,
  '/industry'::text as href,
  null::text as parent_key,
  1::integer as weight
union all
select
  'official_company'::text as node_type,
  profile.company_slug as node_key,
  profile.display_name as label,
  '/companies/' || profile.company_slug as href,
  'industry'::text as parent_key,
  greatest(1, count(contribution.id))::integer as weight
from public.industry_company_profiles profile
left join public.industry_company_contributions contribution
  on contribution.profile_id = profile.id
 and contribution.status = 'approved'
 and contribution.published_at is not null
where profile.verification_status = 'verified'
  and profile.is_public = true
group by profile.id, profile.company_slug, profile.display_name
union all
select
  'company_contribution'::text as node_type,
  'contribution:' || contribution.id::text as node_key,
  contribution.title as label,
  '/companies/' || contribution.company_slug as href,
  contribution.company_slug as parent_key,
  1::integer as weight
from public.industry_company_contributions contribution
where contribution.status = 'approved'
  and contribution.published_at is not null;

create or replace view public.industry_connection_graph_edges
with (security_invoker = true)
as
select 'integrations'::text as source_key, 'industry'::text as target_key, 'routes_to'::text as relation, 1::integer as weight
union all
select 'industry'::text, 'companies'::text, 'builds_profiles'::text, 1::integer
union all
select 'industry'::text, 'verified-products'::text, 'contributes_evidence'::text, 1::integer
union all
select 'industry'::text, 'medicines'::text, 'enriches_encyclopedia'::text, 1::integer
union all
select 'industry'::text, 'workspace'::text, 'connects_partnerships'::text, 1::integer
union all
select
  'industry'::text,
  profile.company_slug,
  'verifies_profile'::text,
  1::integer
from public.industry_company_profiles profile
where profile.verification_status = 'verified'
  and profile.is_public = true
union all
select
  contribution.company_slug,
  'contribution:' || contribution.id::text,
  'publishes_contribution'::text,
  1::integer
from public.industry_company_contributions contribution
where contribution.status = 'approved'
  and contribution.published_at is not null
union all
select
  'contribution:' || contribution.id::text,
  'verified-products'::text,
  case contribution.contribution_type
    when 'product_addition' then 'proposes_product'
    when 'product_update' then 'proposes_update'
    when 'evidence' then 'adds_evidence'
    when 'correction' then 'proposes_correction'
    when 'educational_resource' then 'adds_resource'
    when 'patient_support_program' then 'connects_support_program'
    when 'partnership_opportunity' then 'connects_partnership'
    else 'contributes'
  end::text,
  1::integer
from public.industry_company_contributions contribution
where contribution.status = 'approved'
  and contribution.published_at is not null;

revoke all on public.industry_connection_graph_nodes from public;
revoke all on public.industry_connection_graph_edges from public;
grant select on public.industry_connection_graph_nodes to anon, authenticated, service_role;
grant select on public.industry_connection_graph_edges to anon, authenticated, service_role;

notify pgrst, 'reload schema';
