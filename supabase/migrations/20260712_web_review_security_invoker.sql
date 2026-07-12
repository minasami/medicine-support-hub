-- Platform administrators may submit attributed company evidence for moderation.
-- Review promotion uses SECURITY INVOKER so RLS remains active.

drop policy if exists industry_company_contributions_admin_insert on public.industry_company_contributions;
create policy industry_company_contributions_admin_insert
on public.industry_company_contributions for insert to authenticated
with check (
  private.is_platform_admin()
  and submitted_by = auth.uid()
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
  and review_notes is null
  and published_at is null
);

create or replace function public.review_web_ingestion_candidate(
  target_candidate uuid,
  decision text,
  reviewer_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_catalog
as $$
declare
  candidate public.web_ingestion_candidates%rowtype;
  profile_id_value uuid;
  organization_id_value uuid;
  promoted_id uuid;
  summary_value text;
  title_value text;
  price_value numeric;
begin
  if not private.is_platform_admin() then raise exception 'Platform-admin access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;

  select * into candidate from public.web_ingestion_candidates where id = target_candidate for update;
  if candidate.id is null then raise exception 'Candidate not found'; end if;
  if candidate.status not in ('pending','approved') then raise exception 'Candidate is not reviewable'; end if;

  if decision = 'rejected' then
    update public.web_ingestion_candidates
      set status='rejected', review_notes=reviewer_notes, reviewed_by=auth.uid(), reviewed_at=now()
      where id=target_candidate;
    return jsonb_build_object('status','rejected','candidate_id',target_candidate);
  end if;

  title_value := coalesce(nullif(candidate.source_title,''), initcap(candidate.entity_type)||' web evidence');
  summary_value := coalesce(nullif(candidate.extracted_data->>'summary',''), nullif(candidate.extracted_data->>'description',''), 'Structured evidence extracted from an attributed web source and submitted for human verification.');
  if length(summary_value) < 10 then summary_value := summary_value || ' Source review required.'; end if;

  if candidate.entity_type = 'medicine' and candidate.canonical_id is not null then
    begin
      price_value := nullif(regexp_replace(coalesce(candidate.extracted_data->>'price_egp',''), '[^0-9.]', '', 'g'), '')::numeric;
    exception when others then price_value := null; end;

    insert into public.medicine_collaboration_submissions(
      canonical_id, contribution_type, title, summary, proposed_price_egp,
      evidence_urls, submitted_by, organization_name, status
    ) values (
      candidate.canonical_id,
      case when price_value is not null and price_value > 0 then 'price_observation' else 'product_evidence' end,
      left(title_value, 240), left(summary_value, 4000),
      case when price_value > 0 then price_value else null end,
      array[candidate.source_url], auth.uid(), 'Firecrawl attributed source', 'submitted'
    ) returning id into promoted_id;

    update public.web_ingestion_candidates
      set status='promoted', review_notes=reviewer_notes, promoted_record_id=promoted_id,
          reviewed_by=auth.uid(), reviewed_at=now()
      where id=target_candidate;
    return jsonb_build_object('status','promoted','candidate_id',target_candidate,'record_id',promoted_id,'queue','medicine_contribution');
  end if;

  if candidate.entity_type = 'company' and candidate.company_slug is not null then
    select id, organization_id into profile_id_value, organization_id_value
    from public.industry_company_profiles
    where company_slug = candidate.company_slug and verification_status = 'verified'
    limit 1;

    if profile_id_value is not null and organization_id_value is not null then
      insert into public.industry_company_contributions(
        profile_id, organization_id, company_slug, contribution_type, title, summary,
        payload, evidence_urls, status, submitted_by
      ) values (
        profile_id_value, organization_id_value, candidate.company_slug, 'evidence',
        left(title_value, 240), left(summary_value, 4000), candidate.extracted_data,
        array[candidate.source_url], 'submitted', auth.uid()
      ) returning id into promoted_id;

      update public.web_ingestion_candidates
        set status='promoted', review_notes=reviewer_notes, promoted_record_id=promoted_id,
            reviewed_by=auth.uid(), reviewed_at=now()
        where id=target_candidate;
      return jsonb_build_object('status','promoted','candidate_id',target_candidate,'record_id',promoted_id,'queue','company_contribution');
    end if;
  end if;

  update public.web_ingestion_candidates
    set status='approved', review_notes=reviewer_notes, reviewed_by=auth.uid(), reviewed_at=now()
    where id=target_candidate;
  return jsonb_build_object('status','approved','candidate_id',target_candidate,'promotion','manual_matching_required');
end;
$$;

revoke all on function public.review_web_ingestion_candidate(uuid,text,text) from public, anon;
grant execute on function public.review_web_ingestion_candidate(uuid,text,text) to authenticated;
