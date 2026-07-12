-- Private identity matching. No raw identity value is persisted.

create table if not exists private.clinical_identity_secret (
  singleton boolean primary key default true check (singleton),
  secret bytea not null,
  created_at timestamptz not null default now()
);
insert into private.clinical_identity_secret(singleton,secret)
values(true,extensions.gen_random_bytes(32))
on conflict(singleton) do nothing;
revoke all on private.clinical_identity_secret from public,anon,authenticated;

create table if not exists private.clinical_identity_search_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  identity_type text not null,
  identity_last4 text,
  matched_patient_id uuid references public.clinical_patients(id) on delete set null,
  searched_at timestamptz not null default now()
);
create index if not exists clinical_identity_search_audit_actor_idx on private.clinical_identity_search_audit(actor_user_id,searched_at desc);
revoke all on private.clinical_identity_search_audit from public,anon,authenticated;

create table if not exists private.clinical_patient_claim_invites (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.clinical_patients(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists clinical_patient_claim_invites_patient_idx on private.clinical_patient_claim_invites(patient_id,expires_at desc);
revoke all on private.clinical_patient_claim_invites from public,anon,authenticated;

create or replace function private.normalize_clinical_identity(value text)
returns text language sql immutable strict set search_path=pg_catalog
as $$ select upper(regexp_replace(value,'[^A-Za-z0-9]+','','g')); $$;

create or replace function private.clinical_identity_match_key(identity_type text,country_code text,identity_value text)
returns bytea
language plpgsql stable security definer
set search_path=pg_catalog,private,extensions
as $$
declare normalized text:=private.normalize_clinical_identity(identity_value); secret_value bytea;
begin
  if length(normalized)<6 or length(normalized)>40 then raise exception 'Identity value length is invalid.' using errcode='22023'; end if;
  select secret into secret_value from private.clinical_identity_secret where singleton=true;
  if secret_value is null then raise exception 'Clinical identity protection is unavailable.'; end if;
  return extensions.hmac(convert_to(upper(coalesce(country_code,''))||'|'||lower(coalesce(identity_type,''))||'|'||normalized,'UTF8'),secret_value,'sha256');
end;
$$;
revoke all on function private.normalize_clinical_identity(text) from public,anon,authenticated;
revoke all on function private.clinical_identity_match_key(text,text,text) from public,anon,authenticated;
