drop policy if exists stripe_webhook_events_service_role_all on public.stripe_webhook_events;
create policy stripe_webhook_events_service_role_all
on public.stripe_webhook_events for all to service_role
using(true) with check(true);

drop index if exists public.platform_payment_transactions_request_idx;
