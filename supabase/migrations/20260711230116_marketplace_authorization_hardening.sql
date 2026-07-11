alter table public.marketplace_seller_applications
  drop constraint if exists marketplace_seller_applications_evidence_required;
alter table public.marketplace_seller_applications
  add constraint marketplace_seller_applications_evidence_required
  check (cardinality(evidence_urls) > 0) not valid;
alter table public.marketplace_seller_applications
  validate constraint marketplace_seller_applications_evidence_required;

drop policy if exists marketplace_quote_requests_update on public.marketplace_quote_requests;
drop policy if exists marketplace_quote_requests_buyer_update on public.marketplace_quote_requests;
drop policy if exists marketplace_quote_requests_seller_update on public.marketplace_quote_requests;
drop policy if exists marketplace_quote_requests_admin_update on public.marketplace_quote_requests;

create policy marketplace_quote_requests_buyer_update
on public.marketplace_quote_requests for update to authenticated
using (buyer_id = (select auth.uid()))
with check (
  buyer_id = (select auth.uid())
  and status in ('accepted','withdrawn','closed')
);

create policy marketplace_quote_requests_seller_update
on public.marketplace_quote_requests for update to authenticated
using (
  exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
)
with check (
  status in ('contacted','quoted','declined','closed')
  and exists (
    select 1 from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
);

create policy marketplace_quote_requests_admin_update
on public.marketplace_quote_requests for update to authenticated
using ((select private.is_platform_admin()))
with check ((select private.is_platform_admin()));
