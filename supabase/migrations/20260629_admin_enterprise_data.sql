do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_members_user_id_profiles_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;
