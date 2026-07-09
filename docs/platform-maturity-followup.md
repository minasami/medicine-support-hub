# Platform maturity follow-up

Last reviewed: 2026-07-09

Keep this page lean. It should record only verified platform facts and active blockers.

## Verified this review

- GitHub repository is active, public, writable by the connected account, and uses `main` as the default branch.
- Latest visible repository commit from GitHub commit search is `5ea877ba6ab3fc0eac0eca2641210587c0d1db7f` (`Localize key pharmacy portal labels`).
- Latest visible commit has a successful GitHub commit status from Vercel.
- GitHub workflow-run lookup returned no Actions runs for latest visible commit `5ea877ba6ab3fc0eac0eca2641210587c0d1db7f`, so do not treat latest `main` as Actions-verified from this review.
- Recent merged PR #58 (`Add branch access repair`) has:
  - successful Vercel commit status on head `736b6547fe0ca0d946a6ef2a34899e12e78994af`;
  - successful Quality workflow run `28877399542`;
  - successful Platform Health workflow run `28877399301` build job.
- Platform Health production smoke-test job was skipped on the PR-triggered run, which is expected from workflow rules but means route health is not verified by that run.
- Open PRs visible in GitHub are:
  - #55 `Admin users`, open, not draft, not mergeable, head `c8c0be6db1766634eebce1a0426c81cdf068f98d`, with a successful Vercel commit status but no GitHub workflow runs returned by the connected workflow-run check.
  - #36 `Lazy load application routes`, open, not draft, not mergeable.
  - #25 `Add pilot approval and launch governance`, draft and not mergeable.
  - #26 `Update pilot dashboard`, draft and not mergeable.
- `vercel.json` still configures Vercel to install with `pnpm install --frozen-lockfile` and build with `pnpm run validate`.
- Root package scripts still include `typecheck`, `build`, `validate`, and `import:medicines`.
- Platform Health workflow defines a scheduled/manual `production-smoke-test` job against `https://medicine-support-hub.vercel.app` routes.
- Quality workflow typechecks, uploads TypeScript diagnostics, builds, and fails if typecheck failed.
- README still documents live routes and the platform maturity follow-up link.

## Changed this review

- Refreshed this follow-up document with the 2026-07-09 verified state: latest visible commit, Vercel commit-status evidence, recent PR #58 workflow evidence, open PR state, route-check limits, and unresolved external-tool blockers.
- No production settings, database permissions, deployment configuration, or application behavior were changed.

## Not verified clean

- Production route availability is still not cleanly verified in this review.
- Public fetch of `https://medicine-support-hub.vercel.app/` failed from the review environment, and route opens for app paths were not usable, so do not treat public routes as confirmed healthy from this run.
- Latest visible commit `5ea877ba6ab3fc0eac0eca2641210587c0d1db7f` has successful Vercel status, but no Actions workflow runs were returned for that commit through connected tooling.
- No connected Vercel project-management tooling was available in this review, so the actual production project configuration and deployment alias mapping could not be confirmed beyond GitHub's Vercel commit status.
- No connected Supabase tooling was available in this review, so live security advisor, performance advisor, Edge Function deployment state, and applied migration parity could not be freshly verified.
- No connected Notion tooling was available in this review, so the operating page could not be freshly checked for stale content.

## PR #55 review notes

PR #55 introduces platform admin user management. Treat it as security-sensitive until validated because it:

- Is open, not draft, not mergeable, and has no PR body.
- Adds a Supabase migration on the PR branch for username uniqueness, expanded profile roles, and `platform_admin_user_audit`.
- Creates an audit table with RLS enabled and a read policy using `public.is_platform_admin()`.
- Previously appeared to include an Edge Function using service-role credentials and permissive CORS; re-check the current PR diff before any merge decision.

Do not merge PR #55 based only on the Vercel commit status. It needs GitHub validation, Supabase function/migration verification, and a security review.

## Security decisions needed

Supabase security advisors previously flagged:

1. `public.is_org_member(target_org uuid)` as `SECURITY DEFINER` and executable by `authenticated`.
2. `public.is_platform_admin()` as `SECURITY DEFINER` and executable by `authenticated`.
3. Auth leaked password protection disabled.

Do not revoke helper-function access automatically. The migration `20260701_restrict_sensitive_function_execution.sql` intentionally grants authenticated execute, so this needs a product/security decision.

## Lean next actions

1. Connect or identify the correct Vercel project for `medicine-support-hub.vercel.app`.
2. Run or inspect a scheduled/manual Platform Health workflow and confirm the `production-smoke-test` job passes.
3. Re-check Supabase advisors, Edge Function deployment state, and applied migration history with Supabase tooling.
4. Review PR #55 as security-sensitive before merge, especially service-role use, CORS, allowed role changes, audit guarantees, and migration behavior.
5. Decide whether the two helper functions must remain client-RPC callable.
6. Enable leaked password protection in Supabase Auth.
7. Re-check the Notion operating page for stale architecture/security/deployment notes.
8. Keep draft PRs #25/#26 out of the merge path until rebased and revalidated.
