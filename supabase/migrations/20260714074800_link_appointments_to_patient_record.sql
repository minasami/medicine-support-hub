-- Link a signed-in patient's appointment to the existing clinical record without exposing lookup data.

create or replace function private.link_healthcare_appointment_patient()
returns trigger
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
begin
  if new.patient_id is null then
    select p.id into new.patient_id
    from public.clinical_patients p
    where p.user_id=new.patient_user_id and p.status='active'
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function private.link_healthcare_appointment_patient() from public,anon,authenticated;

create trigger healthcare_appointments_link_patient
before insert on public.healthcare_appointments
for each row execute function private.link_healthcare_appointment_patient();
