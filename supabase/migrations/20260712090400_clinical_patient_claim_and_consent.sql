-- Patient account claiming and consent decisions.

create or replace function private.clinical_claim_patient_profile_impl(p_claim_code text)
returns uuid
language plpgsql security definer
set search_path=public,private,extensions,pg_catalog
as $$
declare invite_row private.clinical_patient_claim_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into invite_row from private.clinical_patient_claim_invites
  where token_hash=extensions.digest(upper(btrim(p_claim_code)),'sha256') and claimed_at is null and expires_at>now()
  for update;
  if not found then raise exception 'Claim code is invalid or expired.' using errcode='22023'; end if;
  if exists(select 1 from public.clinical_patients where id=invite_row.patient_id and user_id is not null) then
    raise exception 'This patient profile is already linked.' using errcode='23505';
  end if;
  if exists(select 1 from public.clinical_patients where user_id=auth.uid()) then
    raise exception 'This account is already linked to another clinical patient record.' using errcode='23505';
  end if;
  update public.clinical_patients set user_id=auth.uid(),identity_verification_status='self_claimed' where id=invite_row.patient_id;
  update private.clinical_patient_claim_invites set claimed_by=auth.uid(),claimed_at=now() where id=invite_row.id;
  return invite_row.patient_id;
end;
$$;

create or replace function public.clinical_claim_patient_profile(p_claim_code text)
returns uuid
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select private.clinical_claim_patient_profile_impl(p_claim_code); $$;

create or replace function private.clinical_request_patient_access_impl(
  p_patient_id uuid,p_organization_id uuid,
  p_scopes text[] default array['demographics','encounters','medications','diagnostics']::text[],
  p_reason text default null
)
returns uuid
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
declare new_id uuid;
begin
  if auth.uid() is null or not private.clinical_is_authorized_practitioner(p_organization_id) then
    raise exception 'Authorized clinical organization membership is required.' using errcode='42501';
  end if;
  if not exists(select 1 from public.clinical_patients where id=p_patient_id and status='active') then
    raise exception 'Patient not found.' using errcode='P0002';
  end if;
  insert into public.clinical_patient_access(
    patient_id,organization_id,access_level,scopes,status,consent_basis,reason,requested_by
  ) values (
    p_patient_id,p_organization_id,'care_team',p_scopes,'requested','patient_requested',nullif(btrim(p_reason),''),auth.uid()
  ) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.clinical_request_patient_access(
  p_patient_id uuid,p_organization_id uuid,
  p_scopes text[] default array['demographics','encounters','medications','diagnostics']::text[],
  p_reason text default null
)
returns uuid
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select private.clinical_request_patient_access_impl(p_patient_id,p_organization_id,p_scopes,p_reason); $$;

create or replace function private.clinical_decide_patient_access_impl(p_access_id uuid,p_decision text)
returns public.clinical_patient_access
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
declare access_row public.clinical_patient_access%rowtype; result_row public.clinical_patient_access%rowtype;
begin
  if p_decision not in ('granted','denied','revoked') then raise exception 'Decision is invalid.' using errcode='22023'; end if;
  select a.* into access_row from public.clinical_patient_access a where a.id=p_access_id for update;
  if not found then raise exception 'Access request not found.' using errcode='P0002'; end if;
  if not private.is_platform_admin() and not exists(
    select 1 from public.clinical_patients p where p.id=access_row.patient_id and p.user_id=auth.uid()
  ) then
    raise exception 'Only the patient or platform administrator can decide this access request.' using errcode='42501';
  end if;
  update public.clinical_patient_access
  set status=p_decision,
      granted_by=case when p_decision='granted' then auth.uid() else granted_by end,
      granted_at=case when p_decision='granted' then now() else granted_at end
  where id=p_access_id returning * into result_row;
  return result_row;
end;
$$;

create or replace function public.clinical_decide_patient_access(p_access_id uuid,p_decision text)
returns public.clinical_patient_access
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select private.clinical_decide_patient_access_impl(p_access_id,p_decision); $$;

revoke all on function private.clinical_claim_patient_profile_impl(text) from public,anon;
revoke all on function private.clinical_request_patient_access_impl(uuid,uuid,text[],text) from public,anon;
revoke all on function private.clinical_decide_patient_access_impl(uuid,text) from public,anon;
grant execute on function private.clinical_claim_patient_profile_impl(text) to authenticated,service_role;
grant execute on function private.clinical_request_patient_access_impl(uuid,uuid,text[],text) to authenticated,service_role;
grant execute on function private.clinical_decide_patient_access_impl(uuid,text) to authenticated,service_role;
revoke all on function public.clinical_claim_patient_profile(text) from public,anon;
revoke all on function public.clinical_request_patient_access(uuid,uuid,text[],text) from public,anon;
revoke all on function public.clinical_decide_patient_access(uuid,text) from public,anon;
grant execute on function public.clinical_claim_patient_profile(text) to authenticated,service_role;
grant execute on function public.clinical_request_patient_access(uuid,uuid,text[],text) to authenticated,service_role;
grant execute on function public.clinical_decide_patient_access(uuid,text) to authenticated,service_role;


