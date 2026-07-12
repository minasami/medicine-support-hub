-- Preserve the original indexed v4 plan privately, then expose the v5 fast browse body through v4.

do $migration$
declare
  legacy_definition text;
  v5_definition text;
begin
  if to_regprocedure('public.search_medicine_encyclopedia_v4_legacy(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer)') is null then
    select pg_get_functiondef(
      'public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer)'::regprocedure
    ) into legacy_definition;
    legacy_definition:=replace(
      legacy_definition,
      'FUNCTION public.search_medicine_encyclopedia_v4(',
      'FUNCTION public.search_medicine_encyclopedia_v4_legacy('
    );
    execute legacy_definition;
  end if;

  select pg_get_functiondef(
    'public.search_medicine_encyclopedia_v5(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer)'::regprocedure
  ) into v5_definition;
  v5_definition:=replace(
    v5_definition,
    'public.search_medicine_encyclopedia_v4(',
    'public.search_medicine_encyclopedia_v4_legacy('
  );
  execute v5_definition;

  v5_definition:=replace(
    v5_definition,
    'FUNCTION public.search_medicine_encyclopedia_v5(',
    'FUNCTION public.search_medicine_encyclopedia_v4('
  );
  execute v5_definition;
end
$migration$;

revoke all on function public.search_medicine_encyclopedia_v4_legacy(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.search_medicine_encyclopedia_v4_legacy(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) to service_role;
revoke all on function public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) from public;
grant execute on function public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer) to anon,authenticated,service_role;
