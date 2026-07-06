# Platform maturity follow-up

Last reviewed: 2026-07-06

Keep this page lean. It should record only verified platform facts and active blockers.

## Verified this review

- GitHub repository is active, public, writable, and uses `main` as the default branch.
- Open PRs visible in GitHub are:
  - #36 `Lazy load application routes` at head `d24614940f71cf7f73d7896ee4143bb0a6f2b421`.
  - #25 `Add pilot approval and launch governance`, draft.
  - #26 `Update pilot dashboard`, draft.
- PR #36 has completed successful GitHub Actions runs for:
  - Platform Health run `28674393253`.
  - Quality run `28674393235`.
- Platform Health build job passed for PR #36.
- Platform Health `production-smoke-test` was skipped for PR #36 because the workflow only runs that job on scheduled or manual dispatch events.
- Quality `Typecheck and production build` job passed for PR #36.
- Root package scripts include `typecheck`, `build`, `validate`, and `import:medicines`.
- Vercel builds are configured to run `pnpm run validate`, not a weaker build-only command.
- Medicine import script is portable: no pnpm-store paths and no timestamped default Excel filename.
- Repository migration files exist for:
  - `supabase/migrations/20260701_performance_indexes_v7.sql`
  - `supabase/migrations/20260701_move_pg_trgm_extension.sql`
  - `supabase/migrations/20260701_restrict_sensitive_function_execution.sql`

## Not verified clean

- Production route availability is still not cleanly verified in this review.
- Public fetch of `https://medicine-support-hub.vercel.app/` failed from the review environment, so do not treat the public route as confirmed healthy from this run.
- No connected Vercel tooling was available in this review, so the actual project backing `medicine-support-hub.vercel.app` could not be confirmed.
- No connected Supabase tooling was available in this review, so live security advisor, performance advisor, and applied migration parity could not be freshly verified.
- No connected Notion tooling was available in this review, so the operating page could not be freshly checked for stale content.

## Security decisions needed

Supabase security advisors previously flagged:

1. `public.is_org_member(target_org uuid)` as `SECURITY DEFINER` and executable by `authenticated`.
2. `public.is_platform_admin()` as `SECURITY DEFINER` and executable by `authenticated`.
3. Auth leaked password protection disabled.

Do not revoke helper-function access automatically. The migration `20260701_restrict_sensitive_function_execution.sql` intentionally grants authenticated execute, so this needs a product/security decision.

## Lean next actions

1. Connect or identify the correct Vercel project for `medicine-support-hub.vercel.app`.
2. Run the Platform Health workflow manually or inspect the scheduled run, then confirm the `production-smoke-test` job passes.
3. Re-check Supabase advisors and applied migration history with Supabase tooling.
4. Decide whether the two helper functions must remain client-RPC callable.
5. Enable leaked password protection in Supabase Auth.
6. Re-check the Notion operating page for stale architecture/security/deployment notes.
7. Review PR #36 first because its build and typecheck are passing, but require production smoke verification before merge.
8. Keep draft PRs #25/#26 out of the merge path until rebased and revalidated.
