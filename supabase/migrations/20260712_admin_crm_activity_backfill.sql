insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details, created_at)
select lead.id, null, 'created', 'Founder contact request imported into CRM',
       jsonb_build_object('source_path', lead.source_path, 'lead_type', lead.lead_type),
       lead.created_at
from public.partnership_leads lead
where not exists (
  select 1 from public.partnership_lead_activities activity
  where activity.lead_id = lead.id and activity.activity_type = 'created'
);
