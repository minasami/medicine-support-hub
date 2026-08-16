# Arabic localization pipeline

## Pattern (required)

```tsx
import { useLanguage } from "@/lib/i18n";

const { t } = useLanguage();
// …
{t("English label", "التسمية العربية")}
```

- `LanguageProvider` sets `dir` / `lang` on `<html>`.
- Prefer **inline** `t(en, ar)` for UI chrome (current project standard).
- Do **not** translate medicine names, ICD codes, or API field keys.

## Automated audit

```bash
node scripts/i18n-audit.mjs
node scripts/i18n-audit.mjs --json
node scripts/i18n-audit.mjs --ci              # CI: fail only critical paths
node scripts/i18n-audit.mjs --fail            # fail if any heuristic gap remains
node scripts/i18n-audit.mjs --critical-only

# via pnpm (root package.json)
pnpm run i18n:audit
pnpm run i18n:audit:ci
```

Scans `apps/web/src/pages` and `apps/web/src/components` (skips `ui/`).

Writes `artifacts/i18n-audit-report.json` when possible.

## Critical paths (CI gate)

File: `scripts/i18n-critical-paths.json`

- Lists pages/components that **must** use `useLanguage` + at least one `t()`.
- GitHub Actions job **Arabic i18n critical paths** runs on every PR/push to `main`:
  - `node scripts/i18n-audit.mjs --ci`
  - Uploads the JSON report as an artifact
- When you finish localizing a new high-traffic page, **add its path** to the critical list so regressions fail CI.

## Batch workflow (A → B → C)

| Tier | Scope | Status |
|------|--------|--------|
| **A** | Workspace details | Done |
| **B** | Pharmacy modules | In progress (hub, settings, training done) |
| **C** | Admin + pilot | Pending |

1. Run audit → pick next gap file  
2. Localize with `t("EN", "AR")`  
3. Add path to `i18n-critical-paths.json`  
4. Commit · CI verifies critical set  

## Full strict mode (later)

When coverage is near-complete:

```bash
node scripts/i18n-audit.mjs --fail
```

Or change the CI step from `--ci` to `--fail`.
