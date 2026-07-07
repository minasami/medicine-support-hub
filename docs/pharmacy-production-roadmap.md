# Pharmacy Production Roadmap

This roadmap turns the pharmacy module from a working feature set into a production-grade operating system for real pharmacy branch work.

## Current production status

The pharmacy hub is live with branch finance, member access, branch settings, inventory, purchases, sales, and training routes.

Supabase production includes the core pharmacy tables for branches, members, finance entries, suppliers, inventory, purchases, sales, and sale lines.

## Priority 1 — Reliability before scale

### 1. Atomic sale completion

Tracking issue: #59

Move sale completion out of multiple frontend write requests and into one server-side operation. A sale should either fully complete or fully fail.

Required result:

- no partial sale records,
- no negative stock,
- finance revenue only posts after stock deduction succeeds,
- inventory movement references the completed sale.

### 2. Authenticated end-to-end workflow test

Tracking issue: #60

Add a browser-level test that covers the full branch workflow: assign role, link accountant, add supplier, receive stock, create purchase, complete sale, review finance, remove access.

Required result:

- future deployments cannot silently break the pharmacy workflow.

## Priority 2 — Security and accountability

### 3. Auth password protection review

Tracking issue: #61

Review the Supabase Auth password protection setting and enable the compromised-password check if available.

Required result:

- stronger account protection before inviting more users.

### 4. Pharmacy operation audit trail

Tracking issue: #62

Record who changed what and when across branch access, finance, suppliers, inventory, purchases, and sales.

Required result:

- branch owners and platform admins can investigate operational changes,
- accountants cannot alter audit history.

## Priority 3 — Operational excellence

### 5. Branch permissions matrix

Define exactly what each role can do:

- platform admin,
- branch owner,
- branch manager,
- pharmacy accountant,
- viewer/read-only role if needed later.

### 6. Monthly close process

Add a simple close/review state for each reporting period so historical finance reports cannot be accidentally changed without a correction trail.

### 7. Backup and export workflow

Add exports for:

- branch finance entries,
- stock summary,
- supplier balances,
- purchases,
- sales,
- audit trail.

## Definition of production-grade pharmacy module

The module should not be considered fully production-grade until:

- sales are atomic,
- authenticated E2E tests are running,
- audit trail is live,
- password protection is reviewed,
- role permissions are documented,
- owners can export branch reports,
- no Supabase security ERROR findings remain,
- Vercel production runtime logs stay clean under real use.
