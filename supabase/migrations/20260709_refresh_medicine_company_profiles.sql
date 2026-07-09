create or replace function public.refresh_medicine_company_profiles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Only platform admins can refresh medicine company profiles.';
  end if;

  insert into public.medicine_company_profiles (
    company_name,
    company_slug,
    origin,
    product_count,
    active_product_count,
    archived_product_count,
    prescription_product_count,
    disease_area_count,
    generic_count,
    min_price,
    max_price,
    latest_source_update,
    updated_at
  )
  select
    company_name,
    company_slug,
    max(company_origin),
    count(*)::int,
    count(*) filter (where duplicate_status = 'active')::int,
    count(*) filter (where duplicate_status = 'archived_lower_price')::int,
    count(*) filter (where prescription_required is not null)::int,
    count(distinct disease_name)::int,
    count(distinct generic_name)::int,
    min(final_price),
    max(final_price),
    current_date,
    now()
  from public.verified_medicine_source_products
  where company_name is not null and company_slug is not null
  group by company_name, company_slug
  on conflict (company_name) do update set
    company_slug = excluded.company_slug,
    origin = excluded.origin,
    product_count = excluded.product_count,
    active_product_count = excluded.active_product_count,
    archived_product_count = excluded.archived_product_count,
    prescription_product_count = excluded.prescription_product_count,
    disease_area_count = excluded.disease_area_count,
    generic_count = excluded.generic_count,
    min_price = excluded.min_price,
    max_price = excluded.max_price,
    latest_source_update = excluded.latest_source_update,
    updated_at = now();

  select count(*) into v_count from public.medicine_company_profiles;
  return v_count;
end;
$$;

grant execute on function public.refresh_medicine_company_profiles() to authenticated;
