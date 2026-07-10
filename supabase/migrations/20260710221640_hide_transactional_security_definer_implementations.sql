alter function public.accept_medicine_import_queue_row(uuid, integer) set schema private;
alter function private.accept_medicine_import_queue_row(uuid, integer) rename to accept_medicine_import_queue_row_impl;

alter function public.bulk_accept_medicine_import_queue_exact_matches() set schema private;
alter function private.bulk_accept_medicine_import_queue_exact_matches() rename to bulk_accept_medicine_import_queue_exact_matches_impl;

alter function public.reject_medicine_import_queue_row(uuid, text) set schema private;
alter function private.reject_medicine_import_queue_row(uuid, text) rename to reject_medicine_import_queue_row_impl;

alter function public.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) set schema private;
alter function private.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) rename to complete_pharmacy_sale_impl;

alter function public.create_pharmacy_purchase_invoice(jsonb) set schema private;
alter function private.create_pharmacy_purchase_invoice(jsonb) rename to create_pharmacy_purchase_invoice_impl;

revoke all on function private.accept_medicine_import_queue_row_impl(uuid, integer) from public, anon;
revoke all on function private.bulk_accept_medicine_import_queue_exact_matches_impl() from public, anon;
revoke all on function private.reject_medicine_import_queue_row_impl(uuid, text) from public, anon;
revoke all on function private.complete_pharmacy_sale_impl(uuid, uuid, uuid, numeric, numeric, text, text) from public, anon;
revoke all on function private.create_pharmacy_purchase_invoice_impl(jsonb) from public, anon;

grant execute on function private.accept_medicine_import_queue_row_impl(uuid, integer) to authenticated, service_role;
grant execute on function private.bulk_accept_medicine_import_queue_exact_matches_impl() to authenticated, service_role;
grant execute on function private.reject_medicine_import_queue_row_impl(uuid, text) to authenticated, service_role;
grant execute on function private.complete_pharmacy_sale_impl(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated, service_role;
grant execute on function private.create_pharmacy_purchase_invoice_impl(jsonb) to authenticated, service_role;

create function public.accept_medicine_import_queue_row(p_queue_id uuid, p_medicine_id integer)
returns uuid
language sql
security invoker
set search_path = private, pg_catalog
as $$
  select private.accept_medicine_import_queue_row_impl(p_queue_id, p_medicine_id);
$$;

create function public.bulk_accept_medicine_import_queue_exact_matches()
returns integer
language sql
security invoker
set search_path = private, pg_catalog
as $$
  select private.bulk_accept_medicine_import_queue_exact_matches_impl();
$$;

create function public.reject_medicine_import_queue_row(p_queue_id uuid, p_reason text default null)
returns void
language sql
security invoker
set search_path = private, pg_catalog
as $$
  select private.reject_medicine_import_queue_row_impl(p_queue_id, p_reason);
$$;

create function public.complete_pharmacy_sale(
  p_branch_id uuid,
  p_item_id uuid,
  p_batch_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_payment_method text default 'cash',
  p_customer_name text default null
)
returns table(
  sale_id uuid,
  total_amount numeric,
  gross_profit numeric,
  new_quantity_on_hand numeric
)
language sql
security invoker
set search_path = private, pg_catalog
as $$
  select *
  from private.complete_pharmacy_sale_impl(
    p_branch_id,
    p_item_id,
    p_batch_id,
    p_quantity,
    p_unit_price,
    p_payment_method,
    p_customer_name
  );
$$;

create function public.create_pharmacy_purchase_invoice(p_payload jsonb)
returns table(
  invoice_id uuid,
  batch_id uuid,
  total_amount numeric,
  payment_status text
)
language sql
security invoker
set search_path = private, pg_catalog
as $$
  select *
  from private.create_pharmacy_purchase_invoice_impl(p_payload);
$$;

revoke all on function public.accept_medicine_import_queue_row(uuid, integer) from public, anon;
revoke all on function public.bulk_accept_medicine_import_queue_exact_matches() from public, anon;
revoke all on function public.reject_medicine_import_queue_row(uuid, text) from public, anon;
revoke all on function public.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) from public, anon;
revoke all on function public.create_pharmacy_purchase_invoice(jsonb) from public, anon;

grant execute on function public.accept_medicine_import_queue_row(uuid, integer) to authenticated, service_role;
grant execute on function public.bulk_accept_medicine_import_queue_exact_matches() to authenticated, service_role;
grant execute on function public.reject_medicine_import_queue_row(uuid, text) to authenticated, service_role;
grant execute on function public.complete_pharmacy_sale(uuid, uuid, uuid, numeric, numeric, text, text) to authenticated, service_role;
grant execute on function public.create_pharmacy_purchase_invoice(jsonb) to authenticated, service_role;
