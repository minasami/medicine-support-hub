-- Governed company-initiated merge requests, delegated review, and admin-authored automation rules.

insert into public.platform_permissions(permission_key,category,label,description,risk_level)
values
('companies.merge.review','governance','Review company merge requests','Approve or refuse company-submitted identity consolidation requests.','high'),
('automation.manage','governance','Manage automation rules','Draft, test, activate, pause and audit platform automation rules.','critical')
on conflict(permission_key) do update set label=excluded.label,description=excluded.description,risk_level=excluded.risk_level,is_active=true;

create table if not exists public.company_merge_review_delegations (
  id uuid primary key default gen_random_uuid(),
  delegate_user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null default 'companies.merge.review' references public.platform_permissions(permission_key),
  organization_scope uuid references public.organizations(id) on delete cascade,
  can_approve boolean not null default true,
  can_refuse boolean not null default true,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  delegated_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check(length(trim(reason))>=3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at>starts_at)
);
create unique index if not exists company_merge_delegation_active_idx on public.company_merge_review_delegations(delegate_user_id,coalesce(organization_scope,'00000000-0000-0000-0000-000000000000'::uuid)) where is_active;

create table if not exists public.platform_automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 3 and 120),
  description text,
  domain text not null check(domain in ('company_merge','company_verification','contribution_review','notification','data_quality','care_network')),
  trigger_key text not null,
  conditions jsonb not null default '[]'::jsonb check(jsonb_typeof(conditions)='array'),
  action_key text not null,
  action_configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(action_configuration)='object'),
  approval_mode text not null default 'human' check(approval_mode in ('human','delegated','automatic')),
  status text not null default 'draft' check(status in ('draft','active','paused','archived')),
  priority integer not null default 100 check(priority between 1 and 1000),
  natural_language_source text,
  model_draft_metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete restrict,
  activated_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.company_merge_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  requester_organization_id uuid not null references public.organizations(id) on delete restrict,
  source_company_slug text not null,
  target_company_slug text not null,
  requested_classification text not null default 'same_legal_entity' check(requested_classification in ('duplicate','same_legal_entity','legacy_alias','administrative_consolidation','other')),
  justification text not null check(length(trim(justification))>=20),
  evidence_urls text[] not null default '{}',
  status text not null default 'pending' check(status in ('pending','under_review','approved','refused','approved_pending_execution','executed','cancelled')),
  assigned_reviewer_id uuid references auth.users(id) on delete set null,
  decision_source text check(decision_source in ('platform_admin','delegate','automation')),
  automation_rule_id uuid references public.platform_automation_rules(id) on delete set null,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(source_company_slug<>target_company_slug)
);
create index if not exists company_merge_requests_status_idx on public.company_merge_requests(status,created_at desc);
create index if not exists company_merge_requests_requester_idx on public.company_merge_requests(requester_user_id,created_at desc);

create table if not exists private.platform_automation_rule_audit (
  id uuid primary key default gen_random_uuid(), rule_id uuid references public.platform_automation_rules(id) on delete set null,
  action text not null, before_snapshot jsonb not null default '{}', after_snapshot jsonb not null default '{}',
  actor_user_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
revoke all on private.platform_automation_rule_audit from public,anon,authenticated;

create or replace function public.can_review_company_merge(target_organization uuid default null)
returns boolean language sql stable security definer set search_path=public,private,pg_catalog as $$
  select private.is_platform_admin() or exists(
    select 1 from public.company_merge_review_delegations d where d.delegate_user_id=auth.uid() and d.is_active
      and d.starts_at<=now() and (d.ends_at is null or d.ends_at>now())
      and (d.organization_scope is null or d.organization_scope=target_organization)
  );
$$;
revoke all on function public.can_review_company_merge(uuid) from public,anon;
grant execute on function public.can_review_company_merge(uuid) to authenticated,service_role;

alter table public.company_merge_review_delegations enable row level security;
alter table public.platform_automation_rules enable row level security;
alter table public.company_merge_requests enable row level security;
create policy merge_delegations_admin_read on public.company_merge_review_delegations for select to authenticated using(private.is_platform_admin() or delegate_user_id=auth.uid());
create policy merge_delegations_admin_write on public.company_merge_review_delegations for all to authenticated using(private.is_platform_admin()) with check(private.is_platform_admin());
create policy automation_rules_admin_all on public.platform_automation_rules for all to authenticated using(private.is_platform_admin()) with check(private.is_platform_admin());
create policy merge_requests_visible on public.company_merge_requests for select to authenticated using(requester_user_id=auth.uid() or public.can_review_company_merge(requester_organization_id));
revoke all on public.company_merge_review_delegations,public.platform_automation_rules,public.company_merge_requests from public,anon;
grant select,insert,update,delete on public.company_merge_review_delegations,public.platform_automation_rules to authenticated;
grant select on public.company_merge_requests to authenticated;

create or replace function public.submit_company_merge_request(p_source_slug text,p_target_slug text,p_classification text,p_justification text,p_evidence_urls text[] default '{}')
returns uuid language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare org_id uuid; request_id uuid; matched_rule public.platform_automation_rules%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.' using errcode='42501'; end if;
  select profile.organization_id into org_id from public.industry_company_profiles profile
  join public.organization_members member on member.organization_id=profile.organization_id and member.user_id=auth.uid() and member.is_active
  where profile.company_slug=p_source_slug and profile.verification_status='verified' limit 1;
  if org_id is null then raise exception 'You may request a merge only for a verified company you actively represent.' using errcode='42501'; end if;
  if not private.company_directory_entry_exists(p_target_slug) then raise exception 'Target company was not found.' using errcode='22023'; end if;
  insert into public.company_merge_requests(requester_user_id,requester_organization_id,source_company_slug,target_company_slug,requested_classification,justification,evidence_urls)
  values(auth.uid(),org_id,p_source_slug,p_target_slug,p_classification,trim(p_justification),coalesce(p_evidence_urls,'{}')) returning id into request_id;
  select * into matched_rule from public.platform_automation_rules r where r.domain='company_merge' and r.trigger_key='merge_request_submitted' and r.status='active'
    and r.approval_mode='automatic' and r.action_key='approve_merge_request' and coalesce((r.action_configuration->>'queue_execution')::boolean,false)
    and jsonb_array_length(r.conditions)>0
    and not exists (
      select 1 from jsonb_array_elements(r.conditions) condition where
        not case condition->>'field'
          when 'evidence_count' then case condition->>'operator' when 'greater_than' then cardinality(coalesce(p_evidence_urls,'{}'))>(condition->>'value')::integer when 'equals' then cardinality(coalesce(p_evidence_urls,'{}'))=(condition->>'value')::integer else false end
          when 'classification' then case condition->>'operator' when 'equals' then p_classification=condition->>'value' when 'in' then to_jsonb(p_classification)<@(condition->'value') else false end
          when 'requester_verified' then (condition->>'operator'='equals' and (condition->>'value')::boolean=true)
          else false end
    ) order by r.priority,r.created_at limit 1;
  if found then update public.company_merge_requests set status='approved_pending_execution',decision_source='automation',automation_rule_id=matched_rule.id,review_notes='Approved by active platform-admin automation rule; consolidation queued for trusted execution.',reviewed_at=now(),updated_at=now() where id=request_id; end if;
  return request_id;
end;
$$;
revoke all on function public.submit_company_merge_request(text,text,text,text,text[]) from public,anon;
grant execute on function public.submit_company_merge_request(text,text,text,text,text[]) to authenticated;

create or replace function public.review_company_merge_request(p_request_id uuid,p_decision text,p_notes text)
returns jsonb language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare req public.company_merge_requests%rowtype; source_kind text;
begin
  select * into req from public.company_merge_requests where id=p_request_id for update;
  if not found or req.status not in ('pending','under_review','approved_pending_execution') then raise exception 'Merge request is not reviewable.' using errcode='22023'; end if;
  if not public.can_review_company_merge(req.requester_organization_id) then raise exception 'Merge-review delegation required.' using errcode='42501'; end if;
  if p_decision not in ('approve','refuse') then raise exception 'Decision must be approve or refuse.' using errcode='22023'; end if;
  source_kind:=case when private.is_platform_admin() then 'platform_admin' else 'delegate' end;
  update public.company_merge_requests set status=case when p_decision='approve' then 'approved_pending_execution' else 'refused' end,
    decision_source=source_kind,review_notes=nullif(trim(p_notes),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=p_request_id;
  return jsonb_build_object('id',p_request_id,'status',case when p_decision='approve' then 'approved_pending_execution' else 'refused' end,'decision_source',source_kind);
end;
$$;
revoke all on function public.review_company_merge_request(uuid,text,text) from public,anon;
grant execute on function public.review_company_merge_request(uuid,text,text) to authenticated,service_role;

create or replace function public.activate_platform_automation_rule(p_rule_id uuid,p_activate boolean)
returns jsonb language plpgsql security definer set search_path=public,private,pg_catalog as $$
declare before_row public.platform_automation_rules%rowtype; after_row public.platform_automation_rules%rowtype;
begin
  if not private.is_platform_admin() then raise exception 'Platform administrator access required.' using errcode='42501'; end if;
  select * into before_row from public.platform_automation_rules where id=p_rule_id for update;
  if not found then raise exception 'Automation rule not found.' using errcode='P0002'; end if;
  update public.platform_automation_rules set status=case when p_activate then 'active' else 'paused' end,activated_by=case when p_activate then auth.uid() else activated_by end,activated_at=case when p_activate then now() else activated_at end,updated_at=now() where id=p_rule_id returning * into after_row;
  insert into private.platform_automation_rule_audit(rule_id,action,before_snapshot,after_snapshot,actor_user_id) values(p_rule_id,case when p_activate then 'activate' else 'pause' end,to_jsonb(before_row),to_jsonb(after_row),auth.uid());
  return jsonb_build_object('id',p_rule_id,'status',after_row.status);
end;
$$;
revoke all on function public.activate_platform_automation_rule(uuid,boolean) from public,anon;
grant execute on function public.activate_platform_automation_rule(uuid,boolean) to authenticated,service_role;
