create table if not exists public.pharmacy_sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  sale_date date not null default current_date,
  customer_name text,
  payment_method text not null default 'cash',
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  cost_amount numeric(14,2) not null default 0,
  gross_profit numeric(14,2) not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.pharmacy_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.pharmacy_sales(id) on delete cascade,
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  item_id uuid not null references public.pharmacy_inventory_items(id) on delete restrict,
  batch_id uuid references public.pharmacy_inventory_batches(id) on delete set null,
  quantity numeric(14,2) not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  line_total numeric(14,2) generated always as (quantity * unit_price) stored,
  line_cost numeric(14,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_sales_branch_date_idx on public.pharmacy_sales(branch_id, sale_date desc);
create index if not exists pharmacy_sale_lines_sale_idx on public.pharmacy_sale_lines(sale_id);
create index if not exists pharmacy_sale_lines_item_idx on public.pharmacy_sale_lines(item_id);

alter table public.pharmacy_sales enable row level security;
alter table public.pharmacy_sale_lines enable row level security;

create policy pharmacy_sales_members on public.pharmacy_sales for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_sale_lines_members on public.pharmacy_sale_lines for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
