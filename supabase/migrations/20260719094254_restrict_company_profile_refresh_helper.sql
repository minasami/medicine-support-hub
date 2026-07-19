-- Keep the privileged company-profile aggregate refresh internal.
-- The function is SECURITY DEFINER and rewrites governed profile rows, so it
-- must not inherit PostgreSQL's default EXECUTE grant to PUBLIC.

do $$
begin
  if to_regprocedure(
    'private.refresh_medicine_company_profiles_for_slugs(text[])'
  ) is not null then
    revoke execute on function
      private.refresh_medicine_company_profiles_for_slugs(text[])
      from public, anon, authenticated;

    grant execute on function
      private.refresh_medicine_company_profiles_for_slugs(text[])
      to service_role;
  end if;
end;
$$;
