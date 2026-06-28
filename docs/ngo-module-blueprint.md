# NGO Chronic Medicine Support Module Blueprint

## Goal

Add a dedicated NGO module for non-profits that manage chronic medicine support programs. It should be accessible from the platform landing page and separated from the current commercial requester/pharmacy flow.

## Platform structure

```text
Medicine Support Hub
├─ Patient / requester portal
├─ Pharmacy / operations portal
└─ NGO chronic medicine support portal
```

## Landing page entry

Add a new card/button:

- Title: For NGOs and Patient Support Programs
- Description: Manage beneficiaries, medicine requests, budgets, procurement, partnerships, and impact reporting.
- Button: Open NGO Portal
- Route: `/ngo`

## Suggested routes

```text
/ngo
/ngo/dashboard
/ngo/beneficiaries
/ngo/beneficiaries/:id
/ngo/requests
/ngo/requests/:id
/ngo/medicines
/ngo/alternatives
/ngo/budgets
/ngo/procurement
/ngo/tenders
/ngo/partners
/ngo/impact
/ngo/reports
/ngo/settings
```

## Roles

```text
ngo_admin
program_manager
case_worker
medical_reviewer
procurement_officer
finance_officer
pharmacy_partner
supplier_partner
donor_viewer
impact_analyst
```

## Phase 1 MVP

Build the operational workflow first:

```text
beneficiary profile
→ chronic medicine request
→ medical review
→ cost and budget review
→ approval or rejection
→ fulfillment tracking
```

MVP modules:

1. NGO workspace
2. Beneficiary registry
3. Chronic medicine requests
4. Reviewer approval/rejection
5. Monthly cost per beneficiary
6. Project budget and remaining balance
7. Basic reports

## Future modules

### Medicine alternatives

Suggest cheaper alternatives by matching:

- active ingredient
- strength
- dosage form
- clinical reviewer approval
- supplier availability
- unit cost

The system should never auto-substitute without medical review.

### Budgeting

Track:

- total project budget
- allocated budget
- committed budget
- spent amount
- remaining balance
- cost per beneficiary
- cost per disease/program category
- budget alerts

### Procurement and supply chain

Track:

- suppliers
- local pharmacy partners
- pharmaceutical company partners
- tenders
- supplier offers
- discounts
- purchase orders
- deliveries
- stock status

### Impact reporting

Track transparent indicators such as:

- beneficiaries supported
- treatment months funded
- disease/category distribution
- avoided treatment interruption
- estimated health impact
- cost per beneficiary
- donor-facing reports

All impact metrics should store assumptions clearly so reports are honest and auditable.

## Database entities

Core tables to add later:

```text
ngo_workspaces
ngo_members
ngo_beneficiaries
ngo_beneficiary_conditions
ngo_medicine_requests
ngo_request_items
ngo_budgets
ngo_budget_allocations
ngo_medicine_alternatives
ngo_suppliers
ngo_tenders
ngo_tender_items
ngo_tender_offers
ngo_purchase_orders
ngo_partner_pharmacies
ngo_impact_metrics
```

## Security model

Every NGO table must include `ngo_id`.

Rules:

- NGO users only access their own workspace.
- Platform admins can support all NGO workspaces.
- Donor viewers can only view approved reports.
- Supplier/pharmacy partners only access assigned tenders or fulfillment tasks.

## Recommended implementation order

1. Add landing-page NGO CTA.
2. Add `/ngo` route and empty dashboard shell.
3. Add database migration for NGO workspaces and members.
4. Add beneficiary registry.
5. Add NGO medicine request workflow.
6. Add budget review.
7. Add alternatives and procurement.
8. Add impact reports.
