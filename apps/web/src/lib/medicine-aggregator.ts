/**
 * Federated medicine encyclopedia aggregator (browser-side helpers).
 *
 * Local Appwrite/catalog remains primary. Use `suggestExternalEnrichment`
 * when monograph fields are missing — calls public APIs from the client
 * or a thin backend proxy when CORS requires it.
 */

export type AggregatorSource =
  | "local"
  | "openfda"
  | "rxnorm"
  | "drugeye"
  | "moh_tariff"
  | "company";

export type AggregatorHit = {
  source: AggregatorSource | string;
  query: string;
  queried_at: string;
  name_en: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  indications_summary?: string | null;
  external_id?: string | null;
  confidence: number;
  source_url?: string | null;
  price_egp?: number | null;
};

export type MergedEnrichment = {
  query: string;
  name_en: { value: string; source: string; confidence: number } | null;
  scientific_name: { value: string; source: string; confidence: number } | null;
  manufacturer: { value: string; source: string; confidence: number } | null;
  drug_class: { value: string; source: string; confidence: number } | null;
  indications_summary: { value: string; source: string; confidence: number } | null;
  price_egp: { value: number; source: string; confidence: number } | null;
  sources_used: string[];
  top_confidence: number;
  links: { source: string; url: string; label: string | null }[];
};

export type LocalMedicineLike = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  current_price_egp?: number | null;
  image_url?: string | null;
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

/** OpenFDA — public API. */
export async function searchOpenFdaClient(
  query: string,
  limit = 5,
): Promise<AggregatorHit[]> {
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
    const res = await fetch(url);
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const data = await res.json();
    results = data.results || [];
    if (results.length) break;
  }
  const now = new Date().toISOString();
  return results.map((r: Record<string, unknown>) => {
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
      indications_summary: clip(first(r.indications_and_usage as string)),
      external_id: first(of.spl_set_id),
      confidence: 0.85,
      source_url: "https://open.fda.gov/apis/drug/label/",
    };
  });
}

/** RxNorm — public NIH API. */
export async function searchRxNormClient(
  query: string,
  limit = 8,
): Promise<AggregatorHit[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RxNorm ${res.status}`);
  const data = await res.json();
  const groups = data?.drugGroup?.conceptGroup || [];
  const now = new Date().toISOString();
  const hits: AggregatorHit[] = [];
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
        confidence: name.toLowerCase().includes(q.toLowerCase()) ? 0.85 : 0.6,
        source_url: p.rxcui
          ? `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${p.rxcui}`
          : "https://rxnav.nlm.nih.gov/",
      });
    }
  }
  return hits.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

export function mergeAggregatorHits(
  hits: AggregatorHit[],
  query: string,
): MergedEnrichment | null {
  if (!hits.length) return null;
  const sorted = [...hits].sort((a, b) => b.confidence - a.confidence);
  const pick = (field: keyof AggregatorHit) => {
    for (const h of sorted) {
      const v = h[field];
      if (v != null && String(v).trim() !== "") {
        return {
          value: v as string | number,
          source: String(h.source),
          confidence: h.confidence,
        };
      }
    }
    return null;
  };
  let price: MergedEnrichment["price_egp"] = null;
  for (const h of sorted) {
    if (h.price_egp != null) {
      price = {
        value: h.price_egp,
        source: String(h.source),
        confidence: h.confidence,
      };
      break;
    }
  }
  return {
    query,
    name_en: pick("name_en") as MergedEnrichment["name_en"],
    scientific_name: pick("scientific_name") as MergedEnrichment["scientific_name"],
    manufacturer: pick("manufacturer") as MergedEnrichment["manufacturer"],
    drug_class: pick("drug_class") as MergedEnrichment["drug_class"],
    indications_summary: pick(
      "indications_summary",
    ) as MergedEnrichment["indications_summary"],
    price_egp: price,
    sources_used: [...new Set(sorted.map((h) => String(h.source)))],
    top_confidence: sorted[0]?.confidence ?? 0,
    links: sorted
      .filter((h) => h.source_url)
      .slice(0, 6)
      .map((h) => ({
        source: String(h.source),
        url: String(h.source_url),
        label: h.name_en,
      })),
  };
}

/** Parallel OpenFDA + RxNorm (browser-safe). DrugEye stays server-side. */
export async function suggestExternalEnrichment(query: string): Promise<{
  hits: AggregatorHit[];
  merged: MergedEnrichment | null;
  errors: string[];
}> {
  const errors: string[] = [];
  const settled = await Promise.allSettled([
    searchOpenFdaClient(query),
    searchRxNormClient(query),
  ]);
  const hits: AggregatorHit[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") hits.push(...s.value);
    else errors.push(String(s.reason?.message || s.reason));
  }
  return { hits, merged: mergeAggregatorHits(hits, query), errors };
}

export function localNeedsEnrichment(local: LocalMedicineLike): string[] {
  const missing: string[] = [];
  if (!local.scientific_name) missing.push("scientific_name");
  if (!local.drug_class) missing.push("drug_class");
  if (local.current_price_egp == null || Number(local.current_price_egp) === 0) {
    missing.push("current_price_egp");
  }
  if (!local.image_url) missing.push("image_url");
  if (!local.manufacturer) missing.push("manufacturer");
  return missing;
}

export function fillMissingFromMerged(
  local: LocalMedicineLike,
  merged: MergedEnrichment | null,
): { patch: Partial<LocalMedicineLike>; provenance: Record<string, string> } {
  if (!merged) return { patch: {}, provenance: {} };
  const patch: Partial<LocalMedicineLike> = {};
  const provenance: Record<string, string> = {};
  const fill = (
    key: keyof LocalMedicineLike,
    slot: { value: string | number; source: string; confidence: number } | null,
  ) => {
    const cur = local[key];
    const empty =
      cur == null ||
      cur === "" ||
      (key === "current_price_egp" && (cur === 0 || cur === null));
    if (empty && slot) {
      (patch as Record<string, unknown>)[key] = slot.value;
      provenance[key] = `${slot.source}:${slot.confidence}`;
    }
  };
  fill("scientific_name", merged.scientific_name);
  fill("manufacturer", merged.manufacturer);
  fill("drug_class", merged.drug_class);
  fill("current_price_egp", merged.price_egp);
  return { patch, provenance };
}
