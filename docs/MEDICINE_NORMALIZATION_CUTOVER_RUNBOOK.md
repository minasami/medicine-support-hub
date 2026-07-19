# Medicine catalog normalization cutover runbook

Status: **pre-cutover draft; do not run against production yet**.

Phase 0 status: **applied to production on 19 July 2026**. This status covers
only the additive canonical-reference columns, their indexes/backfill, and the
governed mapping-review queue. It does not authorize any legacy removal or the
later normalized read cutover.

The first production cutover must be additive and reversible. It must not drop,
truncate, rename, or rebuild any legacy medicine table. Patient, pharmacy,
company, marketplace, and clinical references must continue resolving while
the normalized model is observed.

The Industry administration workspace includes an authorized, read-only
readiness report covering queue decisions, suggestion coverage, database size,
and all five compatibility-reference paths. The report deliberately keeps
legacy deletion locked even when mapping reaches 100%; backup, dependency,
security, test, and observation gates remain separate approvals.

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

## Phase 0 additive package

The first executable package is kept outside migration history until final
approval:

- `scripts/sql/medicine-normalization-preflight.sql`
- `scripts/sql/medicine-normalization-phase0-additive.sql`
- `scripts/sql/medicine-normalization-phase0-verify.sql`

Phase 0 adds nullable `canonical_medicine_id` compatibility columns to the five
tables that still reference `medicines` or `medicines2`, backfills only through
the existing audited ID maps, and adds partial indexes. It does not add a
foreign key to the current canonical view, does not require every legacy row to
match, and does not replace any existing ID.

The production read-only preview on 19 July 2026 found complete mapping for
56,139 `medicine_catalog_v2_map` rows and 202 source-evidence rows. Of 212
legacy enrichment rows, 110 have an existing verified canonical route and 102
remain unresolved. The one current pharmacy inventory medicine reference is
also unresolved. These 103 records must remain on their legacy IDs until
reviewed; the migration deliberately leaves their canonical columns null.

The update logic was transactionally rehearsed with both mapped and unresolved
fixtures. Mapped references received the expected canonical IDs and unresolved
references remained intact. The transaction was rolled back after verification.
The rehearsal security advisor reports no findings. Performance advice contains
only expected informational unused-index notices because the isolated schema is
short-lived; no missing-foreign-key-index warning is present. See the
[Supabase database-linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Governed exception review

`scripts/sql/medicine-normalization-mapping-review.sql` defines the next
additive layer. It creates an RLS-protected exception queue and explicit
permission, synchronizes only unresolved legacy references, and provides
approve, reject, and reopen decisions. Its privileged functions live in the
private schema, verify the current user is a platform administrator or has the
Medicine Mapping Review / Industry Review permission, and are not executable
by anonymous users.

The Industry administration dashboard includes a searchable review workspace.
A reviewer must deliberately select a canonical medicine before approval.
Approval writes only the new `canonical_medicine_id`; the legacy ID remains
unchanged. Reopening removes the canonical link only when it still equals the
previously approved value, preventing an old decision from overwriting a newer
mapping. Rejected and reopened decisions remain in the audit queue.

### Final production-shaped rehearsal

The exact Phase 0 and mapping-review SQL files were executed, in order, against
production-shaped tables in the isolated Supabase project. The rehearsal:

- backfilled mapped references and left deliberately unmapped fixtures null;
- synchronized exactly the three unresolved fixture types;
- approved an enrichment mapping and retained its legacy medicine ID;
- rejected an import-queue mapping without changing its source record;
- approved and then reopened an inventory mapping, removing only the canonical
  link created by that decision;
- preserved all decision states after a second synchronization;
- denied anonymous table reads and anonymous review-function execution; and
- kept public wrappers as security invoker while privileged implementations
  remained in the private schema.

The performance advisor identified and prompted a covering partial index for
the `reviewed_by` foreign key; the exact package was reapplied successfully and
the warning cleared. Remaining rehearsal notices are informational unused-index
messages expected for newly created test objects. Security-advisor notices refer
only to minimal prerequisite mock tables; the mapping queue itself has RLS, an
administrator/delegate policy, and least-privilege grants.

### Production Phase 0 result

The signed preflight confirmed complete mapping coverage for all 114,582 rows
from the three expected mapped source systems. The two additive migrations and
a narrowly scoped direct-database maintenance authorization were then recorded
in Supabase migration history.

Post-application verification confirmed:

- all five legacy medicine table counts were unchanged;
- 56,139 v2-map rows and 202 source-evidence rows received canonical links;
- 110 of 212 enrichments received verified canonical links;
- 102 enrichment references and one inventory reference remained unresolved;
- exactly 103 pending review rows were synchronized;
- zero mappings were automatically approved;
- 46 open exceptions received a single exact normalized-name suggestion for
  faster human review, while 57 retained no exact suggestion;
- suggestion generation changed zero source references and cannot approve a
  mapping;
- anonymous table access and function execution remained denied;
- public review functions remained security invoker; and
- the security and performance advisors reported no mapping-queue finding or
  unindexed reviewer foreign key.

The first mapping-review migration attempt failed atomically because the live
permission registry uses `sensitive` rather than `high` as its risk vocabulary.
The package was corrected to the live constraint and then applied successfully;
no partial objects were left by the failed transaction.

## Deferred destructive work

No legacy table or column is eligible for removal until dependency telemetry
shows zero use, all foreign keys are migrated, backup retention is approved,
and a separate dry run proves restoration. Similar column names alone are not
evidence that two fields have identical meaning or provenance.
