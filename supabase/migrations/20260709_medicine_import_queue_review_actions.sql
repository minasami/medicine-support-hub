create or replace function public.accept_medicine_import_queue_row(
  p_queue_id uuid,
  p_medicine_id integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue public.medicine_enrichment_import_queue%rowtype;
  v_enrichment_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform admins can accept medicine import queue rows.';
  end if;

  select * into v_queue
  from public.medicine_enrichment_import_queue
  where id = p_queue_id
  for update;

  if not found then
    raise exception 'Import queue row not found.';
  end if;

  if v_queue.match_status <> 'unmatched' and v_queue.match_status <> 'candidate' then
    raise exception 'Only unmatched or candidate rows can be accepted.';
  end if;

  if not exists (select 1 from public.medicines where id = p_medicine_id and is_active = true) then
    raise exception 'Target medicine not found or inactive.';
  end if;

  insert into public.medicine_enrichments (
    medicine_id,
    barcode,
    price_amount,
    price_currency,
    price_updated_at,
    source_name,
    source_url,
    source_type,
    confidence,
    notes,
    reviewed_by,
    reviewed_at
  ) values (
    p_medicine_id,
    nullif(v_queue.source_barcode, ''),
    v_queue.source_price_amount,
    coalesce(v_queue.source_price_currency, 'EGP'),
    v_queue.source_price_updated_at,
    v_queue.source_name,
    coalesce(v_queue.source_url, '/data-sources/item-export-20260501'),
    'manual_review',
    'verified',
    concat('Accepted from import queue. Arabic item: ', coalesce(v_queue.source_name_ar, '—'), '. English item: ', coalesce(v_queue.source_name_en, '—'), '. Item code: ', coalesce(v_queue.source_item_code, '—')),
    auth.uid(),
    now()
  )
  returning id into v_enrichment_id;

  update public.medicine_enrichment_import_queue
  set match_status = 'accepted',
      suggested_medicine_id = p_medicine_id,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now(),
      review_notes = coalesce(review_notes, '') || ' Accepted into verified medicine enrichment.'
  where id = p_queue_id;

  return v_enrichment_id;
end;
$$;

create or replace function public.reject_medicine_import_queue_row(
  p_queue_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform admins can reject medicine import queue rows.';
  end if;

  update public.medicine_enrichment_import_queue
  set match_status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now(),
      review_notes = coalesce(p_reason, 'Rejected during admin review.')
  where id = p_queue_id
    and match_status in ('unmatched', 'candidate');

  if not found then
    raise exception 'Import queue row not found or not reviewable.';
  end if;
end;
$$;

grant execute on function public.accept_medicine_import_queue_row(uuid, integer) to authenticated;
grant execute on function public.reject_medicine_import_queue_row(uuid, text) to authenticated;
