-- Refresh static company relationships and search index materialized views instantly on contribution approval.
create or replace function private.review_industry_company_contribution(
  target_contribution uuid,
  decision text,
  reviewer_notes text default null
)
returns public.industry_company_contributions
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare
  contribution_row public.industry_company_contributions%rowtype;
  result_row public.industry_company_contributions%rowtype;
  profile_row public.industry_company_profiles%rowtype;
  v_name_en text;
  v_name_ar text;
  v_scientific text;
  v_manufacturer text;
  v_drug_class text;
  v_route text;
  v_category text;
  v_image_url text;
  v_product_url text;
  v_barcode text;
  v_product_code text;
  v_registration text;
  v_price numeric;
  v_candidate_count integer;
  v_canonical_id bigint;
  v_canonical_key text;
  v_primary_name text;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform administrators can review company contributions.' using errcode='42501';
  end if;
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode='22023';
  end if;

  select * into contribution_row
  from public.industry_company_contributions
  where id=target_contribution
  for update;
  if not found then raise exception 'Company contribution not found.' using errcode='P0002'; end if;
  if contribution_row.status not in ('submitted','under_review') then
    raise exception 'This contribution has already been reviewed.' using errcode='22023';
  end if;

  select * into profile_row from public.industry_company_profiles where id=contribution_row.profile_id;
  if profile_row.id is null then raise exception 'Company profile not found.' using errcode='P0002'; end if;

  if decision='approved' and contribution_row.contribution_type='product_addition' then
    v_name_en:=nullif(btrim(coalesce(contribution_row.payload->>'commercial_name_en',contribution_row.payload->>'product_name')),'');
    v_name_ar:=nullif(btrim(contribution_row.payload->>'commercial_name_ar'),'');
    v_scientific:=nullif(btrim(coalesce(contribution_row.payload->>'scientific_name',contribution_row.payload->>'generic_name')),'');
    v_manufacturer:=nullif(btrim(coalesce(contribution_row.payload->>'manufacturer',profile_row.display_name)),'');
    v_drug_class:=nullif(btrim(contribution_row.payload->>'drug_class'),'');
    v_route:=nullif(btrim(contribution_row.payload->>'route'),'');
    v_category:=nullif(btrim(contribution_row.payload->>'category'),'');
    v_image_url:=nullif(btrim(contribution_row.payload->>'image_url'),'');
    v_product_url:=nullif(btrim(coalesce(contribution_row.payload->>'product_url',contribution_row.payload->>'source_url')),'');
    v_barcode:=nullif(btrim(contribution_row.payload->>'barcode'),'');
    v_product_code:=nullif(btrim(contribution_row.payload->>'product_code'),'');
    v_registration:=nullif(btrim(contribution_row.payload->>'registration_reference'),'');
    v_price:=case when coalesce(contribution_row.payload->>'price_egp','') ~ '^[0-9]+([.][0-9]+)?$' then (contribution_row.payload->>'price_egp')::numeric else null end;

    if coalesce(v_name_en,v_name_ar) is null then
      raise exception 'Product additions require an English or Arabic commercial name.' using errcode='22023';
    end if;
    if cardinality(contribution_row.evidence_urls)=0 and v_registration is null and v_product_url is null then
      raise exception 'Product additions require evidence, a registration reference, or an official product URL.' using errcode='22023';
    end if;

    select count(*)::integer,min(product.canonical_id),min(product.canonical_key)
    into v_candidate_count,v_canonical_id,v_canonical_key
    from public.medicine_canonical_products_v1 product
    where ((v_name_en is not null and private.normalize_medicine_identity(product.name_en)=private.normalize_medicine_identity(v_name_en))
      or (v_name_ar is not null and private.normalize_medicine_identity(product.name_ar)=private.normalize_medicine_identity(v_name_ar)))
      and (v_manufacturer is null or product.manufacturer is null or private.normalize_medicine_identity(product.manufacturer)=private.normalize_medicine_identity(v_manufacturer))
      and (v_scientific is null or product.scientific_name is null or private.normalize_medicine_identity(product.scientific_name)=private.normalize_medicine_identity(v_scientific));

    if v_candidate_count<>1 then
      v_primary_name:=coalesce(v_name_en,v_name_ar);
      v_canonical_key:=concat_ws('|','company',contribution_row.company_slug,
        private.normalize_medicine_identity(v_primary_name),private.normalize_medicine_identity(v_scientific),
        private.normalize_medicine_identity(v_route),private.normalize_medicine_identity(v_manufacturer));
      v_canonical_id:=(('x'||substr(md5(v_canonical_key),1,13))::bit(52))::bigint;
      if exists(select 1 from public.company_verified_medicine_products where canonical_id=v_canonical_id and canonical_key<>v_canonical_key)
        or exists(select 1 from public.company_verified_medicine_products where canonical_id=v_canonical_id and canonical_key<>v_canonical_key) then
        raise exception 'Canonical product identifier collision; manual review is required.' using errcode='23505';
      end if;
    end if;

    insert into public.company_verified_medicine_products(
      contribution_id,profile_id,organization_id,company_slug,canonical_id,canonical_key,
      commercial_name_en,commercial_name_ar,scientific_name,manufacturer,drug_class,route,
      category,image_url,product_url,barcode,product_code,current_price_egp,
      registration_reference,source_name,status,approved_by,approved_at
    ) values (
      contribution_row.id,contribution_row.profile_id,contribution_row.organization_id,contribution_row.company_slug,
      v_canonical_id,v_canonical_key,v_name_en,v_name_ar,v_scientific,v_manufacturer,v_drug_class,v_route,
      v_category,v_image_url,v_product_url,v_barcode,v_product_code,v_price,v_registration,
      profile_row.display_name,'active',auth.uid(),now()
    ) on conflict(contribution_id) do update set
      canonical_id=excluded.canonical_id,canonical_key=excluded.canonical_key,
      commercial_name_en=excluded.commercial_name_en,commercial_name_ar=excluded.commercial_name_ar,
      scientific_name=excluded.scientific_name,manufacturer=excluded.manufacturer,drug_class=excluded.drug_class,
      route=excluded.route,category=excluded.category,image_url=excluded.image_url,product_url=excluded.product_url,
      barcode=excluded.barcode,product_code=excluded.product_code,current_price_egp=excluded.current_price_egp,
      registration_reference=excluded.registration_reference,status='active',approved_by=auth.uid(),approved_at=now();

    -- Automatically refresh static relationships and search indexes for instant public visibility
    perform private.refresh_medicine_product_company_relationships();
    perform public.refresh_medicine_search_index_v1();
  end if;

  update public.industry_company_contributions
  set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=reviewer_notes,
    published_at=case when decision='approved' then now() else null end
  where id=target_contribution
  returning * into result_row;
  return result_row;
end;
$$;
