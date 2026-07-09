create or replace function public.normalize_verified_product_prices()
returns table(active_records integer, archived_lower_price_records integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  with ranked as (
    select
      id,
      max(final_price) over (partition by specification_key) as max_price,
      row_number() over (
        partition by specification_key
        order by final_price desc nulls last, updated_at desc, id desc
      ) as rank_in_spec
    from public.verified_medicine_source_products
    where source_name = 'User-verified medicines CSV'
  )
  update public.verified_medicine_source_products p
  set duplicate_status = case when r.rank_in_spec = 1 then 'active' else 'archived_lower_price' end,
      active_price_kept = r.max_price,
      archived_reason = case
        when r.rank_in_spec = 1 then null
        else concat('Lower price archived; highest verified price for same specification is ', r.max_price, ' ', p.price_currency, '.')
      end,
      updated_at = now()
  from ranked r
  where p.id = r.id;

  perform public.refresh_medicine_company_profiles();

  return query
  select
    count(*) filter (where duplicate_status = 'active')::int,
    count(*) filter (where duplicate_status = 'archived_lower_price')::int
  from public.verified_medicine_source_products
  where source_name = 'User-verified medicines CSV';
end;
$$;

grant execute on function public.normalize_verified_product_prices() to authenticated;
