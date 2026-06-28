# Medicine Support Hub V2 Architecture

## Direction

Medicine Support Hub should evolve from a single medicine-request app into a multi-tenant medicine assistance platform.

The platform should support different organization types without duplicating the whole app for each one:

- commercial pharmacies
- NGOs
- hospitals
- corporate social responsibility programs
- donor-funded programs
- government medicine assistance initiatives
- pharmacy partners
- suppliers

## Core principle

Build one shared platform foundation, then expose different modules by role and organization type.

```text
Platform
├─ Organizations
├─ Users and roles
├─ Beneficiaries / patients
├─ Medicine catalog
├─ Requests
├─ Clinical review
├─ Budgeting
├─ Procurement
├─ Fulfillment
├─ Impact reporting
└─ Administration
```

## Multi-tenant model

Every operational table should eventually be scoped by an organization/workspace ID.

Recommended shared table:

```text
organizations
```

Possible organization types:

```text
platform_owner
commercial_pharmacy
ngo
hospital
corporate_csr
government_program
supplier
pharmacy_partner
donor
```

Every user can belong to one or more organizations through:

```text
organization_members
```

This allows one person to be:

- platform admin across all organizations
- NGO admin for one NGO
- reviewer in another NGO
- donor viewer for a specific donor-funded program

## Recommended high-level schema

```text
organizations
organization_members
organization_settings
profiles

beneficiaries
beneficiary_conditions
beneficiary_documents
beneficiary_support_history

medicine_catalog
medicine_active_ingredients
medicine_equivalents
medicine_prices
medicine_availability

support_requests
support_request_items
review_decisions
request_status_history

budgets
budget_allocations
budget_transactions

tenders
tender_items
tender_offers
purchase_orders
purchase_order_items
suppliers
partner_pharmacies

impact_metrics
impact_assumptions
reports
```

## Role model

Use shared platform roles plus organization-specific roles.

Platform roles:

```text
super_admin
platform_admin
support_admin
```

Organization roles:

```text
org_admin
program_manager
case_worker
medical_reviewer
physician
pharmacist
procurement_officer
finance_officer
supplier_user
pharmacy_partner_user
donor_viewer
impact_analyst
```

## Module map

### Patient / Beneficiary module

Purpose:

- collect requests
- manage profiles
- track request status
- upload documents or prescriptions

### Clinical review module

Purpose:

- validate medical need
- approve/reject requests
- flag missing prescription or documentation
- suggest equivalent alternatives

### Medicine intelligence module

Purpose:

- active ingredient mapping
- brand/generic matching
- dosage form comparison
- lower-cost alternatives
- price and availability tracking

### Budget module

Purpose:

- project budgets
- donor budgets
- disease-specific budgets
- beneficiary allocations
- committed vs spent reporting

### Procurement module

Purpose:

- supplier onboarding
- tender requests
- supplier offers
- purchase orders
- delivery tracking
- discount and donation tracking

### Fulfillment module

Purpose:

- package medicines
- assign delivery/pharmacy partner
- track dispensing
- confirm delivery

### Public health impact module

Purpose:

- supported beneficiaries by disease
- treatment months funded
- estimated impact assumptions
- cost per beneficiary
- cost per treatment month
- donor reports

## V2 implementation strategy

Do not rewrite everything at once.

### Step 1: Keep existing app stable

Current commercial medicine request flow should continue working.

### Step 2: Add organization foundation

Add:

```text
organizations
organization_members
```

Then gradually map existing admin/reviewer/pharmacy roles into organization membership.

### Step 3: Expand NGO module first

Use the NGO module as the first real multi-tenant vertical.

Start with:

```text
NGO workspace
→ beneficiary
→ medicine request
→ review
→ budget decision
```

### Step 4: Extract common logic

After NGO workflow works, extract common pieces:

- request status handling
- user role checking
- medicine catalog
- active ingredient matching
- budget calculations

### Step 5: Add procurement and impact

Only after request and budget workflows are stable.

## Security requirements

- Never rely on front-end role checks alone.
- Every tenant-scoped table needs row-level security.
- Users should only access rows for organizations they belong to.
- Platform admins should have explicit safe policies.
- Donor and partner roles should have read-limited access.

## Engineering recommendation

The next real engineering milestone should be:

```text
Create organizations + organization_members foundation
Migrate NGO tables to use the shared organization model
Add a real NGO workspace setup flow
Build beneficiary CRUD
```

This will make the platform scalable instead of building one isolated module after another.
