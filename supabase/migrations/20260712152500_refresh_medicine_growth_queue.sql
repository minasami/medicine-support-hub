-- Refresh the bounded, prioritized medicine data-growth queue and its public-safe health metrics.

create or replace function public.refresh_medicine_growth_queue_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  refreshed timestamptz := clock_timestamp();
  queue_limit integer := 250;
  upserted bigint := 0;
  open_rows bigint := 0;
begin
  select greatest(25,least(1000,coalesce((value #>> '{}')::integer,250)))
    into queue_limit
  from public.platform_settings
  where setting_key='growth.queue_per_gap';
  queue_limit:=coalesce(queue_limit,250);

  with opportunities as (
    select canonical_id,'price'::text gap_type,
      least(200,110+source_count*3+case when has_verified_dataset then 15 else 0 end)::integer priority
    from private.medicine_search_index_v1 where current_price_egp is null
    union all
    select canonical_id,'scientific_name',
      least(200,95+source_count*3+case when current_price_egp is not null then 5 else 0 end)::integer
    from private.medicine_search_index_v1 where nullif(btrim(scientific_name),'') is null
    union all
    select canonical_id,'manufacturer',
      least(200,90+source_count*3+case when current_price_egp is not null then 5 else 0 end)::integer
    from private.medicine_search_index_v1 where nullif(btrim(manufacturer),'') is null
    union all
    select canonical_id,'drug_class',least(200,80+source_count*2)::integer
    from private.medicine_search_index_v1 where nullif(btrim(drug_class),'') is null
    union all
    select canonical_id,'route',least(200,75+source_count*2)::integer
    from private.medicine_search_index_v1 where nullif(btrim(route),'') is null
    union all
    select canonical_id,'image',least(200,70+source_count*2+case when has_verified_dataset then 10 else 0 end)::integer
    from private.medicine_search_index_v1 where image_url is null
    union all
    select canonical_id,'price_history',least(200,65+source_count*2)::integer
    from private.medicine_search_index_v1 where not has_price_history
    union all
    select canonical_id,'category',least(200,55+source_count*2)::integer
    from private.medicine_search_index_v1 where nullif(btrim(category),'') is null
  ), ranked as (
    select opportunities.*,
      row_number() over(partition by gap_type order by priority desc,canonical_id) gap_rank
    from opportunities
  )
  insert into public.medicine_data_growth_queue(
    canonical_id,gap_type,priority,recommended_source_tier,status,first_seen_at,last_seen_at
  )
  select canonical_id,gap_type,priority,
    case when gap_type in ('price','scientific_name','manufacturer') then 'official' else 'trusted_reference' end,
    'open',refreshed,refreshed
  from ranked where gap_rank<=queue_limit
  on conflict(canonical_id,gap_type) do update set
    priority=excluded.priority,
    recommended_source_tier=excluded.recommended_source_tier,
    status=case
      when public.medicine_data_growth_queue.status in ('in_review','ignored') then public.medicine_data_growth_queue.status
      else 'open'
    end,
    last_seen_at=excluded.last_seen_at,
    resolved_at=null;

  get diagnostics upserted = row_count;

  update public.medicine_data_growth_queue queue
  set status='resolved',resolved_at=refreshed,last_seen_at=refreshed
  where queue.status not in ('resolved','ignored')
    and not exists (
      select 1 from private.medicine_search_index_v1 indexed
      where indexed.canonical_id=queue.canonical_id
        and case queue.gap_type
          when 'price' then indexed.current_price_egp is null
          when 'scientific_name' then nullif(btrim(indexed.scientific_name),'') is null
          when 'manufacturer' then nullif(btrim(indexed.manufacturer),'') is null
          when 'drug_class' then nullif(btrim(indexed.drug_class),'') is null
          when 'route' then nullif(btrim(indexed.route),'') is null
          when 'category' then nullif(btrim(indexed.category),'') is null
          when 'image' then indexed.image_url is null
          when 'price_history' then not indexed.has_price_history
          else false
        end
    );

  update public.medicine_data_growth_queue queue
  set evidence_candidate_count=(
    select count(*)::integer
    from public.web_ingestion_candidates candidate
    where candidate.canonical_id=queue.canonical_id
      and candidate.status in ('pending','approved')
  );

  select count(*) into open_rows
  from public.medicine_data_growth_queue
  where status in ('open','queued','in_review');

  insert into public.medicine_data_growth_metrics_cache_v1(
    singleton,canonical_products,missing_scientific_name,missing_manufacturer,missing_drug_class,
    missing_route,missing_category,missing_image,missing_price,missing_price_history,
    active_growth_queue,active_scheduled_sources,pending_evidence_candidates,refreshed_at
  )
  select true,count(*)::bigint,
    count(*) filter(where nullif(btrim(scientific_name),'') is null)::bigint,
    count(*) filter(where nullif(btrim(manufacturer),'') is null)::bigint,
    count(*) filter(where nullif(btrim(drug_class),'') is null)::bigint,
    count(*) filter(where nullif(btrim(route),'') is null)::bigint,
    count(*) filter(where nullif(btrim(category),'') is null)::bigint,
    count(*) filter(where image_url is null)::bigint,
    count(*) filter(where current_price_egp is null)::bigint,
    count(*) filter(where not has_price_history)::bigint,
    open_rows,
    (select count(*) from public.web_ingestion_sources where is_active and schedule_enabled)::bigint,
    (select count(*) from public.web_ingestion_candidates where status='pending')::bigint,
    refreshed
  from private.medicine_search_index_v1
  on conflict(singleton) do update set
    canonical_products=excluded.canonical_products,
    missing_scientific_name=excluded.missing_scientific_name,
    missing_manufacturer=excluded.missing_manufacturer,
    missing_drug_class=excluded.missing_drug_class,
    missing_route=excluded.missing_route,
    missing_category=excluded.missing_category,
    missing_image=excluded.missing_image,
    missing_price=excluded.missing_price,
    missing_price_history=excluded.missing_price_history,
    active_growth_queue=excluded.active_growth_queue,
    active_scheduled_sources=excluded.active_scheduled_sources,
    pending_evidence_candidates=excluded.pending_evidence_candidates,
    refreshed_at=excluded.refreshed_at;

  return jsonb_build_object(
    'refreshed_at',refreshed,
    'queue_limit_per_gap',queue_limit,
    'upserted',upserted,
    'open_items',open_rows
  );
end;
$$;

revoke all on function public.refresh_medicine_growth_queue_v1() from public,anon,authenticated;
grant execute on function public.refresh_medicine_growth_queue_v1() to service_role;

select public.refresh_medicine_growth_queue_v1();
