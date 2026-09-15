# Catalog admin actions + quality detection (1.0.29)

## Platform-admin product actions

Gate: `isPlatformAdminUser` (`apps/web/src/lib/platform-admin.ts`) — `super_admin` / `platform_admin` / `admin` roles, founder email allowlist, or Appwrite labels.

UI entry points:

| Surface | Component |
|---------|-----------|
| Medicines encyclopedia cards | `EncyclopediaCatalogCard` → `PlatformAdminProductMenu` |
| Medicine detail | `medicine-detail-page.tsx` |
| Bulk duplicate tool | `AdminDuplicateMerger` (now calls Appwrite merge) |
| Flag review | `/admin/catalog-quality` |

### Actions

1. **Edit** — sheet for name_en/ar, scientific_name, manufacturer, strength, dosage_form, drug_class, barcode, image_url, price, description → `databases.updateDocument(medicines)`.
2. **Hide / Unhide** — sets `is_hidden`. Public list/search drops `is_hidden === true`; admins pass `includeHidden: true` and see a **Hidden** badge.
3. **Merge** — pick target; copy missing fields onto target; set source `is_hidden=true`, `merged_into_id`, `merged_into_canonical_id`, `lifecycle_status=archived`; write `catalog_admin_audit`; resolve related open flags.

Client lib: `apps/web/src/lib/catalog-admin-actions.ts`.

## Quality detector

Appwrite Function `detectCatalogQuality` (`functions/detectCatalogQuality`):

- Schedule: `30 4 * * *` (after `rankDrugs` at 03:00)
- On-demand: HTTP / `functions.createExecution("detectCatalogQuality", …)` from admin UI
- Signals: `near_duplicate`, `same_barcode`, `broken_image`, `misinfo_contradiction`, `popular_incomplete`
- Writes deduped open rows to `catalog_quality_flags` (fingerprint)

## Active learning / ranking

`rankDrugs` soft-downranks:

- Hidden or merged docs → `search_score *= 0.05`
- Open quality flags → multiplicative dampening by severity (high/medium/low)

Encyclopedia sort still defaults to `search_score` DESC; hide filter applies in `medicines-appwrite-page.toResult`.

## Provisioning

```bash
APPWRITE_API_KEY=… node scripts/provision-upgrade-collections.mjs
pnpm run deploy:functions   # or appwrite deploy for detectCatalogQuality + rankDrugs
```

### Collections / attributes

| ID | Notes |
|----|-------|
| `catalog_quality_flags` | flag_type, severity, status, score, summary, detail_json, medicine_id, canonical_id, peer_*, fingerprint, resolution |
| `catalog_admin_audit` | action, medicine_id, actor_email, reason, detail, at |
| `medicines.is_hidden` | boolean (default false) |
| `medicines.merged_into_id` | string |
| `medicines.merged_into_canonical_id` | integer |

Ensure client users (or team roles used by platform admins) can **update** medicines and flags/audit as needed. Prefer tighter server-side roles in production; founder clients currently use the same Appwrite session update path as enrichment writeback.

## Manual steps after merge

1. Run provision script against production/project.
2. Deploy `detectCatalogQuality` + updated `rankDrugs`.
3. Smoke: sign in as platform admin → `/medicines` → card ⋮ → Edit / Hide / Merge.
4. Open `/admin/catalog-quality` → Run detector → dismiss or merge via peer link.
5. Confirm anonymous `/medicines` omits hidden rows; admin still sees badge.
