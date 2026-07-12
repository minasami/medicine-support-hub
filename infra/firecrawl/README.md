# Firecrawl deployment for Medicine Support Hub

Medicine Support Hub supports two Firecrawl modes through the same governed ingestion pipeline.

## Recommended production mode: Firecrawl Cloud

Set these server-side Vercel environment variables:

```text
FIRECRAWL_API_BASE_URL=https://api.firecrawl.dev
FIRECRAWL_API_VERSION=v2
FIRECRAWL_API_KEY=<rotated server-side key>
CRON_SECRET=<strong random secret>
SUPABASE_SERVICE_ROLE_KEY=<server-side service key>
```

Never use a `VITE_` prefix for provider credentials. Never store provider keys in `platform_settings`, client code, Git history, logs, or database content.

## Optional self-hosted mode

Firecrawl is a separate multi-service system with API workers, Redis, PostgreSQL, Playwright/browser workers, and queue administration. It should be deployed as an independent service, not copied into the Vite/Vercel application bundle.

Use the official Firecrawl repository and its self-hosting instructions. Pin the upstream commit or release, preserve the upstream AGPL-3.0 licensing obligations, use strong database and queue-admin credentials, keep Redis and PostgreSQL private, and expose the API only through HTTPS.

Configure Medicine Support Hub with:

```text
FIRECRAWL_API_BASE_URL=https://firecrawl.example.org
FIRECRAWL_API_VERSION=v1
FIRECRAWL_REQUIRE_AUTH=false
```

For an authenticated self-hosted gateway, set:

```text
FIRECRAWL_REQUIRE_AUTH=true
FIRECRAWL_API_KEY=<gateway key>
```

`FIRECRAWL_ALLOW_INSECURE_LOCALHOST=true` is permitted only for local development with a localhost HTTP endpoint. It must not be enabled in production.

## Platform workflow

1. A platform administrator creates a narrowly scoped HTTPS source and allow-listed domain.
2. Manual or scheduled jobs call the configured Firecrawl endpoint.
3. Every returned URL is checked against the approved domain.
4. Extracted facts are stored as private candidates with content hashes, provenance, and confidence scores.
5. A platform administrator approves or rejects each candidate.
6. Approved evidence enters the existing medicine or company moderation queue.
7. It never publishes directly into canonical public records.
8. The medicine search index is refreshed after scheduled ingestion.

## Automation controls

The Vercel cron runs only when all of the following are true:

- `firecrawl.enabled` is `true`;
- `firecrawl.automatic_sync` is `true`;
- the configured Firecrawl endpoint is ready;
- `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are configured;
- an approved source is active, scheduled, and due.

Automation is intentionally bounded. It polls at most ten running jobs and starts at most two due sources per run. Automated publication remains disabled.

## Key rotation

Any key pasted into chat, an issue, a commit, or a screenshot should be treated as exposed. Revoke it in Firecrawl, create a replacement, and store the replacement only in the server-side environment.
