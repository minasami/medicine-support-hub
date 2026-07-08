# Platform maturity follow-up

Last reviewed: 2026-07-08

Keep this page lean. It should record only verified platform facts and active blockers.

## Verified this review

- GitHub repository is active, public, writable by the connected account, and uses `main` as the default branch.
- Latest visible `main` commit is `f87f93906a666ec0b96d440ce315a6f275d5212f` (`Add sales export record timestamps`).
- Latest visible `main` commit has a successful GitHub commit status from Vercel.
- Open PRs visible in GitHub are:
  - #55 `Admin users`, open, not draft, not mergeable, head `c8c0be6db1766634eebce1a0426c81cdf068f98d`, with a successful Vercel commit status but no GitHub workflow runs returned by the connected workflow-run check.
  - #36 `Lazy load application routes`, open, not draft, not mergeable, head `d24614940f71cf7f73d7896ee4143bb0a6f2b421`.
  - #25 `Add pilot approval and launch governance`, draft and not mergeable.
  - #26 `Update pilot dashboard`, draft and not mergeable.
- PR #36 still has completed successful GitHub Actions runs for:
  - Platform Health run `28674393253`.
  - Quality run `28674393235`.
- `vercel.json` still configures Vercel to install with `pnpm install --frozen-lockfile` and build with `pnpm run validate`.
- Root package scripts still include `typecheck`, `build`, `validate`, and `import:medicines`.
- Platform Health workflow defines a `production-smoke-test` job for scheduled/manual runs against `https://medicine-support-hub.vercel.app` routes.
- Quality workflow typechecks, uploads TypeScript diagnostics, builds, and fails the run if typecheck failed.
- README still documents live routes and the platform maturity follow-up link.
- Repository migration files still exist for earlier security/performance follow-up:
  - `supabase/migrations/20260701_performance_indexes_v7.sql`
  - `supabase/migrations/20260701_move_pg_trgm_extension.sql`
  - `supabase/migrations/20260701_restrict_sensitive_function_execution.sql`
- PR #55 adds a new migration file: `supabase/migrations/20260707_platform_admin_user_management.sql`.

## Changed this review

- Refreshed this follow-up document with the current `main` commit, open PR state, Vercel commit-status evidence, workflow evidence, route-check blocker, and PR #55 migration/admin-user notes.
- No production settings, database permissions, deployment configuration, or application behavior were changed.

## Not verified clean

- Production route availability is still not cleanly verified in this review.
- Public fetch of `https://medicine-support-hub.vercel.app/` failed from the review environment, and additional route opens were not usable from the public web tool, so do not treat public routes as confirmed healthy from this run.
- The connected GitHub workflow-run check returned no Actions workflow runs for latest visible `main` commit `f87f93906a666ec0b96d440ce315a6f275d5212f`.
- PR #55 has a successful Vercel commit status, but no GitHub workflow runs were returned for its head commit through the connected workflow-run check.
- No connected Vercel project-management tooling was available in this review, so the actual production project configuration and deployment alias mapping could not be confirmed beyond GitHub's Vercel commit status.
- No connected Supabase tooling was available in this review, so live security advisor, performance advisor, Edge Function deployment state, and applied migration parity could not be freshly verified.
- No connected Notion tooling was available in this review, so the operating page could not be freshly checked for stale content.

## PR #55 review notes

PR #55 introduces platform admin user management. Treat it as security-sensitive until validated because it:

- Adds a Supabase Edge Function deployed with service-role credentials.
- Allows authenticated admin/platform-admin/super-admin users to read and patch user profile/auth fields.
- Uses permissive CORS origin `*` in the Edge Function.
- Adds an audit table and read policy, but live RLS/advisor behavior is not verified.

Do not merge PR #55 based only on the Vercel commit status. It needs GitHub validation, Supabase function/migration verification, and a security review.

## Security decisions needed

Supabase security advisors previously flagged:

1. `public.is_org_member(target_org uuid)` as `SECURITY DEFINER` and executable by `authenticated`.
2. `public.is_platform_admin()` as `SECURITY DEFINER` and executable by `authenticated`.
3. Auth leaked password protection disabled.

Do not revoke helper-function access automatically. The migration `20260701_restrict_sensitive_function_execution.sql` intentionally grants authenticated execute, so this needs a product/security decision.

## Lean next actions

1. Connect or identify the correct Vercel project for `medicine-support-hub.vercel.app`.
2. Run or inspect the Platform Health scheduled/manual workflow and confirm the `production-smoke-test` job passes.
3. Re-check Supabase advisors, Edge Function deployment state, and applied migration history with Supabase tooling.
4. Review PR #55 as security-sensitive before merge, especially service-role use, CORS, allowed role changes, audit guarantees, and migration behavior.
5. Decide whether the two helper functions must remain client-RPC callable.
6. Enable leaked password protection in Supabase Auth.
7. Re-check the Notion operating page for stale architecture/security/deployment notes.
8. Keep draft PRs #25/#26 out of the merge path until rebased and revalidated.
