# Medicine provenance schema

Tracks **who asserted what product facts, when, and with what evidence** so public encyclopedia pages can show manufacturer verification lineage.

## Purpose

- Support the north star: verified company representatives update portfolio data that surfaces on `/medicines` and `/catalog/:id`.
- Separate **observation** (import, community) from **manufacturer verification**.
- Keep an append-only history suitable for audit and rollback.

## Client behavior (shipped)

- Module: `apps/web/src/lib/medicine-provenance.ts`
- Browser store key: `msh_medicine_provenance_v1`
- Written on company portfolio save (`CompanyMedicineAdditionForm`)
- Read on medicine detail and encyclopedia cards

## Durable store (Appwrite TablesDB / Postgres)

### Table: `medicine_provenance_events`

| Column | Type | Notes |
|--------|------|--------|
| `$id` / `id` | string PK | UUID |
| `canonical_id` | integer | Product identity |
| `event_type` | string | `product_created`, `product_updated`, `field_asserted`, `price_observed`, `image_attached`, `published_to_encyclopedia`, `verification_confirmed` |
| `source_kind` | string | `verified_company`, `platform_admin`, `community_contribution`, `dataset_import`, `price_observation`, `system` |
| `company_name` | string nullable | Display name |
| `company_slug` | string nullable | Link to company profile |
| `actor_user_id` | string nullable | Auth user |
| `actor_email` | string nullable | |
| `actor_role` | string nullable | e.g. company_ceo |
| `fields_changed` | string[] / json | Field names |
| `field_values` | json | Asserted scalars |
| `evidence_urls` | string[] / json | |
| `notes` | string nullable | |
| `created_at` | datetime | Event time |

### Indexes

- `idx_prov_canonical` on `canonical_id`
- `idx_prov_company` on `company_slug`
- `idx_prov_source` on `source_kind`
- `idx_prov_created` on `created_at`

### Derived fields on public product views (optional)

Prefer computing at read time, or materialize:

- `last_manufacturer_verified_at`
- `last_manufacturer_verified_by` (company name)
- `last_manufacturer_verified_by_slug`
- `has_company_verified_source` (already present on encyclopedia views)

## Write rules

1. **Append only** — never update past events; correct with a new event.
2. **Company saves** set `source_kind = verified_company` only when membership is verified.
3. **Admin imports** use `dataset_import` or `platform_admin`.
4. **Community contributions** stay `community_contribution` until moderated; promotion may emit `verification_confirmed` if a company later adopts them.

## Public display copy

- EN: `Last verified by {Company} on {date}`
- AR: `آخر تحقق بواسطة {Company} في {date}`

Safety boundary: provenance establishes **platform attribution**, not regulatory approval.
