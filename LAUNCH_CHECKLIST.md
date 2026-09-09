# Medicine Support Hub — Launch Checklist (Closed Pilot)

**Target:** Closed pharma pilot (web-only). Not Google Play / App Store.

**Product:** https://medicinesupport.app  
**Appwrite project:** `6a54ac3a00272c02d6e0` (fra)  
**Supabase:** `hoxrnwqymvirlhjgcnly` (eu-north-1)  
**Checked:** 2026-09-10 02:35 EEST (main `c26b740`)

---

## P0 — Must ship before first external invite

| # | Item | Status |
|---|------|--------|
| 1 | Monograph resolver | **Live** — `/catalog/29945` SCARO GEL 50 GM |
| 2 | Detail + Similars / Alternatives | **Pass** |
| 3 | Privacy + Terms | **Pass** — `/privacy`, `/terms` |
| 4 | Rotate exposed API keys | **Ops** before wider invite |
| 5 | Appwrite indexes | Done (23) |
| 6 | Collection permissions | Ops verify |
| 7 | CI / Quality / CD on `main` | **Pass** on `c26b740` |
| 8 | Site build | **Pass** — CD success after VAPID public fallback |
| 9 | Appwrite Functions in Cloud | **Uploaded 6/6** — confirm **Ready** in Console |
| 10 | Scan / POS | **Pass** |
| 11 | Web Push subscribe | **Rotated 2026-09-10** — public key in `platform_public_settings` + app fallback; private key in Vault `medicine_support_hub_vapid_private_key`; `push_subscriptions` + register/unregister RPCs live. Re-Enable after rotate. Campaign *send* needs `profiles` (not on this DB). |

## P1 — Search, portfolio, UX

| # | Item | Status |
|---|------|--------|
| 12 | Adaptive rank + voice | On main |
| 13 | Company pages not collapsing to Soul | Humanize + alias guards on main |
| 14 | Canonical company labels | Optional backfill |

## P2 — Adaptive aggregation

| # | Item | Status |
|---|------|--------|
| 15 | `adaptive-signal-aggregator` | Uploaded with Functions deploy |
| 16 | `VITE_ADAPTIVE_FUNCTION_URL` | After function is Ready |

## P4 — Pilot operating readiness

| # | Item | Status |
|---|------|--------|
| 20 | Industry claim | `/industry` live |
| 21 | Company claim → publish | Manual |
| 22 | Cross-company isolation | Manual |

## Go / No-go

**GO for closed internal pilot.**

**NO-GO for first external company invite** until Appwrite functions show Ready and one claim→publish walkthrough succeeds.

Push *delivery* campaigns are not in the invite path until `profiles` exists on this Supabase project.
