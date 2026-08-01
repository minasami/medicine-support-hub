# Manufacturer stock CSV import

## Unmatched row storage

**Unmatched does not mean discarded.** When a row has no encyclopedia `canonical_id`, it is still written as a full lot document (if Appwrite accepts the write).

### Fields stored for every successful lot (matched or unmatched)

| Field | Matched example | Unmatched example |
|-------|-----------------|-------------------|
| `batch_id` | batch uuid | same |
| `company_slug` | `eva-pharma` | `eva-pharma` |
| `item_code` | `FP-PD-560.12` | `FP-PD-560.12` |
| `item_desc` | `ACTI -COLLA ADVANCE 30 SACHETS` | same |
| `lot_no` | `2404094` | same (omitted if empty) |
| `list_price_egp` | `860` | same (omitted if empty) |
| `expiry_date` | ISO string | same |
| `po_category` | `Local` / `Export` | same |
| `quantity` | if present in CSV | same |
| `canonical_id` | e.g. `12345` | **omitted / null** |
| `match_method` | `exact_name` / `fuzzy_name` / … | **`unmatched`** |
| `match_confidence` | `0.65–1.0` | **`0`** |
| `near_expire` / `is_expired` | from expiry | same |

### What unmatched is used for

1. **Company portfolio** — code + name + price from the ERP dump on `/account` and local portfolio mirror.
2. **Stock history** — batch + lots queryable by `company_slug` in Appwrite.
3. **Later linking** — re-run matching or admin map SKU → `canonical_id` without re-uploading prices/lots.

### What unmatched does *not* do

- Does **not** update public encyclopedia cards by live ID (no `canonical_id`).
- Does **not** set provenance on a medicine row until linked.
- Failed **writes** (rate limit / validation) are different: those lots are **not** stored at all.

---

## Appwrite rate limits (createDocument)

Official client docs for **POST** `/databases/{databaseId}/collections/{collectionId}/documents`:

| Window | Limit | Key |
|--------|-------|-----|
| **1 minute** | **120 requests** | IP + METHOD + URL + USER ID |

Sources: [Appwrite Databases API – createDocument rate limits](https://appwrite.io/docs/references/cloud/client-web/databases), [Rate limits overview](https://appwrite.io/docs/advanced/security/rate-limits).

### Impact on Eva-size imports (~2600 rows)

- 2600 creates ≫ 120/min → without throttling, most calls hit **429** after the first ~120 successful writes per minute.
- Concurrent pool of 12 multiplies burst pressure; current code uses **concurrency 4** and exponential backoff on 429.
- Practical throughput ≈ **~100–120 successful lot writes per minute per user/IP** under the published limit.
- Full 2599-row publish may take **~20–30+ minutes** of sustained writing, or should be **split into chunks** (e.g. 100–150 rows per publish click).

### Mitigations in product code

1. `WRITE_CONCURRENCY = 4`
2. Retry up to 5 times with longer backoff on 429
3. Omit null optional attributes (fewer validation failures mistaken for rate limits)
4. UI surfaces sample error text

### Future options

- **Appwrite Bulk API** (announced 2025): create many documents in one request — preferred long-term for ERP dumps.
- **Server-side Function** with API key (higher / different limits than browser user key).
- **Chunked UI**: “Publish next 150 unmatched rows” against the same batch.

Cloud **monthly** write quotas (billing) are separate from the **per-minute** abuse rate limit; both can matter at scale.

---

## Product name matching (overview)

Order of attempts:

1. Exact / normalized **item code** (rare for Eva internal `FP-…` codes)
2. Exact / normalized / prefix **trade name** after stripping market suffixes (`FOR LIBYA`, `(OCTOBER)`, `UPA`, …)
3. **Brand-token** gate: first significant token (e.g. `ACTI`, `CONVENTIN`) must appear in candidate
4. Fuzzy Levenshtein + token Jaccard on stripped names

Eva descriptions often include export destinations and pack sizes; stripping and brand-first matching are required for acceptable link rates. Unmatched storage remains valid for portfolio even when link rate is low.
