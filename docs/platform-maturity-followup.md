# Platform maturity follow-up

Last reviewed: 2026-07-02

This note tracks operational findings that should not be lost between GitHub, Vercel, Supabase, and Notion checks.

## Verified

- GitHub repository is active and writable.
- Supabase production project `edgbirxeafstvqdpxgxv` is active and healthy.
- Supabase migration history is visible through the connected tooling.
- Latest applied Supabase migrations include `performance_indexes_v7` and `move_pg_trgm_extension`.
- Matching repository migration files exist for:
  - `supabase/migrations/20260701_performance_indexes_v7.sql`
  - `supabase/migrations/20260701_move_pg_trgm_extension.sql`
- Notion operating page for Medicine Support Hub was found and recently edited on 2026-07-01.

## Not verified clean

- Supabase performance advisor failed during execution with an internal linter SQL syntax error near `storage.buckets`; do not mark performance clean until this advisor runs successfully.
- Connected Vercel tooling currently exposes an old Angular project named `csb-745zq-euam`, not a confirmed Medicine Support Hub project. Do not use that project as evidence for Medicine Support Hub production health.
- Live production route availability still needs verification from a runner with access to the correct deployment.

## Supabase security findings needing decision

Supabase security advisors flagged:

1. `public.is_org_member(target_org uuid)` is a `SECURITY DEFINER` function executable by `authenticated`.
2. `public.is_platform_admin()` is a `SECURITY DEFINER` function executable by `authenticated`.
3. Auth leaked password protection is disabled.

The migration `20260701_restrict_sensitive_function_execution.sql` intentionally grants authenticated execute on the two helper functions, so do not revoke those grants without reviewing whether client-side RPC access is required.

## Dependency review

Open Dependabot PRs include major version changes. They should be reviewed with CI/build results and route smoke tests before merge.

## Recommended next actions

1. Confirm the correct Vercel project mapping for `medicine-support-hub.vercel.app`.
2. Run production route smoke tests against the confirmed deployment.
3. Decide whether the two Supabase helper functions should remain RPC-callable by signed-in users.
4. Enable leaked password protection in Supabase Auth settings.
5. Rerun Supabase performance advisors after the linter issue is resolved.
6. Review Dependabot PRs separately, especially packages with major version changes.
