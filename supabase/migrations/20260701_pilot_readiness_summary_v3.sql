create or replace view public.pilot_readiness_summary with (security_invoker = true) as
select
  p.id as program_id,
  p.organization_id,
  p.name as program_name,
  p.pilot_phase,
  p.sites_count,
  p.target_beneficiaries,
  p.budget_amount,
  p.spent_amount,
  p.start_date,
  p.end_date,
  (select count(*) from public.beneficiaries b where b.program_id = p.id)::int as enrolled_beneficiaries,
  (select count(*) from public.pilot_milestones m where m.program_id = p.id)::int as milestones_total,
  (select count(*) from public.pilot_milestones m where m.program_id = p.id and m.status = 'completed')::int as milestones_completed,
  (select count(*) from public.pilot_deliverables d where d.program_id = p.id)::int as deliverables_total,
  (select count(*) from public.pilot_deliverables d where d.program_id = p.id and d.status = 'approved')::int as deliverables_approved
from public.programs p;
