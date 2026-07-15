-- Make accidental distinct-company decisions visible and reversible to platform admins.

create or replace function public.list_company_pair_reviews(p_query text default null,p_limit integer default 100)
returns setof jsonb language plpgsql stable security definer
set search_path=public,private,pg_catalog as $$
declare q text:=private.normalize_company_identity(coalesce(p_query,''));
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  return query
  select jsonb_build_object(
    'left_slug',review.left_company_slug,
    'left_name',coalesce(left_official.display_name,left_dataset.company_name,review.left_company_slug),
    'right_slug',review.right_company_slug,
    'right_name',coalesce(right_official.display_name,right_dataset.company_name,review.right_company_slug),
    'decision',review.decision,'notes',review.notes,'reviewed_at',review.reviewed_at
  )
  from public.company_directory_pair_reviews review
  left join public.industry_company_profiles left_official on left_official.company_slug=review.left_company_slug
  left join public.medicine_company_profiles left_dataset on left_dataset.company_slug=review.left_company_slug
  left join public.industry_company_profiles right_official on right_official.company_slug=review.right_company_slug
  left join public.medicine_company_profiles right_dataset on right_dataset.company_slug=review.right_company_slug
  where review.decision in ('not_duplicate','related_distinct')
    and (q='' or private.normalize_company_identity(coalesce(left_official.display_name,left_dataset.company_name,review.left_company_slug)) like '%'||q||'%'
      or private.normalize_company_identity(coalesce(right_official.display_name,right_dataset.company_name,review.right_company_slug)) like '%'||q||'%'
      or private.normalize_company_identity(review.left_company_slug) like '%'||q||'%'
      or private.normalize_company_identity(review.right_company_slug) like '%'||q||'%')
  order by review.reviewed_at desc
  limit greatest(1,least(coalesce(p_limit,100),300));
end;
$$;
revoke all on function public.list_company_pair_reviews(text,integer) from public,anon;
grant execute on function public.list_company_pair_reviews(text,integer) to authenticated,service_role;

create or replace function public.admin_undo_company_pair_review(p_left_slug text,p_right_slug text,p_reason text default null)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_catalog as $$
declare l text:=least(p_left_slug,p_right_slug); r text:=greatest(p_left_slug,p_right_slug); previous public.company_directory_pair_reviews%rowtype;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  delete from public.company_directory_pair_reviews where left_company_slug=l and right_company_slug=r returning * into previous;
  if not found then raise exception 'Reviewed company pair not found.' using errcode='P0002'; end if;
  insert into private.company_directory_merge_audit(action,source_company_slug,canonical_company_slug,classification,notes,before_snapshot,after_snapshot,performed_by)
  values('edit',l,r,'undo_'||previous.decision,coalesce(nullif(trim(p_reason),''),'Reopened company-pair review'),to_jsonb(previous),jsonb_build_object('review_reopened',true),auth.uid());
  return jsonb_build_object('left_slug',l,'right_slug',r,'review_reopened',true);
end;
$$;
revoke all on function public.admin_undo_company_pair_review(text,text,text) from public,anon;
grant execute on function public.admin_undo_company_pair_review(text,text,text) to authenticated,service_role;
