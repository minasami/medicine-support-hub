-- Restore authenticated execution for the organization membership RLS helper.
-- This function is used inside multiple public-table RLS policies, for example
-- programs, beneficiaries, support requests, and related event tables.
--
-- Without EXECUTE for authenticated users, RLS evaluation can fail with:
-- permission denied for function is_org_member
--
-- The function remains SECURITY DEFINER and only returns whether the current
-- authenticated user is an active member of the target organization.

grant execute on function public.is_org_member(uuid) to authenticated;
