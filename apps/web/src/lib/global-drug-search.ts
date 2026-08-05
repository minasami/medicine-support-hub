/**
 * Global Drug Search API — federated client for medicine identity & labels.
 *
 * Sources (parallel, browser-safe, no API keys):
 *   - OpenFDA drug labels
 *   - RxNorm (exact + approximateTerm for typos)
 *   - WHO Essential Medicines List (local core subset)
 *   - PubChem (name → CID, optional)
 *
 * Egypt-local data (Appwrite, MOH tariff, DrugEye, company) stays primary
 * in the encyclopedia; this module is the world layer.
 *
 * Usage:
 *   const result = await globalDrugSearch("metformin", { limit: 8 });
 *   // result.hits, result.merged, result.who_essential, result.links, result.errors
 */

import {
  searchWhoEmlLocal,
  isLikelyWhoEssential,
  type WhoEmlHit,
} from "./who-eml";
import {
  buildWorldSourceLinks,
  mergeAggregatorHits,
  queryHasArabic,
  resolveAggregatorQueries,
  worldSourceLabel,
  type AggregatorHit,
  type MergedEnrichment,
  type WorldSourceLink,
} from "./medicine-aggregator";

export type GlobalSearchSource =
  | "openfda"
  | "rxnorm"
  | "who_eml"
  | "pubchem";

export type GlobalDrugHit = AggregatorHit & {
  dosage_form?: string | null;
  route?: string | null;
  rxcui?: string | null;
  pubchem_cid?: string | null;
  who_section?: string | null;
  who_list?: "core" | "complementary" | null;
};

export type GlobalDrugSearchOptions = {
  limit?: number;
  includePubChem?: boolean;
  includeWhoEml?: boolean;
  locale?: "en" | "ar";
  nameAr?: string | null;
  signal?: AbortSignal;
  offlineOnly?: boolean;
};

export type GlobalDrugSearchResult = {
  query: string;
  primary_query: string;
  arabic_query: string | null;
  scientific_hint: string | null;
  hits: GlobalDrugHit[];
  merged: MergedEnrichment | null;
  who_essential: boolean;
  who_hits: WhoEmlHit[];
  links: WorldSourceLink[];
  sources_queried: GlobalSearchSource[];
  sources_with_hits: string[];
  errors: string[];
  queried_at: string;
  duration_ms: number;
};

function first(arr: unknown): string | null {
  if (Array.isArray(arr) && arr.length) return String(arr[0]);
  if (typeof arr === "string") return arr;
  return null;
}

function clip(text: string | null, max = 400): string | null {
  if (!text) return null;
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function searchOpenFda(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GlobalDrugHit[]> {
  const q = query.trim();
  if (!q) return [];
  const escaped = q.replace(/"/g, "").trim();
  const attempts = [
    `openfda.brand_name:"${escaped}"`,
    `openfda.generic_name:"${escaped}"`,
    escaped,
  ];
  let results: Record<string, unknown>[] = [];
  for (const search of attempts) {
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=${limit}`;
    const res = await fetch(url, { signal });
    if (res.status === 404) continue;
    if (!res.ok) {
      if (res.status === 429) throw new Error("OpenFDA rate limited");
      continue;
    }
    const data = await res.json();
    results = data.results || [];
    if (results.length) break;
  }
  const now = new Date().toISOString();
  return results.map((r) => {
    const of = (r.openfda || {}) as Record<string, unknown>;
    const brand = first(of.brand_name);
    const generic = first(of.generic_name);
    return {
      source: "openfda" as const,
      query: q,
      queried_at: now,
      name_en: brand || generic,
      scientific_name: generic,
      manufacturer: first(of.manufacturer_name),
      drug_class: first(of.pharm_class_epc) || first(of.pharm_class_cs),
      indications_summary: clip(first(r.indications_and_usage as unknown)),
      external_id: first(of.spl_set_id),
      confidence: 0.85,
      source_url: "https://open.fda.gov/apis/drug/label/",
      dosage_form: first(of.dosage_form),
      route: first(of.route),
      rxcui: first(of.rxcui),
    };
  });
}

async function searchRxNormExact(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GlobalDrugHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxNorm ${res.status}`);
  const data = await res.json();
  const groups = data?.drugGroup?.conceptGroup || [];
  const now = new Date().toISOString();
  const hits: GlobalDrugHit[] = [];
  for (const g of groups) {
    for (const p of g.conceptProperties || []) {
      const name = String(p.name || "").trim();
      if (!name) continue;
      hits.push({
        source: "rxnorm",
        query: q,
        queried_at: now,
        name_en: name,
        scientific_name: null,
        manufacturer: null,
        drug_class: null,
        external_id: p.rxcui ? String(p.rxcui) : null,
        rxcui: p.rxcui ? String(p.rxcui) : null,
        confidence: name.toLowerCase().includes(q.toLowerCase()) ? 0.88 : 0.65,
        source_url: p.rxcui
          ? `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${p.rxcui}`
          : "https://rxnav.nlm.nih.gov/",
      });
    }
  }
  return hits.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

async function searchRxNormApproximate(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GlobalDrugHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=${Math.min(limit, 20)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxNorm approximate ${res.status}`);
  const data = await res.json();
  const candidates = data?.approximateGroup?.candidate || [];
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const hits: GlobalDrugHit[] = [];
  for (const c of candidates) {
    const rxcui = c.rxcui ? String(c.rxcui) : "";
    const name = String(c.name || "").trim();
    if (!rxcui || seen.has(rxcui)) continue;
    seen.add(rxcui);
    const raw = Number(c.score) || 0;
    const conf = Math.min(0.85, 0.5 + Math.min(raw, 20) / 40);
    hits.push({
      source: "rxnorm",
      query: q,
      queried_at: now,
      name_en: name || `RxCUI ${rxcui}`,
      scientific_name: null,
      manufacturer: null,
      drug_class: null,
      external_id: rxcui,
      rxcui,
      confidence: conf,
      source_url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rxcui}`,
    });
  }
  return hits.slice(0, limit);
}

async function searchRxNorm(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<GlobalDrugHit[]> {
  const exact = await searchRxNormExact(query, limit, signal);
  if (exact.length >= 2) return exact;
  try {
    const approx = await searchRxNormApproximate(query, limit, signal);
    const seen = new Set(exact.map((h) => h.rxcui || h.name_en || ""));
    const merged = [...exact];
    for (const h of approx) {
      const key = h.rxcui || h.name_en || "";
      if (key && seen.has(key)) continue;
      seen.add(key);
      merged.push(h);
    }
    return merged.slice(0, limit);
  } catch {
    return exact;
  }
}

async function searchPubChem(
  query: string,
  signal?: AbortSignal,
): Promise<GlobalDrugHit[]> {
  const q = query.trim();
  if (!q || queryHasArabic(q)) return [];
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/cids/JSON`;
  const res = await fetch(url, { signal });
  if (res.status === 404) return [];
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`PubChem ${res.status}`);
  }
  const data = await res.json();
  const cids: number[] = data?.IdentifierList?.CID || [];
  if (!cids.length) return [];
  const cid = String(cids[0]);
  const now = new Date().toISOString();
  return [
    {
      source: "pubchem",
      query: q,
      queried_at: now,
      name_en: q,
      scientific_name: q,
      manufacturer: null,
      drug_class: null,
      external_id: cid,
      pubchem_cid: cid,
      confidence: 0.75,
      source_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
    },
  ];
}

export async function globalDrugSearch(
  input: string,
  opts: GlobalDrugSearchOptions = {},
): Promise<GlobalDrugSearchResult> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 25);
  const locale = opts.locale ?? "en";
  const includePubChem = opts.includePubChem !== false;
  const includeWhoEml = opts.includeWhoEml !== false;
  const offlineOnly = opts.offlineOnly === true;
  const signal = opts.signal;

  const resolved = resolveAggregatorQueries({
    freeText: input,
    name_ar: opts.nameAr,
  });
  const primary =
    resolved.primary && !queryHasArabic(resolved.primary)
      ? resolved.primary
      : resolved.scientific || resolved.primary || input.trim();

  const sourcesQueried: GlobalSearchSource[] = [];
  const errors: string[] = [];
  const hits: GlobalDrugHit[] = [];
  let whoHits: WhoEmlHit[] = [];

  if (includeWhoEml) {
    sourcesQueried.push("who_eml");
    try {
      whoHits = searchWhoEmlLocal(primary || input, 5);
      for (const w of whoHits) {
        hits.push({
          ...w,
          who_section: w.section || null,
          who_list: null,
        });
      }
    } catch (e) {
      errors.push(`who_eml: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!offlineOnly && primary) {
    const tasks: Array<Promise<void>> = [];

    sourcesQueried.push("openfda");
    tasks.push(
      (async () => {
        try {
          hits.push(...(await searchOpenFda(primary, limit, signal)));
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          errors.push(`openfda: ${e instanceof Error ? e.message : String(e)}`);
        }
      })(),
    );

    sourcesQueried.push("rxnorm");
    tasks.push(
      (async () => {
        try {
          hits.push(...(await searchRxNorm(primary, limit, signal)));
        } catch (e) {
          if ((e as Error)?.name === "AbortError") return;
          errors.push(`rxnorm: ${e instanceof Error ? e.message : String(e)}`);
        }
      })(),
    );

    if (includePubChem) {
      sourcesQueried.push("pubchem");
      tasks.push(
        (async () => {
          try {
            hits.push(...(await searchPubChem(primary, signal)));
          } catch (e) {
            if ((e as Error)?.name === "AbortError") return;
            const msg = e instanceof Error ? e.message : String(e);
            if (!msg.includes("404")) errors.push(`pubchem: ${msg}`);
          }
        })(),
      );
    }

    await Promise.all(tasks);
  }

  hits.sort((a, b) => {
    const whoBoost = (h: GlobalDrugHit) => (h.source === "who_eml" ? 0.05 : 0);
    return b.confidence + whoBoost(b) - (a.confidence + whoBoost(a));
  });

  const merged = mergeAggregatorHits(hits, primary || input.trim());
  const whoEssential =
    whoHits.length > 0 || isLikelyWhoEssential(primary || input, 85);

  const links = buildWorldSourceLinks(primary || input.trim(), merged?.scientific_name?.value, {
    nameAr: opts.nameAr || resolved.arabic,
    locale,
  });

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    query: input.trim(),
    primary_query: primary || input.trim(),
    arabic_query: resolved.arabic,
    scientific_hint: resolved.scientific,
    hits,
    merged,
    who_essential: whoEssential,
    who_hits: whoHits,
    links,
    sources_queried: sourcesQueried,
    sources_with_hits: [...new Set(hits.map((h) => String(h.source)))],
    errors,
    queried_at: new Date().toISOString(),
    duration_ms: Math.round(t1 - t0),
  };
}

export async function globalDrugIdentity(
  query: string,
  opts?: GlobalDrugSearchOptions,
): Promise<{
  inn: string | null;
  drug_class: string | null;
  manufacturer: string | null;
  who_essential: boolean;
  sources: string[];
  links: WorldSourceLink[];
}> {
  const r = await globalDrugSearch(query, { ...opts, limit: 5 });
  return {
    inn: r.merged?.scientific_name?.value ?? null,
    drug_class: r.merged?.drug_class?.value ?? null,
    manufacturer: r.merged?.manufacturer?.value ?? null,
    who_essential: r.who_essential,
    sources: r.sources_with_hits,
    links: r.links,
  };
}

export { worldSourceLabel };
export type { WorldSourceLink, MergedEnrichment, AggregatorHit };
