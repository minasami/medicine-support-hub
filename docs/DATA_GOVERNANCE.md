# Data governance strategy

## Goals

1. Manufacturers own accurate product data for their brands.
2. Public encyclopedia stays trustworthy (no silent overwrites without audit).
3. Platform admin retains override and dispute resolution.

## Content lifecycle

```
draft → pending_review → published
                ↓
            rejected → draft
published / rejected → archived
```

| Status | Public catalog | Who can set |
|--------|----------------|-------------|
| draft | Hidden | Contributor |
| pending_review | Hidden | Contributor submit |
| published | Visible | CEO / PM (approved) / platform admin |
| rejected | Hidden | Reviewer |
| archived | Hidden | Admin / publisher |

Legacy rows without `lifecycle_status` remain visible.

## Provenance (recommended document fields)

- `lifecycle_status`
- `source_kind` (`company_verified`, `moh_eda_tariff`, `drugeye`, …)
- `contributed_by_email` / `contributed_by_user_id` / `company_slug`
- `reviewed_by` / `reviewed_at` / `published_at`

Code helpers: `apps/web/src/lib/data-governance.ts`.

## Editable surface for companies

Name EN/AR, scientific name, class, route, category, form, strength, barcode, SKU, **image_url**, list price, line, manufacturer string, description.

Regulatory identity (canonical id assignment) stays platform-controlled.

## Image policy

1. Prefer company-uploaded pack shot (Appwrite Storage URL).
2. Cards and monographs show `image_url`; placeholder if missing.
3. Mismatched images: admin tools / mismatch scripts; do not auto-scrape random web images into production without review.

## Bulk CSV

- Imports create/update **drafts** or stock tables first.
- Matched encyclopedia writes require approved membership + scope.
- Unmatched SKUs stay in manufacturer stock lots for later linking.

## Audit

- Record company product provenance on save (`recordCompanyProductProvenance`).
- Admin can review claim queue and revert abusive edits.

## Related

- `docs/COMPANY_ROLE_HIERARCHY.md`
- `docs/APPWRITE_USER_ACCESS_MAP.md`
- `docs/PORTFOLIO_ISOLATION.md`
