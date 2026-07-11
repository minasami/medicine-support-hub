create schema if not exists private;

create table if not exists public.industry_company_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_slug text not null,
  display_name text not null,
  company_type text not null default 'pharma_company'
    check (company_type in (
      'pharma_company',
      'medical_products_company',
      'medical_device_company',
      'diagnostics_company',
      'biotech_company',
      'supplier',
      'distributor',
      'healthcare_company'
    )),
  description text,
  website_url text,
  logo_url text,
  country text,
  city text,
  contact_email text,
  therapeutic_areas text[] not null default '{}',
  product_categories text[] not null default '{}',
  capabilities text[] not null default '{}',
  support_programs text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','suspended','rejected')),
  is_public boolean not null default false,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id),
  unique (company_slug),
  unique (id, organization_id, company_slug),
  check (company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (jsonb_typeof(social_links) = 'object'),
  check (not is_public or verification_status = 'verified')
);

create table if not exists public.industry_company_profile_claims (
  id uuid primary key default gen_random_uuid(),
  company_slug text,
  proposed_company_name text not null,
  company_type text not null default 'pharma_company'
    check (company_type in (
      'pharma_company',
      'medical_products_company',
      'medical_device_company',
      'diagnostics_company',
      'biotech_company',
      'supplier',
      'distributor',
      'healthcare_company'
    )),
  country text,
  city text,
  work_email text not null,
  role_title text,
  website text,
  evidence_url text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','withdrawn')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  profile_id uuid references public.industry_company_profiles(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(proposed_company_name)) >= 2),
  check (position('@' in work_email) > 1),
  check (company_slug is null or company_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index if not exists industry_company_profile_claims_open_request_key
  on public.industry_company_profile_claims (
    requested_by,
    coalesce(company_slug, lower(trim(proposed_company_name)))
  )
  where status in ('pending','under_review');

create table if not exists public.industry_company_contributions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  organization_id uuid not null,
  company_slug text not null,
  contribution_type text not null
    check (contribution_type in (
      'product_addition',
      'product_update',
      'evidence',
      'correction',
      'educational_resource',
      'patient_support_program',
      'partnership_opportunity'
    )),
  title text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  evidence_urls text[] not null default '{}',
  status text not null default 'submitted'
    check (status in ('submitted','under_review','approved','rejected','withdrawn')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, organization_id, company_slug)
    references public.industry_company_profiles(id, organization_id, company_slug)
    on delete cascade,
  check (length(trim(title)) >= 3),
  check (length(trim(summary)) >= 10),
  check (jsonb_typeof(payload) = 'object')
);

create index if not exists industry_company_profiles_public_idx
  on public.industry_company_profiles (verification_status, is_public, company_slug);
create index if not exists industry_company_profile_claims_requester_idx
  on public.industry_company_profile_claims (requested_by, created_at desc);
create index if not exists industry_company_profile_claims_status_idx
  on public.industry_company_profile_claims (status, created_at asc);
create index if not exists industry_company_contributions_company_idx
  on public.industry_company_contributions (company_slug, status, published_at desc);
create index if not exists industry_company_contributions_org_idx
  on public.industry_company_contributions (organization_id, created_at desc);
create index if not exists industry_company_contributions_submitter_idx
  on public.industry_company_contributions (submitted_by, created_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.industry_company_slug(value text)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

drop trigger if exists industry_company_profiles_touch_updated_at on public.industry_company_profiles;
create trigger industry_company_profiles_touch_updated_at
before update on public.industry_company_profiles
for each row execute function private.touch_updated_at();

drop trigger if exists industry_company_profile_claims_touch_updated_at on public.industry_company_profile_claims;
create trigger industry_company_profile_claims_touch_updated_at
before update on public.industry_company_profile_claims
for each row execute function private.touch_updated_at();

drop trigger if exists industry_company_contributions_touch_updated_at on public.industry_company_contributions;
create trigger industry_company_contributions_touch_updated_at
before update on public.industry_company_contributions
for each row execute function private.touch_updated_at();

alter table public.industry_company_profiles enable row level security;
alter table public.industry_company_profile_claims enable row level security;
alter table public.industry_company_contributions enable row level security;

revoke all on table public.industry_company_profiles from anon, authenticated;
revoke all on table public.industry_company_profile_claims from anon, authenticated;
revoke all on table public.industry_company_contributions from anon, authenticated;

grant select on table public.industry_company_profiles to anon, authenticated;
grant update (
  display_name,
  company_type,
  description,
  website_url,
  logo_url,
  country,
  city,
  contact_email,
  therapeutic_areas,
  product_categories,
  capabilities,
  support_programs,
  social_links
) on table public.industry_company_profiles to authenticated;
grant select, insert on table public.industry_company_profile_claims to authenticated;
grant select on table public.industry_company_contributions to anon, authenticated;
grant insert on table public.industry_company_contributions to authenticated;
grant all on table public.industry_company_profiles to service_role;
grant all on table public.industry_company_profile_claims to service_role;
grant all on table public.industry_company_contributions to service_role;

drop policy if exists industry_company_profiles_public_read on public.industry_company_profiles;
create policy industry_company_profiles_public_read
on public.industry_company_profiles
for select
to anon
using (is_public = true and verification_status = 'verified');

drop policy if exists industry_company_profiles_authenticated_read on public.industry_company_profiles;
create policy industry_company_profiles_authenticated_read
on public.industry_company_profiles
for select
to authenticated
using (
  (is_public = true and verification_status = 'verified')
  or (select private.is_platform_admin())
  or (select private.is_org_member(organization_id))
);

drop policy if exists industry_company_profiles_member_update on public.industry_company_profiles;
create policy industry_company_profiles_member_update
on public.industry_company_profiles
for update
to authenticated
using (
  (select private.is_platform_admin())
  or (select private.is_org_member(organization_id))
)
with check (
  (select private.is_platform_admin())
  or (select private.is_org_member(organization_id))
);

drop policy if exists industry_company_profile_claims_read on public.industry_company_profile_claims;
create policy industry_company_profile_claims_read
on public.industry_company_profile_claims
for select
to authenticated
using (
  requested_by = (select auth.uid())
  or (select private.is_platform_admin())
);

drop policy if exists industry_company_profile_claims_insert on public.industry_company_profile_claims;
create policy industry_company_profile_claims_insert
on public.industry_company_profile_claims
for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'pending'
  and organization_id is null
  and profile_id is null
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and (
    company_slug is null
    or exists (
      select 1
      from public.medicine_company_profiles source_profile
      where source_profile.company_slug = industry_company_profile_claims.company_slug
    )
  )
);

drop policy if exists industry_company_contributions_public_read on public.industry_company_contributions;
create policy industry_company_contributions_public_read
on public.industry_company_contributions
for select
to anon
using (status = 'approved' and published_at is not null);

drop policy if exists industry_company_contributions_authenticated_read on public.industry_company_contributions;
create policy industry_company_contributions_authenticated_read
on public.industry_company_contributions
for select
to authenticated
using (
  (status = 'approved' and published_at is not null)
  or submitted_by = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.is_org_member(organization_id))
);

drop policy if exists industry_company_contributions_member_insert on public.industry_company_contributions;
create policy industry_company_contributions_member_insert
on public.industry_company_contributions
for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and published_at is null
  and (select private.is_org_member(organization_id))
);

create or replace function private.review_industry_company_claim(
  target_claim uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_profile_claims
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  claim_row public.industry_company_profile_claims%rowtype;
  result_row public.industry_company_profile_claims%rowtype;
  next_slug text;
  next_org_slug text;
  next_org_id uuid;
  next_profile_id uuid;
  source_company_name text;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can review company claims.' using errcode = '42501';
  end if;

  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into claim_row
  from public.industry_company_profile_claims
  where id = target_claim
  for update;

  if not found then
    raise exception 'Company claim not found.' using errcode = 'P0002';
  end if;

  if claim_row.status not in ('pending','under_review') then
    raise exception 'This company claim has already been reviewed.' using errcode = '22023';
  end if;

  if decision = 'rejected' then
    update public.industry_company_profile_claims
    set status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = reviewer_notes
    where id = target_claim
    returning * into result_row;
    return result_row;
  end if;

  next_slug := nullif(trim(claim_row.company_slug), '');
  if next_slug is null then
    next_slug := private.industry_company_slug(claim_row.proposed_company_name);
  end if;
  if next_slug is null then
    next_slug := 'company-' || substr(claim_row.id::text, 1, 8);
  end if;

  if exists (
    select 1
    from public.industry_company_profiles existing_profile
    where existing_profile.company_slug = next_slug
  ) then
    raise exception 'This company profile is already claimed.' using errcode = '23505';
  end if;

  if claim_row.company_slug is not null then
    select company_name into source_company_name
    from public.medicine_company_profiles
    where company_slug = claim_row.company_slug
    limit 1;
    if source_company_name is null then
      raise exception 'The source company profile no longer exists.' using errcode = '23503';
    end if;
  end if;

  next_org_slug := 'industry-' || next_slug;
  if exists (select 1 from public.organizations o where o.slug = next_org_slug) then
    next_org_slug := next_org_slug || '-' || substr(claim_row.id::text, 1, 8);
  end if;

  insert into public.organizations (
    name,
    organization_type,
    country,
    city,
    contact_email,
    website,
    slug,
    is_active
  ) values (
    coalesce(source_company_name, claim_row.proposed_company_name),
    claim_row.company_type,
    claim_row.country,
    claim_row.city,
    claim_row.work_email,
    claim_row.website,
    next_org_slug,
    true
  )
  returning id into next_org_id;

  insert into public.industry_company_profiles (
    organization_id,
    company_slug,
    display_name,
    company_type,
    website_url,
    country,
    city,
    contact_email,
    verification_status,
    is_public,
    verified_by,
    verified_at
  ) values (
    next_org_id,
    next_slug,
    coalesce(source_company_name, claim_row.proposed_company_name),
    claim_row.company_type,
    claim_row.website,
    claim_row.country,
    claim_row.city,
    claim_row.work_email,
    'verified',
    true,
    auth.uid(),
    now()
  )
  returning id into next_profile_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    is_active
  ) values (
    next_org_id,
    claim_row.requested_by,
    'company_admin',
    true
  )
  on conflict (organization_id, user_id)
  do update set role = excluded.role, is_active = true;

  update public.industry_company_profile_claims
  set status = 'approved',
      organization_id = next_org_id,
      profile_id = next_profile_id,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = reviewer_notes
  where id = target_claim
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.review_industry_company_claim(
  target_claim uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_profile_claims
language sql
security invoker
set search_path = private, public, pg_catalog
as $$
  select private.review_industry_company_claim(target_claim, decision, reviewer_notes);
$$;

create or replace function private.review_industry_company_contribution(
  target_contribution uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_contributions
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  contribution_row public.industry_company_contributions%rowtype;
  result_row public.industry_company_contributions%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can review company contributions.' using errcode = '42501';
  end if;

  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into contribution_row
  from public.industry_company_contributions
  where id = target_contribution
  for update;

  if not found then
    raise exception 'Company contribution not found.' using errcode = 'P0002';
  end if;

  if contribution_row.status not in ('submitted','under_review') then
    raise exception 'This contribution has already been reviewed.' using errcode = '22023';
  end if;

  update public.industry_company_contributions
  set status = decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = reviewer_notes,
      published_at = case when decision = 'approved' then now() else null end
  where id = target_contribution
  returning * into result_row;

  return result_row;
end;
$$;

create or replace function public.review_industry_company_contribution(
  target_contribution uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_contributions
language sql
security invoker
set search_path = private, public, pg_catalog
as $$
  select private.review_industry_company_contribution(target_contribution, decision, reviewer_notes);
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.industry_company_slug(text) from public, anon, authenticated;
revoke all on function private.review_industry_company_claim(uuid, text, text) from public, anon, authenticated;
revoke all on function private.review_industry_company_contribution(uuid, text, text) from public, anon, authenticated;
revoke all on function public.review_industry_company_claim(uuid, text, text) from public, anon;
revoke all on function public.review_industry_company_contribution(uuid, text, text) from public, anon;
grant execute on function public.review_industry_company_claim(uuid, text, text) to authenticated, service_role;
grant execute on function public.review_industry_company_contribution(uuid, text, text) to authenticated, service_role;

grant usage on schema private to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
