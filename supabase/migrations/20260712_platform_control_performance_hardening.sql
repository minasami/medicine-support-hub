-- Cover new foreign keys and avoid repeated per-row auth evaluation in RLS.

create index if not exists document_ocr_jobs_created_by_idx on public.document_ocr_jobs(created_by);
create index if not exists document_ocr_jobs_reviewed_by_idx on public.document_ocr_jobs(reviewed_by) where reviewed_by is not null;
create index if not exists platform_setting_history_changed_by_idx on public.platform_setting_history(changed_by) where changed_by is not null;
create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by) where updated_by is not null;
create index if not exists web_ingestion_candidates_job_idx on public.web_ingestion_candidates(job_id);
create index if not exists web_ingestion_candidates_reviewed_by_idx on public.web_ingestion_candidates(reviewed_by) where reviewed_by is not null;
create index if not exists web_ingestion_jobs_requested_by_idx on public.web_ingestion_jobs(requested_by) where requested_by is not null;
create index if not exists web_ingestion_jobs_source_idx on public.web_ingestion_jobs(source_id);
create index if not exists web_ingestion_sources_created_by_idx on public.web_ingestion_sources(created_by);
create index if not exists web_ingestion_sources_updated_by_idx on public.web_ingestion_sources(updated_by) where updated_by is not null;

-- One authenticated INSERT policy supports both organization members and platform admins.
drop policy if exists industry_company_contributions_admin_insert on public.industry_company_contributions;
drop policy if exists industry_company_contributions_member_insert on public.industry_company_contributions;
create policy industry_company_contributions_member_or_admin_insert
on public.industry_company_contributions for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and published_at is null
  and (
    (select private.is_platform_admin())
    or (select private.is_org_member(industry_company_contributions.organization_id))
  )
);

-- Separate anonymous public reads from a single authenticated public-or-admin policy.
drop policy if exists platform_settings_admin_select on public.platform_settings;
drop policy if exists platform_settings_public_select on public.platform_settings;
create policy platform_settings_anon_public_select
on public.platform_settings for select to anon
using (is_public = true);
create policy platform_settings_authenticated_select
on public.platform_settings for select to authenticated
using (is_public = true or (select private.is_platform_admin()));

-- Rebuild platform-setting writes with cached authorization checks.
drop policy if exists platform_settings_admin_insert on public.platform_settings;
create policy platform_settings_admin_insert on public.platform_settings for insert to authenticated
with check ((select private.is_platform_admin()));
drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings for update to authenticated
using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()));
drop policy if exists platform_settings_admin_delete on public.platform_settings;
create policy platform_settings_admin_delete on public.platform_settings for delete to authenticated
using ((select private.is_platform_admin()));

drop policy if exists platform_setting_history_admin_select on public.platform_setting_history;
create policy platform_setting_history_admin_select on public.platform_setting_history for select to authenticated
using ((select private.is_platform_admin()));

-- Rebuild private ingestion policies with one initialization-plan authorization lookup.
do $$
declare
  target text;
  policy_name text;
begin
  foreach target in array array['document_ocr_jobs','web_ingestion_sources','web_ingestion_jobs','web_ingestion_candidates'] loop
    policy_name := target || '_admin_select';
    execute format('drop policy if exists %I on public.%I', policy_name, target);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_platform_admin()))', policy_name, target);

    policy_name := target || '_admin_insert';
    execute format('drop policy if exists %I on public.%I', policy_name, target);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_platform_admin()))', policy_name, target);

    policy_name := target || '_admin_update';
    execute format('drop policy if exists %I on public.%I', policy_name, target);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_platform_admin())) with check ((select private.is_platform_admin()))', policy_name, target);

    policy_name := target || '_admin_delete';
    execute format('drop policy if exists %I on public.%I', policy_name, target);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_platform_admin()))', policy_name, target);
  end loop;
end $$;
