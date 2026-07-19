# Medicine storage normalization

## Objective

Replace repeated medicine identity fields across legacy source tables with one
physical canonical product record plus source-specific observations, while
preserving provenance, prices, images, disease links, operational identifiers,
and existing API contracts.

This is a staged production migration. Legacy tables must not be dropped until
an isolated rehearsal and the parity checks below pass.

## Production baseline (2026-07-19)

- Database size: approximately 418 MB.
- Public encyclopedia products: 79,431.
- Canonical search products: 79,430.
- Canonical source mappings: 114,582.
- `medicines5`: 25,066 rows after removal of four exact duplicate payloads.
- Exact duplicate payload groups remaining in the five source tables: zero.
- Repeated English and Arabic name payloads use approximately 14.5 MB before
  indexes and tuple overhead.

## Why similarly named columns cannot simply be dropped

The source tables describe different observations:

| Source | Unique responsibility |
| --- | --- |
| `medicines` | Legacy IDs, dosage form, strength, category, manufacturer, active ingredient, ATC, pharmacy references |
| `medicines2` | Operational IDs, active state, quantity, price, barcode, internal codes |
| `medicines3` | Source images, source links, categories, observed price |
| `medicines4` | Disease and generic relationships, prescribing status, manufacturer origin, descriptive content |
| `medicines5` | Verified bilingual identity, scientific name, manufacturer, class, route, price |

Repeated names and prices are independent source assertions. They must remain
traceable even after the canonical value is selected.

## Target schema

### `medicine_products_core`

One row per canonical product:

- `canonical_id`
- `canonical_key`
- preferred English and Arabic names
- preferred scientific name
- preferred manufacturer
- preferred class, route, category, dosage form and strength
- preferred barcode and operational code
- lifecycle timestamps

### `medicine_source_observations`

One row per source record:

- `source_system`
- `source_record_key`
- `canonical_id`
- source priority and verification status
- observed price, currency and observation date
- source-specific identifiers
- source image and source URL
- compact source payload for fields that do not belong in the canonical core

The primary key is `(source_system, source_record_key)`. Foreign keys reference
`medicine_products_core(canonical_id)`.

### Relationship tables

Keep normalized, independently governed tables for:

- disease and generic relationships;
- company roles and portfolios;
- approved images;
- price history;
- marketplace availability;
- community and company contributions.

## Compatibility strategy

During cutover, the current `medicines*` API contracts remain available through
compatibility views. Application code and database functions can migrate in
small groups without a flag day.

At minimum, preserve:

- legacy `medicines.id` references used by pharmacy inventory;
- `medicines2.id` operational mappings;
- canonical catalog IDs and URLs;
- source record keys used by evidence and price history;
- all RLS and grants;
- security-invoker behavior for exposed views.

## Migration phases

1. Rehearse on a Supabase development branch populated with representative,
   anonymized source rows.
2. Create the normalized tables, constraints, RLS and indexes.
3. Backfill canonical products and source observations.
4. Compare every field and source count with production baselines.
5. Migrate materialized views and refresh functions to normalized tables.
6. Replace legacy physical tables with compatibility views in one transaction.
7. Run application, RLS, search, PWA and direct-route validation.
8. Retain a rollback schema for a defined observation window.
9. Drop the rollback schema only after approval, then reclaim storage during a
   scheduled maintenance window.

## Required parity gates

The migration must stop if any condition fails:

- canonical product count changes unexpectedly;
- source mapping count decreases;
- any canonical ID or public `/catalog/:id` URL changes;
- any approved image disappears;
- current or historical prices lose their source attribution;
- disease, generic, company or marketplace relationships decrease;
- anonymous reads or authenticated RLS tests change unexpectedly;
- representative exact, Arabic, fuzzy, barcode and code searches differ;
- pharmacy inventory foreign keys become invalid;
- database size grows beyond the available production headroom.

## Production deletion rule

Do not delete a legacy table or column merely because its name repeats another
column. Delete it only after its values are represented in the normalized
schema, all dependants use the new schema or a compatibility view, the rollback
copy exists, and the platform administrator approves the final cutover.
