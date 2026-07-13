create or replace function private.prepare_public_entity_comment()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.user_id := auth.uid();
  select coalesce(nullif(trim(full_name), ''), 'Community member') into new.author_name
  from public.profiles where id = auth.uid();
  new.author_name := coalesce(new.author_name, 'Community member');
  new.updated_at := now();

  if new.body ~* '(guaranteed cure|stop your medicine|double the dose|safe for everyone|no side effects|بدون آثار جانبية|علاج مضمون|أوقف الدواء|ضاعف الجرعة)' then
    new.status := 'pending';
    new.moderation_reason := 'Automatically held for medical-safety review.';
  else
    new.status := 'published';
    new.moderation_reason := null;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_public_entity_comment_trigger on public.public_entity_comments;
create trigger prepare_public_entity_comment_trigger
before insert on public.public_entity_comments
for each row execute function private.prepare_public_entity_comment();

create or replace function private.prepare_medicine_community_observation()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.user_id := auth.uid();
  select coalesce(nullif(trim(full_name), ''), 'Community member') into new.author_name
  from public.profiles where id = auth.uid();
  new.author_name := coalesce(new.author_name, 'Community member');
  new.status := 'pending';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prepare_medicine_community_observation_trigger on public.medicine_community_observations;
create trigger prepare_medicine_community_observation_trigger
before insert on public.medicine_community_observations
for each row execute function private.prepare_medicine_community_observation();

create or replace function private.prepare_company_profile_message()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
begin
  new.sender_user_id := auth.uid();
  select coalesce(nullif(trim(full_name), ''), 'Platform member') into new.sender_name
  from public.profiles where id = auth.uid();
  new.sender_name := coalesce(new.sender_name, 'Platform member');
  select profile.organization_id into new.organization_id
  from public.industry_company_profiles profile
  where profile.company_slug = new.company_slug
  order by profile.updated_at desc
  limit 1;
  return new;
end;
$$;

drop trigger if exists prepare_company_profile_message_trigger on public.company_profile_messages;
create trigger prepare_company_profile_message_trigger
before insert on public.company_profile_messages
for each row execute function private.prepare_company_profile_message();

create or replace function public.entity_engagement_summary(p_entity_type text, p_entity_key text)
returns table(favorite_count bigint, like_count bigint, helpful_count bigint, comment_count bigint)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    (select count(*) from public.public_entity_favorites where entity_type=p_entity_type and entity_key=p_entity_key),
    (select count(*) from public.public_entity_reactions where entity_type=p_entity_type and entity_key=p_entity_key and reaction_type='like'),
    (select count(*) from public.public_entity_reactions where entity_type=p_entity_type and entity_key=p_entity_key and reaction_type='helpful'),
    (select count(*) from public.public_entity_comments where entity_type=p_entity_type and entity_key=p_entity_key and status='published');
$$;
grant execute on function public.entity_engagement_summary(text, text) to anon, authenticated;

create or replace function public.review_entity_comment(target_comment uuid, decision text, reviewer_notes text default null)
returns public.public_entity_comments
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare result public.public_entity_comments;
begin
  if not private.is_platform_admin() then raise exception 'Platform admin access required.' using errcode='42501'; end if;
  if decision not in ('published','hidden','rejected') then raise exception 'Invalid decision.'; end if;
  update public.public_entity_comments set status=decision, moderation_reason=reviewer_notes, moderated_by=auth.uid(), moderated_at=now(), updated_at=now()
  where id=target_comment returning * into result;
  return result;
end;
$$;
grant execute on function public.review_entity_comment(uuid, text, text) to authenticated;

create or replace function public.review_medicine_community_observation(target_observation uuid, decision text, reviewer_notes text default null)
returns public.medicine_community_observations
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare result public.medicine_community_observations;
begin
  if not private.is_platform_admin() then raise exception 'Platform admin access required.' using errcode='42501'; end if;
  if decision not in ('approved','rejected','needs_information') then raise exception 'Invalid decision.'; end if;
  update public.medicine_community_observations set status=decision, moderation_notes=reviewer_notes, reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  where id=target_observation returning * into result;
  return result;
end;
$$;
grant execute on function public.review_medicine_community_observation(uuid, text, text) to authenticated;
