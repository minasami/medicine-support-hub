create table if not exists public.entity_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('medicine','company')),
  entity_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id,entity_type,entity_key)
);
create index if not exists entity_favorites_entity_idx on public.entity_favorites(entity_type,entity_key,created_at desc);

create table if not exists public.entity_comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('medicine','company')),
  entity_key text not null,
  parent_id uuid references public.entity_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 2 and 2000),
  is_anonymous boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  moderation_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entity_comments_entity_idx on public.entity_comments(entity_type,entity_key,status,created_at desc);
create index if not exists entity_comments_user_idx on public.entity_comments(user_id,status,created_at desc);

create table if not exists public.entity_public_comments (
  id uuid primary key,
  entity_type text not null,
  entity_key text not null,
  parent_id uuid,
  body text not null,
  author_name text not null,
  created_at timestamptz not null
);
create index if not exists entity_public_comments_entity_idx on public.entity_public_comments(entity_type,entity_key,created_at desc);

create table if not exists public.entity_social_stats (
  entity_type text not null check (entity_type in ('medicine','company')),
  entity_key text not null,
  favorite_count bigint not null default 0,
  comment_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(entity_type,entity_key)
);

create trigger entity_comments_touch_updated_at before update on public.entity_comments for each row execute function private.touch_updated_at();

alter table public.entity_favorites enable row level security;
alter table public.entity_comments enable row level security;
alter table public.entity_public_comments enable row level security;
alter table public.entity_social_stats enable row level security;

revoke all on public.entity_favorites,public.entity_comments,public.entity_public_comments,public.entity_social_stats from anon,authenticated;
grant select,insert,delete on public.entity_favorites to authenticated;
grant select,insert,update on public.entity_comments to authenticated;
grant select on public.entity_public_comments,public.entity_social_stats to anon,authenticated;
grant all on public.entity_favorites,public.entity_comments,public.entity_public_comments,public.entity_social_stats to service_role;

create policy favorites_own_select on public.entity_favorites for select to authenticated using (user_id=(select auth.uid()));
create policy favorites_own_insert on public.entity_favorites for insert to authenticated with check (user_id=(select auth.uid()));
create policy favorites_own_delete on public.entity_favorites for delete to authenticated using (user_id=(select auth.uid()));

create policy comments_approved_or_own_select on public.entity_comments for select to authenticated using (status='approved' or user_id=(select auth.uid()) or (select private.is_platform_admin()));
create policy comments_own_insert on public.entity_comments for insert to authenticated with check (user_id=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null and moderation_notes is null);
create policy comments_pending_own_or_admin_update on public.entity_comments for update to authenticated using ((user_id=(select auth.uid()) and status='pending') or (select private.is_platform_admin())) with check ((user_id=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null) or (select private.is_platform_admin()));

create policy public_comments_read on public.entity_public_comments for select to anon,authenticated using (true);
create policy social_stats_read on public.entity_social_stats for select to anon,authenticated using (true);

create or replace function private.sync_entity_community()
returns trigger
language plpgsql
security definer
set search_path=public,private,pg_catalog
as $$
declare v_type text; v_key text; v_name text;
begin
  v_type:=coalesce(new.entity_type,old.entity_type);
  v_key:=coalesce(new.entity_key,old.entity_key);
  if tg_table_name='entity_comments' then
    if tg_op='DELETE' or new.status<>'approved' then
      delete from public.entity_public_comments where id=old.id;
    else
      select case when new.is_anonymous then 'Community member' else coalesce(nullif(btrim(p.full_name),''),'Community member') end
        into v_name from public.profiles p where p.id=new.user_id;
      insert into public.entity_public_comments(id,entity_type,entity_key,parent_id,body,author_name,created_at)
      values(new.id,new.entity_type,new.entity_key,new.parent_id,new.body,coalesce(v_name,'Community member'),new.created_at)
      on conflict(id) do update set body=excluded.body,author_name=excluded.author_name,parent_id=excluded.parent_id;
    end if;
  end if;
  insert into public.entity_social_stats(entity_type,entity_key,favorite_count,comment_count,updated_at)
  values(v_type,v_key,
    (select count(*) from public.entity_favorites f where f.entity_type=v_type and f.entity_key=v_key),
    (select count(*) from public.entity_comments c where c.entity_type=v_type and c.entity_key=v_key and c.status='approved'),now())
  on conflict(entity_type,entity_key) do update set favorite_count=excluded.favorite_count,comment_count=excluded.comment_count,updated_at=now();
  return coalesce(new,old);
end;
$$;
revoke all on function private.sync_entity_community() from public,anon,authenticated;

create trigger entity_favorites_sync_stats after insert or delete on public.entity_favorites for each row execute function private.sync_entity_community();
create trigger entity_comments_sync_public after insert or update or delete on public.entity_comments for each row execute function private.sync_entity_community();
