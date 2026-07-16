# Platform maturity follow-up

Last reviewed: 2026-07-16

Keep this page lean. It records only public-safe verified facts and active blockers.

## Verified this review

- GitHub repository is active, public, writable by the connected account, and uses `main` as the default branch.
- Latest repository commit reviewed is `746e06a` (`Merge pull request #107 from minasami/codex/company-governance-ux`).
- GitHub reports successful Vercel and Appwrite Sites statuses for that commit.
- PR #107 is merged into `main`; it adds company-directory governance work and updates deployment documentation to describe Vercel production with an Appwrite Sites preview under evaluation.
- GitHub returned no pull-request-triggered Actions runs for the latest commit; this connector view does not prove that push or scheduled runs are absent.
- Open PRs currently include #92, #55, #36, #26, and #25. PR #92 remains a non-mergeable clinical-data draft; #36 remains non-mergeable; #26 and #25 remain non-mergeable drafts.

## Changed this review

- Replaced the stale July 15 commit and failed Appwrite-preview status with the newly verified July 16 `main` commit and successful Vercel/Appwrite statuses.
- Removed resolved references to draft PRs #104 and #105 from the active blocker list.
- Recorded the merge of PR #107 and retained its deployment-boundary wording without treating Appwrite as production parity.
- No application logic, deployment configuration, database schema, permissions, RLS policies, Auth settings, or Notion content were changed by this review.

## Not verified clean

- Direct production route checks could not be completed from this runner because `medicine-support-hub.vercel.app` did not resolve. DNS failures are runner/network failures, not proof that production is down.
- Vercel deployment contents, production aliases, and runtime logs were not available through the connected tools; a successful commit status alone does not prove every production route is healthy.
- Appwrite reports a successful deployment status, but functional parity with Vercel production APIs, cron jobs, dynamic metadata, and response behavior was not independently verified.
- Current Supabase Security Advisor and Performance Advisor results were not available.
- Production application of repository migrations was not available for verification; full historical migration parity remains unverified.
- Current Notion operating-page parity was not available.
- PR #92 adds clinical and identity-sensitive data foundations and must remain draft until authorization and identity-matching controls are independently reviewed or securely feature-gated.
- PR #55 remains security-sensitive and unresolved.

## Lean next actions

1. Run the scheduled/manual Platform Health workflow and inspect route-level output.
2. Verify production routes, aliases, deployment contents, and runtime logs through the correct Vercel project.
3. Verify the Appwrite preview routes and document exact feature gaps versus Vercel production.
4. Confirm production migration application, then rerun Supabase Security and Performance Advisors.
5. Complete full historical repository-to-production migration parity verification.
6. Keep PR #92 draft until its security boundary is independently verified.
7. Rebase or close stale non-mergeable PRs after confirming whether their work is still needed.
8. Reconcile the private Notion operating page with this verified status.
