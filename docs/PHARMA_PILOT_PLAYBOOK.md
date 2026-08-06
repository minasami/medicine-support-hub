# Pharma manufacturer pilot playbook

**Goal:** Let pharmaceutical companies and manufacturing leadership contribute to the Medicines Encyclopedia through verified accounts, with optional delegation to product managers and line managers \u2014 **web-first**, closed pilot.

**Product:** https://medicinesupport.app  
**Industry registration:** https://medicinesupport.app/industry  
**Account (verified reps):** https://medicinesupport.app/account  

---

## What is already in the codebase

| Module | Purpose |
|--------|--------|
| `company-role-hierarchy.ts` | CEO \u2192 product_manager \u2192 line_manager \u2192 company_rep \u2192 viewer |
| `company-portfolio-scope.ts` | Isolate portfolio rows to one company slug |
| `data-governance.ts` | draft \u2192 pending_review \u2192 published / rejected / archived |
| `medicine-provenance.ts` + `record-company-product-provenance.ts` | Audit trail on create/update |
| `company-contribution-workflow.ts` | Orchestrates authz + sanitize + lifecycle + audit |
| `company_profile_claims` (Appwrite) | Work-email claim \u2192 admin approve |
| Industry / admin UI | Registration, claim moderation, contribution network pages |

---

## Pilot operating model (recommended)

### Week 0 \u2014 Legal & ops
1. Publish **Privacy Policy**, **Terms of Use**, **Manufacturer Contribution Terms**.
2. Create pilot NDA / data processing note for 3\u20135 manufacturers.
3. Admin process: claim review within **2 business days**.

### Week 1 \u2014 Onboard company
1. CEO or authorized rep registers at `/industry` with **corporate work email**.
2. Platform admin approves claim in `/admin/industry`.
3. CEO is recorded as `company_ceo` in `company_team_members`.
4. CEO invites product managers, line managers, optional reps.

### Week 2 \u2014 Contribute
1. Editors work only on products that **belong to their company**.
2. Saves go through `planContributionSave` (`save_draft` | `submit_review` | `publish`).
3. Every save records a provenance event.
4. Public encyclopedia shows **published** (or legacy) rows only.

### Success metrics
- \u22651 company with approved claim
- \u226510 SKUs with company-verified provenance
- Zero cross-company portfolio leakage
- Admin claim SLA met

---

## Roles at a glance

| Role | Edit products | Publish | Invite team |
|------|---------------|---------|-------------|
| company_ceo | All company SKUs | Yes | Yes |
| product_manager | Lines or all if lines empty | Yes | Line managers, reps, viewers |
| line_manager | Assigned lines / SKUs | Yes | No |
| company_rep | If claim approved + scope | If claim approved | No |
| viewer | No | No | No |

---

## Not in pilot scope (defer)

- Open self-serve without admin review
- Google Play / App Store public listing
- SSO / SCIM
- Automatic MOH / EDA official certification badges

---

## Appwrite tables to verify

1. `company_profile_claims` \u2014 `docs/company-profile-claims-schema.md`
2. `company_team_members` \u2014 see `COMPANY_TEAM_MEMBERS_TABLE`
3. Medicine documents: optional `lifecycle_status`, `company_slug`, provenance fields

---

## Store apps (later)

Capacitor shell exists (`docs/capacitor-shell.md`). Treat store submission as **Phase C** after pilot metrics and privacy pages are live.
