# Anonymized Adaptive Aggregation (Human-Gated)

Shared catalog rules (e.g. global typo expansions) change **only** after a human approves aggregated candidates and a promote script updates source control.

## Flow

```
Browser (local signals)
    → anonymized beacon (no user id / email)
        → Appwrite Function: adaptive-signal-aggregator
            → adaptive_alias_candidates (support counts)
                → human: list_pending → approve | reject
                    → adaptive_alias_decisions
                        → scripts/promote-approved-aliases.mjs
                            → expand-search-query.ts (commit + deploy)
```

## Collections (create in Appwrite Console)

Database: `medicine_support_hub`

### `adaptive_signal_daily`
| Attribute | Type |
|-----------|------|
| day_type_key | string, required, size 64 |
| day | string, required, size 16 |
| event_type | string, required, size 32 |
| count | integer, required |

Indexes: key on `day_type_key`, key on `day`

### `adaptive_alias_candidates`
| Attribute | Type |
|-----------|------|
| pair_key | string, required, size 140 |
| from_query | string, required, size 64 |
| to_query | string, required, size 64 |
| support | integer, required |
| status | string, required, size 32 (`accumulating` \| `pending_review` \| `approved` \| `rejected`) |
| first_seen | string, size 40 |
| last_seen | string, size 40 |
| reviewed_at | string, size 40, optional |
| reviewer | string, size 80, optional |

Indexes: unique key on `pair_key`; key on `status`

### `adaptive_alias_decisions`
| Attribute | Type |
|-----------|------|
| pair_key | string, required, size 140 |
| from_query | string, required, size 64 |
| to_query | string, required, size 64 |
| decision | string, required, size 16 |
| reviewer | string, size 80 |
| note | string, size 240, optional |
| decided_at | string, size 40 |
| promoted | boolean |

Indexes: key on `decision`; key on `promoted`

Permissions: **server API key only** (no public document read).

## Function env vars

| Variable | Purpose |
|----------|---------|
| `APPWRITE_API_KEY` | Server key with DB read/write |
| `APPWRITE_DATABASE_ID` | default `medicine_support_hub` |
| `ADAPTIVE_ADMIN_KEY` | Shared secret for approve/reject/list |
| `ADAPTIVE_MIN_SUPPORT` | default `3` before `pending_review` |

Deploy:

```bash
appwrite deploy function --function-id adaptive-signal-aggregator
# or Console → Functions → Create from appwrite.json
```

## Client

Set in Site env:

```
VITE_ADAPTIVE_FUNCTION_URL=https://<region>.cloud.appwrite.io/v1/functions/adaptive-signal-aggregator/executions
```

(Use your project’s function execution URL pattern.)

In app shell:

```ts
import { startAdaptiveBeacon } from "@/lib/adaptive/signal-beacon";
useEffect(() => startAdaptiveBeacon(120_000), []);
```

## Human review CLI examples

```bash
# Pending queue
curl -s -X POST "$ADAPTIVE_FUNCTION_URL" \
  -H "content-type: application/json" \
  -H "x-adaptive-key: $ADAPTIVE_ADMIN_KEY" \
  -d '{"action":"list_pending"}' | jq

# Approve one pair
curl -s -X POST "$ADAPTIVE_FUNCTION_URL" \
  -H "content-type: application/json" \
  -H "x-adaptive-key: $ADAPTIVE_ADMIN_KEY" \
  -d '{"action":"approve","fromQuery":"nortryptalin","toQuery":"nortriptyline","reviewer":"mina"}'

# Promote into codebase (still requires git commit)
ADAPTIVE_FUNCTION_URL=... ADAPTIVE_ADMIN_KEY=... \
  node scripts/promote-approved-aliases.mjs --dry-run
ADAPTIVE_FUNCTION_URL=... ADAPTIVE_ADMIN_KEY=... \
  node scripts/promote-approved-aliases.mjs
git add apps/web/src/lib/expand-search-query.ts && git commit -m "chore: promote approved search aliases" && git push
```

## Privacy notes

- Beacon sends only event type, normalized query text (max 64 chars), coarse rank bucket
- No account id, email, IP, or device id in payload
- Admin actions require `ADAPTIVE_ADMIN_KEY`
- Shared rules change only via **approve → promote script → git → deploy**
