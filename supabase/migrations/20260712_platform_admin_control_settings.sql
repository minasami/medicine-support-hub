-- Platform-admin settings and customization registry.
-- Secrets are intentionally excluded; provider credentials remain in Vercel environment variables.

create table if not exists public.platform_settings (
  setting_key text primary key,
  category text not null,
  label text not null,
  description text,
  value jsonb not null default '{}'::jsonb,
  value_type text not null default 'json',
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_check check (
    setting_key ~ '^[a-z0-9][a-z0-9._-]{2,119}$'
    and setting_key !~ '(secret|password|credential|private_key|service_role|api_key|token)'
  ),
  constraint platform_settings_category_check check (category in ('identity','experience','search','marketplace','industry','learning','ocr','firecrawl','approvals','security','operations')),
  constraint platform_settings_value_type_check check (value_type in ('boolean','integer','number','string','json'))
);

create table if not exists public.platform_setting_history (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  previous_value jsonb,
  next_value jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists platform_settings_category_idx on public.platform_settings(category, setting_key);
create index if not exists platform_setting_history_key_changed_idx on public.platform_setting_history(setting_key, changed_at desc);

alter table public.platform_settings enable row level security;
alter table public.platform_setting_history enable row level security;

drop policy if exists platform_settings_admin_select on public.platform_settings;
create policy platform_settings_admin_select on public.platform_settings for select to authenticated
  using (private.is_platform_admin());

drop policy if exists platform_settings_admin_insert on public.platform_settings;
create policy platform_settings_admin_insert on public.platform_settings for insert to authenticated
  with check (private.is_platform_admin());

drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists platform_settings_admin_delete on public.platform_settings;
create policy platform_settings_admin_delete on public.platform_settings for delete to authenticated
  using (private.is_platform_admin());

drop policy if exists platform_setting_history_admin_select on public.platform_setting_history;
create policy platform_setting_history_admin_select on public.platform_setting_history for select to authenticated
  using (private.is_platform_admin());

create or replace function private.audit_platform_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    insert into public.platform_setting_history(setting_key, previous_value, next_value, changed_by)
    values (new.setting_key, null, new.value, auth.uid());
  elsif new.value is distinct from old.value then
    insert into public.platform_setting_history(setting_key, previous_value, next_value, changed_by)
    values (new.setting_key, old.value, new.value, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.audit_platform_setting_change() from public;

drop trigger if exists platform_setting_audit on public.platform_settings;
create trigger platform_setting_audit
before insert or update on public.platform_settings
for each row execute function private.audit_platform_setting_change();

create or replace view public.platform_public_settings_v1
with (security_invoker = true)
as
select setting_key, category, label, description, value, value_type, updated_at
from public.platform_settings
where is_public = true;

grant select, insert, update, delete on public.platform_settings to authenticated;
grant select on public.platform_setting_history to authenticated;
grant select on public.platform_public_settings_v1 to anon, authenticated;

insert into public.platform_settings(setting_key, category, label, description, value, value_type, is_public)
values
  ('identity.platform_name','identity','Platform name','Public product name.',to_jsonb('Medicine Support Hub'::text),'string',true),
  ('identity.support_email','identity','Support email','Public support and partnership email.',to_jsonb('jesussavedmina@gmail.com'::text),'string',true),
  ('experience.default_language','experience','Default language','Default public interface language.',to_jsonb('en'::text),'string',true),
  ('experience.allow_public_registration','experience','Public registration','Allow public patient and stakeholder account registration.','true'::jsonb,'boolean',false),
  ('search.default_sort','search','Default medicine sort','Default ordering when no explicit sort is selected.',to_jsonb('best'::text),'string',true),
  ('search.page_size','search','Medicine results per page','Public medicine result page size.','36'::jsonb,'integer',true),
  ('search.minimum_default_completeness','search','Minimum default completeness','Default minimum completeness percentage on the public medicine page.','0'::jsonb,'integer',true),
  ('search.show_product_images','search','Show product images','Display approved or attributed product images in medicine results.','true'::jsonb,'boolean',true),
  ('search.show_marketplace_connections','search','Show marketplace links','Display approved marketplace offer connections on medicine cards.','true'::jsonb,'boolean',true),
  ('marketplace.enabled','marketplace','Marketplace enabled','Enable public marketplace discovery and seller workflows.','true'::jsonb,'boolean',true),
  ('industry.contributions_enabled','industry','Company contributions enabled','Allow verified companies to submit reviewed contributions.','true'::jsonb,'boolean',true),
  ('learning.enabled','learning','Learning center enabled','Enable public learning tracks and private progress.','true'::jsonb,'boolean',true),
  ('ocr.enabled','ocr','OCR processing enabled','Enable administrator document OCR when a managed provider is configured.','true'::jsonb,'boolean',false),
  ('ocr.provider','ocr','OCR provider','Preferred OCR provider. Google Enterprise Document OCR is the primary implementation.',to_jsonb('google_document_ai'::text),'string',false),
  ('ocr.max_file_mb','ocr','OCR maximum file size','Maximum direct-upload file size accepted by the admin OCR console.','3'::jsonb,'integer',false),
  ('ocr.language_hints','ocr','OCR language hints','Language hints supplied to the OCR provider.','["ar","en"]'::jsonb,'json',false),
  ('firecrawl.enabled','firecrawl','Firecrawl enabled','Enable governed web ingestion when Firecrawl access is configured.','true'::jsonb,'boolean',false),
  ('firecrawl.automatic_sync','firecrawl','Automatic Firecrawl sync','Allow the daily production cron to process due approved sources.','false'::jsonb,'boolean',false),
  ('firecrawl.max_pages_per_source','firecrawl','Maximum pages per crawl','Default cost and safety limit for each source crawl.','25'::jsonb,'integer',false),
  ('approvals.require_human_review','approvals','Require human review','Prevent OCR and web-ingested data from publishing without platform-admin review.','true'::jsonb,'boolean',false)
on conflict (setting_key) do nothing;
