-- DRAFT: governed review queue for unresolved legacy medicine references.
-- Rehearse before migration-history promotion. No legacy value is deleted.

insert into public.platform_permissions(
  permission_key, category, label, description, risk_level, is_active
) values (
  'medicines.mapping.review', 'medicines', 'Review medicine mappings',
  'Review unresolved legacy-to-canonical medicine references.', 'high', true
)
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  risk_level = excluded.risk_level,
  is_active = true;

create table if not exists public.medicine_mapping_review_queue (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in (
    'medicine_enrichments', 'medicine_enrichment_import_queue',
    'pharmacy_inventory_items'
  )),
  source_record_id text not null,
  legacy_medicine_id integer,
  legacy_name text,
  context_snapshot jsonb not null default '{}'::jsonb,
  suggested_matches jsonb not null default '[]'::jsonb,
  selected_canonical_id bigint,
  status text not null default 'pending' check (status in (
    'pending', 'in_review', 'approved', 'rejected', 'reopened'
  )),
  decision_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_record_id)
);

alter table public.medicine_mapping_review_queue enable row level security;
revoke all on public.medicine_mapping_review_queue from public, anon;
grant select on public.medicine_mapping_review_queue to authenticated, service_role;
grant insert, update, delete on public.medicine_mapping_review_queue to service_role;

drop policy if exists medicine_mapping_review_select on public.medicine_mapping_review_queue;
create policy medicine_mapping_review_select
on public.medicine_mapping_review_queue for select to authenticated
using (
  (select private.is_platform_admin())
  or (select public.platform_user_has_permission('medicines.mapping.review', null))
);

create index if not exists medicine_mapping_review_status_idx
  on public.medicine_mapping_review_queue(status, created_at desc);
create index if not exists medicine_mapping_review_legacy_idx
  on public.medicine_mapping_review_queue(legacy_medicine_id)
  where legacy_medicine_id is not null;
create index if not exists medicine_mapping_review_selected_idx
  on public.medicine_mapping_review_queue(selected_canonical_id)
  where selected_canonical_id is not null;

create or replace function private.can_review_medicine_mappings()
returns boolean language sql stable security invoker
set search_path = ''
as $$
  select private.is_platform_admin()
    or public.platform_user_has_permission('medicines.mapping.review', null)
    or public.platform_user_has_permission('industry.review', null);
$$;

revoke all on function private.can_review_medicine_mappings() from public, anon;
grant execute on function private.can_review_medicine_mappings() to authenticated, service_role;

create or replace function private.refresh_medicine_mapping_review_queue()
returns integer language plpgsql security definer
set search_path = ''
as $$
declare inserted_count integer := 0;
declare affected_count integer := 0;
begin
  if not private.can_review_medicine_mappings() then
    raise exception 'Medicine mapping review permission is required.' using errcode = '42501';
  end if;

  insert into public.medicine_mapping_review_queue(
    source_table, source_record_id, legacy_medicine_id, legacy_name,
    context_snapshot
  )
  select 'medicine_enrichments', enrichment.id::text, enrichment.medicine_id,
         medicine.name_en,
         jsonb_build_object(
           'name_en', medicine.name_en, 'name_ar', medicine.name_ar,
           'manufacturer', enrichment.manufacturer,
           'active_ingredient', enrichment.active_ingredient,
           'source_name', enrichment.source_name,
           'source_url', enrichment.source_url
         )
  from public.medicine_enrichments enrichment
  join public.medicines medicine on medicine.id = enrichment.medicine_id
  where enrichment.canonical_medicine_id is null
  on conflict (source_table, source_record_id) do update set
    legacy_medicine_id = excluded.legacy_medicine_id,
    legacy_name = excluded.legacy_name,
    context_snapshot = excluded.context_snapshot,
    updated_at = now()
  where public.medicine_mapping_review_queue.status in ('pending','in_review','reopened');
  get diagnostics inserted_count = row_count;

  insert into public.medicine_mapping_review_queue(
    source_table, source_record_id, legacy_medicine_id, legacy_name,
    context_snapshot
  )
  select 'medicine_enrichment_import_queue', queue.id::text,
         queue.suggested_medicine_id,
         coalesce(queue.source_name_en, queue.source_name_ar),
         jsonb_build_object(
           'source_name_en', queue.source_name_en,
           'source_name_ar', queue.source_name_ar,
           'source_barcode', queue.source_barcode,
           'source_name', queue.source_name,
           'source_url', queue.source_url
         )
  from public.medicine_enrichment_import_queue queue
  where queue.suggested_medicine_id is not null
    and queue.canonical_medicine_id is null
  on conflict (source_table, source_record_id) do update set
    legacy_medicine_id = excluded.legacy_medicine_id,
    legacy_name = excluded.legacy_name,
    context_snapshot = excluded.context_snapshot,
    updated_at = now()
  where public.medicine_mapping_review_queue.status in ('pending','in_review','reopened');
  get diagnostics affected_count = row_count;
  inserted_count := inserted_count + affected_count;

  insert into public.medicine_mapping_review_queue(
    source_table, source_record_id, legacy_medicine_id, legacy_name,
    context_snapshot
  )
  select 'pharmacy_inventory_items', item.id::text, item.medicine_id,
         item.item_name,
         jsonb_build_object(
           'item_name', item.item_name, 'barcode', item.barcode,
           'branch_id', item.branch_id
         )
  from public.pharmacy_inventory_items item
  where item.medicine_id is not null and item.canonical_medicine_id is null
  on conflict (source_table, source_record_id) do update set
    legacy_medicine_id = excluded.legacy_medicine_id,
    legacy_name = excluded.legacy_name,
    context_snapshot = excluded.context_snapshot,
    updated_at = now()
  where public.medicine_mapping_review_queue.status in ('pending','in_review','reopened');
  get diagnostics affected_count = row_count;
  inserted_count := inserted_count + affected_count;

  return inserted_count;
end;
$$;

create or replace function private.review_medicine_mapping(
  p_review_id uuid, p_decision text, p_canonical_id bigint default null,
  p_note text default null
) returns public.medicine_mapping_review_queue
language plpgsql security definer set search_path = ''
as $$
declare review_row public.medicine_mapping_review_queue;
begin
  if not private.can_review_medicine_mappings() then
    raise exception 'Medicine mapping review permission is required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved','rejected','reopened') then
    raise exception 'Unsupported mapping decision.' using errcode = '22023';
  end if;
  if p_decision = 'approved' and p_canonical_id is null then
    raise exception 'Choose a canonical medicine before approval.' using errcode = '22023';
  end if;
  if p_decision = 'approved' and not exists (
    select 1 from public.medicine_canonical_products_v1
    where canonical_id = p_canonical_id
  ) then
    raise exception 'Canonical medicine does not exist.' using errcode = '23503';
  end if;

  select * into review_row
  from public.medicine_mapping_review_queue where id = p_review_id for update;
  if review_row.id is null then raise exception 'Mapping review was not found.' using errcode='P0002'; end if;

  if p_decision = 'approved' then
    if review_row.source_table = 'medicine_enrichments' then
      update public.medicine_enrichments set canonical_medicine_id=p_canonical_id
      where id::text=review_row.source_record_id;
    elsif review_row.source_table = 'medicine_enrichment_import_queue' then
      update public.medicine_enrichment_import_queue set canonical_medicine_id=p_canonical_id
      where id::text=review_row.source_record_id;
    elsif review_row.source_table = 'pharmacy_inventory_items' then
      update public.pharmacy_inventory_items set canonical_medicine_id=p_canonical_id
      where id::text=review_row.source_record_id;
    end if;
  elsif p_decision = 'reopened' and review_row.selected_canonical_id is not null then
    if review_row.source_table = 'medicine_enrichments' then
      update public.medicine_enrichments set canonical_medicine_id=null
      where id::text=review_row.source_record_id and canonical_medicine_id=review_row.selected_canonical_id;
    elsif review_row.source_table = 'medicine_enrichment_import_queue' then
      update public.medicine_enrichment_import_queue set canonical_medicine_id=null
      where id::text=review_row.source_record_id and canonical_medicine_id=review_row.selected_canonical_id;
    elsif review_row.source_table = 'pharmacy_inventory_items' then
      update public.pharmacy_inventory_items set canonical_medicine_id=null
      where id::text=review_row.source_record_id and canonical_medicine_id=review_row.selected_canonical_id;
    end if;
  end if;

  update public.medicine_mapping_review_queue set
    status=p_decision,
    selected_canonical_id=case when p_decision='approved' then p_canonical_id else null end,
    decision_note=nullif(trim(coalesce(p_note,'')),''),
    reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  where id=p_review_id returning * into review_row;
  return review_row;
end;
$$;

revoke all on function private.refresh_medicine_mapping_review_queue() from public, anon;
revoke all on function private.review_medicine_mapping(uuid,text,bigint,text) from public, anon;
grant execute on function private.refresh_medicine_mapping_review_queue() to authenticated, service_role;
grant execute on function private.review_medicine_mapping(uuid,text,bigint,text) to authenticated, service_role;

create or replace function public.refresh_medicine_mapping_review_queue()
returns integer language sql security invoker set search_path=''
as $$ select private.refresh_medicine_mapping_review_queue(); $$;
create or replace function public.review_medicine_mapping(
  p_review_id uuid, p_decision text, p_canonical_id bigint default null,
  p_note text default null
) returns public.medicine_mapping_review_queue
language sql security invoker set search_path=''
as $$ select private.review_medicine_mapping(p_review_id,p_decision,p_canonical_id,p_note); $$;

revoke all on function public.refresh_medicine_mapping_review_queue() from public, anon;
revoke all on function public.review_medicine_mapping(uuid,text,bigint,text) from public, anon;
grant execute on function public.refresh_medicine_mapping_review_queue() to authenticated, service_role;
grant execute on function public.review_medicine_mapping(uuid,text,bigint,text) to authenticated, service_role;
