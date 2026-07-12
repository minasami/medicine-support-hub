# Adaptive Medicine Data Growth and Search Reliability

## Purpose

Medicine Support Hub continuously identifies high-value medicine data gaps, schedules approved sources according to their observed usefulness, stores attributed evidence as private review candidates, and refreshes the public search layer without allowing unreviewed web content to publish automatically.

This design is adaptive and self-maintaining, but it is not autonomous clinical truth generation. Canonical public records remain review-controlled.

## Guest medicine-search reliability

The public medicines page previously triggered expensive live aggregation queries on every guest visit:

- five full grouped scans for search facets;
- a live canonical-metrics aggregation;
- a windowed count across the full search index before returning the first page.

The current design uses:

- `medicine_search_facets_cache_v1` for refreshed facet counts;
- `medicine_search_metrics_cache_v1` for one-row catalog metrics;
- `medicine_encyclopedia_facets_featured_v1` for a bounded public filter payload;
- `search_medicine_encyclopedia_v5` for the fast empty-query browse path;
- backward-compatible `search_medicine_encyclopedia_v4` routing so older clients receive the same fast path;
- the original indexed v4 search as private `search_medicine_encyclopedia_v4_legacy` for non-empty and filtered search.

The service-role-only `refresh_medicine_search_caches_v1()` function updates the public caches after a controlled search-index refresh.

## Adaptive growth queue

`medicine_data_growth_queue` stores bounded, prioritized opportunities rather than attempting to process every missing field at once.

Tracked gaps:

- missing price
- missing scientific name
- missing manufacturer
- missing drug class
- missing route
- missing category
- missing image
- missing price history

Priority considers source richness, existing verification signals, and the practical value of the missing field. The queue size per gap is controlled through `growth.queue_per_gap`.

The queue lifecycle is:

`open → queued → in_review → resolved`

Items may also be marked `ignored` by an authorized administrator.

New attributed evidence automatically connects to matching queue items. A queue item is resolved only after the refreshed canonical search index shows that the gap is no longer present.

## Source trust model

Every governed source has a record in `web_ingestion_source_quality`.

Trust tiers:

- official
- regulator
- licensed provider
- verified partner
- trusted reference
- discovery

Each source specifies:

- reliability score
- required corroboration count
- allowed fields
- whether automatic candidate creation is allowed
- verification metadata

Automatic publication is constrained to `false` at the database level.

Every candidate snapshots:

- source trust tier
- source reliability score
- required corroborations

Candidate confidence cannot exceed the configured source reliability. New candidates are forced into `pending` status even when an incoming process attempts to mark them approved.

## Adaptive scheduling

Approved sources keep both a configured interval and an adaptive interval.

Observed outcomes change the adaptive interval:

- failures apply a bounded failure backoff;
- completed runs with no candidates apply a bounded zero-yield backoff;
- productive sources accelerate within configured minimum and maximum limits;
- repeated failures and empty runs are recorded for operational review.

Relevant settings:

- `growth.min_refresh_hours`
- `growth.max_refresh_hours`
- `growth.zero_yield_backoff`
- `growth.failure_backoff`

The scheduler records:

- last candidate yield
- consecutive empty runs
- consecutive failures
- scheduling reason
- next run time

The source-health view is `web_ingestion_source_health_v1`.

## Controlled refresh chain

`refresh_medicine_search_index_v1()` performs the controlled refresh sequence:

1. Refresh the private medicine search materialized index.
2. Analyze the index.
3. Refresh public metrics and facet caches.
4. Recalculate the adaptive growth queue.
5. Return a structured operational result.

The function is executable only by the service role.

## Firecrawl boundary

Firecrawl may create private, attributed evidence candidates from administrator-approved HTTPS domains. It may not publish directly to canonical records.

Scheduled synchronization requires:

- a rotated server-side Firecrawl credential or separately hosted endpoint;
- `CRON_SECRET`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `firecrawl.enabled = true`;
- `firecrawl.automatic_sync = true`;
- an active, scheduled, due, allow-listed source.

Any credential shared in chat, an issue, a screenshot, or Git history must be revoked and replaced before activation.

## Review and promotion

An authorized platform administrator reviews each candidate through `review_web_ingestion_candidate`.

Approved medicine evidence is routed into the existing medicine collaboration moderation queue. Approved company evidence is routed into the verified company contribution queue when the company relationship is known. Manual matching is required when a candidate cannot be safely connected.

This preserves provenance and separates:

- crawled evidence
- reviewed contribution
- canonical public record
- clinical prescription
- marketplace offer
- private pharmacy inventory

## Public health metrics

`medicine_data_growth_health_v1` exposes aggregate-only progress such as:

- canonical product count
- missing-field totals
- active growth-queue count
- active scheduled source count
- pending evidence-candidate count
- refresh timestamp

It contains no patient data, private inventory, secret configuration, or unpublished evidence content.

## Operational rule

The platform may automatically discover, prioritize, crawl, compare, queue, deduplicate, schedule, and measure.

It must not automatically diagnose, prescribe, approve insurance, dispense medication, or convert unreviewed web claims into canonical healthcare truth.
