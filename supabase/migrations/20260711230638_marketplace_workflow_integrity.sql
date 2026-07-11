create unique index if not exists marketplace_seller_applications_active_license_uidx
  on public.marketplace_seller_applications (seller_type, lower(btrim(license_number)))
  where status in ('pending','under_review','approved');

create unique index if not exists marketplace_seller_profiles_active_license_uidx
  on public.marketplace_seller_profiles (seller_type, lower(btrim(license_number)))
  where verification_status in ('pending','verified');

drop policy if exists marketplace_quote_requests_insert on public.marketplace_quote_requests;
create policy marketplace_quote_requests_insert
on public.marketplace_quote_requests for insert to authenticated
with check (
  buyer_id = (select auth.uid())
  and status = 'submitted'
  and exists (
    select 1
    from public.marketplace_medicine_offers offer
    join public.marketplace_seller_profiles seller on seller.id = offer.seller_profile_id
    where offer.id = offer_id
      and offer.canonical_id = canonical_id
      and offer.seller_profile_id = seller_profile_id
      and offer.status = 'approved'
      and offer.published_at is not null
      and seller.verification_status = 'verified'
      and seller.is_public = true
  )
);

create or replace function private.enforce_marketplace_quote_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := private.is_platform_admin();
  actor_is_seller boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if actor_is_admin then
    return new;
  end if;

  if actor = old.buyer_id and (
    (old.status in ('submitted','contacted','quoted') and new.status = 'withdrawn')
    or (old.status = 'quoted' and new.status = 'accepted')
    or (old.status = 'accepted' and new.status = 'closed')
  ) then
    return new;
  end if;

  select exists (
    select 1
    from public.marketplace_seller_profiles seller
    where seller.id = old.seller_profile_id
      and private.is_org_member(seller.organization_id)
  ) into actor_is_seller;

  if actor_is_seller and (
    (old.status = 'submitted' and new.status in ('contacted','quoted','declined','closed'))
    or (old.status = 'contacted' and new.status in ('quoted','declined','closed'))
    or (old.status = 'quoted' and new.status in ('declined','closed'))
    or (old.status = 'accepted' and new.status = 'closed')
  ) then
    return new;
  end if;

  raise exception 'Invalid marketplace quote status transition from % to % for the current actor.', old.status, new.status
    using errcode = '42501';
end;
$$;

revoke all on function private.enforce_marketplace_quote_status_transition() from public, anon, authenticated;

drop trigger if exists marketplace_quote_requests_enforce_status on public.marketplace_quote_requests;
create trigger marketplace_quote_requests_enforce_status
before update of status on public.marketplace_quote_requests
for each row execute function private.enforce_marketplace_quote_status_transition();
