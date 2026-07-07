create table if not exists public.pharmacy_purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  supplier_id uuid references public.pharmacy_suppliers(id) on delete set null,
  invoice_number text,
  invoice_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid')),
  paid_amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharmacy_purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.pharmacy_purchase_invoices(id) on delete cascade,
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  item_id uuid not null references public.pharmacy_inventory_items(id) on delete cascade,
  batch_id uuid references public.pharmacy_inventory_batches(id) on delete set null,
  quantity numeric(14,2) not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  batch_number text,
  expiry_date date,
  line_total numeric(14,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_purchase_invoices_branch_date_idx on public.pharmacy_purchase_invoices(branch_id, invoice_date desc);
create index if not exists pharmacy_purchase_invoices_supplier_idx on public.pharmacy_purchase_invoices(supplier_id);
create index if not exists pharmacy_purchase_lines_invoice_idx on public.pharmacy_purchase_invoice_lines(invoice_id);
create index if not exists pharmacy_purchase_lines_item_idx on public.pharmacy_purchase_invoice_lines(item_id);

alter table public.pharmacy_purchase_invoices enable row level security;
alter table public.pharmacy_purchase_invoice_lines enable row level security;

create policy pharmacy_purchase_invoices_members on public.pharmacy_purchase_invoices for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_purchase_lines_members on public.pharmacy_purchase_invoice_lines for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));

create or replace view public.pharmacy_supplier_balance_summary as
select
  s.branch_id,
  s.id as supplier_id,
  s.supplier_name,
  s.opening_balance,
  coalesce(sum(i.total_amount),0)::numeric(14,2) as purchases_total,
  coalesce(sum(i.paid_amount),0)::numeric(14,2) as paid_total,
  (s.opening_balance + coalesce(sum(i.total_amount),0) - coalesce(sum(i.paid_amount),0))::numeric(14,2) as balance_due
from public.pharmacy_suppliers s
left join public.pharmacy_purchase_invoices i on i.supplier_id = s.id
group by s.branch_id, s.id, s.supplier_name, s.opening_balance;
