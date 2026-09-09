# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app  
**Appwrite project:** `6a54ac3a00272c02d6e0` (fra)  
**Checked:** 2026-09-10 02:14 EEST (main `1b9432c`)

---

## P0 — Must ship before first external invite

| # | Item | Owner action | Status |
|---|------|--------------|--------|
| 1 | Deploy monograph resolver | `fetchMedicineByCanonicalId` on main | **Live** — `/catalog/29945` opens SCARO GEL 50 GM |
| 2 | Smoke-test detail URLs | `/catalog/29945` + Similars / Alternatives | **Pass** |
| 3 | Privacy + Terms live | `/privacy`, `/terms` | **Pass** |
| 4 | Rotate any exposed API keys | Console → rotate; never commit keys | **Ops** — do before wider invite |
| 5 | Indexes present | `node scripts/create-appwrite-indexes.mjs` | Done (23) |
| 6 | Collection permissions | Public read; write via Teams/Function | Ops verify |
| 7 | CI green on `main` | GitHub Actions **CI** / Quality / CD | **Pass** |
| 8 | TypeScript / Site build | Site serving latest SPA | **Pass** |
| 9 | **Appwrite Functions exist in Cloud** | Actions → **Deploy Appwrite Functions** | **Pass** — runs [#11](https://github.com/minasami/medicine-support-hub/actions/runs/34415752019) and [#12](https://github.com/minasami/medicine-support-hub/actions/runs/34415964979): auth OK, 6/6 uploaded (`edge-api`, `firecrawl-image-enricher`, `ocr-prescription-parser`, `eda-tariff-sync`, `adaptive-signal-aggregator`, `drugeye-refresh`). Deployments left Appwrite in `waiting` (Cloud build). Confirm Ready in Console. |
| 10 | Scan / POS | `/scan` camera + lookup | **Pass** (UI live) |
| 11 | Notifications subscribe | Client VAPID public fallback on main | **Subscribe UI unblocked**; delivery still needs private VAPID in Appwrite vault |

## P1 — Search, portfolio, UX

| # | Item | Status |
|---|------|--------|
| 12 | Adaptive rank + voice + empty states | On main — live Site |
| 13 | Company pages not collapsing to Soul | Humanize + alias guards on main |
| 14 | Canonical company labels | Optional backfill script |

## P2 — Adaptive aggregation (optional day 1)

| # | Item | Status |
|---|------|--------|
| 15 | Deploy `adaptive-signal-aggregator` | **Uploaded** with the other 5 functions |
| 16 | Set `VITE_ADAPTIVE_FUNCTION_URL` on Site | After function shows Ready + public execute URL |

## P3 — CI/CD ops

| # | Item | Status |
|---|------|--------|
| 17 | Secrets | `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID` **set** — Functions workflow authenticates |
| 18 | Optional Site force-redeploy | Last CD Deploy on main: success |
| 19 | Branch protection | Require CI on `main` |

## P4 — Pilot operating readiness

| # | Item | Owner action |
|---|------|--------------|
| 20 | Industry claim flow | `/industry` → `/admin/industry` |
| 21 | One real company walkthrough | claim → draft → publish |
| 22 | Cross-company isolation | Soul vs Med-Care vs Eva |

## Go / No-go

**GO for closed internal pilot** — encyclopedia, legal pages, scan, monograph, CI, and Functions packages are in Cloud.

**NO-GO for first external company invite** until:
1. Appwrite Console shows the 6 function deployments as **Ready** (not stuck on `waiting`/`failed`).
2. Private VAPID key is in the Appwrite vault if push delivery is in the invite path.
3. One internal company claim → publish walkthrough succeeds.

**NO-GO for public marketing / stores** until P0–P1 green and legal reviewed.

## Commands

```bash
# Re-deploy after function source changes:
# Actions → Deploy Appwrite Functions → Run workflow (ensure=true)

# Or locally:
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_API_KEY=…
pnpm run deploy:functions
```
