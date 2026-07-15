-- Secure clinician onboarding and exact patient matching.

create or replace function private.clinical_create_patient_impl(
  p_organization_id uuid,p_full_name text,p_birthdate date default null,p_phone text default null,
  p_email text default null,p_city text default null,p_country_code text default 'EG',
  p_identity_type text default 'national_id',p_identity_value text default null,
  p_sex_at_birth text default null,p_consent_basis text default 'treatment'
)
returns table(patient_id uuid,claim_code text)
language plpgsql security definer
set search_path=public,private,extensions,pg_catalog
as $$
declare normalized text; match_key bytea; new_patient uuid; raw_code text;
begin
  if auth.uid() is null or not private.clinical_is_authorized_practitioner(p_organization_id) then
    raise exception 'Authorized clinical organization membership is required.' using errcode='42501';
  end if;
  if p_consent_basis not in ('patient_requested','treatment','emergency','legal_guardian','institutional_program') then
    raise exception 'Consent basis is invalid.' using errcode='22023';
  end if;
  if nullif(btrim(p_full_name),'') is null then raise exception 'Patient name is required.' using errcode='22023'; end if;
  if p_identity_value is not null then
    normalized:=private.normalize_clinical_identity(p_identity_value);
    if upper(coalesce(p_country_code,'EG'))='EG' and lower(coalesce(p_identity_type,'national_id'))='national_id' and normalized !~ '^[0-9]{14}$' then
      raise exception 'Egyptian national ID must contain exactly 14 digits.' using errcode='22023';
    end if;
    match_key:=private.clinical_identity_match_key(p_identity_type,p_country_code,p_identity_value);
    if exists(select 1 from public.clinical_patients p where p.country_code=upper(p_country_code) and p.identity_type=lower(p_identity_type) and p.identity_match_key=match_key and p.status<>'merged') then
      raise exception 'A patient with this identity already exists. Use exact search and request access.' using errcode='23505';
    end if;
  end if;

  insert into public.clinical_patients(
    home_organization_id,full_name,phone,email,birthdate,sex_at_birth,city,country_code,
    identity_type,identity_match_key,identity_last4,consent_basis,created_by,identity_verification_status
  ) values (
    p_organization_id,btrim(p_full_name),nullif(btrim(p_phone),''),nullif(btrim(p_email),''),p_birthdate,p_sex_at_birth,
    nullif(btrim(p_city),''),upper(coalesce(p_country_code,'EG')),lower(coalesce(p_identity_type,'national_id')),match_key,
    case when normalized is null then null else right(normalized,4) end,p_consent_basis,auth.uid(),'invited'
  ) returning id into new_patient;

  insert into public.clinical_patient_access(
    patient_id,organization_id,access_level,scopes,status,consent_basis,reason,requested_by,granted_by,granted_at
  ) values (
    new_patient,p_organization_id,'care_team',array['demographics','encounters','medications','diagnostics','insurance','clinical_write'],
    'granted',p_consent_basis,'Initial treatment relationship',auth.uid(),auth.uid(),now()
  );

  raw_code:=upper(encode(extensions.gen_random_bytes(12),'hex'));
  insert into private.clinical_patient_claim_invites(patient_id,token_hash,expires_at,created_by)
  values(new_patient,extensions.digest(raw_code,'sha256'),now()+interval '7 days',auth.uid());
  return query select new_patient,raw_code;
end;
$$;

create or replace function public.clinical_create_patient(
  p_organization_id uuid,p_full_name text,p_birthdate date default null,p_phone text default null,
  p_email text default null,p_city text default null,p_country_code text default 'EG',
  p_identity_type text default 'national_id',p_identity_value text default null,
  p_sex_at_birth text default null,p_consent_basis text default 'treatment'
)
returns table(patient_id uuid,claim_code text)
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select * from private.clinical_create_patient_impl(p_organization_id,p_full_name,p_birthdate,p_phone,p_email,p_city,p_country_code,p_identity_type,p_identity_value,p_sex_at_birth,p_consent_basis); $$;

create or replace function private.clinical_find_patient_by_identity_impl(
  p_organization_id uuid,p_identity_value text,p_country_code text default 'EG',p_identity_type text default 'national_id'
)
returns table(patient_id uuid,full_name text,birthdate date,identity_last4 text,access_status text)
language plpgsql security definer
set search_path=public,private,pg_catalog
as $$
declare match_key bytea; last4 text; matched uuid;
begin
  if auth.uid() is null or not private.clinical_is_authorized_practitioner(p_organization_id) then
    raise exception 'Authorized clinical organization membership is required.' using errcode='42501';
  end if;
  match_key:=private.clinical_identity_match_key(p_identity_type,p_country_code,p_identity_value);
  last4:=right(private.normalize_clinical_identity(p_identity_value),4);
  select p.id into matched from public.clinical_patients p
  where p.country_code=upper(p_country_code) and p.identity_type=lower(p_identity_type)
    and p.identity_match_key=match_key and p.status<>'merged' limit 1;
  insert into private.clinical_identity_search_audit(actor_user_id,organization_id,identity_type,identity_last4,matched_patient_id)
  values(auth.uid(),p_organization_id,lower(p_identity_type),last4,matched);
  return query
  select p.id,p.full_name,p.birthdate,p.identity_last4,
    coalesce((select a.status from public.clinical_patient_access a
      where a.patient_id=p.id and a.organization_id=p_organization_id and a.status in ('requested','granted')
      order by case a.status when 'granted' then 0 else 1 end,a.created_at desc limit 1),'none')
  from public.clinical_patients p where p.id=matched;
end;
$$;

create or replace function public.clinical_find_patient_by_identity(
  p_organization_id uuid,p_identity_value text,p_country_code text default 'EG',p_identity_type text default 'national_id'
)
returns table(patient_id uuid,full_name text,birthdate date,identity_last4 text,access_status text)
language sql security invoker
set search_path=public,private,pg_catalog
as $$ select * from private.clinical_find_patient_by_identity_impl(p_organization_id,p_identity_value,p_country_code,p_identity_type); $$;

create or replace function public.clinical_search_accessible_patients(p_organization_id uuid,p_query text,p_limit integer default 20)
returns table(patient_id uuid,full_name text,birthdate date,phone text,city text,identity_verification_status text)
language sql stable security invoker
set search_path=public,private,pg_catalog
as $$
  select distinct p.id,p.full_name,p.birthdate,p.phone,p.city,p.identity_verification_status
  from public.clinical_patients p join public.clinical_patient_access a on a.patient_id=p.id
  where private.clinical_is_authorized_practitioner(p_organization_id)
    and a.organization_id=p_organization_id and a.status='granted'
    and (a.expires_at is null or a.expires_at>now())
    and (a.practitioner_user_id is null or a.practitioner_user_id=auth.uid())
    and (btrim(coalesce(p_query,''))='' or p.full_name ilike '%'||btrim(p_query)||'%')
  order by p.full_name,p.id
  limit greatest(1,least(coalesce(p_limit,20),50));
$$;

revoke all on function private.clinical_create_patient_impl(uuid,text,date,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function private.clinical_find_patient_by_identity_impl(uuid,text,text,text) from public,anon;
grant execute on function private.clinical_create_patient_impl(uuid,text,date,text,text,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function private.clinical_find_patient_by_identity_impl(uuid,text,text,text) to authenticated,service_role;
revoke all on function public.clinical_create_patient(uuid,text,date,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.clinical_find_patient_by_identity(uuid,text,text,text) from public,anon;
revoke all on function public.clinical_search_accessible_patients(uuid,text,integer) from public,anon;
grant execute on function public.clinical_create_patient(uuid,text,date,text,text,text,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.clinical_find_patient_by_identity(uuid,text,text,text) to authenticated,service_role;
grant execute on function public.clinical_search_accessible_patients(uuid,text,integer) to authenticated,service_role;


