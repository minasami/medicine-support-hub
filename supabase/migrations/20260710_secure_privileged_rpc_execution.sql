revoke execute on function public.accept_medicine_import_queue_row(uuid, integer) from public, anon;
revoke execute on function public.reject_medicine_import_queue_row(uuid, text) from public, anon;
revoke execute on function public.bulk_accept_medicine_import_queue_exact_matches() from public, anon;
revoke execute on function public.normalize_verified_product_prices() from public, anon;
revoke execute on function public.refresh_medicine_company_profiles() from public, anon;
revoke execute on function public.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) from public, anon;
revoke execute on function public.create_pharmacy_purchase_invoice(jsonb) from public, anon;

grant execute on function public.accept_medicine_import_queue_row(uuid, integer) to authenticated;
grant execute on function public.reject_medicine_import_queue_row(uuid, text) to authenticated;
grant execute on function public.bulk_accept_medicine_import_queue_exact_matches() to authenticated;
grant execute on function public.normalize_verified_product_prices() to authenticated;
grant execute on function public.refresh_medicine_company_profiles() to authenticated;
grant execute on function public.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.create_pharmacy_purchase_invoice(jsonb) to authenticated;

alter function public.noop_pharmacy_transaction_test() set search_path = public;
