-- Read-only production preflight. Every result must be reviewed before cutover.

select current_database() database_name, now() checked_at,
       current_setting('server_version') postgres_version;

with source_counts as (
  select 'medicines2' source_system, count(*)::bigint source_rows from public.medicines2
  union all select 'medicines3', count(*) from public.medicines3
  union all select 'medicines5', count(*) from public.medicines5
), map_counts as (
  select source_system, count(*)::bigint mapped_rows
  from public.medicine_catalog_id_map_v1
  where source_system in ('medicines2','medicines3','medicines5')
  group by source_system
)
select source_counts.source_system, source_rows, coalesce(mapped_rows, 0) mapped_rows,
       source_rows - coalesce(mapped_rows, 0) unmapped_rows
from source_counts left join map_counts using (source_system)
order by source_system;

select conrelid::regclass::text referencing_table,
       a.attname referencing_column,
       confrelid::regclass::text referenced_table,
       af.attname referenced_column
from pg_constraint c
join unnest(c.conkey) with ordinality ck(attnum, ord) on true
join unnest(c.confkey) with ordinality fk(attnum, ord) on fk.ord = ck.ord
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = ck.attnum
join pg_attribute af on af.attrelid = c.confrelid and af.attnum = fk.attnum
where c.contype = 'f'
  and confrelid in (
    'public.medicines'::regclass, 'public.medicines2'::regclass,
    'public.medicines3'::regclass, 'public.medicines4'::regclass,
    'public.medicines5'::regclass
  )
order by referenced_table, referencing_table, referencing_column;

select p.proname, pg_get_function_identity_arguments(p.oid) arguments,
       p.prosecdef security_definer,
       has_function_privilege('anon', p.oid, 'execute') anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') authenticated_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'search_medicine_encyclopedia_v3',
    'search_medicine_encyclopedia_v4',
    'search_medicine_encyclopedia_v5',
    'search_medicines_catalog'
  )
order by p.proname, arguments;

