create table if not exists public.medicine_enrichment_import_queue (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  source_item_code text,
  source_name_ar text,
  source_name_en text,
  source_barcode text,
  source_price_amount numeric,
  source_price_currency text default 'EGP',
  source_price_updated_at date,
  suggested_medicine_id integer references public.medicines(id) on delete set null,
  match_status text not null default 'unmatched',
  review_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medicine_enrichment_import_queue_match_status_check check (match_status in ('unmatched','candidate','accepted','rejected'))
);

create index if not exists medicine_enrichment_import_queue_source_idx on public.medicine_enrichment_import_queue(source_name);
create index if not exists medicine_enrichment_import_queue_status_idx on public.medicine_enrichment_import_queue(match_status);
create index if not exists medicine_enrichment_import_queue_barcode_idx on public.medicine_enrichment_import_queue(source_barcode);

alter table public.medicine_enrichment_import_queue enable row level security;

drop policy if exists medicine_enrichment_import_queue_admin_all on public.medicine_enrichment_import_queue;
create policy medicine_enrichment_import_queue_admin_all
on public.medicine_enrichment_import_queue
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
