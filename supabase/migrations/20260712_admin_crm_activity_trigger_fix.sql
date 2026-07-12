-- Split lead activity logging from timestamp mutation so INSERT logging occurs
-- after the parent lead exists and cannot violate the activity foreign key.

drop trigger if exists partnership_lead_activity_log on public.partnership_leads;

create or replace function private.touch_partnership_lead_activity_time()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.last_activity_at := now();
  return new;
end;
$$;

revoke all on function private.touch_partnership_lead_activity_time() from public;

drop trigger if exists partnership_lead_touch_activity_time on public.partnership_leads;
create trigger partnership_lead_touch_activity_time
before update on public.partnership_leads
for each row execute function private.touch_partnership_lead_activity_time();

create or replace function private.log_partnership_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'created', 'Founder contact request created', jsonb_build_object('source_path', new.source_path, 'lead_type', new.lead_type));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'status_changed', 'Lead status changed', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.follow_up_at is distinct from old.follow_up_at or new.next_action is distinct from old.next_action then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'follow_up_changed', 'Follow-up plan changed', jsonb_build_object('follow_up_at', new.follow_up_at, 'next_action', new.next_action));
  end if;
  if new.admin_notes is distinct from old.admin_notes then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary)
    values (new.id, actor, 'note_changed', 'Admin notes updated');
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'assignment_changed', 'Lead assignment changed', jsonb_build_object('assigned_to', new.assigned_to));
  end if;
  if new.priority is distinct from old.priority then
    insert into public.partnership_lead_activities(lead_id, actor_user_id, activity_type, summary, details)
    values (new.id, actor, 'priority_changed', 'Lead priority changed', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  return new;
end;
$$;

revoke all on function private.log_partnership_lead_activity() from public;

create trigger partnership_lead_activity_log
after insert or update on public.partnership_leads
for each row execute function private.log_partnership_lead_activity();
