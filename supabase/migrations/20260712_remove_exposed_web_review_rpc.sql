-- Web evidence promotion is performed by the platform-admin server endpoint.
-- Removing the exposed SECURITY DEFINER RPC avoids broad authenticated executability.

drop function if exists public.review_web_ingestion_candidate(uuid,text,text);
