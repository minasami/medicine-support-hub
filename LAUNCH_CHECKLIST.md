# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app  
**Appwrite project:** `6a54ac3a00272c02d6e0` (fra)

---

## P0 — Must ship before first external invite

| # | Item | Owner action | Status |
|---|------|--------------|--------|
| 1 | Deploy monograph resolver | `fetchMedicineByCanonicalId` on main | Code on main — **redeploy Site** |
| 2 | Smoke-test detail URLs | `/catalog/29945`, `/catalog/n~SCARO%20GEL%2050%20GM` | After deploy |
| 3 | Privacy + Terms live | `/privacy`, `/terms` | Present in repo |
| 4 | Rotate any exposed API keys | Console → rotate; never commit keys | **Ops** |
| 5 | Indexes present | `node scripts/create-appwrite-indexes.mjs` | Done (23) |
| 6 | Collection permissions | Public read; write via Teams/Function | Ops verify |
| 7 | CI green on `main` | GitHub Actions **CI** | Enabled |
| 8 | TypeScript / Site build | No `baseUrl` / typecheck failures | Fixed on main |
| 9 | **Appwrite Functions exist in Cloud** | `pnpm run deploy:functions` or Actions → **Deploy Appwrite Functions** | **Do this now** |

## P1 — Search, portfolio, UX

| # | Item | Owner action |
|---|------|--------------|
| 10 | Adaptive rank + voice + empty states | On main (`medicines-encyclopedia.tsx`) — redeploy Site |
| 11 | Soul / Smartec / Med-Care portfolios | Verify `/account` counts after Site deploy |
| 12 | Canonical company labels | Optional backfill script |
| 13 | Adaptive beacon | On main (`App.tsx`) — redeploy Site |

## P2 — Adaptive aggregation (optional day 1)

| # | Item | Owner action |
|---|------|--------------|
| 14 | Deploy `adaptive-signal-aggregator` | Part of `deploy:functions` |
| 15 | Set `VITE_ADAPTIVE_FUNCTION_URL` on Site | After function has a public execute URL |
| 16 | Human-gated alias promote | `docs/ADAPTIVE_AGGREGATION.md` |

## P3 — CI/CD ops

| # | Item | Owner action |
|---|------|--------------|
| 17 | Secrets | `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID` ✅ |
| 18 | Optional Site force-redeploy | `APPWRITE_SITE_ID` secret + CD VCS deploy |
| 19 | Broken `.pnpm-store` gitlink | **Removed** — do not re-commit pnpm store |
| 20 | Branch protection | Require CI on `main` |

## P4 — Pilot operating readiness

| # | Item | Owner action |
|---|------|--------------|
| 21 | Industry claim flow | `/industry` → `/admin/industry` |
| 22 | One real company walkthrough | claim → draft → publish |
| 23 | Cross-company isolation | Soul vs Med-Care vs Eva |

## Go / No-go

**GO for closed pilot** when P0 is green (including Functions list non-empty), detail pages work, one portfolio walkthrough succeeds, CI green.

**NO-GO for public marketing / stores** until P0–P1 green and legal reviewed.

## Commands

```bash
git pull origin main

# Create + deploy all Functions into Cloud project
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_API_KEY=…
pnpm run deploy:functions

# Or: GitHub → Actions → Deploy Appwrite Functions → Run workflow

# Site: push to main (Git integration) or Sites → Redeploy
```
