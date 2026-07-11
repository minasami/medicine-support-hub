drop policy if exists marketplace_quote_requests_buyer_update on public.marketplace_quote_requests;
drop policy if exists marketplace_quote_requests_seller_update on public.marketplace_quote_requests;
drop policy if exists marketplace_quote_requests_admin_update on public.marketplace_quote_requests;

create policy marketplace_quote_requests_actor_update
on public.marketplace_quote_requests for update to authenticated
using (
  buyer_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1
    from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
)
with check (
  buyer_id = (select auth.uid())
  or (select private.is_platform_admin())
  or exists (
    select 1
    from public.marketplace_seller_profiles seller
    where seller.id = seller_profile_id
      and (select private.is_org_member(seller.organization_id))
  )
);
