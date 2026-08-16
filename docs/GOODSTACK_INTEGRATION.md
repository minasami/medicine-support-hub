# Goodstack integration — Medicine Support Hub

**Status:** Foundation (Phase 0–1)  
**Goal:** Help pharmaceutical companies do good by donating to **verified NGOs**, enrich public NGO pages under `/ngos`, and support joint medicine support programs.

Production routes already in the app:

| Route | Role |
|-------|------|
| `/ngos` | Public NGO directory |
| `/ngos/:slug` | Public NGO profile |
| `/ngo/donations` | In-kind medicine donation exchange |
| `/industry` | Pharma company representatives |

---

## What Goodstack provides vs what we own

| Concern | Owner |
|---------|--------|
| Nonprofit existence + compliance verification | **Goodstack** |
| Monetary donations, disbursement, tax rails | **Goodstack** |
| Medicine **in-kind** donations (stock, expiry, fulfillment) | **Medicine Support Hub** |
| Patient programs, eligibility, clinical workflows | **Medicine Support Hub** |
| Public NGO story, medicine needs, program listings | **Hub** (enriched with Goodstack IDs/status) |

Goodstack is *not* a substitute for Egyptian medicines regulation or local licensing. A “Goodstack Verified” badge means the organisation passed Goodstack’s nonprofit checks — not that it holds a specific MOH license.

---

## Official resources

- Docs: https://docs.goodstack.io/
- Organisations API: Search, Retrieve, Profile
- Donations API + Hosted Donation Gateway
- Cause verification (validation submissions)
- Access / keys: partner dashboard; engineering support `engineering-support@goodstack.io`

**Keys**

| Key | Prefix | Where it may live |
|-----|--------|-------------------|
| Publishable | `pk_` | Frontend (organisation search only) |
| Secret | `sk_` | Server / Appwrite Function only — never in the browser bundle |

Environment variables (proposed):

```bash
VITE_GOODSTACK_PUBLISHABLE_KEY=pk_...
# Server-only (Functions / backend):
GOODSTACK_SECRET_KEY=sk_...
GOODSTACK_WEBHOOK_SECRET=...
```

There is **no official Goodstack MCP server** as of this doc. Optional later work: wrap our server helpers as an internal MCP for platform AI agents (`search_verified_ngos`, `get_ngo_profile`). Primary integration remains REST.

---

## Architecture

```text
Pharma company
    ├─ Monetary gift ──────────► Goodstack (verify + donate + settle)
    └─ Medicine in-kind ───────► Hub /ngo/donations + programs

Public /ngos/:slug
    ├─ Hub profile (programs, medicine needs, contact policy)
    ├─ goodstack_organisation_id + verification_status
    └─ CTAs: Donate medicines | Support financially | Join program
```

### Appwrite collection `ngos` (target schema)

| Attribute | Type | Notes |
|-----------|------|--------|
| `slug` | string (unique) | URL key |
| `name` | string | Display name |
| `name_ar` | string? | Arabic |
| `country_code` | string | ISO, default `EG` |
| `city` | string? | |
| `description` | string | Public summary |
| `logo_url` | string? | |
| `website` | string? | |
| `contact_email` | string? | Prefer form over public email when possible |
| `registry_id` | string? | Local registry / license number |
| `goodstack_organisation_id` | string? | `organisation_…` |
| `goodstack_verification_status` | enum | `unknown` \| `pending` \| `verified` \| `rejected` |
| `goodstack_last_synced_at` | datetime? | |
| `accepts_medicine_donations` | boolean | In-kind |
| `accepts_monetary_support` | boolean | Via Goodstack when linked |
| `active_programs_count` | integer | Denormalized |
| `published` | boolean | Public listing |

### Client module

See `apps/web/src/lib/goodstack.ts`:

- `searchOrganisations({ query, countryCode })` — publishable key
- `isGoodstackConfigured()` — feature flag for UI
- Stubs for server-side donation session creation (implemented in Functions when secret key exists)

---

## Phased delivery

### Phase 0 — Access
1. Request partner dashboard + keys from Goodstack.
2. Confirm Egypt (`EG`) coverage for target health NGOs.
3. Store secret key only in server env / Appwrite Function secrets.

### Phase 1 — Enrich `/ngos` (no payments required)
1. Map directory profiles to optional `goodstack_organisation_id`.
2. Show **Goodstack Verified** badge when status is `verified`.
3. “Link / search on Goodstack” admin action using Search Organisations API.
4. Cache profile fields; refresh on schedule or on-demand.

### Phase 2 — Monetary support CTA
1. Prefer **Hosted Donation Gateway** (create donation session server-side with `organisationId`).
2. Webhooks → update Hub donation records (`donation.payment_successful`, `donation.settled`).
3. Surface “Recent financial support” aggregates on NGO pages (no PII).

### Phase 3 — Joint support programs
1. `support_programs` linking company claim + NGO + medicines + budget window.
2. Require `goodstack_verification_status = verified` before public program publish (policy configurable).
3. Keep in-kind fulfillment on Hub rails.

### Phase 4 — Optional MCP
Internal tools for the platform assistant only; not a public Goodstack MCP.

---

## UX principles

1. **Two clear CTAs** on every NGO page: *Donate medicines* vs *Support financially*.
2. Pharma flows only list NGOs that are **published** and preferably **verified**.
3. Never imply Goodstack verified a medicine shipment or clinical protocol.
4. Arabic + English copy for badges and CTAs.
5. Mobile-first directory (same declutter patterns as `/medicines`).

---

## Compliance notes (Egypt / pharma)

- In-kind medicine donation remains subject to local law, quality, cold chain, and authorised entities.
- Do not publish beneficiary or patient-level data on `/ngos`.
- Monetary flows follow Goodstack’s disbursement and foundation model; Hub does not custody those funds.
- Separate badges if you later add “locally licensed / MOH-related” flags from Hub data.

---

## Implementation checklist

- [x] This document
- [x] `apps/web/src/lib/goodstack.ts` client foundation
- [ ] Appwrite `ngos` collection provisioned
- [ ] Wire directory badges to `goodstack_verification_status`
- [ ] Admin: search & link Goodstack organisation ID
- [ ] Function: create donation session + webhooks
- [ ] Pharma program launch UI requiring verified NGO

---

## Contact

Platform: https://medicinesupport.app/ngos  
Maintainer: Mina Samy Tawfik Saad — minasamitawfiksaad@gmail.com
