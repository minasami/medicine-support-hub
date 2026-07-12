# Governed Firecrawl automation

## Security action required

Any Firecrawl credential pasted into chat, an issue, a commit, a screenshot, or a client-side log must be treated as exposed. Revoke it in the Firecrawl dashboard and create a replacement. Store the replacement only as the server-side Vercel environment variable `FIRECRAWL_API_KEY`.

Never place provider keys in `VITE_*` variables, browser code, public platform settings, GitHub files, URLs, logs, or public database content.

## Supported provider modes

Medicine Support Hub uses one server-side adapter for either provider mode.

### Firecrawl Cloud

```text
FIRECRAWL_API_BASE_URL=https://api.firecrawl.dev
FIRECRAWL_API_VERSION=v2
FIRECRAWL_API_KEY=<rotated cloud key>
```

Cloud mode always requires the API key.

### Separately deployed self-hosted Firecrawl

```text
FIRECRAWL_API_BASE_URL=https://firecrawl.internal.example
FIRECRAWL_API_VERSION=v1
FIRECRAWL_REQUIRE_AUTH=true
FIRECRAWL_API_KEY=<self-hosted bearer key>
```

A self-hosted endpoint may omit the key only when it is intentionally deployed without Bearer authentication. Production endpoints must use HTTPS. Plain HTTP is accepted only for explicitly enabled localhost development.

The Firecrawl source tree is not copied into the Medicine Support Hub application repository. Firecrawl is a separate crawling service with its own browser workers, queues, persistence, scaling, operations, and AGPL obligations. Keeping it separately deployed prevents the healthcare application from becoming responsible for an unrelated crawler runtime and allows cloud and self-hosted providers to be exchanged without changing ingestion governance.

## Automation flow

1. A platform administrator registers an HTTPS source and approved domain in `/admin/control-center`.
2. The administrator chooses medicine or company evidence, scrape or crawl mode, path restrictions, page limit, refresh interval, and optional canonical target.
3. Manual runs or the Vercel cron call Firecrawl through the server-side adapter.
4. Returned pages are checked against the source domain allow-list.
5. Structured facts, source metadata, an excerpt, hash, and confidence score are saved as private candidates.
6. Candidates remain pending until a platform administrator reviews them.
7. Approved candidates enter the existing medicine or company contribution queue; they do not publish directly.
8. Existing moderation, attribution, duplicate handling, and canonical-product rules decide whether the evidence becomes public.
9. The medicine search index is refreshed through its service-role-only refresh function.

## Scheduling

The production cron remains intentionally bounded. It polls at most ten running crawl jobs and starts at most two due sources per run. It respects `firecrawl.enabled`, `firecrawl.automatic_sync`, source-level scheduling, page limits, and refresh intervals. Automated publication remains disabled.

Automatic synchronization is disabled by default. Enable it from the control center only after `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and the selected Firecrawl provider are configured and tested.

## Required release validation

- Anonymous users cannot read sources, jobs, or candidates.
- Normal authenticated users cannot create, run, or approve ingestion.
- Only active platform administrators can manage sources and manual runs.
- Crawl responses outside the approved domain are rejected.
- Page limits remain between 1 and 250.
- Duplicates are ignored by source, URL, and content hash.
- Human review remains mandatory.
- The private materialized medicine search index has no public table grants.
- Public search works only through the fixed v4/v3 RPC projections.
- Runtime logs never include provider keys or full private provider responses.
