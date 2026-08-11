# Adaptive, Self-Healing Platform Layer

Medicine Support Hub includes a **client-side evolutionary control plane** that adapts ranking and data-path healing from real user needs — without autonomously rewriting production source code (unsafe for a medicine catalog).

## What “self-evolving” means here

| Capability | Mechanism |
|------------|-----------|
| **Self-healing** | `withSelfHealing()` retries Appwrite calls with backoff, then static/fallback paths; logs recoveries |
| **Evolving rank** | Genome weights mutate when fitness (search success + top-3 clicks + heal rate) is weak |
| **Learned queries** | Empty search → successful reformulation within 90s becomes a query alias |
| **Signals** | Privacy-preserving events in `localStorage` (search, click rank, healing) |

## What it deliberately does *not* do

- Does **not** auto-deploy code or change clinical/price facts without a human workflow
- Does **not** train a black-box model on PHI on-device beyond local signals
- Does **not** bypass company portfolio authorization

## Modules

```
apps/web/src/lib/adaptive/
  platform-genome.ts    # genes: rank weights, healing policy, aliases
  user-signals.ts       # event bus + fitness counters
  evolution-engine.ts   # selection / mutation schedule
  self-healing.ts       # retry + fallback runner
  adaptive-rank.ts      # genome-aware ranking + query resolve
  index.ts              # public API
```

## Wire into encyclopedia (example)

```ts
import {
  adaptiveRankMedicineResults,
  recordAdaptiveEvent,
  resolveAdaptiveQuery,
  withSelfHealing,
} from "@/lib/adaptive";

// Before fetch
const { primary, variants } = resolveAdaptiveQuery(query);

// Fetch with healing
const page = await withSelfHealing({
  label: "medicines-page",
  primary: () => fetchMedicinesPage({ filters: { query: primary } }),
  fallback: () => fetchMedicinesPage({ filters: { query: variants[1] || primary } }),
});

// Rank
const items = adaptiveRankMedicineResults(page.data.items, primary);

// Signals
recordAdaptiveEvent({
  type: items.length ? "search_success" : "search_empty",
  query: primary,
});

// On monograph click
recordAdaptiveEvent({ type: "result_click", query: primary, rank: index + 1, canonicalId });
```

## Evolution schedule

- At least **12** aggregated signals
- At most once every **6 hours** per browser profile
- Mutation intensity higher when fitness < 0.45

## Future server component (optional)

Aggregate anonymized alias candidates and healing rates in Appwrite Functions; promote curated aliases into `expand-search-query.ts` via PR — still human-gated for catalog integrity.
