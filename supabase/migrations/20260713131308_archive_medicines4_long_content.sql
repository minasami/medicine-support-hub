-- The original long-form source text is retained in the verified
-- medicines4_rows.csv.gz archive before this migration is applied.
alter table public.medicines4 drop column drug_content;
alter table public.medicines4 add column drug_content text;

comment on column public.medicines4.drug_content is
  'Long-form source content archived 2026-07-13 in medicines4_rows.csv.gz; archive SHA-256 5a311a2e1f2a082d98861430fc79af77e4619a4b8f10645bccca639c78e56764; intentionally null after quota cleanup.';
