import {
  searchWhoEmlLocal,
  isLikelyWhoEssential,
  type WhoEmlHit,
} from "./who-eml";

/** Re-export for UI consumers (monograph badge, world search). */
export { searchWhoEmlLocal, isLikelyWhoEssential };
export type { WhoEmlHit };

/**
 * Federated medicine encyclopedia aggregator (browser-side helpers).
 * Local Appwrite/catalog remains primary. Auto-enrich when fields missing.
 * Arabic + global encyclopedia link-outs with provenance.
 */

export type AggregatorSource =
  | "openfda"
  | "rxnorm"
  | "pubchem"
  | "who_eml"
  | "drugeye"
  | "local";

export type AggregatorHit = {
  source: AggregatorSource;
  query: string;
  queried_at: string;
  name_en: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  indications_summary: string | null;
  external_id: string | null;
  confidence: number;
  source_url: string | null;
  price_egp: number | null;
  section?: string | null;
  rxcui?: string | null;
  pubchem_cid?: number | null;
};

export type MergedEnrichment = {
  scientific_name?: string;
  drug_class?: string;
  indications_summary?: string;
  manufacturer?: string;
  who_essential?: boolean;
  external_ids?: Record<string, string>;
};

export type LocalMedicineLike = {
  id?: string;
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  indications?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

export type WorldSourceLink = {
  source: AggregatorSource | string;
  label_en: string;
  label_ar: string;
  url: string;
};

export function queryHasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

export function resolveAggregatorQueries(input: {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
}): string[] {
  const out: string[] = [];
  for (const k of [input.scientific_name, input.name_en, input.name_ar]) {
    const t = (k || "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export async function searchOpenFdaClient(
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<AggregatorHit[]> {
  const q = (query || "").trim();
  if (!q) return [];
  const now = new Date().toISOString();
  try {
    const url =
      "https://api.fda.gov/drug/label.json?search=" +
      encodeURIComponent(
        `openfda.brand_name:"${q}"+OR+openfda.generic_name:"${q}"`
      ) +
      `&limit=${limit}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        openfda?: {
          brand_name?: string[];
          generic_name?: string[];
          manufacturer_name?: string[];
          substance_name?: string[];
          pharm_class_epc?: string[];
        };
        indications_and_usage?: string[];
        id?: string;
      }>;
    };
    return (data.results || []).map((r) => {
      const of = r.openfda || {};
      return {
        source: "openfda" as const,
        query: q,
        queried_at: now,
        name_en: of.brand_name?.[0] || of.generic_name?.[0] || null,
        scientific_name: of.generic_name?.[0] || of.substance_name?.[0] || null,
        manufacturer: of.manufacturer_name?.[0] || null,
        drug_class: of.pharm_class_epc?.[0] || null,
        indications_summary: r.indications_and_usage?.[0]?.slice(0, 400) || null,
        external_id: r.id || null,
        confidence: 0.75,
        source_url: "https://www.accessdata.fda.gov/scripts/cder/daf/",
        price_egp: null,
      };
    });
  } catch {
    return [];
  }
}

export async function searchRxNormClient(
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<AggregatorHit[]> {
  const q = (query || "").trim();
  if (!q) return [];
  const now = new Date().toISOString();
  try {
    const url =
      "https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=" +
      encodeURIComponent(q) +
      `&maxEntries=${limit}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      approximateGroup?: {
        candidate?: Array<{ rxcui?: string; name?: string; score?: string }>;
      };
    };
    const cands = data.approximateGroup?.candidate || [];
    return cands.slice(0, limit).map((c) => ({
      source: "rxnorm" as const,
      query: q,
      queried_at: now,
      name_en: c.name || null,
      scientific_name: c.name || null,
      manufacturer: null,
      drug_class: null,
      indications_summary: null,
      external_id: c.rxcui || null,
      confidence: Math.min(0.95, Number(c.score || 0) / 100 || 0.6),
      source_url: c.rxcui
        ? `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${c.rxcui}`
        : "https://mor.nlm.nih.gov/RxNav/",
      price_egp: null,
      rxcui: c.rxcui || null,
    }));
  } catch {
    return [];
  }
}

export function mergeAggregatorHits(hits: AggregatorHit[]): MergedEnrichment {
  const merged: MergedEnrichment = { external_ids: {} };
  const byConf = [...hits].sort((a, b) => b.confidence - a.confidence);
  for (const h of byConf) {
    if (h.scientific_name && !merged.scientific_name) merged.scientific_name = h.scientific_name;
    if (h.drug_class && !merged.drug_class) merged.drug_class = h.drug_class;
    if (h.indications_summary && !merged.indications_summary)
      merged.indications_summary = h.indications_summary;
    if (h.manufacturer && !merged.manufacturer) merged.manufacturer = h.manufacturer;
    if (h.source === "who_eml") merged.who_essential = true;
    if (h.external_id && merged.external_ids) {
      merged.external_ids[h.source] = h.external_id;
    }
  }
  return merged;
}

export async function suggestExternalEnrichment(query: string): Promise<{
  hits: AggregatorHit[];
  errors: string[];
}> {
  const q = (query || "").trim();
  if (!q) return { hits: [], errors: [] };
  const errors: string[] = [];
  const who = searchWhoEmlLocal(q, 5, 70);
  let openfda: AggregatorHit[] = [];
  let rxnorm: AggregatorHit[] = [];
  try {
    openfda = await searchOpenFdaClient(q, 4);
  } catch (e) {
    errors.push(`openfda: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    rxnorm = await searchRxNormClient(q, 4);
  } catch (e) {
    errors.push(`rxnorm: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { hits: [...who, ...openfda, ...rxnorm], errors };
}

export function localNeedsEnrichment(local: LocalMedicineLike): string[] {
  const missing: string[] = [];
  if (!(local.scientific_name || "").trim()) missing.push("scientific_name");
  if (!(local.drug_class || "").trim()) missing.push("drug_class");
  if (!(local.indications || local.description || "").toString().trim())
    missing.push("indications");
  if (!(local.manufacturer || "").trim()) missing.push("manufacturer");
  return missing;
}

export function fillMissingFromMerged(
  local: LocalMedicineLike,
  merged: MergedEnrichment
): { patch: Record<string, string | boolean>; provenance: Record<string, string> } {
  const patch: Record<string, string | boolean> = {};
  const provenance: Record<string, string> = {};
  if (!(local.scientific_name || "").trim() && merged.scientific_name) {
    patch.scientific_name = merged.scientific_name;
    provenance.scientific_name = "federated:open_sources";
  }
  if (!(local.drug_class || "").trim() && merged.drug_class) {
    patch.drug_class = merged.drug_class;
    provenance.drug_class = "federated:open_sources";
  }
  if (
    !(local.indications || local.description || "").toString().trim() &&
    merged.indications_summary
  ) {
    patch.indications = merged.indications_summary;
    provenance.indications = "federated:open_sources";
  }
  if (!(local.manufacturer || "").trim() && merged.manufacturer) {
    patch.manufacturer = merged.manufacturer;
    provenance.manufacturer = "federated:open_sources";
  }
  if (merged.who_essential) {
    patch.who_essential = true;
    provenance.who_essential = "who_eml";
  }
  return { patch, provenance };
}

export function buildWorldSourceLinks(query: string): WorldSourceLink[] {
  const q = encodeURIComponent((query || "").trim() || "medicine");
  return [
    {
      source: "who_eml",
      label_en: "WHO Essential Medicines",
      label_ar: "قائمة الأدوية الأساسية",
      url: `https://list.essentialmeds.org/?query=${q}`,
    },
    {
      source: "openfda",
      label_en: "OpenFDA",
      label_ar: "OpenFDA",
      url: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${q}"`,
    },
    {
      source: "rxnorm",
      label_en: "RxNorm",
      label_ar: "RxNorm",
      url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=String&searchTerm=${q}`,
    },
    {
      source: "pubchem",
      label_en: "PubChem",
      label_ar: "PubChem",
      url: `https://pubchem.ncbi.nlm.nih.gov/#query=${q}`,
    },
  ];
}

export function worldSourceLabel(
  link: WorldSourceLink,
  locale: "en" | "ar"
): string {
  return locale === "ar" ? link.label_ar : link.label_en;
}

export function enrichmentPlan(missing: string[]): AggregatorSource[] {
  if (!missing.length) return [];
  return ["who_eml", "rxnorm", "openfda"];
}

export async function autoEnrichIfNeeded(
  local: LocalMedicineLike,
  opts?: { signal?: AbortSignal }
): Promise<{
  ran: boolean;
  missing: string[];
  merged: MergedEnrichment;
  patch: Record<string, string | boolean>;
  provenance: Record<string, string>;
  errors: string[];
}> {
  const missing = localNeedsEnrichment(local);
  if (!missing.length) {
    return {
      ran: false,
      missing,
      merged: {},
      patch: {},
      provenance: {},
      errors: [],
    };
  }
  const queries = resolveAggregatorQueries({
    name_en: local.name_en,
    name_ar: local.name_ar,
    scientific_name: local.scientific_name,
  });
  const q = queries[0] || local.name_en || local.name_ar || "";
  const { hits, errors } = await suggestExternalEnrichment(q);
  const merged = mergeAggregatorHits(hits);
  if (isLikelyWhoEssential(q)) merged.who_essential = true;
  const { patch, provenance } = fillMissingFromMerged(local, merged);
  return { ran: true, missing, merged, patch, provenance, errors };
}
