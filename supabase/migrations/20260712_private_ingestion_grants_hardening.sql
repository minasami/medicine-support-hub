-- Defense in depth: private ingestion queues are not part of the anonymous Data API.

revoke all on public.document_ocr_jobs from anon, public;
revoke all on public.web_ingestion_sources from anon, public;
revoke all on public.web_ingestion_jobs from anon, public;
revoke all on public.web_ingestion_candidates from anon, public;
revoke all on public.platform_setting_history from anon, public;
revoke all on public.platform_approval_summary_v1 from anon, public;

revoke all on function public.review_web_ingestion_candidate(uuid,text,text) from anon, public;

grant select, insert, update, delete on public.document_ocr_jobs to authenticated;
grant select, insert, update, delete on public.web_ingestion_sources to authenticated;
grant select, insert, update, delete on public.web_ingestion_jobs to authenticated;
grant select, insert, update, delete on public.web_ingestion_candidates to authenticated;
grant select on public.platform_setting_history to authenticated;
grant select on public.platform_approval_summary_v1 to authenticated;
grant execute on function public.review_web_ingestion_candidate(uuid,text,text) to authenticated;
