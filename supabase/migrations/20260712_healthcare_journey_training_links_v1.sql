create or replace view public.healthcare_journey_public_v1
with (security_invoker = true)
as
select
  stage_key,sort_order,title_en,title_ar,summary_en,summary_ar,primary_actor,lifecycle_status,
  public_route,staff_route,learning_course_slug,
  case when learning_course_slug is null then null else '/learn#' || learning_course_slug end as learning_route,
  source_systems,required_capabilities,release_gate,updated_at
from public.healthcare_journey_stages
where is_public = true;

grant select on public.healthcare_journey_public_v1 to anon, authenticated;
notify pgrst, 'reload schema';
