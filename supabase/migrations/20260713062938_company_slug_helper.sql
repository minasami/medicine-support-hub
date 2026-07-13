create extension if not exists pgcrypto;

create or replace function public.company_slug_for_name(p_name text)
returns text
language sql
immutable
strict
set search_path = public, pg_catalog
as $$
  select left(
    coalesce(nullif(trim(both '-' from regexp_replace(lower(trim(p_name)), '[^[:alnum:]]+', '-', 'g')), ''), 'company'),
    74
  ) || '-' || substr(md5(trim(p_name)), 1, 8);
$$;
