# Repository Audit and Cleanup Plan

The repository is currently organized like an exported workspace. The deployed Vercel app is under `artifacts/chronic-medicines`.

## Current important areas

- `artifacts/chronic-medicines` is the deployed Vite React app.
- `lib/api-client-react` is a generated client from the old backend flow. Some legacy pages still import it.
- `lib/db` contains database migration material.
- `vercel.json` builds only `artifacts/chronic-medicines`.
- `.agents` appears to be generated assistant/export memory and is not needed at runtime.

## Main cleanup issues

- The production app is inside `artifacts`, which is not a clean permanent app path.
- Workspace configuration is broader than the current deployed app needs.
- Replit-specific configuration and plugins still exist.
- Some pages still depend on generated API hooks instead of Supabase-native calls.
- Supabase schema and Edge Function source should be versioned under a dedicated `supabase` folder.

## Recommended final structure

```text
apps/web
packages/shared
supabase/migrations
supabase/functions
docs
```

Keep root-level files for `package.json`, `pnpm-workspace.yaml`, `vercel.json`, `.env.example`, `.gitignore`, and `README.md`.

## Safe cleanup phases

### Phase 1

- Keep the deploy path unchanged.
- Improve `.gitignore`.
- Focus root scripts on the deployed app.
- Document the cleanup plan.

### Phase 2

- Move `artifacts/chronic-medicines` to `apps/web`.
- Update `vercel.json` paths.
- Update path aliases and imports.
- Update workspace packages to `apps/*` and `packages/*`.

### Phase 3

- Remove `lib/api-client-react` after all generated API hook usage is replaced.
- Remove old pages that call the legacy backend.
- Remove Replit-only plugins and dependencies.
- Move database files into `supabase/migrations`.
- Add Edge Function source under `supabase/functions`.

## Dependencies to review before removal

- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`
- `@workspace/api-client-react`
- unused UI packages after page cleanup

## Deployment note

Current Vercel build command:

```text
pnpm --filter @workspace/chronic-medicines build
```

Current output directory:

```text
artifacts/chronic-medicines/dist/public
```

Do not change these until the app has been moved and tested.
