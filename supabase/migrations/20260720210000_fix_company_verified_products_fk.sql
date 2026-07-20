-- 20260720210000_fix_company_verified_products_fk.sql
-- Drop the strict foreign key constraint to industry_company_contributions 
-- because company_verified_medicine_products can now be populated from medicine_catalog_submissions

alter table public.company_verified_medicine_products
  drop constraint if exists company_verified_medicine_products_contribution_id_fkey;
