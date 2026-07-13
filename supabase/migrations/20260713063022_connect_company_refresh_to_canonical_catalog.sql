create or replace function public.refresh_medicine_company_profiles()
returns integer
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_slugs text[];
  v_total integer;
begin
  if current_user not in ('postgres', 'supabase_admin')
     and coalesce(auth.role(), '') <> 'service_role'
     and not private.is_platform_admin() then
    raise exception 'Only platform administrators or service automation can refresh medicine company profiles.' using errcode = '42501';
  end if;

  perform public.refresh_medicine_company_profiles_from_encyclopedia();
  select coalesce(array_agg(distinct company_slug), '{}'::text[]) into v_slugs
  from public.verified_medicine_source_products
  where nullif(trim(company_slug), '') is not null;
  if cardinality(v_slugs) > 0 then
    perform private.refresh_medicine_company_profiles_for_slugs(v_slugs);
  end if;
  select count(*)::integer into v_total from public.medicine_company_profiles;
  return v_total;
end;
$$;
