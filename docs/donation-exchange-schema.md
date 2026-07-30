# Medicine Donation Exchange — Appwrite Schema (TablesDB)

Database ID: `medicine_support_hub` (or `VITE_APPWRITE_DATABASE_ID`)

> **Appwrite TablesDB Note**: Appwrite Console uses **Tables** (formerly Collections), **Columns** (formerly Attributes), and **Rows** (formerly Documents). The classic Database SDK calls remain 100% backwards compatible.

Create these 3 Tables in Appwrite Console (or via CLI / MCP) before relying on remote persistence.
Until tables exist in Appwrite Cloud, the web app stores data in browser `localStorage` as a safe fallback.

## Tables & Columns

### `donation_listings`

| Column (Attribute) | Type | Size | Required | Default |
|-------------------|------|------|----------|---------|
| org_id | string | 64 | yes | |
| org_code | string | 32 | no | |
| title | string | 256 | yes | |
| description | string | 2000 | no | |
| status | string | 32 | yes | draft |
| visibility | string | 32 | yes | network |
| currency | string | 8 | yes | EGP |
| valid_from | datetime | | no | |
| valid_until | datetime | | no | |
| contact_name | string | 128 | no | |
| contact_email | string | 256 | no | |
| contact_phone | string | 64 | no | |
| source_filename | string | 256 | no | |
| lot_count | integer | | no | 0 |
| total_units | integer | | no | 0 |
| total_value_egp | double | | no | 0 |
| created_by | string | 64 | no | |
| published_at | datetime | | no | |
| closed_at | datetime | | no | |

**Indexes:** `org_id`, `status`, `org_id+status`, `published_at`

**Enums:** status = `draft|published|closed|archived`; visibility = `network|invite_only|public`

### `donation_lots`

| Column (Attribute) | Type | Size | Required | Default | CSV |
|-------------------|------|------|----------|---------|-----|
| listing_id | string | 64 | yes | | |
| org_id | string | 64 | yes | | |
| org_code | string | 32 | no | | Org Code |
| item_code | string | 64 | yes | | Item Code |
| item_desc | string | 512 | yes | | Item Desc |
| lot_no | string | 64 | yes | | Lot No. |
| locator | string | 128 | no | | Locator |
| near_expire | boolean | | no | false | derived |
| quantity_available | integer | | yes | | Quantity Accept |
| quantity_reserved | integer | | yes | 0 | |
| quantity_fulfilled | integer | | yes | 0 | |
| quantity_initial | integer | | yes | | Quantity Accept |
| list_price_egp | double | | no | 0 | Price List |
| expiry_date | datetime | | yes | | Exp Date |
| po_category | string | 32 | no | | Po Category |
| medicine_id | string | 64 | no | | |
| status | string | 32 | yes | available | |
| unit_label | string | 32 | no | | |
| notes | string | 1000 | no | | |
| import_batch_id | string | 64 | no | | |
| lot_key | string | 160 | yes | | org:item:lot |
| created_by | string | 64 | no | | |

**Indexes:** `listing_id`, `org_id`, `status`, `expiry_date`, `item_code`, `lot_no`, unique `lot_key`

**Enums:** status = `available|partial|exhausted|expired|withdrawn`

### `donation_requests`

| Column (Attribute) | Type | Size | Required | Default |
|-------------------|------|------|----------|---------|
| lot_id | string | 64 | yes | |
| listing_id | string | 64 | yes | |
| donor_org_id | string | 64 | yes | |
| requester_org_id | string | 64 | yes | |
| requested_by | string | 64 | yes | |
| quantity_requested | integer | | yes | |
| quantity_approved | integer | | no | 0 |
| status | string | 32 | yes | submitted |
| justification | string | 2000 | no | |
| program_name | string | 256 | no | |
| preferred_pickup_at | datetime | | no | |
| rejection_reason | string | 1000 | no | |
| reviewed_by | string | 64 | no | |
| reviewed_at | datetime | | no | |
| item_code | string | 64 | no | |
| item_desc | string | 512 | no | |
| lot_no | string | 64 | no | |
| expiry_date | datetime | | no | |
| list_price_egp | double | | no | |

**Indexes:** `lot_id`, `requester_org_id`, `donor_org_id`, `status`, `donor_org_id+status`, `requester_org_id+status`

**Enums:** status = `submitted|under_review|approved|rejected|fulfilled|cancelled`

## Permissions (MVP)

- Prefer server API key / Functions for approve & stock mutation.
- Client can create listings/lots/requests for authenticated users.
- Document read: any authenticated user for `published` listings and non-withdrawn lots (tighten later with Teams).

## CSV format (donor import)

```
Org Code,Item Code,Item Desc,Lot No.,Locator,Quantity Accept,Price List,Exp Date,Po Category
```

Exp Date accepts `DD-Mon-YY`, `DD-Mon-YYYY`, or ISO dates.
