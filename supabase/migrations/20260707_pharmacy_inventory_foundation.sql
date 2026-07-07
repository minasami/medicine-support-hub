create table if not exists public.pharmacy_suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  supplier_name text not null,
  contact_name text,
  phone text,
  address text,
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharmacy_inventory_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  medicine_id integer references public.medicines(id) on delete set null,
  item_name text not null,
  barcode text,
  unit text not null default 'pack',
  reorder_level numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, barcode)
);

create table if not exists public.pharmacy_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  item_id uuid not null references public.pharmacy_inventory_items(id) on delete cascade,
  batch_number text,
  expiry_date date,
  quantity_on_hand numeric(14,2) not null default 0,
  unit_cost numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pharmacy_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.pharmacy_branches(id) on delete cascade,
  item_id uuid not null references public.pharmacy_inventory_items(id) on delete cascade,
  batch_id uuid references public.pharmacy_inventory_batches(id) on delete set null,
  movement_type text not null check (movement_type in ('purchase','sale','return_in','return_out','adjustment','transfer_in','transfer_out','expired','damage')),
  quantity numeric(14,2) not null,
  unit_cost numeric(14,2),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists pharmacy_suppliers_branch_idx on public.pharmacy_suppliers(branch_id, supplier_name);
create index if not exists pharmacy_items_branch_name_idx on public.pharmacy_inventory_items(branch_id, item_name);
create index if not exists pharmacy_items_barcode_idx on public.pharmacy_inventory_items(barcode);
create index if not exists pharmacy_batches_item_expiry_idx on public.pharmacy_inventory_batches(item_id, expiry_date);
create index if not exists pharmacy_movements_branch_created_idx on public.pharmacy_inventory_movements(branch_id, created_at desc);

alter table public.pharmacy_suppliers enable row level security;
alter table public.pharmacy_inventory_items enable row level security;
alter table public.pharmacy_inventory_batches enable row level security;
alter table public.pharmacy_inventory_movements enable row level security;

create policy pharmacy_suppliers_members on public.pharmacy_suppliers for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_items_members on public.pharmacy_inventory_items for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_batches_members on public.pharmacy_inventory_batches for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));
create policy pharmacy_movements_members on public.pharmacy_inventory_movements for all to authenticated using (public.is_pharmacy_branch_member(branch_id)) with check (public.is_pharmacy_branch_member(branch_id));

create or replace view public.pharmacy_inventory_stock_summary as
select
  i.branch_id,
  i.id as item_id,
  i.item_name,
  i.barcode,
  i.unit,
  i.reorder_level,
  coalesce(sum(b.quantity_on_hand),0)::numeric(14,2) as quantity_on_hand,
  min(b.expiry_date) filter (where b.quantity_on_hand > 0) as nearest_expiry_date,
  max(b.selling_price) as latest_selling_price,
  case when coalesce(sum(b.quantity_on_hand),0) <= i.reorder_level then true else false end as below_reorder_level
from public.pharmacy_inventory_items i
left join public.pharmacy_inventory_batches b on b.item_id = i.id
group by i.branch_id, i.id, i.item_name, i.barcode, i.unit, i.reorder_level;
