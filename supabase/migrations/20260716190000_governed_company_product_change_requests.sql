-- Verified company representatives can propose governed product corrections,
-- portfolio disassociation, and updated imagery without directly mutating public data.

alter table public.medicine_catalog_submissions
  add column if not exists canonical_id bigint,
  add column if not exists request_company_slug text;

alter table public.medicine_catalog_submissions
  drop constraint if exists medicine_catalog_submissions_submission_kind_check;
alter table public.medicine_catalog_submissions
  add constraint medicine_catalog_submissions_submission_kind_check check (submission_kind in (
    'medicine_addition','medicine_correction','dataset','spreadsheet','database_export',
    'portfolio_correction','portfolio_disassociation','product_photo_update'
  ));

alter table public.medicine_catalog_submissions
  drop constraint if exists medicine_catalog_submissions_check1;
alter table public.medicine_catalog_submissions
  drop constraint if exists medicine_catalog_submissions_file_requirement_check;
alter table public.medicine_catalog_submissions
  add constraint medicine_catalog_submissions_file_requirement_check check (
    case
      when submission_kind in ('dataset','spreadsheet','database_export','product_photo_update') then cardinality(file_paths) > 0
      else true
    end
  );

alter table public.medicine_catalog_submissions
  add constraint medicine_catalog_submissions_product_action_check check (
    submission_kind not in ('portfolio_correction','portfolio_disassociation','product_photo_update')
    or (canonical_id is not null and company_profile_id is not null and organization_id is not null and request_company_slug is not null)
  ) not valid;
alter table public.medicine_catalog_submissions validate constraint medicine_catalog_submissions_product_action_check;

create index if not exists medicine_catalog_submissions_product_idx
  on public.medicine_catalog_submissions(canonical_id,request_company_slug,status,created_at desc)
  where canonical_id is not null;

drop policy if exists medicine_catalog_submission_own_insert on public.medicine_catalog_submissions;
create policy medicine_catalog_submission_own_insert
on public.medicine_catalog_submissions for insert to authenticated
with check (
  submitted_by=(select auth.uid())
  and status='submitted'
  and reviewed_by is null
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

update storage.buckets
set allowed_mime_types=array[
  'text/csv','application/json','application/pdf','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet','application/zip',
  'image/jpeg','image/png','image/webp'
]
where id='medicine-data-submissions';

comment on column public.medicine_catalog_submissions.canonical_id is
  'Canonical medicine targeted by a governed product-level request.';
comment on column public.medicine_catalog_submissions.request_company_slug is
  'Verified represented company submitting the governed request.';

-- Older discovery views pointed a company result at the directory page. Preserve
-- their shape and permissions while routing every company result to its profile.
do $$
declare view_name text; view_sql text;
begin
  foreach view_name in array array['platform_connection_graph_nodes','platform_universal_search_index','public_seo_catalog'] loop
    select pg_get_viewdef(format('public.%I',view_name)::regclass,true) into view_sql;
    if view_sql like '%/companies?company=%' then
      view_sql:=replace(view_sql,'''/companies?company=''::text ||','''/companies/''::text ||');
      execute format('create or replace view public.%I as %s',view_name,view_sql);
    end if;
  end loop;
end $$;
