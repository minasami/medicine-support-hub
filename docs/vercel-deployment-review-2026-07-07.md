# Vercel deployment review - 2026-07-07

## Current production signal

The latest observed production deployment for Medicine Support Hub is READY.

Latest observed production commit:

- `133294a3b1652dfd1cc273a2f8529c31a2381c33`
- Commit message: `Add PR 41 dependency review guardrail`

## Preview deployment signal

A recent preview deployment for PR 41 is in ERROR state.

PR 41 should stay out of the merge path until its preview build is reviewed and fixed or the dependency updates are split.

## Useful deployment rule

Production docs-only governance commits can deploy safely, but dependency updates should only move forward after:

1. Quality workflow passes.
2. Vercel preview is READY.
3. Route smoke tests pass.
4. Major UI dependencies are checked on routes using calendars, charts, forms and resizable panels.

## Decision

Do not treat a READY production deployment as approval to merge risky dependency previews. Keep production stable and review PR 41 separately.
