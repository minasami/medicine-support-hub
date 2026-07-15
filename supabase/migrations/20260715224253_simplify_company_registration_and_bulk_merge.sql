alter table public.industry_company_profile_claims
  add column if not exists evidence_file_paths text[] not null default '{}'::text[];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-verification-documents',
  'company-verification-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_verification_documents_insert on storage.objects;
create policy company_verification_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists company_verification_documents_select on storage.objects;
create policy company_verification_documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'company-verification-documents'
  and (
    owner_id = (select auth.uid()::text)
    or private.is_platform_admin()
  )
);

drop policy if exists company_verification_documents_delete on storage.objects;
create policy company_verification_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-verification-documents'
  and owner_id = (select auth.uid()::text)
);

create or replace function public.admin_bulk_merge_company_profiles(
  p_source_slugs text[],
  p_target_slug text,
  p_classification text default 'administrative_consolidation'
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  source_slug text;
  merged_sources text[] := '{}'::text[];
  merge_result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator access required.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_source_slugs, 1), 0) = 0 then
    raise exception 'Select at least one source company.' using errcode = '22023';
  end if;
  if coalesce(array_length(p_source_slugs, 1), 0) > 100 then
    raise exception 'A bulk merge is limited to 100 source companies.' using errcode = '22023';
  end if;

  foreach source_slug in array p_source_slugs loop
    source_slug := trim(source_slug);
    if source_slug is null or source_slug = '' or source_slug = trim(p_target_slug) then
      continue;
    end if;
    merge_result := public.admin_merge_company_profiles(
      source_slug,
      trim(p_target_slug),
      p_classification,
      'Platform administrator bulk merge'
    );
    merged_sources := array_append(merged_sources, merge_result->>'source_company_slug');
  end loop;

  if coalesce(array_length(merged_sources, 1), 0) = 0 then
    raise exception 'Select at least one source different from the canonical company.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'canonical_company_slug', trim(p_target_slug),
    'merged_sources', to_jsonb(merged_sources),
    'merged_count', array_length(merged_sources, 1),
    'reversible', true
  );
end;
$$;

revoke all on function public.admin_bulk_merge_company_profiles(text[], text, text) from public, anon;
grant execute on function public.admin_bulk_merge_company_profiles(text[], text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
