-- Clinical access helpers and least-privilege policies.

create or replace function private.clinical_is_authorized_practitioner(target_org uuid)
returns boolean
language sql stable security definer
set search_path=public,private
as $$
  select private.is_org_member(target_org)
    and exists (
      select 1 from public.profiles p
      where p.id=auth.uid() and p.is_active=true
        and p.role in ('physician','reviewer','pharmacist','pharmacy_assistant','branch_manager','admin','platform_admin','super_admin')
    );
$$;

create or replace function private.clinical_can_read_patient(target_patient uuid,required_scope text default 'demographics')
returns boolean
language sql stable security definer
set search_path=public,private
as $$
  select exists(select 1 from public.clinical_patients p where p.id=target_patient and p.user_id=auth.uid())
    or private.is_platform_admin()
    or exists (
      select 1 from public.clinical_patient_access a
      where a.patient_id=target_patient and a.status='granted'
        and (a.expires_at is null or a.expires_at>now())
        and ('all'=any(a.scopes) or required_scope=any(a.scopes))
        and (a.practitioner_user_id=auth.uid() or (a.practitioner_user_id is null and private.is_org_member(a.organization_id)))
    );
$$;

create or replace function private.clinical_can_write_patient(target_patient uuid,target_org uuid,required_scope text default 'clinical_write')
returns boolean
language sql stable security definer
set search_path=public,private
as $$
  select private.is_platform_admin()
    or (
      private.clinical_is_authorized_practitioner(target_org)
      and exists (
        select 1 from public.clinical_patient_access a
        where a.patient_id=target_patient and a.organization_id=target_org and a.status='granted'
          and (a.expires_at is null or a.expires_at>now())
          and ('all'=any(a.scopes) or required_scope=any(a.scopes) or 'clinical_write'=any(a.scopes))
          and (a.practitioner_user_id is null or a.practitioner_user_id=auth.uid())
      )
    );
$$;

revoke all on function private.clinical_is_authorized_practitioner(uuid) from public,anon;
revoke all on function private.clinical_can_read_patient(uuid,text) from public,anon;
revoke all on function private.clinical_can_write_patient(uuid,uuid,text) from public,anon;
grant execute on function private.clinical_is_authorized_practitioner(uuid) to authenticated,service_role;
grant execute on function private.clinical_can_read_patient(uuid,text) to authenticated,service_role;
grant execute on function private.clinical_can_write_patient(uuid,uuid,text) to authenticated,service_role;

grant select on public.clinical_patients,public.clinical_patient_access to authenticated;

create policy clinical_patients_read on public.clinical_patients for select to authenticated
using ((select private.clinical_can_read_patient(id,'demographics')));
create policy clinical_patient_access_read on public.clinical_patient_access for select to authenticated
using (
  (select private.is_platform_admin())
  or exists(select 1 from public.clinical_patients p where p.id=patient_id and p.user_id=(select auth.uid()))
  or (select private.is_org_member(organization_id))
  or practitioner_user_id=(select auth.uid())
);
