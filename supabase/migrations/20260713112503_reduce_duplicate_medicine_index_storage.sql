-- Reclaim free-plan database capacity without deleting medicine records.
-- These indexes duplicated broader search-vector/identifier indexes or were
-- unused by the active v4/v5 encyclopedia search path.
drop index if exists private.medicine_canonical_products_v1_search_trgm_idx;
drop index if exists private.medicine_canonical_products_v1_name_ar_idx;
drop index if exists private.medicine_canonical_products_v1_name_en_idx;
drop index if exists private.medicine_canonical_products_v1_history_idx;

drop index if exists private.medicine_search_index_v1_name_en_trgm_idx;
drop index if exists private.medicine_search_index_v1_name_ar_trgm_idx;
drop index if exists private.medicine_search_index_v1_scientific_trgm_idx;
drop index if exists private.medicine_search_index_v1_class_trgm_idx;
drop index if exists private.medicine_search_index_v1_route_trgm_idx;
drop index if exists private.medicine_search_index_v1_category_trgm_idx;
drop index if exists private.medicine_search_index_v1_sources_idx;
drop index if exists private.medicine_search_index_v1_price_idx;

drop index if exists private.medicine_price_history_v1_current_idx;
