create or replace function public.review_marketplace_seller_application(
  target_application uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_seller_applications
language sql
security definer
set search_path = public, private, pg_catalog
as $$
  select private.review_marketplace_seller_application(target_application, decision, reviewer_notes);
$$;

create or replace function public.review_marketplace_medicine_offer(
  target_offer uuid,
  decision text,
  reviewer_notes text default null
)
returns public.marketplace_medicine_offers
language sql
security definer
set search_path = public, private, pg_catalog
as $$
  select private.review_marketplace_medicine_offer(target_offer, decision, reviewer_notes);
$$;

create or replace function public.review_industry_company_contribution(
  target_contribution uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_contributions
language sql
security definer
set search_path = private, public, pg_catalog
as $$
  select private.review_industry_company_contribution(target_contribution, decision, reviewer_notes);
$$;

revoke all on function public.review_marketplace_seller_application(uuid,text,text) from public, anon;
revoke all on function public.review_marketplace_medicine_offer(uuid,text,text) from public, anon;
revoke all on function public.review_industry_company_contribution(uuid,text,text) from public, anon;
grant execute on function public.review_marketplace_seller_application(uuid,text,text) to authenticated, service_role;
grant execute on function public.review_marketplace_medicine_offer(uuid,text,text) to authenticated, service_role;
grant execute on function public.review_industry_company_contribution(uuid,text,text) to authenticated, service_role;
