create or replace function private.resolve_care_network_enrollment_notifications()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
as $$
begin
  if old.status in ('pending','under_review') and new.status in ('approved','rejected') then
    update public.user_notifications
    set read_at=coalesce(read_at,now()),
        body=left(body||' Decision: '||case when new.status='approved' then 'approved' else 'refused' end||'.',500),
        data=data||jsonb_build_object(
          'status',new.status,
          'reviewed_at',new.reviewed_at,
          'reviewed_by',new.reviewed_by
        )
    where entity_type='healthcare_entity_application' and entity_key=new.id::text;
  end if;
  return new;
end;
$$;
revoke all on function private.resolve_care_network_enrollment_notifications() from public,anon,authenticated;
