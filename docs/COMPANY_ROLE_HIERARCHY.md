# Company role hierarchy

## Roles

| Role | Rank | Capabilities |
|------|------|----------------|
| **company_ceo** | 100 | Full company portfolio; invite PMs / line managers; publish |
| **product_manager** | 70 | Edit assigned lines or full portfolio if no lines set; invite line managers |
| **line_manager** | 50 | Edit only assigned `product_lines` / SKUs |
| **company_rep** | 30 | Submit drafts; publish only if claim **approved** |
| **viewer** | 10 | Read-only |

## Scope

- `product_lines[]` — e.g. `Anti-infectives`, `OTC`
- `product_canonical_ids[]` — explicit encyclopedia IDs

## Appwrite table

**Database:** `medicine_support_hub`  
**Table:** `company_team_members`

Columns: `company_slug`, `company_name`, `user_email`, `user_id`, `role`, `product_lines`, `product_canonical_ids`, `status` (`pending`\|`active`\|`revoked`), `invited_by`, `invited_at`, `notes`.

Indexes: `company_slug`, `user_email`, `status`.

## Code

- `apps/web/src/lib/company-role-hierarchy.ts` — types + `memberCanEditProduct` / `memberCanPublish`
- Integrate with `mapAppwriteUserToAccess` when team membership is loaded

## CEO workflow

1. CEO claim approved for company slug.
2. CEO invites product manager (email) with optional lines.
3. PM invites line managers for specific lines.
4. Line managers update images, prices, monograph fields within scope.
5. Publish follows data governance lifecycle.
