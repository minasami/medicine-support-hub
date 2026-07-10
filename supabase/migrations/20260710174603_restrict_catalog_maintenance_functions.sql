revoke execute on function public.normalize_verified_product_prices() from authenticated;
revoke execute on function public.refresh_medicine_company_profiles() from authenticated;
revoke execute on function public.normalize_verified_product_prices() from public, anon;
revoke execute on function public.refresh_medicine_company_profiles() from public, anon;
grant execute on function public.normalize_verified_product_prices() to service_role;
grant execute on function public.refresh_medicine_company_profiles() to service_role;
