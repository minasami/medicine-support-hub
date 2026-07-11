-- Verified B2B medicine marketplace for pharmacies, warehouses, and distributors.
-- Public discovery exposes approved offers only. Exact inventory and quote conversations remain private.

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin','platform_admin','super_admin')
  );
$$;

create table if not exists public.marketplace_seller_applications (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (length(btrim(business_name)) >= 2),
  seller_type text not null check (seller_type in ('pharmacy','warehouse','distributor')),
  country text,
  city text,
  address text,
  work_email text not null check (position('@' in work_email) > 1),
  contact_phone text,
  website_url text,
  license_number text not null check (length(btrim(license_number)) >= 3),
  license_authority text,
  license_expiry date,
  evidence_urls text[] not null default '{}',
  service_areas text[] not null default '{}',
  advantages text[] not null default '{}',
  notes text,
  status text not null default 'pending' check (status in ('pending','under_review','approved','rejected','withdrawn')),
  submitted_by uuid not null references auth.users(id),
  organization_id uuid references public.organizations(id),
  seller_profile_id uuid,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_seller_applications_active_uidx
  on public.marketplace_seller_applications (submitted_by, lower(btrim(business_name)))
  where status in ('pending','under_review','approved');
create index if not exists marketplace_seller_applications_status_idx
  on public.marketplace_seller_applications (status, created_at);
create index if not exists marketplace_seller_applications_submitted_by_idx
  on public.marketplace_seller_applications (submitted_by, created_at desc);

create table if not exists public.marketplace_seller_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  seller_slug text not null unique check (seller_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (length(btrim(display_name)) >= 2),
  seller_type text not null check (seller_type in ('pharmacy','warehouse','distributor')),
  description text,
  logo_url text,
  country text,
  city text,
  address text,
  contact_email text,
  contact_phone text,
  website_url text,
  license_number text not null,
  license_authority text,
  license_expiry date,
  service_areas text[] not null default '{}',
  fulfillment_modes text[] not null default '{}',
  advantages text[] not null default '{}',
  payment_terms text[] not null default '{}',
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','suspended','rejected')),
  is_public boolean not null default false,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_seller_applications
  drop constraint if exists marketplace_seller_applications_seller_profile_id_fkey;
alter table public.marketplace_seller_applications
  add constraint marketplace_seller_applications_seller_profile_id_fkey
  foreign key (seller_profile_id) references public.marketplace_seller_profiles(id);

create index if not exists marketplace_seller_profiles_public_idx
  on public.marketplace_seller_profiles (verification_status, is_public, seller_type, country, city);

create table if not exists public.marketplace_medicine_offers (
  id uuid primary key default gen_random_uuid(),
  seller_profile_id uuid not null references public.marketplace_seller_profiles(id),
  organization_id uuid not null references public.organizations(id),
  canonical_id bigint not null,
  seller_sku text,
  offer_title text,
  unit_price_egp numeric not null check (unit_price_egp > 0),
  list_price_egp numeric check (list_price_egp is null or list_price_egp > 0),
  minimum_order_quantity numeric not null default 1 check (minimum_order_quantity > 0),
  packaging text,
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock','limited','preorder','out_of_stock')),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  minimum_expiry_months integer check (minimum_expiry_months is null or minimum_expiry_months >= 0),
  delivery_scope text[] not null default '{}',
  advantages text[] not null default '{}',
  payment_terms text[] not null default '{}',
  cold_chain_supported boolean not null default false,
  prescription_handling text not null default 'licensed_b2b_only' check (prescription_handling in ('licensed_b2b_only','not_applicable')),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','rejected','paused','archived')),
  submitted_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_medicine_offers_active_uidx
  on public.marketplace_medicine_offers (seller_profile_id, canonical_id, coalesce(seller_sku,''))
  where status not in ('rejected','archived');
create index if not exists marketplace_medicine_offers_public_idx
  on public.marketplace_medicine_offers (canonical_id, status, unit_price_egp, published_at desc);
create index if not exists marketplace_medicine_offers_seller_idx
  on public.marketplace_medicine_offers (seller_profile_id, status, updated_at desc);
create index if not exists marketplace_medicine_offers_org_idx
  on public.marketplace_medicine_offers (organization_id, status);

create table if not exists public.marketplace_quote_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.marketplace_medicine_offers(id),
  canonical_id bigint not null,
  seller_profile_id uuid not null references public.marketplace_seller_profiles(id),
  buyer_id uuid not null references auth.users(id),
  buyer_organization_name text,
  buyer_type text not null default 'other' check (buyer_type in ('pharmacy','hospital','clinic','ngo','warehouse','distributor','company','other')),
  requested_quantity numeric not null check (requested_quantity > 0),
  delivery_country text,
  delivery_city text,
  contact_email text not null check (position('@' in contact_email) > 1),
  message text not null check (length(btrim(message)) >= 10),
  status text not null default 'submitted' check (status in ('submitted','contacted','quoted','accepted','declined','withdrawn','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_quote_requests_buyer_idx
  on public.marketplace_quote_requests (buyer_id, created_at desc);
create index if not exists marketplace_quote_requests_seller_idx
  on public.marketplace_quote_requests (seller_profile_id, status, created_at desc);
create index if not exists marketplace_quote_requests_offer_idx
  on public.marketplace_quote_requests (offer_id, created_at desc);

create trigger marketplace_seller_applications_touch_updated_at
before update on public.marketplace_seller_applications
for each row execute function private.touch_updated_at();
create trigger marketplace_seller_profiles_touch_updated_at
before update on public.marketplace_seller_profiles
for each row execute function private.touch_updated_at();
create trigger marketplace_medicine_offers_touch_updated_at
before update on public.marketplace_medicine_offers
for each row execute function private.touch_updated_at();
create trigger marketplace_quote_requests_touch_updated_at
before update on public.marketplace_quote_requests
for each row execute function private.touch_updated_at();

alter table public.marketplace_seller_applications enable row level security;
alter table public.marketplace_seller_profiles enable row level security;
alter table public.marketplace_medicine_offers enable row level security;
alter table public.marketplace_quote_requests enable row level security;

revoke all on public.marketplace_seller_applications from anon, authenticated;
revoke all on public.marketplace_seller_profiles from anon, authenticated;
revoke all on public.marketplace_medicine_offers from anon, authenticated;
revoke all on public.marketplace_quote_requests from anon, authenticated;

grant select, insert on public.marketplace_seller_applications to authenticated;
grant select on public.marketplace_seller_profiles to anon, authenticated;
grant update (display_name, description, logo_url, country, city, address, contact_email, contact_phone, website_url, service_areas, fulfillment_modes, advantages, payment_terms, updated_at)
  on public.marketplace_seller_profiles to authenticated;
grant select on public.marketplace_medicine_offers to anon, authenticated;
grant insert on public.marketplace_medicine_offers to authenticated;
grant update (seller_sku, offer_title, unit_price_egp, list_price_egp, minimum_order_quantity, packaging, stock_status, lead_time_days, minimum_expiry_months, delivery_scope, advantages, payment_terms, cold_chain_supported, prescription_handling, status, updated_at)
  on public.marketplace_medicine_offers to authenticated;
grant select, insert on public.marketplace_quote_requests to authenticated;
grant update (status, updated_at) on public.marketplace_quote_requests to authenticated;
grant all on public.marketplace_seller_applications, public.marketplace_seller_profiles, public.marketplace_medicine_offers, public.marketplace_quote_requests to service_role;

create policy marketplace_seller_applications_insert
on public.marketplace_seller_applications for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'pending'
  and organization_id is null
  and seller_profile_id is null
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
);

create policy marketplace_seller_applications_read
on public.marketplace_seller_applications for select to authenticated
using (submitted_by = (select auth.uid()) or (select private.is_platform_admin()));

create policy marketplace_seller_profiles_public_read
on public.marketplace_seller_profiles for select to anon
using (verification_status = 'verified' and is_public = true);

create policy marketplace_seller_profiles_authenticated_read
on public.marketplace_seller_profiles for select to authenticated
using (
  (verification_status = 'verified' and is_public = true)
  or (select private.is_org_member(organization_id))
  or (select private.is_platform_admin())
);

create policy marketplace_seller_profiles_member_update
on public.marketplace_seller_profiles for update to authenticated
using ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()))
with check ((select private.is_org_member(organization_id)) or (select private.is_platform_admin()));

create policy marketplace_offers_public_read
on public.marketplace_medicine_offers for select to anon
using (
  status = 'approved' and published_at is not null
  and exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and seller.verification_status = 'verified'
      and seller.is_public = true
  )
);

create policy marketplace_offers_authenticated_read
on public.marketplace_medicine_offers for select to authenticated
using (
  (status = 'approved' and published_at is not null and exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id and seller.verification_status = 'verified' and seller.is_public = true
  ))
  or (select private.is_org_member(organization_id))
  or (select private.is_platform_admin())
);

create policy marketplace_offers_member_insert
on public.marketplace_medicine_offers for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and status in ('draft','submitted')
  and reviewed_by is null and reviewed_at is null and review_notes is null and published_at is null
  and (select private.is_org_member(organization_id))
  and exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and seller.organization_id = organization_id
      and seller.verification_status = 'verified'
  )
  and exists (select 1 from public.medicine_canonical_products_v1 product where product.canonical_id = canonical_id)
);

create policy marketplace_offers_member_update
on public.marketplace_medicine_offers for update to authenticated
using (
  (select private.is_platform_admin())
  or ((select private.is_org_member(organization_id)) and status in ('draft','submitted','paused'))
)
with check (
  (select private.is_platform_admin())
  or (
    (select private.is_org_member(organization_id))
    and status in ('draft','submitted','paused')
    and reviewed_by is null and reviewed_at is null and review_notes is null and published_at is null
  )
);

create policy marketplace_quote_requests_insert
on public.marketplace_quote_requests for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1 from public.marketplace_medicine_offers offer
    where offer.id = offer_id
      and offer.canonical_id = canonical_id
      and offer.seller_profile_id = seller_profile_id
      and offer.status = 'approved'
      and offer.published_at is not null
  )
);

create policy marketplace_quote_requests_read
on public.marketplace_quote_requests for select to authenticated
using (
  buyer_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
);

create policy marketplace_quote_requests_update
on public.marketplace_quote_requests for update to authenticated
using (
  buyer_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
)
with check (
  buyer_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
);

create or replace function private.review_marketplace_seller_application(
  target_application uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_seller_applications
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  application_row public.marketplace_seller_applications%rowtype;
  result_row public.marketplace_seller_applications%rowtype;
  created_org_id uuid;
  created_profile_id uuid;
  base_slug text;
  candidate_slug text;
  suffix integer := 1;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can review marketplace seller applications.' using errcode = '42501';
  end if;
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into application_row
  from public.marketplace_seller_applications
  where id = target_application
  for update;
  if not found then raise exception 'Seller application not found.' using errcode = 'P0002'; end if;
  if application_row.status not in ('pending','under_review') then
    raise exception 'This seller application has already been reviewed.' using errcode = '22023';
  end if;

  if decision = 'approved' then
    base_slug := coalesce(private.industry_company_slug(application_row.business_name), 'seller');
    candidate_slug := base_slug;
    while exists (select 1 from public.marketplace_seller_profiles where seller_slug = candidate_slug)
       or exists (select 1 from public.organizations where slug = candidate_slug) loop
      suffix := suffix + 1;
      candidate_slug := base_slug || '-' || suffix::text;
    end loop;

    insert into public.organizations (
      name, organization_type, country, city, contact_email, contact_phone, website, notes, slug
    ) values (
      application_row.business_name,
      application_row.seller_type,
      application_row.country,
      application_row.city,
      application_row.work_email,
      application_row.contact_phone,
      application_row.website_url,
      concat_ws(E'\n', application_row.notes, 'Marketplace seller license: ' || application_row.license_number),
      candidate_slug
    ) returning id into created_org_id;

    insert into public.marketplace_seller_profiles (
      organization_id, seller_slug, display_name, seller_type, country, city, address,
      contact_email, contact_phone, website_url, license_number, license_authority, license_expiry,
      service_areas, advantages, verification_status, is_public, verified_by, verified_at
    ) values (
      created_org_id, candidate_slug, application_row.business_name, application_row.seller_type,
      application_row.country, application_row.city, application_row.address,
      application_row.work_email, application_row.contact_phone, application_row.website_url,
      application_row.license_number, application_row.license_authority, application_row.license_expiry,
      application_row.service_areas, application_row.advantages,
      'verified', true, auth.uid(), now()
    ) returning id into created_profile_id;

    insert into public.organization_members (organization_id, user_id, role, is_active)
    values (created_org_id, application_row.submitted_by, 'org_admin', true)
    on conflict do nothing;
  end if;

  update public.marketplace_seller_applications
  set status = decision,
      organization_id = case when decision = 'approved' then created_org_id else null end,
      seller_profile_id = case when decision = 'approved' then created_profile_id else null end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_notes = reviewer_notes
  where id = target_application
  returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.review_marketplace_seller_application(
  target_application uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_seller_applications
language sql
security invoker
set search_path = public, private, pg_catalog
as $$ select private.review_marketplace_seller_application(target_application, decision, reviewer_notes); $$;
revoke all on function private.review_marketplace_seller_application(uuid,text,text) from public, anon, authenticated;
revoke all on function public.review_marketplace_seller_application(uuid,text,text) from public, anon;
grant execute on function public.review_marketplace_seller_application(uuid,text,text) to authenticated, service_role;

create or replace function private.review_marketplace_medicine_offer(
  target_offer uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_medicine_offers
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare result_row public.marketplace_medicine_offers%rowtype;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can review marketplace offers.' using errcode = '42501';
  end if;
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  update public.marketplace_medicine_offers
  set status = decision,
      reviewed_by = auth.uid(), reviewed_at = now(), review_notes = reviewer_notes,
      published_at = case when decision = 'approved' then now() else null end
  where id = target_offer and status in ('submitted','under_review')
  returning * into result_row;
  if result_row.id is null then raise exception 'Offer not found or already reviewed.' using errcode = 'P0002'; end if;
  return result_row;
end;
$$;

create or replace function public.review_marketplace_medicine_offer(
  target_offer uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_medicine_offers
language sql
security invoker
set search_path = public, private, pg_catalog
as $$ select private.review_marketplace_medicine_offer(target_offer, decision, reviewer_notes); $$;
revoke all on function private.review_marketplace_medicine_offer(uuid,text,text) from public, anon, authenticated;
revoke all on function public.review_marketplace_medicine_offer(uuid,text,text) from public, anon;
grant execute on function public.review_marketplace_medicine_offer(uuid,text,text) to authenticated, service_role;

create or replace view public.marketplace_public_sellers_v1 with (security_invoker = true) as
select seller.id, seller.seller_slug, seller.display_name, seller.seller_type, seller.description, seller.logo_url,
  seller.country, seller.city, seller.address, seller.contact_email, seller.contact_phone, seller.website_url,
  seller.service_areas, seller.fulfillment_modes, seller.advantages, seller.payment_terms,
  seller.license_authority, seller.license_expiry, seller.verified_at,
  count(offer.id)::bigint approved_offer_count,
  count(distinct offer.canonical_id)::bigint medicine_count,
  min(offer.unit_price_egp) lowest_offer_price_egp
from public.marketplace_seller_profiles seller
left join public.marketplace_medicine_offers offer
  on offer.seller_profile_id = seller.id and offer.status = 'approved' and offer.published_at is not null
where seller.verification_status = 'verified' and seller.is_public = true
group by seller.id;

grant select on public.marketplace_public_sellers_v1 to anon, authenticated, service_role;
