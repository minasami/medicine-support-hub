# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app

---

## P0 — Must ship before first external invite

| # | Item | Owner action | Status |
|---|------|--------------|--------|
| 1 | Deploy fixed monograph resolver | `fetchMedicineByCanonicalId` / `fetchMedicineByName` on main | Code on main — **redeploy Site** |
| 2 | Smoke-test detail URLs | `/catalog/29945`, `/catalog/n~SCARO%20GEL%2050%20GM` | After deploy |
| 3 | Privacy + Terms live | `/privacy`, `/terms` | Present in repo |
| 4 | Rotate exposed Appwrite API keys | `node scripts/rotate-appwrite-api-key.mjs` | Ops |
| 5 | Indexes present | 23 indexes confirmed | Done |
| 6 | Collection permissions | Public read published; write via Teams/Function | Ops verify |

## P1 — Pilot operating readiness

| # | Item | Owner action |
|---|------|--------------|
| 7 | `company_slug` backfill | `node scripts/backfill-company-slug.mjs --dry-run` |
| 8 | Industry claim flow | `/industry` → `/admin/industry` |
| 9 | One real company walkthrough | claim → draft → publish |
| 10 | Cross-company isolation | Eva vs Med-Care |

## Go / No-go

**GO for closed pilot** when P0 is green and one internal contribution walkthrough succeeds.

**NO-GO for public marketing or app stores** until P0+P1 are green.
