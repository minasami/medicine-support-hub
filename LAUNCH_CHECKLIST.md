# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app  
**Appwrite project:** `6a54ac3a00272c02d6e0` (fra)  
**Checked:** 2026-09-10 01:58 EEST (main `6518865`)

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
| 7 | CI green on `main` | GitHub Actions **CI** / Quality / CD | **Pass** on `6518865` |
| 8 | TypeScript / Site build | Site serving latest SPA | **Pass** |
| 9 | **Appwrite Functions exist in Cloud** | Actions → **Deploy Appwrite Functions** | **Blocked** — workflow run [#10](https://github.com/minasami/medicine-support-hub/actions/runs/34414787407) skipped: `APPWRITE_API_KEY` / `APPWRITE_PROJECT_ID` secrets empty on this workflow |
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
| 15 | Deploy `adaptive-signal-aggregator` | Same as P0 #9 — needs Appwrite secrets on the Functions workflow |
| 16 | Set `VITE_ADAPTIVE_FUNCTION_URL` on Site | After function has a public execute URL |

## P3 — CI/CD ops

| # | Item | Status |
|---|------|--------|
| 17 | Secrets | `APPWRITE_API_KEY`, `APPWRITE_PROJECT_ID` **missing from Actions** (CD/CI can still run; Functions deploy cannot) |
| 18 | Optional Site force-redeploy | Last CD Deploy on main: success |
| 19 | Branch protection | Require CI on `main` |

## P4 — Pilot operating readiness

| # | Item | Owner action |
|---|------|--------------|
| 20 | Industry claim flow | `/industry` → `/admin/industry` |
| 21 | One real company walkthrough | claim → draft → publish |
| 22 | Cross-company isolation | Soul vs Med-Care vs Eva |

## Go / No-go

**CONDITIONAL GO for closed internal pilot** — public encyclopedia, legal pages, scan, and monograph are live; CI is green.

**NO-GO for first external company invite** until:
1. GitHub repo secrets `APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0` and `APPWRITE_API_KEY` are set, then re-run **Deploy Appwrite Functions**.
2. Private VAPID key is in the Appwrite vault if push delivery is in the invite path.
3. One internal company claim → publish walkthrough succeeds.

**NO-GO for public marketing / stores** until P0–P1 green and legal reviewed.

## Commands

```bash
# After secrets are set in GitHub → Settings → Secrets
# Actions → Deploy Appwrite Functions → Run workflow (ensure=true)

# Or locally:
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=6a54ac3a00272c02d6e0
export APPWRITE_API_KEY=…
pnpm run deploy:functions
```
