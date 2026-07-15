-- Rich company contact fields plus reversible company-directory identity governance.
-- Dataset rows are never destructively deleted. Admin merges create canonical aliases,
-- preserve an audit snapshot, and can be reversed.

alter table public.industry_company_profile_claims
  add column if not exists full_address text,
  add column if not exists mobile_phone text,
  add column if not exists whatsapp_same_as_mobile boolean not null default true,
  add column if not exists whatsapp_phone text;

alter table public.industry_company_profiles
  add column if not exists full_address text,
  add column if not exists mobile_phone text,
  add column if not exists whatsapp_same_as_mobile boolean not null default true,
  add column if not exists whatsapp_phone text,
  add column if not exists merged_into_company_slug text;

alter table public.organizations
  add column if not exists full_address text,
  add column if not exists whatsapp_phone text,
  add column if not exists whatsapp_same_as_contact_phone boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='industry_claim_mobile_phone_format') then
    alter table public.industry_company_profile_claims add constraint industry_claim_mobile_phone_format
      check (mobile_phone is null or length(regexp_replace(mobile_phone,'[^0-9]','','g')) between 7 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conname='industry_claim_whatsapp_phone_format') then
    alter table public.industry_company_profile_claims add constraint industry_claim_whatsapp_phone_format
      check (whatsapp_phone is null or length(regexp_replace(whatsapp_phone,'[^0-9]','','g')) between 7 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conname='industry_claim_whatsapp_required') then
    alter table public.industry_company_profile_claims add constraint industry_claim_whatsapp_required
      check (whatsapp_same_as_mobile or nullif(trim(whatsapp_phone),'') is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname='industry_profile_mobile_phone_format') then
    alter table public.industry_company_profiles add constraint industry_profile_mobile_phone_format
      check (mobile_phone is null or length(regexp_replace(mobile_phone,'[^0-9]','','g')) between 7 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conname='industry_profile_whatsapp_phone_format') then
    alter table public.industry_company_profiles add constraint industry_profile_whatsapp_phone_format
      check (whatsapp_phone is null or length(regexp_replace(whatsapp_phone,'[^0-9]','','g')) between 7 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conname='industry_profile_whatsapp_required') then
    alter table public.industry_company_profiles add constraint industry_profile_whatsapp_required
      check (whatsapp_same_as_mobile or nullif(trim(whatsapp_phone),'') is not null);
  end if;
end $$;

grant update(full_address,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone)
  on public.industry_company_profiles to authenticated;

-- Permit an official profile slug to follow a canonical merge while preserving
-- its contributions through ON UPDATE CASCADE.
alter table public.industry_company_contributions
  drop constraint if exists industry_company_contributions_profile_id_organization_id_company_slug_fkey;
alter table public.industry_company_contributions
  add constraint industry_company_contributions_profile_id_organization_id_company_slug_fkey
  foreign key(profile_id,organization_id,company_slug)
  references public.industry_company_profiles(id,organization_id,company_slug)
  on update cascade on delete cascade;

create table if not exists public.company_directory_aliases (
  source_company_slug text primary key,
  canonical_company_slug text not null,
  source_company_name text,
  canonical_company_name text,
  merge_classification text not null default 'duplicate'
    check (merge_classification in ('duplicate','same_legal_entity','legacy_alias','administrative_consolidation','other')),
  reason text not null,
  is_active boolean not null default true,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (canonical_company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (source_company_slug <> canonical_company_slug),
  check (length(trim(reason)) >= 3)
);

create index if not exists company_directory_aliases_canonical_idx
  on public.company_directory_aliases(canonical_company_slug)
  where is_active;

create table if not exists public.company_directory_pair_reviews (
  left_company_slug text not null,
  right_company_slug text not null,
  decision text not null check (decision in ('merged','not_duplicate','related_distinct')),
  notes text,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(left_company_slug,right_company_slug),
  check (left_company_slug < right_company_slug)
);

create table if not exists public.company_directory_overrides (
  company_slug text primary key,
  display_name text,
  company_type text,
  description text,
  website_url text,
  logo_url text,
  country text,
  city text,
  full_address text,
  contact_email text,
  mobile_phone text,
  whatsapp_same_as_mobile boolean not null default true,
  whatsapp_phone text,
  is_hidden boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (mobile_phone is null or length(regexp_replace(mobile_phone,'[^0-9]','','g')) between 7 and 16),
  check (whatsapp_phone is null or length(regexp_replace(whatsapp_phone,'[^0-9]','','g')) between 7 and 16),
  check (whatsapp_same_as_mobile or nullif(trim(whatsapp_phone),'') is not null)
);

create table if not exists private.company_directory_merge_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('merge','unmerge','mark_distinct','edit')),
  source_company_slug text,
  canonical_company_slug text,
  classification text,
  notes text,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  performed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.company_directory_aliases enable row level security;
alter table public.company_directory_pair_reviews enable row level security;
alter table public.company_directory_overrides enable row level security;
revoke all on public.company_directory_aliases from public,anon,authenticated;
revoke all on public.company_directory_pair_reviews from public,anon,authenticated;
revoke all on public.company_directory_overrides from public,anon,authenticated;
revoke all on private.company_directory_merge_audit from public,anon,authenticated;
grant select,insert,update,delete on public.company_directory_aliases to authenticated;
grant select,insert,update,delete on public.company_directory_pair_reviews to authenticated;
grant select,insert,update,delete on public.company_directory_overrides to authenticated;

create policy company_directory_aliases_admin_all on public.company_directory_aliases
  for all to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy company_directory_pair_reviews_admin_all on public.company_directory_pair_reviews
  for all to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));
create policy company_directory_overrides_admin_all on public.company_directory_overrides
  for all to authenticated using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create or replace function private.normalize_company_identity(value text)
returns text language sql immutable security invoker set search_path=pg_catalog as $$
  select lower(regexp_replace(coalesce(value,''),'[^[:alnum:]]','','g'));
$$;

create or replace function private.company_directory_entry_exists(target_slug text)
returns boolean language sql stable security definer
set search_path=public,pg_catalog as $$
  select exists(select 1 from public.medicine_company_profiles where company_slug=target_slug)
      or exists(select 1 from public.industry_company_profiles where company_slug=target_slug)
      or exists(select 1 from public.company_directory_overrides where company_slug=target_slug);
$$;
revoke all on function private.company_directory_entry_exists(text) from public,anon,authenticated;

create or replace function private.company_directory_snapshot(target_slug text)
returns jsonb language sql stable security definer
set search_path=public,pg_catalog as $$
  select jsonb_build_object(
    'slug',target_slug,
    'dataset',(select to_jsonb(row) from (select company_name,company_slug,origin,source_name,product_count,dataset_metadata from public.medicine_company_profiles where company_slug=target_slug limit 1) row),
    'official',(select to_jsonb(row) from (select id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,verification_status,is_public,merged_into_company_slug from public.industry_company_profiles where company_slug=target_slug limit 1) row),
    'override',(select to_jsonb(row) from (select * from public.company_directory_overrides where company_slug=target_slug limit 1) row),
    'alias',(select to_jsonb(row) from (select * from public.company_directory_aliases where source_company_slug=target_slug limit 1) row)
  );
$$;
revoke all on function private.company_directory_snapshot(text) from public,anon,authenticated;

create or replace view public.company_directory_resolutions_v1
with (security_barrier=true)
as
with affected as (
  select source_company_slug as source_slug from public.company_directory_aliases where is_active
  union select canonical_company_slug from public.company_directory_aliases where is_active
  union select company_slug from public.company_directory_overrides
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
  select coalesce(alias.canonical_company_slug,relation.company_slug) as canonical_slug,
         count(distinct relation.canonical_id)::integer as canonical_product_count,
         array_agg(distinct relation.company_slug order by relation.company_slug) as portfolio_slugs
  from public.medicine_product_company_relationships relation
  left join public.company_directory_aliases alias
    on alias.source_company_slug=relation.company_slug and alias.is_active
  group by 1
), alias_groups as (
  select canonical_company_slug as canonical_slug,
         array_agg(source_company_slug order by source_company_slug) as alias_slugs
  from public.company_directory_aliases where is_active
  group by canonical_company_slug
)
select resolved.source_slug as source_company_slug,
       resolved.canonical_slug as canonical_company_slug,
       coalesce(override.display_name,official.display_name,dataset.company_name,resolved.canonical_company_name,resolved.source_company_name) as display_name,
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
left join public.company_directory_overrides override on override.company_slug=resolved.canonical_slug
left join public.industry_company_profiles official on official.company_slug=resolved.canonical_slug
left join public.medicine_company_profiles dataset on dataset.company_slug=resolved.canonical_slug
left join stats on stats.canonical_slug=resolved.canonical_slug
left join alias_groups on alias_groups.canonical_slug=resolved.canonical_slug;

grant select on public.company_directory_resolutions_v1 to anon,authenticated;

create or replace function public.search_company_directory_admin(p_query text default null,p_limit integer default 50)
returns setof jsonb language plpgsql stable security definer
set search_path=public,private,pg_catalog as $$
declare q text:=private.normalize_company_identity(coalesce(p_query,''));
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  return query
  with slugs as (
    select company_slug from public.medicine_company_profiles
    union select company_slug from public.industry_company_profiles
    union select company_slug from public.company_directory_overrides
  ), entries as (
    select s.company_slug,
      coalesce(o.display_name,i.display_name,d.company_name,s.company_slug) as display_name,
      d.company_name as dataset_name,d.source_name,d.product_count,
      i.id as official_profile_id,i.organization_id,i.verification_status,i.is_public,
      coalesce(o.company_type,i.company_type) as company_type,
      coalesce(o.website_url,i.website_url) as website_url,
      coalesce(o.country,i.country,d.origin) as country,
      coalesce(o.city,i.city) as city,
      coalesce(o.full_address,i.full_address) as full_address,
      coalesce(o.contact_email,i.contact_email) as contact_email,
      coalesce(o.mobile_phone,i.mobile_phone) as mobile_phone,
      coalesce(o.whatsapp_same_as_mobile,i.whatsapp_same_as_mobile,true) as whatsapp_same_as_mobile,
      coalesce(o.whatsapp_phone,i.whatsapp_phone) as whatsapp_phone,
      coalesce(a.canonical_company_slug,s.company_slug) as canonical_company_slug,
      a.is_active is true as is_alias,
      coalesce(o.is_hidden,false) as is_hidden
    from slugs s
    left join public.medicine_company_profiles d using(company_slug)
    left join public.industry_company_profiles i using(company_slug)
    left join public.company_directory_overrides o using(company_slug)
    left join public.company_directory_aliases a on a.source_company_slug=s.company_slug and a.is_active
  )
  select jsonb_build_object(
    'company_slug',e.company_slug,'display_name',e.display_name,'dataset_name',e.dataset_name,
    'source_name',e.source_name,'product_count',coalesce(e.product_count,0),
    'official_profile_id',e.official_profile_id,'organization_id',e.organization_id,
    'verification_status',e.verification_status,'is_public',e.is_public,
    'company_type',e.company_type,'website_url',e.website_url,'country',e.country,'city',e.city,
    'full_address',e.full_address,'contact_email',e.contact_email,'mobile_phone',e.mobile_phone,
    'whatsapp_same_as_mobile',e.whatsapp_same_as_mobile,'whatsapp_phone',e.whatsapp_phone,
    'canonical_company_slug',e.canonical_company_slug,'is_alias',e.is_alias,'is_hidden',e.is_hidden
  )
  from entries e
  where q='' or private.normalize_company_identity(e.display_name) like '%'||q||'%'
     or private.normalize_company_identity(coalesce(e.dataset_name,'')) like '%'||q||'%'
     or private.normalize_company_identity(e.company_slug) like '%'||q||'%'
  order by (private.normalize_company_identity(e.display_name)=q) desc,
           (private.normalize_company_identity(e.display_name) like q||'%') desc,
           (e.official_profile_id is not null) desc,coalesce(e.product_count,0) desc,e.display_name
  limit greatest(1,least(coalesce(p_limit,50),200));
end;
$$;
revoke all on function public.search_company_directory_admin(text,integer) from public,anon;
grant execute on function public.search_company_directory_admin(text,integer) to authenticated,service_role;

create or replace function public.list_company_duplicate_candidates(p_limit integer default 100)
returns setof jsonb language plpgsql stable security definer
set search_path=public,private,pg_catalog as $$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  return query
  with slugs as (
    select company_slug from public.medicine_company_profiles
    union select company_slug from public.industry_company_profiles
  ), entries as (
    select s.company_slug,
      coalesce(i.display_name,d.company_name,s.company_slug) as display_name,
      coalesce(d.product_count,0) as product_count,
      i.id is not null as official,
      private.normalize_company_identity(coalesce(i.display_name,d.company_name,s.company_slug)) as identity_key
    from slugs s
    left join public.medicine_company_profiles d using(company_slug)
    left join public.industry_company_profiles i using(company_slug)
  ), pairs as (
    select left_entry.*,right_entry.company_slug as right_slug,right_entry.display_name as right_name,
      right_entry.product_count as right_products,right_entry.official as right_official
    from entries left_entry
    join entries right_entry on left_entry.company_slug<right_entry.company_slug
      and left_entry.identity_key<>'' and left_entry.identity_key=right_entry.identity_key
    where not exists(select 1 from public.company_directory_pair_reviews review
      where review.left_company_slug=left_entry.company_slug and review.right_company_slug=right_entry.company_slug)
      and not exists(select 1 from public.company_directory_aliases alias
      where alias.source_company_slug in (left_entry.company_slug,right_entry.company_slug) and alias.is_active)
  )
  select jsonb_build_object(
    'left_slug',company_slug,'left_name',display_name,'left_products',product_count,'left_official',official,
    'right_slug',right_slug,'right_name',right_name,'right_products',right_products,'right_official',right_official,
    'match_reason','Normalized names match','score',100
  ) from pairs
  order by (official or right_official) desc,(product_count+right_products) desc,display_name
  limit greatest(1,least(coalesce(p_limit,100),300));
end;
$$;
revoke all on function public.list_company_duplicate_candidates(integer) from public,anon;
grant execute on function public.list_company_duplicate_candidates(integer) to authenticated,service_role;

create or replace function public.admin_review_company_pair(
  p_left_slug text,p_right_slug text,p_decision text,p_notes text default null
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare l text:=least(p_left_slug,p_right_slug); r text:=greatest(p_left_slug,p_right_slug);
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  if p_decision not in ('not_duplicate','related_distinct') then raise exception 'Invalid distinct-profile decision.' using errcode='22023'; end if;
  if l=r or not private.company_directory_entry_exists(l) or not private.company_directory_entry_exists(r) then raise exception 'Both company profiles must exist.' using errcode='22023'; end if;
  insert into public.company_directory_pair_reviews(left_company_slug,right_company_slug,decision,notes,reviewed_by)
  values(l,r,p_decision,nullif(trim(p_notes),''),auth.uid())
  on conflict(left_company_slug,right_company_slug) do update set decision=excluded.decision,notes=excluded.notes,reviewed_by=excluded.reviewed_by,reviewed_at=now(),updated_at=now();
  insert into private.company_directory_merge_audit(action,source_company_slug,canonical_company_slug,classification,notes,before_snapshot,after_snapshot,performed_by)
  values('mark_distinct',l,r,p_decision,p_notes,private.company_directory_snapshot(l),private.company_directory_snapshot(r),auth.uid());
  return jsonb_build_object('left_slug',l,'right_slug',r,'decision',p_decision);
end;
$$;
revoke all on function public.admin_review_company_pair(text,text,text,text) from public,anon;
grant execute on function public.admin_review_company_pair(text,text,text,text) to authenticated,service_role;

create or replace function public.admin_merge_company_profiles(
  p_source_slug text,p_target_slug text,p_classification text default 'duplicate',p_reason text default null
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare
  source_slug text:=trim(p_source_slug); target_slug text:=trim(p_target_slug);
  source_profile public.industry_company_profiles%rowtype;
  target_profile public.industry_company_profiles%rowtype;
  before_data jsonb;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  if p_classification not in ('duplicate','same_legal_entity','legacy_alias','administrative_consolidation','other') then raise exception 'Invalid merge classification.' using errcode='22023'; end if;
  if nullif(trim(p_reason),'') is null or length(trim(p_reason))<3 then raise exception 'Document why these profiles should be merged.' using errcode='22023'; end if;
  select canonical_company_slug into target_slug from public.company_directory_aliases where source_company_slug=target_slug and is_active;
  target_slug:=coalesce(target_slug,trim(p_target_slug));
  if source_slug=target_slug then raise exception 'Source and target must be different.' using errcode='22023'; end if;
  if not private.company_directory_entry_exists(source_slug) or not private.company_directory_entry_exists(target_slug) then raise exception 'Both company profiles must exist.' using errcode='22023'; end if;
  before_data:=jsonb_build_object('source',private.company_directory_snapshot(source_slug),'target',private.company_directory_snapshot(target_slug));

  select * into source_profile from public.industry_company_profiles where company_slug=source_slug for update;
  select * into target_profile from public.industry_company_profiles where company_slug=target_slug for update;

  if source_profile.id is not null and target_profile.id is null then
    update public.industry_company_profiles set company_slug=target_slug,merged_into_company_slug=null where id=source_profile.id;
    update public.industry_company_profile_claims set company_slug=target_slug where profile_id=source_profile.id;
  elsif source_profile.id is not null and target_profile.id is not null then
    update public.industry_company_profiles set
      description=coalesce(target_profile.description,source_profile.description),
      website_url=coalesce(target_profile.website_url,source_profile.website_url),
      logo_url=coalesce(target_profile.logo_url,source_profile.logo_url),
      country=coalesce(target_profile.country,source_profile.country),
      city=coalesce(target_profile.city,source_profile.city),
      full_address=coalesce(target_profile.full_address,source_profile.full_address),
      contact_email=coalesce(target_profile.contact_email,source_profile.contact_email),
      mobile_phone=coalesce(target_profile.mobile_phone,source_profile.mobile_phone),
      whatsapp_same_as_mobile=coalesce(target_profile.whatsapp_same_as_mobile,source_profile.whatsapp_same_as_mobile,true),
      whatsapp_phone=coalesce(target_profile.whatsapp_phone,source_profile.whatsapp_phone),
      therapeutic_areas=(select coalesce(array_agg(distinct value order by value),'{}'::text[]) from unnest(target_profile.therapeutic_areas||source_profile.therapeutic_areas) value),
      product_categories=(select coalesce(array_agg(distinct value order by value),'{}'::text[]) from unnest(target_profile.product_categories||source_profile.product_categories) value),
      capabilities=(select coalesce(array_agg(distinct value order by value),'{}'::text[]) from unnest(target_profile.capabilities||source_profile.capabilities) value),
      support_programs=(select coalesce(array_agg(distinct value order by value),'{}'::text[]) from unnest(target_profile.support_programs||source_profile.support_programs) value),
      updated_at=now()
    where id=target_profile.id;
    update public.industry_company_profiles set is_public=false,verification_status='suspended',merged_into_company_slug=target_slug,updated_at=now() where id=source_profile.id;
  end if;

  update public.company_directory_aliases set canonical_company_slug=target_slug,updated_at=now()
  where canonical_company_slug=source_slug and is_active;
  insert into public.company_directory_aliases(source_company_slug,canonical_company_slug,source_company_name,canonical_company_name,merge_classification,reason,is_active,reviewed_by)
  values(source_slug,target_slug,
    coalesce(source_profile.display_name,(select company_name from public.medicine_company_profiles where company_slug=source_slug)),
    coalesce(target_profile.display_name,(select company_name from public.medicine_company_profiles where company_slug=target_slug)),
    p_classification,trim(p_reason),true,auth.uid())
  on conflict(source_company_slug) do update set canonical_company_slug=excluded.canonical_company_slug,source_company_name=excluded.source_company_name,canonical_company_name=excluded.canonical_company_name,merge_classification=excluded.merge_classification,reason=excluded.reason,is_active=true,reviewed_by=excluded.reviewed_by,reviewed_at=now(),updated_at=now();

  insert into public.company_directory_pair_reviews(left_company_slug,right_company_slug,decision,notes,reviewed_by)
  values(least(source_slug,target_slug),greatest(source_slug,target_slug),'merged',trim(p_reason),auth.uid())
  on conflict(left_company_slug,right_company_slug) do update set decision='merged',notes=excluded.notes,reviewed_by=excluded.reviewed_by,reviewed_at=now(),updated_at=now();

  insert into private.company_directory_merge_audit(action,source_company_slug,canonical_company_slug,classification,notes,before_snapshot,after_snapshot,performed_by)
  values('merge',source_slug,target_slug,p_classification,trim(p_reason),before_data,
    jsonb_build_object('source',private.company_directory_snapshot(source_slug),'target',private.company_directory_snapshot(target_slug)),auth.uid());
  return jsonb_build_object('source_company_slug',source_slug,'canonical_company_slug',target_slug,'classification',p_classification,'reversible',true);
end;
$$;
revoke all on function public.admin_merge_company_profiles(text,text,text,text) from public,anon;
grant execute on function public.admin_merge_company_profiles(text,text,text,text) to authenticated,service_role;

create or replace function public.admin_unmerge_company_profile(p_source_slug text,p_reason text default null)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare alias_row public.company_directory_aliases%rowtype; audit_snapshot jsonb;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  select * into alias_row from public.company_directory_aliases where source_company_slug=p_source_slug and is_active for update;
  if not found then raise exception 'Active merge alias not found.' using errcode='P0002'; end if;
  select before_snapshot into audit_snapshot from private.company_directory_merge_audit
    where action='merge' and source_company_slug=p_source_slug order by created_at desc limit 1;
  update public.company_directory_aliases set is_active=false,reason=coalesce(nullif(trim(p_reason),''),reason),updated_at=now(),reviewed_by=auth.uid(),reviewed_at=now() where source_company_slug=p_source_slug;
  if audit_snapshot->'source'->'official' is not null then
    update public.industry_company_profiles set
      verification_status=coalesce(audit_snapshot->'source'->'official'->>'verification_status',verification_status),
      is_public=coalesce((audit_snapshot->'source'->'official'->>'is_public')::boolean,is_public),
      merged_into_company_slug=null,updated_at=now()
    where id=(audit_snapshot->'source'->'official'->>'id')::uuid;
  end if;
  insert into private.company_directory_merge_audit(action,source_company_slug,canonical_company_slug,classification,notes,before_snapshot,after_snapshot,performed_by)
  values('unmerge',p_source_slug,alias_row.canonical_company_slug,alias_row.merge_classification,p_reason,
    private.company_directory_snapshot(p_source_slug),private.company_directory_snapshot(alias_row.canonical_company_slug),auth.uid());
  return jsonb_build_object('source_company_slug',p_source_slug,'unmerged',true);
end;
$$;
revoke all on function public.admin_unmerge_company_profile(text,text) from public,anon;
grant execute on function public.admin_unmerge_company_profile(text,text) to authenticated,service_role;

create or replace function public.admin_upsert_company_directory_override(
  p_company_slug text,p_display_name text default null,p_company_type text default null,p_description text default null,
  p_website_url text default null,p_logo_url text default null,p_country text default null,p_city text default null,
  p_full_address text default null,p_contact_email text default null,p_mobile_phone text default null,
  p_whatsapp_same_as_mobile boolean default true,p_whatsapp_phone text default null,p_is_hidden boolean default false
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare before_data jsonb;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  if not private.company_directory_entry_exists(p_company_slug) then raise exception 'Company profile not found.' using errcode='P0002'; end if;
  if not coalesce(p_whatsapp_same_as_mobile,true) and nullif(trim(p_whatsapp_phone),'') is null then raise exception 'WhatsApp number is required when it differs from the mobile number.' using errcode='22023'; end if;
  before_data:=private.company_directory_snapshot(p_company_slug);
  insert into public.company_directory_overrides(company_slug,display_name,company_type,description,website_url,logo_url,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,is_hidden,updated_by)
  values(p_company_slug,nullif(trim(p_display_name),''),nullif(trim(p_company_type),''),nullif(trim(p_description),''),nullif(trim(p_website_url),''),nullif(trim(p_logo_url),''),nullif(trim(p_country),''),nullif(trim(p_city),''),nullif(trim(p_full_address),''),nullif(trim(p_contact_email),''),nullif(trim(p_mobile_phone),''),coalesce(p_whatsapp_same_as_mobile,true),case when coalesce(p_whatsapp_same_as_mobile,true) then null else nullif(trim(p_whatsapp_phone),'') end,coalesce(p_is_hidden,false),auth.uid())
  on conflict(company_slug) do update set display_name=excluded.display_name,company_type=excluded.company_type,description=excluded.description,website_url=excluded.website_url,logo_url=excluded.logo_url,country=excluded.country,city=excluded.city,full_address=excluded.full_address,contact_email=excluded.contact_email,mobile_phone=excluded.mobile_phone,whatsapp_same_as_mobile=excluded.whatsapp_same_as_mobile,whatsapp_phone=excluded.whatsapp_phone,is_hidden=excluded.is_hidden,updated_by=excluded.updated_by,updated_at=now();
  update public.industry_company_profiles set display_name=coalesce(nullif(trim(p_display_name),''),display_name),company_type=coalesce(nullif(trim(p_company_type),''),company_type),description=nullif(trim(p_description),''),website_url=nullif(trim(p_website_url),''),logo_url=nullif(trim(p_logo_url),''),country=nullif(trim(p_country),''),city=nullif(trim(p_city),''),full_address=nullif(trim(p_full_address),''),contact_email=nullif(trim(p_contact_email),''),mobile_phone=nullif(trim(p_mobile_phone),''),whatsapp_same_as_mobile=coalesce(p_whatsapp_same_as_mobile,true),whatsapp_phone=case when coalesce(p_whatsapp_same_as_mobile,true) then null else nullif(trim(p_whatsapp_phone),'') end,updated_at=now() where company_slug=p_company_slug;
  update public.organizations organization set name=coalesce(nullif(trim(p_display_name),''),organization.name),country=nullif(trim(p_country),''),city=nullif(trim(p_city),''),full_address=nullif(trim(p_full_address),''),contact_email=nullif(trim(p_contact_email),''),contact_phone=nullif(trim(p_mobile_phone),''),whatsapp_same_as_contact_phone=coalesce(p_whatsapp_same_as_mobile,true),whatsapp_phone=case when coalesce(p_whatsapp_same_as_mobile,true) then null else nullif(trim(p_whatsapp_phone),'') end,website=nullif(trim(p_website_url),''),updated_at=now()
  where organization.id=(select profile.organization_id from public.industry_company_profiles profile where profile.company_slug=p_company_slug limit 1);
  insert into private.company_directory_merge_audit(action,source_company_slug,canonical_company_slug,notes,before_snapshot,after_snapshot,performed_by)
  values('edit',p_company_slug,p_company_slug,'Administrative company directory edit',before_data,private.company_directory_snapshot(p_company_slug),auth.uid());
  return private.company_directory_snapshot(p_company_slug);
end;
$$;
revoke all on function public.admin_upsert_company_directory_override(text,text,text,text,text,text,text,text,text,text,text,boolean,text,boolean) from public,anon;
grant execute on function public.admin_upsert_company_directory_override(text,text,text,text,text,text,text,text,text,text,text,boolean,text,boolean) to authenticated,service_role;

-- Company portfolios resolve canonical aliases and include all explicitly merged source slugs.
drop function if exists public.company_medicine_portfolio_page(text,text,integer,integer);
create function public.company_medicine_portfolio_page(p_company_slug text,p_query text default null,p_limit integer default 60,p_offset integer default 0)
returns table(id uuid,product_name text,product_url text,disease_name text,disease_url text,final_price numeric,listed_price_text text,price_currency text,prescription_required text,drug_variant text,company_name text,company_slug text,company_origin text,generic_name text,image_urls text,source_name text,total_count bigint)
language sql stable security invoker set search_path=public,pg_catalog as $$
  with canonical as (
    select coalesce((select canonical_company_slug from public.company_directory_aliases where source_company_slug=p_company_slug and is_active),p_company_slug) as slug
  ), slugs as (
    select slug from canonical
    union select source_company_slug from public.company_directory_aliases,canonical where canonical_company_slug=canonical.slug and is_active
  ), company as (
    select canonical.slug as company_slug,
      coalesce(override.display_name,official.display_name,dataset.company_name,canonical.slug) as company_name,
      coalesce(override.country,official.country,dataset.origin) as origin
    from canonical
    left join public.company_directory_overrides override on override.company_slug=canonical.slug
    left join public.industry_company_profiles official on official.company_slug=canonical.slug
    left join public.medicine_company_profiles dataset on dataset.company_slug=canonical.slug
  ), filtered as (
    select distinct on (medicine.canonical_id) medicine.*,company.company_name,company.company_slug,company.origin
    from public.medicine_product_company_relationships relation
    join slugs on slugs.slug=relation.company_slug
    join public.medicine_encyclopedia_products_v2 medicine on medicine.canonical_id=relation.canonical_id
    cross join company
    where nullif(trim(coalesce(p_query,'')),'') is null
      or coalesce(medicine.name_en,'') ilike '%'||trim(p_query)||'%'
      or coalesce(medicine.name_ar,'') ilike '%'||trim(p_query)||'%'
      or coalesce(medicine.scientific_name,'') ilike '%'||trim(p_query)||'%'
      or coalesce(medicine.drug_class,'') ilike '%'||trim(p_query)||'%'
      or coalesce(medicine.category,'') ilike '%'||trim(p_query)||'%'
    order by medicine.canonical_id
  )
  select md5('canonical-medicine:'||filtered.canonical_id::text)::uuid,
    coalesce(nullif(filtered.name_en,''),nullif(filtered.name_ar,''),'Medicine '||filtered.canonical_id::text),
    '/catalog/'||filtered.canonical_id::text,coalesce(nullif(filtered.drug_class,''),nullif(filtered.category,'')),null::text,
    filtered.current_price_egp,case when filtered.current_price_egp is null then null else filtered.current_price_egp::text||' EGP' end,
    coalesce(filtered.price_currency,'EGP'),null::text,coalesce(nullif(filtered.route,''),nullif(filtered.category,'')),
    filtered.company_name,filtered.company_slug,filtered.origin,filtered.scientific_name,filtered.image_url,
    'Medicine Support Hub canonical encyclopedia',count(*) over()
  from filtered order by filtered.current_price_egp desc nulls last,coalesce(filtered.name_en,filtered.name_ar),filtered.canonical_id
  limit greatest(1,least(coalesce(p_limit,60),200)) offset greatest(coalesce(p_offset,0),0);
$$;
grant execute on function public.company_medicine_portfolio_page(text,text,integer,integer) to anon,authenticated;

-- Enhanced approval: copy address and phone details, resolve aliases, and allow an
-- administrator to approve another representative for an existing verified company.
create or replace function private.review_industry_company_claim(target_claim uuid,decision text,reviewer_notes text default null)
returns public.industry_company_profile_claims language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare
  claim_row public.industry_company_profile_claims%rowtype; result_row public.industry_company_profile_claims%rowtype;
  next_slug text; next_org_slug text; next_org_id uuid; next_profile_id uuid; source_company_name text;
begin
  if not private.is_platform_admin() then raise exception 'Only platform administrators can review company claims.' using errcode='42501'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.' using errcode='22023'; end if;
  select * into claim_row from public.industry_company_profile_claims where id=target_claim for update;
  if not found then raise exception 'Company claim not found.' using errcode='P0002'; end if;
  if claim_row.status not in ('pending','under_review') then raise exception 'This company claim has already been reviewed.' using errcode='22023'; end if;
  if decision='rejected' then
    update public.industry_company_profile_claims set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes where id=target_claim returning * into result_row;
    return result_row;
  end if;
  next_slug:=coalesce(nullif(trim(claim_row.company_slug),''),private.industry_company_slug(claim_row.proposed_company_name),'company-'||substr(claim_row.id::text,1,8));
  select canonical_company_slug into next_slug from public.company_directory_aliases where source_company_slug=next_slug and is_active;
  next_slug:=coalesce(next_slug,coalesce(nullif(trim(claim_row.company_slug),''),private.industry_company_slug(claim_row.proposed_company_name),'company-'||substr(claim_row.id::text,1,8)));

  select id,organization_id into next_profile_id,next_org_id from public.industry_company_profiles where company_slug=next_slug limit 1;
  if next_profile_id is not null then
    insert into public.organization_members(organization_id,user_id,role,is_active) values(next_org_id,claim_row.requested_by,'company_admin',true)
    on conflict(organization_id,user_id) do update set role='company_admin',is_active=true;
    update public.industry_company_profile_claims set status='approved',company_slug=next_slug,organization_id=next_org_id,profile_id=next_profile_id,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes where id=target_claim returning * into result_row;
    return result_row;
  end if;

  if claim_row.company_slug is not null then
    select company_name into source_company_name from public.medicine_company_profiles where company_slug=claim_row.company_slug limit 1;
    if source_company_name is null then raise exception 'The source company profile no longer exists.' using errcode='23503'; end if;
  end if;
  next_org_slug:='industry-'||next_slug;
  if exists(select 1 from public.organizations where slug=next_org_slug) then next_org_slug:=next_org_slug||'-'||substr(claim_row.id::text,1,8); end if;
  insert into public.organizations(name,organization_type,country,city,full_address,contact_email,contact_phone,whatsapp_same_as_contact_phone,whatsapp_phone,website,slug,is_active)
  values(coalesce(source_company_name,claim_row.proposed_company_name),claim_row.company_type,claim_row.country,claim_row.city,claim_row.full_address,claim_row.work_email,claim_row.mobile_phone,claim_row.whatsapp_same_as_mobile,case when claim_row.whatsapp_same_as_mobile then null else claim_row.whatsapp_phone end,claim_row.website,next_org_slug,true)
  returning id into next_org_id;
  insert into public.industry_company_profiles(organization_id,company_slug,display_name,company_type,website_url,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,verification_status,is_public,verified_by,verified_at)
  values(next_org_id,next_slug,coalesce(source_company_name,claim_row.proposed_company_name),claim_row.company_type,claim_row.website,claim_row.country,claim_row.city,claim_row.full_address,claim_row.work_email,claim_row.mobile_phone,claim_row.whatsapp_same_as_mobile,case when claim_row.whatsapp_same_as_mobile then null else claim_row.whatsapp_phone end,'verified',true,auth.uid(),now()) returning id into next_profile_id;
  insert into public.organization_members(organization_id,user_id,role,is_active) values(next_org_id,claim_row.requested_by,'company_admin',true)
  on conflict(organization_id,user_id) do update set role='company_admin',is_active=true;
  update public.industry_company_profile_claims set status='approved',company_slug=next_slug,organization_id=next_org_id,profile_id=next_profile_id,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes where id=target_claim returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.review_industry_company_claim(target_claim uuid,decision text,reviewer_notes text default null)
returns public.industry_company_profile_claims language sql security invoker set search_path=private,public,pg_catalog as $$
  select private.review_industry_company_claim(target_claim,decision,reviewer_notes);
$$;
revoke all on function public.review_industry_company_claim(uuid,text,text) from public,anon;
grant execute on function public.review_industry_company_claim(uuid,text,text) to authenticated,service_role;
