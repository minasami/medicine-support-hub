-- Expand medicine_catalog_submissions to hold all required medicine encyclopedia fields

alter table public.medicine_catalog_submissions
  add column if not exists canonical_id bigint,
  add column if not exists name_ar text,
  add column if not exists scientific_name text,
  add column if not exists drug_class text,
  add column if not exists route text,
  add column if not exists category text,
  add column if not exists dosage_form text,
  add column if not exists strength text,
  add column if not exists barcode text,
  add column if not exists code text,
  add column if not exists price_egp numeric,
  add column if not exists image_url text;

-- Add index on canonical_id if editing an existing medicine
create index if not exists medicine_catalog_submissions_canonical_idx on public.medicine_catalog_submissions(canonical_id);

comment on column public.medicine_catalog_submissions.canonical_id is 'Links the submission to an existing medicine in the encyclopedia if it is a correction/update';
comment on column public.medicine_catalog_submissions.name_ar is 'Arabic commercial name';
comment on column public.medicine_catalog_submissions.scientific_name is 'Scientific/generic name';
comment on column public.medicine_catalog_submissions.drug_class is 'Pharmacological drug class';
comment on column public.medicine_catalog_submissions.route is 'Route of administration';
comment on column public.medicine_catalog_submissions.category is 'Product category';
comment on column public.medicine_catalog_submissions.dosage_form is 'Dosage form';
comment on column public.medicine_catalog_submissions.strength is 'Strength of the active ingredient';
comment on column public.medicine_catalog_submissions.barcode is 'Product Barcode';
comment on column public.medicine_catalog_submissions.code is 'Product Code';
comment on column public.medicine_catalog_submissions.price_egp is 'Price in EGP';
comment on column public.medicine_catalog_submissions.image_url is 'Product Image URL';
