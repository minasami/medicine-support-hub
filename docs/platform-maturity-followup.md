# Platform maturity follow-up

Last reviewed: 2026-07-03

Keep this page lean. It should record only verified platform facts and active blockers.

## Verified

- GitHub repository is active and writable.
- Medicine import script is now portable: no pnpm-store paths and no timestamped default Excel filename.
- Root command exists: `pnpm import:medicines <xlsx-path>`.
- Supabase production project `edgbirxeafstvqdpxgxv` is active and healthy.
- Supabase migration history is visible through connected tooling.
- Latest applied Supabase migrations include `performance_indexes_v7` and `move_pg_trgm_extension`.
- Matching repository migration files exist for:
  - `supabase/migrations/20260701_performance_indexes_v7.sql`
  - `supabase/migrations/20260701_move_pg_trgm_extension.sql`
- Notion operating page for Medicine Support Hub was found and recently edited on 2026-07-01.
- Pilot PRs #25 and #26 are drafts, not ready-to-merge work.

## Not verified clean

- Supabase performance advisor is not cleanly verified.
- Connected Vercel tooling exposes an old Angular project named `csb-745zq-euam`, not a confirmed Medicine Support Hub project.
- Live production routes still need verification against the correct Vercel project.

## Security decisions needed

Supabase security advisors still flag:

1. `public.is_org_member(target_org uuid)` as `SECURITY DEFINER` and executable by `authenticated`.
2. `public.is_platform_admin()` as `SECURITY DEFINER` and executable by `authenticated`.
3. Auth leaked password protection disabled.

Do not revoke helper-function access automatically. The migration `20260701_restrict_sensitive_function_execution.sql` intentionally grants authenticated execute, so this needs a product/security decision.

## Lean next actions

1. Connect or identify the correct Vercel project for `medicine-support-hub.vercel.app`.
2. Run route smoke tests against the confirmed deployment.
3. Decide whether the two helper functions must remain client-RPC callable.
4. Enable leaked password protection in Supabase Auth.
5. Rerun Supabase performance advisors.
6. Review draft PRs #25/#26 and dependency PRs only after build and route checks pass.
