alter view public.pharmacy_inventory_stock_summary set (security_invoker = true);
alter view public.pharmacy_supplier_balance_summary set (security_invoker = true);
alter view public.pharmacy_branch_finance_summary set (security_invoker = true);

revoke execute on function public.is_org_member(uuid) from authenticated;
