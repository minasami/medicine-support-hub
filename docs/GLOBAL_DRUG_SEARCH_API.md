# Global Drug Search API

Federated client API for world-layer medicine identity. Egypt-local Appwrite / MOH / company data remains primary in the encyclopedia; this module is the open-web complement.

## Entry point

```ts
import {
  globalDrugSearch,
  globalDrugIdentity,
} from "@/lib/global-drug-search";

const result = await globalDrugSearch("metformin", {
  limit: 8,
  locale: "en",
  includePubChem: true,
  includeWhoEml: true,
});
```

## Sources (parallel)

| Source | Network | Role |
|--------|---------|------|
| **OpenFDA** | Yes | US labels: brand, generic, manufacturer, class, indications |
| **RxNorm** | Yes | NIH nomenclature: exact `drugs.json` + `approximateTerm` for typos |
| **WHO EML** | No (local) | Essential-list flag + therapeutic section |
| **PubChem** | Yes | Name → CID for chemical identity |

No API keys required. CORS-friendly public endpoints.

## Options

```ts
type GlobalDrugSearchOptions = {
  limit?: number;              // per network source, default 8
  includePubChem?: boolean;    // default true
  includeWhoEml?: boolean;     // default true
  locale?: "en" | "ar";
  nameAr?: string | null;      // for Arabic encyclopedia links
  signal?: AbortSignal;
  offlineOnly?: boolean;       // WHO-only
};
```

## Response shape

```ts
type GlobalDrugSearchResult = {
  query: string;
  primary_query: string;       // Latin/INN preferred for global APIs
  arabic_query: string | null;
  hits: GlobalDrugHit[];       // sorted by confidence (WHO boosted)
  merged: MergedEnrichment | null;
  who_essential: boolean;
  who_hits: WhoEmlHit[];
  links: WorldSourceLink[];    // Egypt + Arabic + global link-outs
  sources_queried: string[];
  sources_with_hits: string[];
  errors: string[];
  duration_ms: number;
};
```

## Convenience

```ts
const id = await globalDrugIdentity("aspirin");
// { inn, drug_class, manufacturer, who_essential, sources, links }
```

## UI wiring

- **`/world-search`** — uses `globalDrugSearch` (cancelable, duration badge, WHO card, RxCUI/CID chips)
- **Enrichment panel** — continues to use `autoEnrichIfNeeded` / `suggestExternalEnrichment` (aggregator); both share WHO EML + merge logic
- **Monograph** — WHO Essential badge via `isLikelyWhoEssential` / `searchWhoEmlLocal`

## Provenance policy

- Never silently overwrite local / company / MOH fields
- External data only fills empty slots via `fillMissingFromMerged`
- Every applied field records `source:confidence`

## Deploy

Place under `apps/web/src/lib/global-drug-search.ts` and ensure imports resolve:

- `./who-eml`
- `./medicine-aggregator`

Then rebuild the web app / Appwrite Site.
