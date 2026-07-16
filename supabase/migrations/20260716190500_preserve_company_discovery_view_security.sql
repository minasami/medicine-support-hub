-- Dynamic CREATE OR REPLACE preserves columns and grants but resets view options.
-- Keep public discovery views as invoker-secured views after canonical-link repair.
alter view public.platform_connection_graph_nodes set (security_invoker=true,security_barrier=true);
alter view public.platform_universal_search_index set (security_invoker=true,security_barrier=true);
alter view public.public_seo_catalog set (security_invoker=true,security_barrier=true);
