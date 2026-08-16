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
node scripts/i18n-audit.mjs --fail   # non-zero exit if gaps remain
```

Scans `apps/web/src/pages` and `apps/web/src/components` (skips `ui/`).

## Batch workflow (A → B → C)

| Tier | Scope |
|------|--------|
| **A** | Workspace details: beneficiary, program, support-request detail |
| **B** | Pharmacy modules |
| **C** | Admin suite + pilot |

1. Run audit → pick next gap file  
2. Agent or human rewrites with `t()`  
3. Commit  
4. Re-run audit until clean  

## CI suggestion

Add to PR checks:

```yaml
- name: i18n audit
  run: node scripts/i18n-audit.mjs --fail
```

(Optional once coverage is high enough.)

## Agent skill

Use the repo skill / prompt: *Localize remaining pages reported by `i18n-audit.mjs` using `useLanguage` + bilingual `t()`.*
