# Connected platform review - 2026-07-07

## Scope

This review checked the public repository, Vercel deployment context and Supabase advisor status for Medicine Support Hub.

## Confirmed

- Vercel project was found for Medicine Support Hub.
- Supabase project was found and is active healthy.
- The latest production Vercel deployment observed from the main branch is ready.
- A recent development dependency preview deployment failed, so PR 41 should not be merged without review.
- The repository keeps `pnpm run validate` as the build gate.
- Platform Health includes production smoke testing for the public app.

## Advisor findings

Supabase advisor results currently show three practical themes:

1. Security review needed for two signed-in-user callable helper functions.
2. Leaked password protection should be enabled in Supabase Auth.
3. RLS and policy performance can be improved, but changes should be made carefully so access behavior is not changed accidentally.

## Deployment decision

Do not merge the development-dependencies PR yet. It includes several major version changes and one related Vercel preview deployment is failing.

## Next actions

1. Inspect the failed PR 41 preview deployment.
2. Run Platform Health manually and confirm production smoke routes pass.
3. Enable leaked password protection from Supabase Auth settings.
4. Review helper-function exposure before changing database access.
5. Fix RLS performance warnings in small migrations with rollback notes.
6. Leave unused indexes in place until real usage data is available.
