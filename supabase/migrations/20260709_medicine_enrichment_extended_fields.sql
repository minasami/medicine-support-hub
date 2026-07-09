alter table public.medicine_enrichments
  add column if not exists medicine_family text,
  add column if not exists medicine_genre text,
  add column if not exists route text,
  add column if not exists price_amount numeric,
  add column if not exists price_currency text,
  add column if not exists price_updated_at timestamptz;
