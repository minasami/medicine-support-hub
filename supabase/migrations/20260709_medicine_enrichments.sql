create table if not exists public.medicine_enrichments (
  id uuid primary key default gen_random_uuid(),
  medicine_id integer not null references public.medicines(id) on delete cascade,
  manufacturer text,
  active_ingredient text,
  atc_code text,
  barcode text,
  source_name text not null,
  source_url text not null,
  source_type text not null default 'manufacturer',
  confidence text not null default 'needs_review',
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medicine_enrichments_confidence_check check (confidence in ('needs_review','verified','rejected')),
  constraint medicine_enrichments_source_type_check check (source_type in ('manufacturer','regulator','trusted_reference','manual_review'))
);

create index if not exists medicine_enrichments_medicine_idx on public.medicine_enrichments(medicine_id);
create index if not exists medicine_enrichments_verified_idx on public.medicine_enrichments(medicine_id, confidence) where confidence = 'verified';

alter table public.medicine_enrichments enable row level security;

drop policy if exists medicine_enrichments_public_verified_read on public.medicine_enrichments;
create policy medicine_enrichments_public_verified_read
on public.medicine_enrichments
for select
using (confidence = 'verified');

drop policy if exists medicine_enrichments_admin_all on public.medicine_enrichments;
create policy medicine_enrichments_admin_all
on public.medicine_enrichments
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());
