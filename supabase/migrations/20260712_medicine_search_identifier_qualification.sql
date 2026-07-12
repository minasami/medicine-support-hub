-- Qualify CTE identifiers that can otherwise conflict with RETURNS TABLE output variables.

do $patch$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.search_medicine_encyclopedia_v4(text,text,text,text,text,text,text,numeric,numeric,boolean,boolean,boolean,boolean,integer,text,text,integer,integer)'::regprocedure
  ) into definition;

  definition := replace(definition,
    'select canonical_id from primary_ids',
    'select primary_ids.canonical_id from primary_ids'
  );
  definition := replace(definition,
    'select canonical_id from fuzzy_ids',
    'select fuzzy_ids.canonical_id from fuzzy_ids'
  );
  definition := replace(definition,
    'join private.medicine_search_index_v1 indexed using(canonical_id)',
    'join private.medicine_search_index_v1 indexed on indexed.canonical_id=ids.canonical_id'
  );

  execute definition;
end
$patch$;
