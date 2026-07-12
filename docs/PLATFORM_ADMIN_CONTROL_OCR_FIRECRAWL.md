# Platform Administration, OCR, Firecrawl, and Medicine Search

## Purpose

The platform control center at `/admin/control-center` gives an authorized platform administrator one governed workspace for:

- public and private platform settings;
- customization and feature switches;
- approval-queue visibility;
- document OCR;
- medicine and pharmaceutical-company web ingestion;
- scheduled source refresh;
- promotion of reviewed evidence into existing moderation queues.

The active founder account is authorized through the normal `profiles.role` and `private.is_platform_admin()` controls. Email address alone never grants administrator access.

## Settings model

`platform_settings` stores non-secret configuration only. Every value change creates a row in `platform_setting_history`.

Settings marked `is_public=true` can be read through `platform_public_settings_v1`. Private settings remain protected by row-level security.

The database rejects setting keys containing secret-like names such as `api_key`, `token`, `password`, `credential`, `private_key`, or `service_role`.

Provider credentials must remain in Vercel environment variables.

## Required Vercel environment variables

### Google Enterprise Document OCR

- `GOOGLE_DOCUMENT_AI_PROJECT_ID`
- `GOOGLE_DOCUMENT_AI_LOCATION`
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- Optional: `OCR_MAX_FILE_MB` — defaults to 3 MB and is capped at 8 MB for direct uploads.

The service account should have only the minimum Document AI permissions required to process documents.

### Firecrawl

- `FIRECRAWL_API_KEY`

Manual administrator scraping and crawling require this key.

### Scheduled Firecrawl sync

- `FIRECRAWL_API_KEY`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is used only by the protected server-side cron worker. It must never use a `VITE_` prefix or appear in browser code.

### Existing image search

- `BING_IMAGE_SEARCH_KEY`
- Optional: `BING_IMAGE_SEARCH_ENDPOINT`

## OCR workflow

1. An administrator uploads a supported PDF or image from the control center.
2. The browser sends the document directly to `/api/admin-ocr` over HTTPS.
3. The server validates administrator access, MIME type, and file size.
4. A SHA-256 fingerprint and private processing job are created.
5. The document bytes are sent to Google Enterprise Document OCR.
6. Raw uploaded bytes are not written to Supabase.
7. Extracted text, paragraph blocks, detected languages, page count, image-quality score, defects, provider, and provenance are stored in `document_ocr_jobs`.
8. The extraction remains pending until an administrator approves or rejects it.

OCR output is evidence extraction, not clinical validation. Do not use it as an autonomous medication order, diagnosis, regulatory approval, insurance decision, or verified price.

## Firecrawl source workflow

1. Add an HTTPS source to `web_ingestion_sources` from the control center.
2. Choose `medicine` or `company`.
3. Link an existing canonical medicine ID or verified company slug when known.
4. Choose a single-page scrape or a bounded crawl.
5. Set include paths, exclude paths, page limit, refresh interval, and scheduling state.
6. Run the source manually or enable scheduled sync.
7. Firecrawl returns attributed page content and structured extraction.
8. The server checks that every returned URL remains within the approved domain.
9. Results enter `web_ingestion_candidates` with a content hash and confidence score.
10. An administrator approves or rejects each candidate.
11. Approved linked medicine evidence is routed into `medicine_collaboration_submissions`.
12. Approved linked company evidence is routed into `industry_company_contributions`.
13. The existing medicine/company moderator must still review it before publication.

Firecrawl never writes directly into the canonical medicine catalog or public company profile.

## Automatic sync

The production cron invokes `/api/firecrawl-cron` daily at 02:15 UTC.

The worker:

- validates `Authorization: Bearer <CRON_SECRET>`;
- polls up to ten running crawl jobs;
- starts no more than two due sources per run;
- respects each source's page limit and allow-listed domain;
- creates private candidates only;
- does not publish content.

Automatic sync also requires both settings below to be true:

- `firecrawl.enabled`
- `firecrawl.automatic_sync`

This provides an administrator-controlled cost and risk kill switch.

## Source governance

Before adding a source, confirm:

- the site permits the intended automated access;
- robots.txt, terms, copyright, database rights, and local laws are respected;
- the page is an appropriate authoritative or attributable source;
- no patient data, credentials, private portals, or paywalled content are targeted;
- crawl paths and page limits are narrowly scoped;
- the refresh interval matches how often the source changes.

## Medicine search v4

`search_medicine_encyclopedia_v4` preserves v3 compatibility while adding:

- exact barcode and product-code priority;
- exact commercial-name priority;
- phrase matching;
- multi-term all/any matching;
- fuzzy spelling similarity;
- partial manufacturer, class, route, category, and scientific-name filters;
- source-system filter;
- image availability filter;
- minimum completeness filter;
- price, verification, price-history, and marketplace filters;
- match-reason and matched-term metadata;
- best-match ordering that combines relevance, completeness, image authenticity, and source connectivity.

The public page reads safe defaults from `platform_public_settings_v1` and stores active search state in the URL for sharing and navigation.

## Approval command center

`platform_approval_summary_v1` connects these queues:

- Founder CRM
- Company profile claims
- Company contributions
- Medicine contributions
- Seller applications
- Marketplace offers
- Medicine enrichments
- Medicine image candidates
- OCR documents
- Firecrawl web candidates

The summary is private and available only to authenticated platform administrators.

## Security tests

Before release, verify:

- anonymous users cannot read OCR jobs, crawl sources, jobs, candidates, setting history, or approval summaries;
- anonymous users cannot execute candidate-review RPCs;
- public users can read only settings marked public;
- private administrator routes return `noindex`, `nofollow`, `noarchive`, and `private, no-store`;
- OCR and Firecrawl endpoints reject missing or non-admin sessions;
- cron rejects an incorrect secret;
- crawled result URLs outside the allowed domain are rejected;
- all automated data remains pending until human review;
- no provider secret is present in browser bundles, logs, database values, or API responses.

## Release positioning

The platform can state that it provides managed OCR and governed web-data ingestion capabilities when the corresponding provider credentials are configured.

It should not claim that OCR is infallible, that crawled data is automatically verified, or that automated extraction establishes medical, commercial, or regulatory truth.
