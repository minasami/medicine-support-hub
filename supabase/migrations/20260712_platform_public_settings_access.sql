-- Allow clients to read only settings explicitly marked public.
-- Private platform controls remain visible only to platform administrators.

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_public_select on public.platform_settings;
create policy platform_settings_public_select
on public.platform_settings for select to anon, authenticated
using (is_public = true);

grant select on public.platform_settings to anon, authenticated;
grant select on public.platform_public_settings_v1 to anon, authenticated;
