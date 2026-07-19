-- Reviewer assistance for Phase 0 mapping exceptions.
-- Suggestions never approve a mapping or modify a source record.

create or replace function private.refresh_medicine_mapping_suggestions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_count integer := 0;
begin
  if not private.can_review_medicine_mappings() then
    raise exception 'Medicine mapping review permission is required.' using errcode = '42501';
  end if;

  with candidates as (
    select
      review.id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'canonical_id', medicine.canonical_id,
            'name_en', medicine.name_en,
            'name_ar', medicine.name_ar,
            'manufacturer', medicine.manufacturer,
            'scientific_name', medicine.scientific_name,
            'match_reason', 'Exact normalized product name',
            'confidence', 'high'
          ) order by medicine.canonical_id
        ) filter (where medicine.canonical_id is not null),
        '[]'::jsonb
      ) as suggestions
    from public.medicine_mapping_review_queue review
    left join public.medicine_canonical_products_v1 medicine
      on lower(regexp_replace(trim(coalesce(medicine.name_en, '')), '\s+', ' ', 'g'))
       = lower(regexp_replace(trim(coalesce(review.legacy_name, '')), '\s+', ' ', 'g'))
    where review.status in ('pending', 'in_review', 'reopened')
    group by review.id
  )
  update public.medicine_mapping_review_queue review
  set suggested_matches = candidates.suggestions,
      updated_at = now()
  from candidates
  where review.id = candidates.id
    and review.suggested_matches is distinct from candidates.suggestions;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

revoke all on function private.refresh_medicine_mapping_suggestions() from public, anon;
grant execute on function private.refresh_medicine_mapping_suggestions() to authenticated, service_role;

create or replace function public.refresh_medicine_mapping_suggestions()
returns integer
language sql
security invoker
set search_path = ''
as $$ select private.refresh_medicine_mapping_suggestions(); $$;

revoke all on function public.refresh_medicine_mapping_suggestions() from public, anon;
grant execute on function public.refresh_medicine_mapping_suggestions() to authenticated, service_role;

select private.refresh_medicine_mapping_suggestions();
