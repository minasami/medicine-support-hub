create or replace view public.pilot_executive_summary with (security_invoker = true) as
select p.id as program_id, p.organization_id, p.name as program_name, p.pilot_phase, p.status as program_status, p.currency, p.budget_amount, p.committed_amount, p.spent_amount, greatest(coalesce(p.budget_amount,0)-coalesce(p.committed_amount,0)-coalesce(p.spent_amount,0),0) as remaining_budget, p.target_beneficiaries,
(select count(*) from public.beneficiaries b where b.program_id=p.id)::int as enrolled_beneficiaries,
(select count(*) from public.pilot_milestones m where m.program_id=p.id)::int as milestones_total,
(select count(*) from public.pilot_milestones m where m.program_id=p.id and m.status='completed')::int as milestones_completed,
(select count(*) from public.pilot_deliverables d where d.program_id=p.id)::int as deliverables_total,
(select count(*) from public.pilot_deliverables d where d.program_id=p.id and d.status='approved')::int as deliverables_approved,
(select count(*) from public.support_requests r where r.program_id=p.id)::int as support_requests_total,
(select count(*) from public.support_requests r where r.program_id=p.id and r.status in ('approved','fulfilled'))::int as support_requests_successful,
p.sites_count,p.start_date,p.end_date,p.pilot_objective,p.success_criteria,p.risks,p.lessons_learned
from public.programs p;
