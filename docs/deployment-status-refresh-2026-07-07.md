# Deployment status refresh - 2026-07-07

## Latest production

Latest observed production deployment is READY.

Commit:

- `f59d06d9cb6948a7f866e3aac3366063b7756ee6`
- `Add pharmacy accountant member management (#43)`

## Preview notes

- PR 42 related previews were READY before production merge.
- PR 43 related previews were READY before production merge.
- PR 44 has a READY preview and still needs review before merge because it changes member-management behavior.
- PR 41 still has an older ERROR preview and should not be merged until it is fixed or split.

## Release rule

READY preview is necessary but not enough. For higher-risk changes, also check workflows, smoke routes and role behavior before merge.
