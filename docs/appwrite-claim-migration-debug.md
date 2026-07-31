# Debug: Appwrite company claim migration

## Symptom

- Eva Pharma rep registers at `/industry` with `mina.s.tawfik@armaniousfoundation.org`.
- `/account` may show pending (or wrong company) depending on browser.
- Admin **Industry** queue is empty or cannot Approve.
- Approval does not stick across devices.

## Root cause (confirmed in code)

| Path | Current behavior | Durable on Appwrite? |
|------|------------------|----------------------|
| Submit (`industry-contribution-network.tsx`) | `POST /rest/v1/company_profile_claims` (Supabase) + **localStorage** mirror | **No** — Supabase is retired; localStorage is device-local |
| Account resolve (`account.tsx`) | Reads localStorage first, then Supabase REST | **No** for cross-device |
| Admin queue (`admin-industry-contributions.tsx`) | Lists Supabase `company_profile_claims` + RPC `review_industry_company_claim` | **No** |
| Appwrite tables provisioned so far | `donation_*`, `manufacturer_stock_*`, `medicines`, … | **Claims table was never provisioned** |

There is **no completed migration** of industry claims to Appwrite. The product only has a **partial** Appwrite cutover (medicines, stock, donations). Auth/claims moderation still points at Supabase REST paths that fail silently (`catch` → localStorage only).

## Why admin cannot see Eva claim

1. Submit wrote to localStorage on the **registration browser** only.
2. Admin opens `/admin/industry` on another machine/browser → Supabase returns `[]` → empty queue.
3. Even if you approve via localStorage console snippet, it never reaches Appwrite or other devices.

## Fix architecture

1. **Provision** table `company_profile_claims` under database `medicine_support_hub` (see schema below / `docs/company-profile-claims-schema.md`).
2. **Write path**: `apps/web/src/lib/company-claims-data.ts` → Appwrite first, then localStorage mirror.
3. **Read path**: account + admin load claims via the same module (not Supabase REST).
4. **Approve path**: update document `status` / `is_approved` in Appwrite (replace Supabase RPC).
5. **One-time seed**: if a claim exists only in localStorage, open the registration browser → export JSON → insert into Appwrite (or re-submit claim after table exists).

## Schema (TablesDB terms)

**Table id:** `company_profile_claims`

| Column | Type | Notes |
|--------|------|--------|
| `company_slug` | string 128 | e.g. `eva-pharma` |
| `company_name` | string 256 | |
| `proposed_company_name` | string 256 | |
| `company_type` | string 64 | |
| `work_email` | string 256 | index |
| `user_email` | string 256 | |
| `user_id` | string 64 | Appwrite user id if available |
| `mobile_phone` | string 64 | |
| `role_title` | string 128 | |
| `website` | string 512 | optional |
| `notes` | string 2000 | optional |
| `status` | string 32 | `pending` \| `under_review` \| `approved` \| `rejected` |
| `is_approved` | boolean | |
| `verification_score` | integer | |
| `requested_by` | string 256 | |
| `reviewer_notes` | string 2000 | optional |
| `reviewed_at` | string 64 | ISO optional |

**Indexes:** `idx_work_email` (key), `idx_status` (key), `idx_company_slug` (key)

**Permissions (bootstrap):** create users; read users (tighten later to admin team).

## Verify after provision

```bash
# List collections/tables in medicine_support_hub (API key)
curl -s "$APPWRITE_ENDPOINT/databases/medicine_support_hub/collections" \
  -H "X-Appwrite-Project: $APPWRITE_PROJECT_ID" \
  -H "X-Appwrite-Key: $APPWRITE_API_KEY" | jq '.collections[]?.$id'
```

Expect `company_profile_claims` among ids.

Then submit a test claim from `/industry` and confirm a row appears in Appwrite Console.

## Approve Eva (after table + wire)

1. Admin → Industry → Eva claim → Approve, **or**
2. Appwrite Console → `company_profile_claims` → set `status=approved`, `is_approved=true` for the Eva row.

Until the table exists and the UI is wired, **console localStorage approve only works on that one browser**.
