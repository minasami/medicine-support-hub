alter table public.pharmacy_sales enable row level security;
alter table public.pharmacy_sale_lines enable row level security;

create policy pharmacy_sales_insert
on public.pharmacy_sales
for insert
to authenticated
with check (public.is_pharmacy_branch_member(branch_id));

create policy pharmacy_sales_update
on public.pharmacy_sales
for update
to authenticated
using (public.is_pharmacy_branch_member(branch_id))
with check (public.is_pharmacy_branch_member(branch_id));

create policy pharmacy_sale_lines_select
on public.pharmacy_sale_lines
for select
to authenticated
using (public.is_pharmacy_branch_member(branch_id));

create policy pharmacy_sale_lines_insert
on public.pharmacy_sale_lines
for insert
to authenticated
with check (public.is_pharmacy_branch_member(branch_id));

create policy pharmacy_sale_lines_update
on public.pharmacy_sale_lines
for update
to authenticated
using (public.is_pharmacy_branch_member(branch_id))
with check (public.is_pharmacy_branch_member(branch_id));
