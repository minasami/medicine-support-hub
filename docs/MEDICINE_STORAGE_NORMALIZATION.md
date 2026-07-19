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

## Production dependency inventory

The cutover must preserve or replace ten directly dependent views/materialized
views, including the canonical products, source records, price history,
encyclopedia, catalog, search-facet, and catalog-search contracts.

Seventeen stored functions also reference the legacy or current canonical
medicine relations. They cover canonical/search refreshes, all public medicine
search entry points, import-queue acceptance, verified-company portfolio
imports, company-profile aggregation, contribution review, collaboration
validation, growth queues, and verified-price normalization. Several references
are dynamic SQL and therefore do not appear in PostgreSQL's ordinary dependency
graph; both catalog dependencies and function bodies must be audited.

These 27 database objects are a mandatory rewrite-and-parity checklist. No
legacy relation can be replaced or removed until each object either reads the
normalized tables or has passed against a compatibility view with the same
signature, grants, security behavior, and output contract.

### Dependency rewrite progress

The five legacy source compatibility views now reproduce all 52 production
columns in the same logical order, with the same names and PostgreSQL types.
This includes preserving the historical `medicines4.drug_varient` spelling so
existing positional and named consumers are not broken.

The first normalized dependency layer has also been implemented in the
isolated rehearsal:

- `medicine_source_records_v1`: 22 of 22 columns match;
- `medicine_canonical_products_v1`: 33 of 33 columns match;
- `medicine_price_history_v1`: 12 of 12 columns match.

Together these three replacements reproduce 67 ordered production columns with
zero name or type differences. They contain 125,894 rehearsed source records,
79,490 canonical rows (the 79,430 production-scale synthetic rows plus the 60
separately imported representative public records), and 125,894 grouped
price/source rows. All 60 representative records retain the tested price,
image, barcode, and operational-code values through the rewritten canonical
view.

Supabase's rehearsal-project security advisor reports no findings. The
performance advisor reports only informational unused-index notices expected
for a newly created isolated rehearsal; index retention will be decided from
production-like query coverage rather than deleting them from this short-lived
usage snapshot.

## Isolated rehearsal results (2026-07-19)

Supabase development branches were unavailable on the current plan, so a
separate `$0/month` rehearsal project was created in `eu-north-1`. The project
contains no production authentication, patient, clinical, organization, or
secret data.

A production-scale synthetic shape was loaded:

- 79,430 canonical products;
- 114,582 source observations;
- 86,106 rows reconstructed through the `medicines2` compatibility view.

Measured normalized storage:

- canonical core including indexes: 27 MB;
- source observations including indexes: 35 MB;
- normalized total: 62 MB;
- complete rehearsal database: 72 MB.

An indexed canonical product plus source aggregation executed in approximately
0.2 ms on a warm cache. Both the canonical primary key and source-observation
canonical index were used.

The rehearsal was then extended with normalized legacy identifiers and
disease/generic relationships. Compatibility views reconstructed every legacy
source shape at its production row count:

- `medicines`: 70,673 rows;
- `medicines2`: 86,106 rows;
- `medicines3`: 3,410 rows;
- `medicines4`: 11,252 rows;
- `medicines5`: 25,066 rows.

With these additional relationships and indexes, all normalized rehearsal
relations occupy 79 MB and the complete rehearsal database occupies 89 MB.
The compatibility views consume no persisted row storage.

### Compact search rehearsal

Search summary fields and a generated `tsvector` were added directly to the
canonical core rather than recreating the production 107 MB standalone search
materialized view. English and Arabic exact-name plans were separated so each
uses its language-specific index.

Measured warm-cache timings:

- exact English name: approximately 4.7 ms;
- exact Arabic name: approximately 8.5 ms;
- deliberately misspelled synthetic name: approximately 330 ms.

The fuzzy synthetic benchmark is a pathological case because every generated
English name starts with the same word (`MEDICINE`). It improved from about
1.08 seconds after prefix and trigram candidates were split by language. Fuzzy
ranking must still be repeated with a larger representative real-name corpus
before cutover.

With search vectors, trigram indexes, prefix indexes, filters, all source
observations, legacy identifiers, and disease/generic relationships included,
the normalized rehearsal relations occupy approximately 135 MB. This figure is
the appropriate comparison point for the current source, canonical, and search
storage combined.

### Representative public-record parity

A deterministic sample of 60 public encyclopedia records was copied into the
isolated rehearsal. No authentication, patient, clinical, organization, or
private data was copied. The normalized core and source observation retained:

- 60 of 60 current prices exactly;
- 60 of 60 preferred-image values exactly, including null values;
- 60 of 60 barcodes exactly;
- 60 of 60 operational codes exactly.

Exact English and Arabic searches for two independently sampled products both
returned the expected canonical product as the first result. Representative
warm-cache execution measured approximately 5.0 ms for an English exact name
and 6.6 ms for its Arabic exact name. Canonical IDs and therefore public
`/catalog/:id` URLs remained unchanged.

These results validate the normalized storage shape, compatibility row counts,
representative public-field preservation, and exact bilingual search. They do
not yet authorize production deletion. Before cutover, the remaining database
functions and materialized views must be redirected to the normalized schema,
the full relationship/RLS/application suite must pass, a rollback copy must be
created, and the platform administrator must approve the final transaction.
