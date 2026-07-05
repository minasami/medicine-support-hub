# Platform maturity follow-up

Last reviewed: 2026-07-05

Keep this page lean. It should record only verified platform facts and active blockers.

## Verified

- GitHub repository is active, public, writable, and uses `main` as the default branch.
- Root package scripts include `typecheck`, `build`, `validate`, and `import:medicines`.
- Vercel builds are configured to run `pnpm run validate`, not a weaker build-only command.
- Medicine import script is portable: no pnpm-store paths and no timestamped default Excel filename.
- Root command exists: `pnpm import:medicines <xlsx-path>`.
- Quality workflow exists and runs typecheck plus production build on pull requests and pushes to `main`.
- Platform Health workflow exists and runs build on pull requests, pushes to `main`, scheduled runs, and manual dispatch.
- PR #36 (`perf/lazy-routes-and-bundle`) has passing Platform Health and Quality runs at head `d24614940f71cf7f73d7896ee4143bb0a6f2b421`.
- For PR #36, Platform Health build passed and Quality typecheck plus production build passed.
- For PR #36, production smoke test was skipped by design because the run was pull-request triggered; do not treat this as production-route verification.
- Pilot PRs #25 and #26 are drafts, not ready-to-merge work.
- Repository migration files exist for:
  - `supabase/migrations/20260701_performance_indexes_v7.sql`
  - `supabase/migrations/20260701_move_pg_trgm_extension.sql`
  - `supabase/migrations/20260701_restrict_sensitive_function_execution.sql`
- Open dependency PR #37 bumps 14 production dependencies, including major updates to `@types/node`, `@vitejs/plugin-react`, `lucide-react`, `vite`, and `zod`; it should not be auto-merged without full CI and route checks.
- Previously verified external facts still need re-check with connected tools before treating them as fresh:
  - Supabase production project `edgbirxeafstvqdpxgxv` was active and healthy.
  - Supabase migration history was visible through connected tooling.
  - Latest applied Supabase migrations included `performance_indexes_v7` and `move_pg_trgm_extension`.
  - Notion operating page for Medicine Support Hub was found and recently edited on 2026-07-01.

## Not verified clean

- Production route availability is not cleanly verified in this review.
- Public fetch of `https://medicine-support-hub.vercel.app/` failed from the review environment, so do not treat the public route as confirmed healthy from this run.
- Platform Health production smoke test exists, but PR runs skip it by design; it only runs on schedule or manual dispatch.
- Connected Vercel tooling was not available in this review; the previously exposed Vercel project was an old Angular project named `csb-745zq-euam`, not a confirmed Medicine Support Hub project.
- Connected Supabase tooling was not available in this review, so live security advisor, performance advisor, and applied migration parity could not be freshly verified.
- Connected Notion tooling was not available in this review, so the operating page could not be freshly checked for stale content.

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
8. Review dependency PR #37 separately because it contains multiple major updates; do not auto-merge it as a low-risk fix.
9. Keep draft PRs #25/#26 out of the merge path until rebased and revalidated.
