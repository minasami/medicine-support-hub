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

The next four public read contracts have also been rebuilt on top of the
normalized rehearsal layer with `security_invoker = true`:

- public canonical products: 33 of 33 columns match;
- public price history: 12 of 12 columns match;
- catalog ID map: 4 of 4 columns match;
- search facets: 3 of 3 columns match.

These public replacements reproduce another 52 ordered production columns with
zero name or type differences. The catalog-ID map returns the preserved
canonical ID directly rather than hashing it again, preventing public
`/catalog/:id` URL changes during the eventual cutover.

The normalized encyclopedia and v5 search layer has now been rehearsed as
well. The encyclopedia view matches all 39 production columns. The search
function matches all 18 production arguments and its complete 41-column return
table exactly. Four representative English and Arabic exact searches returned
the expected canonical product first.

An initial implementation recomputed source aggregates for every request and
took about 1.58 seconds. It was rejected. The corrected implementation uses a
materialized canonical read model, indexed candidate retrieval, and a bounded
empty-query browse path. Measured rehearsal timings were approximately:

- representative exact English search: 9-19 ms across warm/cold checks;
- representative exact Arabic search: approximately 10 ms;
- empty 36-product browse page: approximately 110 ms.

The browse result reported the correct 79,490-product rehearsal total, adjacent
36-row pages had no canonical-ID overlap, and a 100-200 EGP filter returned no
out-of-range rows. Company-verified enrichment, marketplace offers, and image
verification remain explicit parity gates because the isolated project does
not contain the production organization or marketplace datasets.

The remaining public search compatibility entry points were then routed to the
same normalized indexed implementation. The v4, v4-legacy, and canonical
functions match their production argument lists and return-table definitions
exactly. An Arabic representative query produced the same ordered result and
canonical ID through all four search versions.

The older `search_medicines_catalog` composite contract was also reconstructed:
its enriched catalog view matches all 40 production columns by name and type.
The first empty-query implementation incorrectly invoked fuzzy candidate
search and took about 860 ms; it was rejected. A dedicated indexed browse path
reduced the 50-row rehearsal browse to approximately 71 ms while exact product
search continued to return the expected record.

### Write and maintenance-function audit

The remaining mutation layer was classified by target: enrichment-queue
acceptance, verified-company portfolio import and review, canonical/search
refresh, company-profile aggregation, price normalization, and growth/cache
maintenance. This audit found one existing production access-control defect:
`private.refresh_medicine_company_profiles_for_slugs(text[])` was a
`SECURITY DEFINER` function with PostgreSQL's default public execution grant,
no internal caller check, and effective `anon` and `authenticated` access. The
function can rewrite and delete governed company-profile aggregates.

Execution was revoked from `PUBLIC`, `anon`, and `authenticated`, while
`service_role` access was retained. Effective privileges were verified after
the change: anonymous and authenticated execution are false and service-role
execution is true. The repository contains the matching idempotent hardening
migration so new environments retain the boundary.

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

### Refresh and search-cache rehearsal

The production refresh sequence was reproduced against the normalized
materialized read model and cache tables. A canonical refresh followed by a
search-cache refresh completed successfully and produced:

- 79,490 indexed canonical products;
- 4,152 cached facet values across five facet types;
- 125,894 merged source observations recorded in search metrics;
- 25,066 verified-dataset products;
- 79,430 operational-catalog products;
- 79,490 products with a current price.

After the refresh, all 60 representative public records still matched their
source observation for current price, preferred image (including nulls),
barcode, and operational code. This validates refresh stability and derived
cache reconstruction, but not yet contribution/import mutations or the final
production cutover.

### Adaptive growth-queue rehearsal

The normalized indexed model was also connected to an isolated copy of the
adaptive data-growth queue. Its first refresh created a bounded queue of 1,750
items: 250 items for each of the seven gaps present in the rehearsal data
(scientific name, manufacturer, drug class, route, category, image, and price
history). No price-gap rows were created because all 79,490 rehearsal products
have a current price.

A second refresh preserved one item deliberately marked `in_review` and one
item deliberately marked `ignored`. This confirms that rebuilding derived
indexes and priorities does not erase administrator workflow decisions. The
isolated project contains no crawler source or evidence-candidate data, so its
scheduled-source and pending-evidence metrics correctly remain zero. Evidence
linkage and resolved-gap transitions remain separate mutation gates.

### Governed import mutation rehearsal

An isolated review queue was connected to normalized source observations and
tested with one accepted row and one rejected row targeting the same canonical
medicine. The accepted row:

- remained in the review queue with its approval note and timestamp;
- created exactly one governed, verified source observation;
- retained the existing canonical ID used by `/catalog/:id`;
- introduced a second observed price without overwriting the earlier source;
- rebuilt into `has_price_history = true`; and
- moved the corresponding adaptive-growth item to `resolved`.

The rejected row retained its rejection reason but created no source
observation. Both review functions are executable by `service_role` only in the
rehearsal; `anon` and `authenticated` have no execute privilege. This validates
the audit-preserving accept/reject path and one resolved-gap transition.
Bulk imports, company contribution decisions, evidence-candidate linkage, and
rollback of an accepted observation remain separate gates.

### Bulk company contribution and rollback rehearsal

A three-row verified-company batch was reviewed through a bounded transactional
function. Two distinct rows were accepted and one row that reused an existing
source record key was rejected as a duplicate. The successful rows retained:

- the verified company slug;
- both submitted evidence URLs;
- their original source record keys;
- the administrator decision in the review queue; and
- their existing canonical medicine IDs.

The duplicate retained its rejection explanation and referenced the already
existing observation; it did not create a second source record. After the batch,
the canonical index still contained 79,490 products and its caches rebuilt
successfully.

One accepted company observation was then reverted. The active source
observation was removed, its complete row and two evidence URLs were copied to
a restricted reversal-audit table, the rollback reason was retained, and the
canonical medicine remained available under the same ID. This validates a
reversible approval path without deleting the underlying medicine. The next
gate is connecting production-shaped company contribution records and evidence
candidates to this normalized contract.

### Production-shaped company and evidence contract

The live dependency audit found one active verified-company medicine product.
It has an assigned canonical ID in the company portfolio table but no matching
row in the current canonical medicine model. This confirms that approved
company products can remain isolated from the primary encyclopedia unless the
normalization cutover explicitly publishes them into the unified contract.

The production contribution and verified-product shapes were reproduced with
synthetic identities in the rehearsal. Publishing an approved product addition:

- inserted the missing canonical core product;
- created one attributed `verified_company_contribution` observation;
- preserved company, profile, organization, registration, review-note,
  contribution-payload, and evidence metadata;
- exposed price, barcode, operational code, and image through the canonical
  indexed model;
- increased the canonical/search-cache product count from 79,490 to 79,491;
- returned the new medicine through exact encyclopedia search; and
- remained idempotent when the publisher was executed again.

A production-shaped evidence-candidate contract was also rehearsed. One pending
and one approved candidate linked to an existing medicine and updated its
growth-queue evidence count plus the public-safe pending metric. Candidate
values remained separate from canonical fields: even an approved candidate did
not publish itself without the governed promotion step. This preserves the
boundary between discovered evidence and reviewed medicine facts.

### Governed evidence promotion and rollback

An approved scientific-name candidate was promoted through a field allowlist.
The operation updated only `scientific_name`, retained the previous value and
complete evidence/provenance metadata in an audit record, created an attributed
source observation, and changed the corresponding growth gap to `resolved`.

The promotion was then reverted with a required reason. Rollback verified that
the canonical value still equalled the promoted value before restoring the
previous value, preventing a stale rollback from overwriting a later edit. It
removed active promotion provenance, returned the candidate to `approved`,
reopened the scientific-name gap, and retained the complete audit history.
Promotion and rollback are executable only by `service_role` in rehearsal.

### Public-search and private-workflow privilege parity

The rehearsal search path was converted to an invoker model over public-safe
canonical fields. Tested as the actual `anon` and `authenticated` database
roles, exact search returned the approved synthetic company product and public
browse returned 24 rows with a total of 79,491.

Neither role has `SELECT` or `INSERT` on source observations, import queues,
company contribution contracts, evidence candidates, growth queues, reversal
history, or promotion audits. The public-safe growth metrics remain readable.
This separation allows public encyclopedia search without exposing evidence
payloads or administrative workflow data.

The production audit also identified three older anonymous search RPCs (`v3`,
`v4`, and `v5`) that are currently `SECURITY DEFINER`. Their outputs are
public-safe, but the normalized cutover should replace their owner-privileged
implementations with invoker functions over explicitly granted public-safe read
models, matching the successful rehearsal.

### Application dependency hardening

The final application trace found two user-facing reads that still queried the
legacy `medicines` table directly. The shared `/api/medicines` browser adapter
and pharmacy inventory picker now use `search_medicines_catalog`. Pharmacy
inventory temporarily writes the RPC's `legacy_medicine_id` into its existing
foreign-key column while retaining the canonical ID in the user-visible audit
note; migrating that foreign key is a separate additive cutover step.

The old Excel importer can delete and reseed the complete legacy catalog. It is
now disabled by default and directs normal datasets to the governed import
workflow. The server-rendered catalog metadata path remains canonical-first but
retains one legacy fallback for unmapped historical links and immediate
rollback during the observation window.

The staged, non-destructive release and rollback procedure is documented in
`docs/MEDICINE_NORMALIZATION_CUTOVER_RUNBOOK.md`. It explicitly forbids table
or column deletion in the initial production cutover.
