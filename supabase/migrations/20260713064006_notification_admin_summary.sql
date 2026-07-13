create or replace function public.notification_admin_summary()
returns table(active_subscriptions bigint,subscribed_users bigint,draft_campaigns bigint,sent_campaigns bigint,total_delivered bigint,total_failed bigint)
language plpgsql stable security definer set search_path=public,private,pg_catalog as $$
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator required' using errcode='42501'; end if;
  return query select
    (select count(*) from public.push_subscriptions where is_enabled),
    (select count(distinct user_id) from public.push_subscriptions where is_enabled),
    (select count(*) from public.notification_campaigns where status in ('draft','scheduled')),
    (select count(*) from public.notification_campaigns where status='sent'),
    (select coalesce(sum(delivered_count),0) from public.notification_campaigns),
    (select coalesce(sum(failed_count),0) from public.notification_campaigns);
end;
$$;
revoke all on function public.notification_admin_summary() from public,anon;
grant execute on function public.notification_admin_summary() to authenticated,service_role;
