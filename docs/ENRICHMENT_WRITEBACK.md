# Federated enrichment write-back

## Policy

1. **Local Egypt / company / MOH fields win** — write-back is **fill-only** (never overwrite non-empty values).
2. **Session apply** — every user can apply suggestions for the current browser (`msh_session_medicine_enrichment_v1`).
3. **Appwrite persist** — platform admins (founder allowlist / `PLATFORM_ADMIN` role) trigger `updateDocument` on `medicines`.
4. **Provenance** — when optional columns exist, store `field_sources` (JSON) and `last_enriched_at`.
5. **External IDs** — optional `rxcui`, `pubchem_cid` columns; ignored if not provisioned.
6. **Images** — packshot from Open Product Facts is a *candidate* (`openproductsfacts` provenance), not manufacturer-verified. PubChem structure is labeled separately.

## Code

| Module | Role |
|--------|------|
| `apps/web/src/lib/medicine-enrichment-writeback.ts` | Fill-only Appwrite update |
| `apps/web/src/lib/session-medicine-enrichment.ts` | Browser session overlay |
| `apps/web/src/lib/packshot-from-barcode.ts` | OPF image candidate |
| `apps/web/src/components/medicine-web-enrichment-panel.tsx` | UI Apply + Persist |

## Optional Appwrite columns

Under database `medicine_support_hub` / table `medicines`:

| Column | Type | Notes |
|--------|------|--------|
| `rxcui` | string | NIH RxNorm concept id |
| `pubchem_cid` | string | PubChem compound id |
| `field_sources` | string | JSON map field → source |
| `last_enriched_at` | string/datetime | ISO timestamp |

SDK update retries without optional keys if the attribute is missing.

## Permissions

Document update requires the signed-in Appwrite user to have **update** on the medicines table (or use an admin API key from a server function — not shipped in the browser path).
