-- Harden public company resolution, index governance relationships, and make
-- unmerge restore the original official slug from the immutable audit snapshot.

create index if not exists company_directory_aliases_reviewed_by_idx
  on public.company_directory_aliases(reviewed_by);
create index if not exists company_directory_pair_reviews_reviewed_by_idx
  on public.company_directory_pair_reviews(reviewed_by);
create index if not exists company_directory_overrides_updated_by_idx
  on public.company_directory_overrides(updated_by);
create index if not exists company_directory_merge_audit_performed_by_idx
  on private.company_directory_merge_audit(performed_by);

drop policy if exists company_directory_aliases_admin_all on public.company_directory_aliases;
drop policy if exists company_directory_aliases_admin_insert on public.company_directory_aliases;
create policy company_directory_aliases_admin_insert on public.company_directory_aliases
  for insert to authenticated with check ((select private.is_platform_admin()));
drop policy if exists company_directory_aliases_admin_update on public.company_directory_aliases;
create policy company_directory_aliases_admin_update on public.company_directory_aliases
  for update to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
drop policy if exists company_directory_aliases_admin_delete on public.company_directory_aliases;
create policy company_directory_aliases_admin_delete on public.company_directory_aliases
  for delete to authenticated using ((select private.is_platform_admin()));
drop policy if exists company_directory_aliases_public_resolution on public.company_directory_aliases;
create policy company_directory_aliases_public_resolution on public.company_directory_aliases
  for select to anon,authenticated using (is_active=true);

drop policy if exists company_directory_overrides_admin_all on public.company_directory_overrides;
drop policy if exists company_directory_overrides_admin_insert on public.company_directory_overrides;
create policy company_directory_overrides_admin_insert on public.company_directory_overrides
  for insert to authenticated with check ((select private.is_platform_admin()));
drop policy if exists company_directory_overrides_admin_update on public.company_directory_overrides;
create policy company_directory_overrides_admin_update on public.company_directory_overrides
  for update to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
drop policy if exists company_directory_overrides_admin_delete on public.company_directory_overrides;
create policy company_directory_overrides_admin_delete on public.company_directory_overrides
  for delete to authenticated using ((select private.is_platform_admin()));
drop policy if exists company_directory_overrides_public_resolution on public.company_directory_overrides;
create policy company_directory_overrides_public_resolution on public.company_directory_overrides
  for select to anon,authenticated using (true);

drop policy if exists company_directory_pair_reviews_admin_all on public.company_directory_pair_reviews;
drop policy if exists company_directory_pair_reviews_admin_select on public.company_directory_pair_reviews;
create policy company_directory_pair_reviews_admin_select on public.company_directory_pair_reviews
  for select to authenticated using ((select private.is_platform_admin()));
drop policy if exists company_directory_pair_reviews_admin_insert on public.company_directory_pair_reviews;
create policy company_directory_pair_reviews_admin_insert on public.company_directory_pair_reviews
  for insert to authenticated with check ((select private.is_platform_admin()));
drop policy if exists company_directory_pair_reviews_admin_update on public.company_directory_pair_reviews;
create policy company_directory_pair_reviews_admin_update on public.company_directory_pair_reviews
  for update to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
drop policy if exists company_directory_pair_reviews_admin_delete on public.company_directory_pair_reviews;
create policy company_directory_pair_reviews_admin_delete on public.company_directory_pair_reviews
  for delete to authenticated using ((select private.is_platform_admin()));

grant select(
  source_company_slug,canonical_company_slug,source_company_name,
  canonical_company_name,merge_classification,is_active
) on public.company_directory_aliases to anon,authenticated;
grant select(
  company_slug,display_name,company_type,description,website_url,logo_url,
  country,city,full_address,contact_email,mobile_phone,
  whatsapp_same_as_mobile,whatsapp_phone,is_hidden
) on public.company_directory_overrides to anon,authenticated;

drop view if exists public.company_directory_resolutions_v1;
create view public.company_directory_resolutions_v1
with (security_invoker=true,security_barrier=true)
as
with affected as (
  select source_company_slug as source_slug
  from public.company_directory_aliases where is_active
  union
  select canonical_company_slug
  from public.company_directory_aliases where is_active
  union
  select company_slug from public.company_directory_overrides
), resolved as (
  select affected.source_slug,
         coalesce(alias.canonical_company_slug,affected.source_slug) as canonical_slug,
         alias.source_company_name,
         alias.canonical_company_name,
         alias.merge_classification,
         alias.is_active as source_is_alias
  from affected
  left join public.company_directory_aliases alias
    on alias.source_company_slug=affected.source_slug and alias.is_active
), stats as (
  select coalesce(alias.canonical_company_slug,relationship.company_slug) as canonical_slug,
         count(distinct relationship.canonical_id)::integer as canonical_product_count,
         array_agg(distinct relationship.company_slug order by relationship.company_slug) as portfolio_slugs
  from public.medicine_product_company_relationships relationship
  left join public.company_directory_aliases alias
    on alias.source_company_slug=relationship.company_slug and alias.is_active
  group by 1
), alias_groups as (
  select canonical_company_slug as canonical_slug,
         array_agg(source_company_slug order by source_company_slug) as alias_slugs
  from public.company_directory_aliases
  where is_active
  group by canonical_company_slug
)
select resolved.source_slug as source_company_slug,
       resolved.canonical_slug as canonical_company_slug,
       coalesce(override.display_name,official.display_name,dataset.company_name,
                resolved.canonical_company_name,resolved.source_company_name) as display_name,
       coalesce(override.company_type,official.company_type) as company_type,
       coalesce(override.description,official.description) as description,
       coalesce(override.website_url,official.website_url) as website_url,
       coalesce(override.logo_url,official.logo_url) as logo_url,
       coalesce(override.country,official.country,dataset.origin) as country,
       coalesce(override.city,official.city) as city,
       coalesce(override.full_address,official.full_address) as full_address,
       coalesce(override.contact_email,official.contact_email) as contact_email,
       coalesce(override.mobile_phone,official.mobile_phone) as mobile_phone,
       coalesce(override.whatsapp_same_as_mobile,official.whatsapp_same_as_mobile,true) as whatsapp_same_as_mobile,
       coalesce(override.whatsapp_phone,official.whatsapp_phone) as whatsapp_phone,
       coalesce(override.is_hidden,false) as is_hidden,
       coalesce(stats.canonical_product_count,dataset.product_count,0) as canonical_product_count,
       coalesce(alias_groups.alias_slugs,'{}'::text[]) as alias_slugs,
       coalesce(stats.portfolio_slugs,'{}'::text[]) as portfolio_slugs,
       coalesce(official.verification_status='verified',false) as official_verified,
       coalesce(resolved.source_is_alias,false) as source_is_alias,
       resolved.merge_classification
from resolved
left join public.company_directory_overrides override
  on override.company_slug=resolved.canonical_slug
left join public.industry_company_profiles official
  on official.company_slug=resolved.canonical_slug
left join public.medicine_company_profiles dataset
  on dataset.company_slug=resolved.canonical_slug
left join stats on stats.canonical_slug=resolved.canonical_slug
left join alias_groups on alias_groups.canonical_slug=resolved.canonical_slug;
grant select on public.company_directory_resolutions_v1 to anon,authenticated;

create or replace function public.admin_unmerge_company_profile(
  p_source_slug text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  alias_row public.company_directory_aliases%rowtype;
  audit_snapshot jsonb;
  original_profile jsonb;
  original_profile_id uuid;
  original_slug text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required.' using errcode='42501';
  end if;
  select * into alias_row
  from public.company_directory_aliases
  where source_company_slug=p_source_slug and is_active
  for update;
  if not found then
    raise exception 'Active merge alias not found.' using errcode='P0002';
  end if;
  select before_snapshot into audit_snapshot
  from private.company_directory_merge_audit
  where action='merge' and source_company_slug=p_source_slug
  order by created_at desc
  limit 1;
  original_profile:=audit_snapshot->'source'->'official';
  if original_profile is not null and original_profile<>'null'::jsonb then
    original_profile_id:=(original_profile->>'id')::uuid;
    original_slug:=coalesce(original_profile->>'company_slug',p_source_slug);
    if exists(
      select 1 from public.industry_company_profiles
      where company_slug=original_slug and id<>original_profile_id
    ) then
      raise exception 'The original official slug is now occupied; resolve that identity first.' using errcode='23505';
    end if;
    update public.industry_company_profiles
    set company_slug=original_slug,
        verification_status=coalesce(original_profile->>'verification_status',verification_status),
        is_public=coalesce((original_profile->>'is_public')::boolean,is_public),
        merged_into_company_slug=null,
        updated_at=now()
    where id=original_profile_id;
    update public.industry_company_profile_claims
    set company_slug=original_slug
    where profile_id=original_profile_id;
  end if;
  update public.company_directory_aliases
  set is_active=false,
      reason=coalesce(nullif(trim(p_reason),''),reason),
      updated_at=now(),
      reviewed_by=auth.uid(),
      reviewed_at=now()
  where source_company_slug=p_source_slug;
  insert into private.company_directory_merge_audit(
    action,source_company_slug,canonical_company_slug,classification,notes,
    before_snapshot,after_snapshot,performed_by
  ) values (
    'unmerge',p_source_slug,alias_row.canonical_company_slug,
    alias_row.merge_classification,p_reason,
    private.company_directory_snapshot(p_source_slug),
    private.company_directory_snapshot(alias_row.canonical_company_slug),
    auth.uid()
  );
  return jsonb_build_object(
    'source_company_slug',p_source_slug,
    'unmerged',true,
    'restored_official_slug',original_slug
  );
end;
$$;
revoke all on function public.admin_unmerge_company_profile(text,text) from public,anon;
grant execute on function public.admin_unmerge_company_profile(text,text) to authenticated,service_role;
