create index if not exists notification_campaigns_created_by_fk_idx
  on public.notification_campaigns(created_by)
  where created_by is not null;

create index if not exists notification_deliveries_subscription_fk_idx
  on public.notification_deliveries(subscription_id)
  where subscription_id is not null;

create index if not exists user_notifications_campaign_fk_idx
  on public.user_notifications(campaign_id)
  where campaign_id is not null;
