alter table public.public_entity_favorites enable row level security;
alter table public.public_entity_reactions enable row level security;
alter table public.public_entity_comments enable row level security;
alter table public.public_entity_reports enable row level security;
alter table public.medicine_community_observations enable row level security;
alter table public.company_profile_messages enable row level security;

drop policy if exists "favorites own read" on public.public_entity_favorites;
create policy "favorites own read" on public.public_entity_favorites for select to authenticated using (user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "favorites own insert" on public.public_entity_favorites;
create policy "favorites own insert" on public.public_entity_favorites for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "favorites own delete" on public.public_entity_favorites;
create policy "favorites own delete" on public.public_entity_favorites for delete to authenticated using (user_id=auth.uid() or private.is_platform_admin());

drop policy if exists "reactions own read" on public.public_entity_reactions;
create policy "reactions own read" on public.public_entity_reactions for select to authenticated using (user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "reactions own insert" on public.public_entity_reactions;
create policy "reactions own insert" on public.public_entity_reactions for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "reactions own delete" on public.public_entity_reactions;
create policy "reactions own delete" on public.public_entity_reactions for delete to authenticated using (user_id=auth.uid() or private.is_platform_admin());

drop policy if exists "published comments public read" on public.public_entity_comments;
create policy "published comments public read" on public.public_entity_comments for select to anon, authenticated using (status='published' or user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "comments authenticated insert" on public.public_entity_comments;
create policy "comments authenticated insert" on public.public_entity_comments for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "comments owner delete" on public.public_entity_comments;
create policy "comments owner delete" on public.public_entity_comments for delete to authenticated using (user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "comments admin update" on public.public_entity_comments;
create policy "comments admin update" on public.public_entity_comments for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists "reports own insert" on public.public_entity_reports;
create policy "reports own insert" on public.public_entity_reports for insert to authenticated with check (reporter_user_id=auth.uid());
drop policy if exists "reports own or admin read" on public.public_entity_reports;
create policy "reports own or admin read" on public.public_entity_reports for select to authenticated using (reporter_user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "reports admin update" on public.public_entity_reports;
create policy "reports admin update" on public.public_entity_reports for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists "observations approved or own read" on public.medicine_community_observations;
create policy "observations approved or own read" on public.medicine_community_observations for select to anon, authenticated using (status='approved' or user_id=auth.uid() or private.is_platform_admin());
drop policy if exists "observations own insert" on public.medicine_community_observations;
create policy "observations own insert" on public.medicine_community_observations for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "observations owner delete pending" on public.medicine_community_observations;
create policy "observations owner delete pending" on public.medicine_community_observations for delete to authenticated using ((user_id=auth.uid() and status='pending') or private.is_platform_admin());
drop policy if exists "observations admin update" on public.medicine_community_observations;
create policy "observations admin update" on public.medicine_community_observations for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy if exists "company messages sender or company read" on public.company_profile_messages;
create policy "company messages sender or company read" on public.company_profile_messages for select to authenticated using (
  sender_user_id=auth.uid() or private.is_platform_admin() or exists(
    select 1 from public.organization_members member where member.organization_id=company_profile_messages.organization_id and member.user_id=auth.uid() and member.is_active
  )
);
drop policy if exists "company messages authenticated insert" on public.company_profile_messages;
create policy "company messages authenticated insert" on public.company_profile_messages for insert to authenticated with check (sender_user_id=auth.uid());
drop policy if exists "company messages company update" on public.company_profile_messages;
create policy "company messages company update" on public.company_profile_messages for update to authenticated using (
  private.is_platform_admin() or exists(
    select 1 from public.organization_members member where member.organization_id=company_profile_messages.organization_id and member.user_id=auth.uid() and member.is_active
  )
) with check (
  private.is_platform_admin() or exists(
    select 1 from public.organization_members member where member.organization_id=company_profile_messages.organization_id and member.user_id=auth.uid() and member.is_active
  )
);
