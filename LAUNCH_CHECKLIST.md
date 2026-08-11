# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app

---

## P0 — Must ship before first external invite

| # | Item | Owner action | Status |
|---|------|--------------|--------|
| 1 | Deploy monograph resolver | `fetchMedicineByCanonicalId` on main | Code on main — **redeploy Site** |
| 2 | Smoke-test detail URLs | `/catalog/29945`, `/catalog/n~SCARO%20GEL%2050%20GM` | After deploy |
| 3 | Privacy + Terms live | `/privacy`, `/terms` | Present in repo |
| 4 | Rotate exposed Appwrite API keys | Console → rotate; never commit keys | **Ops** |
| 5 | Indexes present | `node scripts/create-appwrite-indexes.mjs` | Done (23) |
| 6 | Collection permissions | Public read; write via Teams/Function | Ops verify |
| 7 | CI green on `main` | GitHub Actions **CI** workflow | Enabled |
| 8 | TypeScript build | No `baseUrl` / typecheck failures on Site build | Fixed on main |

## P1 — Search, portfolio, UX

| # | Item | Owner action |
|---|------|--------------|
| 9 | Mobile search UX wires | `node scripts/wire-encyclopedia-mobile-rank.mjs` etc. then deploy |
| 10 | Fuzzy + voice + ranking examples | `node scripts/wire-fuzzy-voice-ranking-ui.mjs` |
| 11 | UX polish pass | `node scripts/wire-ux-polish-pass.mjs` |
| 12 | Soul / Smartec / Med-Care portfolios | `node scripts/wire-medcare-portfolio-loader.mjs` + redeploy |
| 13 | Canonical company labels backfill | `node scripts/backfill-canonical-company-labels.mjs --dry-run` |
| 14 | Adaptive encyclopedia rank/signals | `node scripts/wire-adaptive-encyclopedia.mjs` |
| 15 | Adaptive beacon in App | `node scripts/wire-adaptive-beacon-app.mjs` |

## P2 — Adaptive aggregation (optional for pilot day 1)

| # | Item | Owner action |
|---|------|--------------|
| 16 | Create adaptive collections | See `docs/ADAPTIVE_AGGREGATION.md` |
| 17 | Deploy `adaptive-signal-aggregator` | Appwrite Functions + `ADAPTIVE_ADMIN_KEY` |
| 18 | Set `VITE_ADAPTIVE_FUNCTION_URL` on Site | Appwrite Site env |
| 19 | Human review + promote aliases | `list_pending` → approve → `promote-approved-aliases.mjs` |

## P3 — CI/CD ops

| # | Item | Owner action |
|---|------|--------------|
| 20 | GitHub secrets | `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID`, optional `APPWRITE_SITE_DEPLOY_HOOK` |
| 21 | Branch protection | Require **CI** check on `main` |
| 22 | Site Git integration or deploy hook | Auto-build on push to `main` |

## P4 — Pilot operating readiness

| # | Item | Owner action |
|---|------|--------------|
| 23 | Industry claim flow | `/industry` → `/admin/industry` |
| 24 | One real company walkthrough | claim → draft → publish |
| 25 | Cross-company isolation | Soul vs Med-Care vs Eva |
| 26 | Share manufacturer video | `artifacts/pharma-video/...mp4` (local) or re-export |

## Go / No-go

**GO for closed pilot** when P0 is green, detail pages work, one industry portfolio walkthrough succeeds, and CI is green.

**NO-GO for public marketing or app stores** until P0–P1 are green and legal pages are reviewed.

## Quick redeploy

```bash
git pull origin main
# run any pending wire-*.mjs scripts, commit, push
git push origin main
# Appwrite Sites → Redeploy  OR  rely on CD deploy hook
```
