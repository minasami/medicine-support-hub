-- Keep the materialized medicine search index private while allowing the fixed,
-- public-safe search RPCs to read private search infrastructure with the
-- function owner's privileges. Both functions use fixed projections and no
-- caller-controlled dynamic SQL.

alter function public.search_medicine_encyclopedia_v4(
  text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer
) security definer;

alter function public.search_medicine_encyclopedia_v4(
  text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer
) set search_path = public, private, extensions, pg_catalog;

revoke all on function public.search_medicine_encyclopedia_v4(
  text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer
) from public;

grant execute on function public.search_medicine_encyclopedia_v4(
  text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer
) to anon, authenticated, service_role;

-- Preserve the v3 compatibility endpoint for older clients.
alter function public.search_medicine_encyclopedia_v3(
  text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer
) security definer;

alter function public.search_medicine_encyclopedia_v3(
  text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer
) set search_path = public, private, extensions, pg_catalog;

revoke all on function public.search_medicine_encyclopedia_v3(
  text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer
) from public;

grant execute on function public.search_medicine_encyclopedia_v3(
  text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,text,integer,integer
) to anon, authenticated, service_role;

revoke all on private.medicine_search_index_v1 from public, anon, authenticated;
