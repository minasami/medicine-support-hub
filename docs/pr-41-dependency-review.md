# PR 41 dependency review guardrail

## Status

PR 41 should not be auto-merged yet.

## Why

The PR updates a development-dependencies group and includes several major version changes. A related Vercel preview deployment is currently failing.

## Review checklist

Before merge:

- Confirm Quality workflow passes.
- Confirm Vercel preview deployment is READY.
- Confirm `pnpm run validate` passes locally or in CI.
- Check UI routes that use calendars, date pickers, charts, forms and resizable panels.
- Split the PR if one major package causes failures.

## Safer sequence

1. Merge low-risk patch/minor dependency PRs first.
2. Keep TypeScript, charting, calendar and panel updates isolated if they cause errors.
3. Validate production smoke routes after merge.
