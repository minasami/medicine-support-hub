# Appwrite table: `company_profile_claims`

Database: `medicine_support_hub`  
Project: `6a54ac3a00272c02d6e0` (FRA)

Use **Create Table** → columns below (Classic SDK still uses collection/document APIs).

## Columns

| Column | Type | Size | Required | Default |
|--------|------|------|----------|--------|
| company_slug | string | 128 | yes | |
| company_name | string | 256 | yes | |
| proposed_company_name | string | 256 | no | |
| company_type | string | 64 | no | pharmaceutical_manufacturer |
| work_email | string | 256 | yes | |
| user_email | string | 256 | no | |
| user_id | string | 64 | no | |
| mobile_phone | string | 64 | no | |
| role_title | string | 128 | no | |
| website | string | 512 | no | |
| notes | string | 2000 | no | |
| status | string | 32 | yes | pending |
| is_approved | boolean | — | yes | false |
| verification_score | integer | — | no | 50 |
| requested_by | string | 256 | no | |
| reviewer_notes | string | 2000 | no | |
| reviewed_at | string | 64 | no | |
| automated_recommendation | string | 64 | no | ready_for_admin_review |
| risk_flags | string | 1000 | no | JSON array as string |

## Indexes

- `idx_work_email` — key on `work_email`
- `idx_status` — key on `status`
- `idx_company_slug` — key on `company_slug`

## Document id convention

Client may pass `$id` as `claim_<timestamp>` or let Appwrite generate unique id.
