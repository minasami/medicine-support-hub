# Upgrade slice: Barcode Wiki + TrustScore (1.0.24)

**Branch / PR:** `feat/barcode-wiki-trustscore-1.0.24`  
**App version:** Android `1.0.24` (versionCode `25`)  
**Appwrite project:** `6a54ac3a00272c02d6e0`  
**Database:** `medicine_support_hub`  
**Endpoint:** `https://appwrite.medicinesupport.app/v1` (Cloud alias `https://fra.cloud.appwrite.io/v1`)

Extends [UPGRADE_RANK_OCR_FCM_DEEPLINKS.md](./UPGRADE_RANK_OCR_FCM_DEEPLINKS.md). Push remains Appwrite Messaging (no Firebase Admin).

## Collections

| Collection ID | Purpose |
|---------------|---------|
| `drug_contributions` | Barcode wiki claims (`barcode`, `medicine_id?`, `canonical_id?`, `kind` = `link_barcode` \| `create_product`, `payload` JSON, `contributor_id`, `status` = `pending` \| `approved` \| `rejected`, `created_at`, `reviewed_at`, `reviewed_by`, `applied_at`, `trust_score_at_submit`, `notes`, `name_en`, `name_ar`) |
| `user_trust` | Per-user TrustScore (`user_id`, `approved_count`, `rejected_count`, `account_created_at`, `is_verified_rep`, `is_pharmacist`, `trust_score`, `updated_at`) |

### Medicines attributes added

- `lifecycle_status` (string: `draft` \| `pending_review` \| `published` \| `rejected` \| `archived`)
- `source_kind` (string; community writes `community_contribution`)
- `contributed_by_user_id` (string)

Legacy rows without `lifecycle_status` stay publicly visible.

Re-run: `APPWRITE_API_KEY=… node scripts/provision-upgrade-collections.mjs`

## TrustScore

```
trust_score =
  Approved*3
  − Rejected*5
  + AccountAgeDays/30
  + IsVerifiedRep*20
  + IsPharmacist*30
```

`processContribution` **auto-approves** when `trust_score > 50`. Otherwise the contribution stays `pending` for admin.

Pharmacist / verified-rep flags come from Appwrite user **labels** (`pharmacist`, `verified_rep`) or prefs, plus `user_trust` booleans.

## Function

| ID | Runtime | Events | Notes |
|----|---------|--------|-------|
| `processContribution` | node-20 source / **node-18.0 live** (same as sibling functions on this project) | `drug_contributions` document create + update | Also HTTP: `{ contribution_id }` or `{ process_pending: true }` or `{ annotation_id, vote }` |

Deploy: `APPWRITE_API_KEY=… pnpm run deploy:functions -- --only processContribution --ensure`

Required scopes / API key: `documents.read`, `documents.write`, `users.read`.

### Apply rules (safety)

| Kind | High-trust / admin approve | Low-trust |
|------|----------------------------|-----------|
| `link_barcode` | Write `barcode` on the existing medicine **only if empty or already the same**. Different existing barcode → stay pending (`barcode_conflict`). | Leave pending |
| `create_product` | Create a medicines row with `lifecycle_status=pending_review` (not published). | Leave pending |

Public encyclopedia listing skips non-published lifecycle rows (`isPubliclyVisible`). Barcode `/scan` lookup can still resolve a just-applied barcode.

## Frontend

- `/scan` miss → modal with **Add to existing drug** (search + link) or **Create new product** (name EN required, AR / manufacturer / INN optional)
- Disclaimer: contributions do not publish unsafely
- EN/AR via `t(...)`
- Light RLAIF: `/annotations` voting UI + `apps/web/src/lib/annotation-votes.ts` — 3 high-trust votes approve/reject. Vertex fine-tune **not** wired.

## How to test the scan not-found flow

1. Open `/scan` (web or Capacitor).
2. Enter a barcode that is **not** in `medicines` (e.g. `0000000000000` or a made-up 13-digit EAN).
3. Confirm the miss card + modal with two options.
4. Sign in. **Add to existing:** search a known trade name, pick it, submit. **Create new:** fill Name (English), submit.
5. Console → `drug_contributions` shows `status=pending` (typical new account) or `approved` if TrustScore > 50.
6. Execute `processContribution` with `{ "contribution_id": "<id>" }` or `{ "process_pending": true }`.
7. High-trust user (label `pharmacist` + `verified_rep` + ~30 day account, or enough approved history): contribution auto-approves; link writes barcode; create writes a `pending_review` medicine.
8. `/annotations`: vote up/down on pending OCR labels (needs sign-in). Three high-trust agrees → `approved`.

## What is deferred

- Full RLAIF 3-voter UX polish / dedicated admin queue
- `retrainModel` → Vertex MedGemma fine-tune
- Auto-publish of community-created products (they stay `pending_review`)
- Admin console screen for rejecting contributions (use Appwrite Console for now)
