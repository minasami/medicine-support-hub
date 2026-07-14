update public.user_notifications notification
set read_at=coalesce(notification.read_at,application.reviewed_at,now()),
    data=notification.data||jsonb_build_object(
      'status',application.status,
      'reviewed_at',application.reviewed_at,
      'reviewed_by',application.reviewed_by
    ),
    body=case
      when notification.body ilike '%Decision:%' then notification.body
      else left(notification.body||' Decision: '||case when application.status='approved' then 'approved' else 'refused' end||'.',500)
    end
from public.healthcare_entity_applications application
where notification.entity_type='healthcare_entity_application'
  and notification.entity_key=application.id::text
  and application.status in ('approved','rejected')
  and coalesce(notification.data->>'status','') is distinct from application.status;
