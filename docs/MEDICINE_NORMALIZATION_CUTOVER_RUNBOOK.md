# Medicine catalog normalization cutover runbook

Status: **pre-cutover draft; do not run against production yet**.

The first production cutover must be additive and reversible. It must not drop,
truncate, rename, or rebuild any legacy medicine table. Patient, pharmacy,
company, marketplace, and clinical references must continue resolving while
the normalized model is observed.

## Release gates

All of the following must pass immediately before cutover:

1. A restorable production backup is completed and its recovery procedure is
   verified.
2. Canonical product, source-observation, ID-map, public-view, and search-cache
   counts match the approved rehearsal tolerances.
3. Every legacy product reference maps to either a canonical ID or an explicit
   reviewed exception.
4. Verified-company products and approved governed imports publish
   idempotently into the canonical contract.
5. Anonymous and authenticated searches run as invoker functions over only
   public-safe views; neither role can read workflow or evidence payloads.
6. Foreign-key, RLS, security-advisor, and query-plan checks pass.
7. Application typecheck, build, direct-route, authentication, medicine search,
   product detail, patient request, and pharmacy inventory tests pass.

## Additive cutover sequence

1. Record immutable pre-cutover counts, schema definitions, grants, policies,
   function definitions, and representative query results.
2. Create the normalized tables, ID maps, audit tables, indexes, and restricted
   governance functions without changing legacy objects.
3. Backfill canonical products and attributed observations in bounded,
   restartable batches. Record every rejected or ambiguous row.
4. Build and refresh public-safe indexed views and search caches.
5. Install compatibility adapters and dual-write publishers for governed
   imports, verified-company contributions, and evidence promotions.
6. Switch application reads to canonical RPCs. Keep the legacy metadata
   fallback and legacy foreign-key references during the observation window.
7. Observe error rate, latency, count drift, unresolved IDs, and write parity.
   The minimum observation window is seven days and must include a real
   company contribution, patient request, and pharmacy inventory operation.
8. Only after a separately approved release may legacy tables become read-only
   compatibility objects. Physical deletion is a later project with its own
   backup, retention, and rollback approval.

## Immediate rollback

Rollback is a routing and grants change, not a data deletion:

1. Stop normalized publishers and restore application reads to the preserved
   legacy functions/views.
2. Restore the prior grants and function definitions captured at preflight.
3. Keep normalized tables and audit records intact for diagnosis.
4. Reconcile writes accepted during the cutover window back into the legacy
   contract using their source keys and audit records.
5. Re-run patient request, pharmacy inventory, company portfolio, product
   detail, and public search smoke tests.

Rollback is mandatory for any authorization regression, missing clinical or
commercial reference, unexplained count drift, broken product route, or
sustained search/error regression beyond the approved threshold.

## Application dependency disposition

- Browser `/api/medicines` lookup: canonical `search_medicines_catalog` RPC.
- Pharmacy inventory lookup: canonical RPC; the returned
  `legacy_medicine_id` is temporarily retained for the existing inventory
  foreign key.
- Patient request lookup: canonical RPC; both canonical and compatibility IDs
  are retained.
- Catalog server metadata: canonical first, with a legacy fallback retained
  solely for rollback and unmapped historical URLs during the observation
  window.
- Destructive Excel importer: disabled by default. New datasets must enter the
  governed import/review workflow.

## Deferred destructive work

No legacy table or column is eligible for removal until dependency telemetry
shows zero use, all foreign keys are migrated, backup retention is approved,
and a separate dry run proves restoration. Similar column names alone are not
evidence that two fields have identical meaning or provenance.
