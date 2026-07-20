-- 20260720250000_fix_auto_publish_status_check.sql
-- Change status value used in auto-approval from 'published' to 'approved'
-- to satisfy the medicine_catalog_submissions_status_check constraint.

drop trigger if exists auto_publish_verified_medicine_submissions_trigger on public.medicine_catalog_submissions;

create or replace function public.auto_publish_verified_medicine_submissions()
returns trigger language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare
  profile_row public.industry_company_profiles%rowtype;
  v_name_en text;
  v_name_ar text;
  v_scientific text;
  v_manufacturer text;
  v_drug_class text;
  v_route text;
  v_category text;
  v_image_url text;
  v_barcode text;
  v_product_code text;
  v_price numeric;
  v_canonical_id bigint;
  v_canonical_key text;
begin
  -- Intercept only company representative submissions
  if new.submitter_kind = 'company_representative' and new.status = 'submitted' then
    
    -- Verify the company profile
    select * into profile_row from public.industry_company_profiles where id = new.company_profile_id;
    
    if found and profile_row.verification_status = 'verified' then
      -- Auto approve the submission row using 'approved' to respect the check constraint
      new.status := 'approved';
      new.reviewed_by := new.submitted_by;
      new.reviewed_at := now();
      new.review_notes := 'Auto-published for verified company representative.';
      
      -- Extract fields from the payload
      v_name_en := nullif(btrim(new.medicine_name), '');
      v_name_ar := nullif(btrim(new.name_ar), '');
      v_scientific := nullif(btrim(new.scientific_name), '');
      v_manufacturer := nullif(btrim(new.manufacturer_name), '');
      if v_manufacturer is null then 
        v_manufacturer := profile_row.display_name; 
      end if;
      
      v_drug_class := nullif(btrim(new.drug_class), '');
      v_route := nullif(btrim(new.route), '');
      v_category := nullif(btrim(new.category), '');
      v_image_url := nullif(btrim(new.image_url), '');
      v_barcode := nullif(btrim(new.barcode), '');
      v_product_code := nullif(btrim(new.code), '');
      v_price := new.price_egp;
      
      -- Determine canonical key and ID
      if new.canonical_id is not null then
        v_canonical_id := new.canonical_id;
        
        -- Try to fetch canonical_key from company_verified_medicine_products
        select canonical_key into v_canonical_key 
        from public.company_verified_medicine_products 
        where canonical_id = v_canonical_id limit 1;
        
        -- Fallback to medicine_canonical_products_v1
        if v_canonical_key is null then
          select canonical_key into v_canonical_key 
          from public.medicine_canonical_products_v1 
          where canonical_id = v_canonical_id limit 1;
        end if;
      else
        v_canonical_key := concat_ws('|', 'company', new.request_company_slug,
          private.normalize_medicine_identity(coalesce(v_name_en, v_name_ar)),
          private.normalize_medicine_identity(v_scientific),
          private.normalize_medicine_identity(v_route),
          private.normalize_medicine_identity(v_manufacturer));
        v_canonical_id := (('x' || substr(md5(v_canonical_key), 1, 13))::bit(52))::bigint;
      end if;
      
      -- Insert or update company verified products
      insert into public.company_verified_medicine_products(
        contribution_id, profile_id, organization_id, company_slug, canonical_id, canonical_key,
        commercial_name_en, commercial_name_ar, scientific_name, manufacturer, drug_class, route,
        category, image_url, barcode, product_code, current_price_egp,
        source_name, status, approved_by, approved_at
      ) values (
        new.id, profile_row.id, profile_row.organization_id, profile_row.company_slug,
        v_canonical_id, coalesce(v_canonical_key, ''), v_name_en, v_name_ar, v_scientific, v_manufacturer, v_drug_class, v_route,
        v_category, v_image_url, v_barcode, v_product_code, v_price,
        profile_row.display_name, 'active', new.submitted_by, now()
      ) on conflict (contribution_id) do update set
        canonical_id = excluded.canonical_id, canonical_key = excluded.canonical_key,
        commercial_name_en = excluded.commercial_name_en, commercial_name_ar = excluded.commercial_name_ar,
        scientific_name = excluded.scientific_name, manufacturer = excluded.manufacturer, drug_class = excluded.drug_class,
        route = excluded.route, category = excluded.category, image_url = excluded.image_url,
        barcode = excluded.barcode, product_code = excluded.product_code, current_price_egp = excluded.current_price_egp,
        status = 'active', approved_by = new.submitted_by, approved_at = now();
    end if;
  end if;
  
  return new;
end;
$$;

create trigger auto_publish_verified_medicine_submissions_trigger
before insert on public.medicine_catalog_submissions
for each row
execute function public.auto_publish_verified_medicine_submissions();


drop policy if exists medicine_catalog_submission_own_insert on public.medicine_catalog_submissions;
create policy medicine_catalog_submission_own_insert
on public.medicine_catalog_submissions for insert to authenticated
with check (
  submitted_by=(select auth.uid())
  and status in ('submitted', 'approved')
  and (reviewed_by is null or reviewed_by=(select auth.uid()))
  and (
    (submitter_kind='individual' and company_profile_id is null and organization_id is null)
    or (
      submitter_kind='company_representative'
      and exists (
        select 1
        from public.industry_company_profiles profile
        where profile.id=company_profile_id
          and profile.organization_id=medicine_catalog_submissions.organization_id
          and profile.company_slug=medicine_catalog_submissions.request_company_slug
          and profile.verification_status='verified'
          and private.is_org_member(profile.organization_id)
          and (
            submission_kind not in ('portfolio_correction','portfolio_disassociation','product_photo_update')
            or exists (
              select 1
              from public.medicine_product_company_relationships relationship
              left join public.company_directory_aliases relationship_alias
                on relationship_alias.source_company_slug=relationship.company_slug and relationship_alias.is_active
              left join public.company_directory_aliases profile_alias
                on profile_alias.source_company_slug=profile.company_slug and profile_alias.is_active
              where relationship.canonical_id=medicine_catalog_submissions.canonical_id
                and coalesce(relationship_alias.canonical_company_slug,relationship.company_slug)
                    =coalesce(profile_alias.canonical_company_slug,profile.company_slug)
            )
          )
      )
    )
  )
);
