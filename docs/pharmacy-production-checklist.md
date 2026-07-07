# Pharmacy Production Checklist

## Live production modules

- `/pharmacy` — operations hub
- `/pharmacy/finance` — branch finance reporting
- `/pharmacy/members` — branch finance access management
- `/pharmacy/settings` — branch review and safe deactivation
- `/pharmacy/inventory` — inventory items, batches, and stock summary
- `/pharmacy/purchases` — suppliers and purchase invoices
- `/pharmacy/sales` — sales workflow

## Supabase production tables

- `pharmacy_branches`
- `pharmacy_branch_members`
- `pharmacy_finance_entries`
- `pharmacy_suppliers`
- `pharmacy_inventory_items`
- `pharmacy_inventory_batches`
- `pharmacy_inventory_movements`
- `pharmacy_purchase_invoices`
- `pharmacy_purchase_invoice_lines`
- `pharmacy_sales`
- `pharmacy_sale_lines`

## Access model

1. A platform admin sets the user's global profile role to `pharmacy_accountant` from `/admin-users`.
2. The branch owner opens `/pharmacy/members`.
3. The branch owner links that user as branch `accountant`.
4. The accountant can then work inside the branch pharmacy finance/inventory/purchase/sales modules.

## Old branch repair

If an old branch was created before owner-membership bootstrap was fixed, open `/pharmacy/members`, select the branch, and press **Repair owner access**.

## Manual Supabase security setting still recommended

Enable leaked password protection:

Supabase Dashboard → Authentication → Settings / Security → Password protection → enable leaked password protection.

## End-to-end test flow

1. Sign in as platform admin.
2. Set test user role to `pharmacy_accountant`.
3. Sign in as branch owner.
4. Link the test user as branch accountant.
5. Add supplier.
6. Add inventory item and batch.
7. Create purchase invoice.
8. Create sale.
9. Review finance summary.
10. Remove accountant access and confirm the user can no longer see the branch data.
