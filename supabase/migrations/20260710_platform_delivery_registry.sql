create table if not exists public.platform_delivery_registry (
  id uuid primary key default gen_random_uuid(),
  workstream_key text not null unique,
  workstream_name text not null,
  status text not null default 'active' check (status in ('planned','active','blocked','completed')),
  priority text not null default 'high' check (priority in ('urgent','high','normal','low')),
  github_url text,
  clickup_url text,
  notion_url text,
  production_url text,
  source_of_truth text not null default 'supabase',
  public_safe boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.platform_delivery_registry enable row level security;

drop policy if exists platform_delivery_registry_public_read on public.platform_delivery_registry;
create policy platform_delivery_registry_public_read
on public.platform_delivery_registry
for select
to anon, authenticated
using (public_safe = true);

drop policy if exists platform_delivery_registry_admin_all on public.platform_delivery_registry;
create policy platform_delivery_registry_admin_all
on public.platform_delivery_registry
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

insert into public.platform_delivery_registry (
  workstream_key, workstream_name, status, priority, github_url, clickup_url, notion_url, production_url, public_safe, notes
) values
  ('verified-data-imports','Verified medicine data imports','active','urgent','https://github.com/minasami/medicine-support-hub/issues/74','https://app.clickup.com/9015400058/v/l/li/901524374718','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/verified-products',true,'Continue controlled imports, source attribution, and highest-price normalization.'),
  ('search-and-seo','Universal search and SEO','active','high','https://github.com/minasami/medicine-support-hub/issues/74','https://app.clickup.com/9015400058/v/l/li/901524374718','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/search',true,'Improve discovery, durable landing pages, structured data, relevance, and internal linking.'),
  ('platform-reliability','Platform reliability and security','active','urgent','https://github.com/minasami/medicine-support-hub/issues/74','https://app.clickup.com/9015400058/v/l/li/901524374718','https://app.notion.com/p/3908fc7e175381aaa67ee1a56475b64a','https://medicine-support-hub.vercel.app/',false,'Track RLS optimization, database advisors, deployments, runtime errors, and access control.')
on conflict (workstream_key) do update set
  workstream_name = excluded.workstream_name,
  status = excluded.status,
  priority = excluded.priority,
  github_url = excluded.github_url,
  clickup_url = excluded.clickup_url,
  notion_url = excluded.notion_url,
  production_url = excluded.production_url,
  public_safe = excluded.public_safe,
  notes = excluded.notes,
  updated_at = now();

create or replace view public.platform_delivery_public_status
with (security_invoker = true)
as
select workstream_key, workstream_name, status, priority, github_url, clickup_url, notion_url, production_url, notes, updated_at
from public.platform_delivery_registry
where public_safe = true;

grant select on public.platform_delivery_public_status to anon, authenticated;
