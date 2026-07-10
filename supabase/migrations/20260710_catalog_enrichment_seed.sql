-- Seed only source evidence that meets conservative product-identity rules.

-- EgyptDwa tier 1: Unicode-preserving normalized name unique on both sides.
with source_rows as (
  select "Medicine Name" source_key,
    public.normalize_catalog_name("Medicine Name") norm,
    "Price"::numeric source_price,
    "Category title" category_name, "Category link" category_url,
    "Views" product_views, "Category views" category_views,
    "Image" image_url,
    public.canonical_source_url("Medicine Name link") source_url
  from public.medicines3
), source_unique as (
  select norm, min(source_key) source_key
  from source_rows
  where length(norm) >= 5 and norm ~ '[a-zء-ي]'
  group by norm having count(*) = 1
), target_rows as (
  select id, public.normalize_catalog_name(name_ar) norm
  from public.medicines2 where coalesce(active, true)
), target_unique as (
  select norm, min(id) medicines2_id
  from target_rows
  where length(norm) >= 5 and norm ~ '[a-zء-ي]'
  group by norm having count(*) = 1
)
insert into public.medicine_catalog_source_evidence (
  source_system, source_key, medicines2_id, match_method, confidence, match_score,
  source_name, source_url, image_url, category_name, category_url,
  product_views, category_views, observed_price, observed_price_text,
  observed_currency, evidence
)
select 'egyptdwa', s.source_key, t.medicines2_id,
  'unicode_normalized_name_unique', 'verified', 1.0,
  s.source_key, s.source_url, s.image_url, s.category_name, s.category_url,
  s.product_views, s.category_views, s.source_price, s.source_price::text,
  'EGP', jsonb_build_object('normalization', 'unicode_preserving')
from source_rows s
join source_unique su on su.norm = s.norm and su.source_key = s.source_key
join target_unique t on t.norm = s.norm
on conflict do nothing;

-- EgyptDwa tier 2: exact normalized name and exactly one price-matching target.
with source_rows as (
  select "Medicine Name" source_key,
    public.normalize_catalog_name("Medicine Name") norm,
    "Price"::numeric source_price,
    "Category title" category_name, "Category link" category_url,
    "Views" product_views, "Category views" category_views,
    "Image" image_url,
    public.canonical_source_url("Medicine Name link") source_url
  from public.medicines3
), candidates as (
  select s.*, m.id medicines2_id,
    count(*) filter (
      where s.source_price is not null and m.price is not null
        and abs(s.source_price - m.price) <= 0.01
    ) over (partition by s.source_key) matching_price_candidates
  from source_rows s
  join public.medicines2 m
    on public.normalize_catalog_name(m.name_ar) = s.norm
   and coalesce(m.active, true)
  where length(s.norm) >= 5 and s.norm ~ '[a-zء-ي]'
)
insert into public.medicine_catalog_source_evidence (
  source_system, source_key, medicines2_id, match_method, confidence, match_score,
  source_name, source_url, image_url, category_name, category_url,
  product_views, category_views, observed_price, observed_price_text,
  observed_currency, evidence
)
select 'egyptdwa', c.source_key, c.medicines2_id,
  'unicode_normalized_name_exact_price_unique', 'verified', 0.99,
  c.source_key, c.source_url, c.image_url, c.category_name, c.category_url,
  c.product_views, c.category_views, c.source_price, c.source_price::text,
  'EGP', jsonb_build_object('price_tolerance', 0.01)
from candidates c
join public.medicines2 m on m.id = c.medicines2_id
where c.matching_price_candidates = 1
  and c.source_price is not null and m.price is not null
  and abs(c.source_price - m.price) <= 0.01
on conflict do nothing;

-- EgyptDwa tier 3: exact price and numeric signature, similarity >= .90,
-- and a >= .08 margin over the second candidate.
with source_rows as (
  select "Medicine Name" source_key, "Price"::numeric source_price,
    public.catalog_number_signature("Medicine Name") number_signature,
    "Category title" category_name, "Category link" category_url,
    "Views" product_views, "Category views" category_views,
    "Image" image_url,
    public.canonical_source_url("Medicine Name link") source_url
  from public.medicines3 where "Medicine Name" is not null
), ranked as (
  select s.*, candidate.id medicines2_id, candidate.similarity_score,
    row_number() over (
      partition by s.source_key
      order by candidate.similarity_score desc, candidate.id
    ) candidate_rank
  from source_rows s
  cross join lateral (
    select m.id, similarity(m.name_ar, s.source_key) similarity_score
    from public.medicines2 m
    where coalesce(m.active, true)
      and s.number_signature <> ''
      and public.catalog_number_signature(m.name_ar) = s.number_signature
      and s.source_price is not null and m.price is not null
      and abs(s.source_price - m.price) <= 0.01
      and m.name_ar % s.source_key
    order by similarity(m.name_ar, s.source_key) desc, m.id
    limit 2
  ) candidate
), compared as (
  select ranked.*,
    max(similarity_score) filter (where candidate_rank = 2)
      over (partition by source_key) second_similarity
  from ranked
)
insert into public.medicine_catalog_source_evidence (
  source_system, source_key, medicines2_id, match_method, confidence, match_score,
  source_name, source_url, image_url, category_name, category_url,
  product_views, category_views, observed_price, observed_price_text,
  observed_currency, evidence
)
select 'egyptdwa', c.source_key, c.medicines2_id,
  'arabic_trigram_price_numbers', 'verified', c.similarity_score,
  c.source_key, c.source_url, c.image_url, c.category_name, c.category_url,
  c.product_views, c.category_views, c.source_price, c.source_price::text,
  'EGP', jsonb_build_object(
    'number_signature', c.number_signature,
    'second_similarity', coalesce(c.second_similarity, 0),
    'minimum_similarity', 0.90, 'minimum_margin', 0.08
  )
from compared c
where c.candidate_rank = 1
  and c.similarity_score >= 0.90
  and c.similarity_score - coalesce(c.second_similarity, 0) >= 0.08
on conflict do nothing;

-- Netmeds product evidence: unique normalized English product name only.
with source_rows as (
  select med_name source_key,
    public.normalize_ascii_catalog_name(med_name) norm,
    med_url source_url, public.canonical_source_url(img_urls) image_url,
    public.clean_netmeds_generic(generic_name) generic_name,
    regexp_replace(coalesce(disease_name, ''), '\s*\([0-9,]+\)\s*$', '', 'g') disease_area,
    prescription_required,
    nullif(trim(regexp_replace(coalesce(drug_manufacturer, ''), '^\s*\*?\s*Mkt:\s*', '', 'i')), '') manufacturer_name,
    nullif(trim(regexp_replace(coalesce(drug_manufacturer_origin, ''), '^\s*\*?\s*Country of Origin:\s*', '', 'i')), '') manufacturer_origin,
    final_price observed_price_text
  from public.medicines4
), source_unique as (
  select norm, min(source_key) source_key
  from source_rows where length(norm) >= 6 and norm ~ '[a-z]'
  group by norm having count(*) = 1
), target_rows as (
  select id, public.normalize_ascii_catalog_name(name_en) norm
  from public.medicines2 where coalesce(active, true)
), target_unique as (
  select norm, min(id) medicines2_id
  from target_rows where length(norm) >= 6 and norm ~ '[a-z]'
  group by norm having count(*) = 1
)
insert into public.medicine_catalog_source_evidence (
  source_system, source_key, medicines2_id, match_method, confidence, match_score,
  source_name, source_url, image_url, observed_price_text, observed_currency,
  generic_name, disease_area, prescription_required, manufacturer_name,
  manufacturer_origin, evidence
)
select 'netmeds', s.source_key, t.medicines2_id,
  'ascii_normalized_name_unique', 'verified', 1.0,
  s.source_key, s.source_url, s.image_url, s.observed_price_text, 'INR',
  s.generic_name, nullif(s.disease_area, ''), s.prescription_required,
  s.manufacturer_name, s.manufacturer_origin,
  jsonb_build_object(
    'market', 'India',
    'price_policy', 'reference_only_never_overwrite_egyptian_price'
  )
from source_rows s
join source_unique su on su.norm = s.norm and su.source_key = s.source_key
join target_unique t on t.norm = s.norm
on conflict do nothing;

-- Ingredient-level international reference, intentionally separate from
-- Egyptian brand identity.
with source_parts as (
  select m.med_name, m.med_url,
    trim(regexp_replace(part, '\s+[0-9].*$', '', 'i')) ingredient_name,
    regexp_replace(coalesce(m.disease_name, ''), '\s*\([0-9,]+\)\s*$', '', 'g') disease_area,
    m.prescription_required,
    nullif(trim(regexp_replace(coalesce(m.drug_manufacturer, ''), '^\s*\*?\s*Mkt:\s*', '', 'i')), '') manufacturer_name,
    nullif(trim(regexp_replace(coalesce(m.drug_manufacturer_origin, ''), '^\s*\*?\s*Country of Origin:\s*', '', 'i')), '') manufacturer_origin
  from public.medicines4 m
  cross join lateral regexp_split_to_table(
    coalesce(public.clean_netmeds_generic(m.generic_name), ''), '\+'
  ) part
), cleaned as (
  select public.normalize_ascii_catalog_name(ingredient_name) ingredient_key,
    ingredient_name, med_name, med_url, nullif(disease_area, '') disease_area,
    prescription_required, manufacturer_name, manufacturer_origin
  from source_parts
  where length(trim(ingredient_name)) >= 3
    and public.normalize_ascii_catalog_name(ingredient_name) <> ''
), aggregated as (
  select ingredient_key, min(ingredient_name) ingredient_name,
    count(distinct med_name)::bigint source_product_count,
    coalesce(array_agg(distinct disease_area) filter (where disease_area is not null), '{}') disease_areas,
    bool_or(lower(coalesce(prescription_required, '')) like '%rx%') prescription_required_observed,
    min(manufacturer_name) filter (where manufacturer_name is not null) manufacturer_sample,
    min(manufacturer_origin) filter (where manufacturer_origin is not null) manufacturer_origin_sample,
    min(med_url) filter (where med_url is not null) source_url_sample
  from cleaned group by ingredient_key
)
insert into public.international_ingredient_reference (
  ingredient_key, ingredient_name, source_product_count, disease_areas,
  prescription_required_observed, manufacturer_sample,
  manufacturer_origin_sample, source_url_sample, updated_at
)
select ingredient_key, ingredient_name, source_product_count, disease_areas,
  prescription_required_observed, manufacturer_sample,
  manufacturer_origin_sample, source_url_sample, now()
from aggregated
on conflict (ingredient_key) do update set
  ingredient_name = excluded.ingredient_name,
  source_product_count = excluded.source_product_count,
  disease_areas = excluded.disease_areas,
  prescription_required_observed = excluded.prescription_required_observed,
  manufacturer_sample = excluded.manufacturer_sample,
  manufacturer_origin_sample = excluded.manufacturer_origin_sample,
  source_url_sample = excluded.source_url_sample,
  updated_at = now();
