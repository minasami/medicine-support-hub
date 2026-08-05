import { searchWhoEmlLocal } from "./who-eml";

/**
 * Federated medicine encyclopedia aggregator (browser-side helpers).
 * Local Appwrite/catalog remains primary. Auto-enrich when fields missing.
 * Arabic + global encyclopedia link-outs with provenance.
 */

export type AggregatorSource =
  | "local"
  | "openfda"
  | "rxnorm"
  | "drugeye"
  | "moh_tariff"
  | "company"
  | "who_eml";

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

export type WorldSourceLink = {
  source: string;
  labelEn: string;
  labelAr: string;
  url: string;
  region: "global" | "arabic" | "egypt";
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

export function queryHasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

export function resolveAggregatorQueries(input: {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  freeText?: string | null;
}): { primary: string; arabic: string | null; scientific: string | null } {
  const en = (input.name_en || "").trim();
  const ar = (input.name_ar || "").trim();
  const sci = (input.scientific_name || "").trim();
  const free = (input.freeText || "").trim();
  const primary = en || sci || free || ar;
  const arabic = ar || (queryHasArabic(free) ? free : null);
  return { primary, arabic: arabic || null, scientific: sci || null };
}

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
      indications_summary: clip(first(r.indications_and_usage as unknown)),
      external_id: first(of.spl_set_id),
      confidence: 0.85,
      source_url: "https://open.fda.gov/apis/drug/label/",
    };
  });
}

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
  try {
    hits.push(...searchWhoEmlLocal(query, 5));
  } catch (e) {
    errors.push(String((e as Error)?.message || e));
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

export function buildWorldSourceLinks(
  query: string,
  scientificName?: string | null,
  opts?: { nameAr?: string | null; locale?: "en" | "ar" },
): WorldSourceLink[] {
  const primary = (query || "").trim();
  if (!primary && !(opts?.nameAr || "").trim()) return [];
  const qEn = encodeURIComponent(primary || scientificName || opts?.nameAr || "");
  const qAr = encodeURIComponent((opts?.nameAr || primary).trim());
  const inn = encodeURIComponent((scientificName || primary).trim());
  const qArRaw = (opts?.nameAr || primary).trim();

  const egypt: WorldSourceLink[] = [
    {
      source: "drugeye",
      labelEn: "DrugEye (Egypt)",
      labelAr: "DrugEye — مصر",
      url: "http://www.drugeye.pharorg.com/drugeyeapp/android-search/drugeye-android-live-go.aspx",
      region: "egypt",
    },
    {
      source: "eda_egypt",
      labelEn: "Egyptian Drug Authority",
      labelAr: "هيئة الدواء المصرية",
      url: `https://www.google.com/search?q=site%3Aedaegypt.gov.eg+${qEn}+OR+${qAr}`,
      region: "egypt",
    },
    {
      source: "msh_local",
      labelEn: "Medicine Support Hub (local)",
      labelAr: "منصة دعم الدواء (محلي)",
      url: `/medicines#q=${qEn}`,
      region: "egypt",
    },
  ];

  const arabic: WorldSourceLink[] = [
    {
      source: "altibbi",
      labelEn: "Altibbi (Arabic)",
      labelAr: "الطبي",
      url: `https://www.altibbi.com/search?q=${qAr}`,
      region: "arabic",
    },
    {
      source: "webteb",
      labelEn: "WebTeb (Arabic)",
      labelAr: "ويب طب",
      url: `https://www.webteb.com/search?q=${qAr}`,
      region: "arabic",
    },
    {
      source: "mawdoo3",
      labelEn: "Mawdoo3 health",
      labelAr: "موضوع — صحة",
      url: `https://www.google.com/search?q=site%3Amawdoo3.com+${qAr}+%D8%AF%D9%88%D8%A7%D8%A1`,
      region: "arabic",
    },
    {
      source: "almaany_medical",
      labelEn: "Almaany medical dictionary",
      labelAr: "المعاني — قاموس طبي",
      url: `https://www.almaany.com/ar/dict/ar-en/${encodeURIComponent(qArRaw)}/`,
      region: "arabic",
    },
    {
      source: "google_ar_medical",
      labelEn: "Arabic medical search",
      labelAr: "بحث طبي عربي",
      url: `https://www.google.com/search?hl=ar&q=${qAr}+(%D8%AF%D9%88%D8%A7%D8%A1+OR+%D9%85%D8%B3%D8%AA%D8%AD%D8%B6%D8%B1+OR+%D9%86%D8%B4%D8%B1%D8%A9)`,
      region: "arabic",
    },
  ];

  const global: WorldSourceLink[] = [
    {
      source: "openfda",
      labelEn: "OpenFDA / FDA labels",
      labelAr: "إدارة الغذاء والدواء الأمريكية",
      url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=BasicSearch.process&searchterm=${qEn}`,
      region: "global",
    },
    {
      source: "dailymed",
      labelEn: "DailyMed",
      labelAr: "DailyMed — النشرات الأمريكية",
      url: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${qEn}`,
      region: "global",
    },
    {
      source: "rxnorm",
      labelEn: "RxNorm (NIH)",
      labelAr: "RxNorm — توحيد الأسماء العلمية",
      url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=String&searchTerm=${qEn}`,
      region: "global",
    },
    {
      source: "pubchem",
      labelEn: "PubChem",
      labelAr: "PubChem — التركيب الكيميائي",
      url: `https://pubchem.ncbi.nlm.nih.gov/#query=${inn}`,
      region: "global",
    },
    {
      source: "drugbank",
      labelEn: "DrugBank",
      labelAr: "DrugBank",
      url: `https://go.drugbank.com/unearth/q?utf8=%E2%9C%93&searcher=drugs&query=${inn}`,
      region: "global",
    },
    {
      source: "ema",
      labelEn: "EMA (Europe)",
      labelAr: "وكالة الأدوية الأوروبية",
      url: `https://www.ema.europa.eu/en/search?search_api_fulltext=${qEn}`,
      region: "global",
    },
    {
      source: "who_eml",
      labelEn: "WHO Essential Medicines List",
      labelAr: "قائمة الأدوية الأساسية لمنظمة الصحة العالمية",
      url: `https://list.essentialmeds.org/?query=${qEn}`,
      region: "global",
    },
  ];

  return [...egypt, ...arabic, ...global];
}

export function worldSourceLabel(link: WorldSourceLink, locale: "en" | "ar"): string {
  return locale === "ar" ? link.labelAr : link.labelEn;
}

export function enrichmentPlan(missing: string[]): AggregatorSource[] {
  const plan: AggregatorSource[] = ["openfda", "rxnorm", "who_eml"];
  if (missing.includes("current_price_egp")) plan.push("drugeye", "moh_tariff");
  return plan;
}

const AUTO_ENRICH_CACHE = new Map<
  string,
  { at: number; merged: MergedEnrichment | null }
>();
const AUTO_ENRICH_TTL_MS = 30 * 60 * 1000;

/** Auto-run federated search when local critical fields are missing (30m tab cache). */
export async function autoEnrichIfNeeded(
  local: LocalMedicineLike,
  opts?: { force?: boolean },
): Promise<{
  ran: boolean;
  missing: string[];
  merged: MergedEnrichment | null;
  patch: Partial<LocalMedicineLike>;
  provenance: Record<string, string>;
  errors: string[];
}> {
  const missing = localNeedsEnrichment(local);
  const queries = resolveAggregatorQueries({
    name_en: local.name_en,
    name_ar: local.name_ar,
    scientific_name: local.scientific_name,
  });
  const key = (queries.primary || queries.arabic || "").toLowerCase();
  if (!key) {
    return { ran: false, missing, merged: null, patch: {}, provenance: {}, errors: [] };
  }
  const critical = missing.filter((m) => m !== "image_url");
  if (!opts?.force && critical.length === 0) {
    return { ran: false, missing, merged: null, patch: {}, provenance: {}, errors: [] };
  }

  const cached = AUTO_ENRICH_CACHE.get(key);
  if (!opts?.force && cached && Date.now() - cached.at < AUTO_ENRICH_TTL_MS) {
    const { patch, provenance } = fillMissingFromMerged(local, cached.merged);
    return {
      ran: true,
      missing,
      merged: cached.merged,
      patch,
      provenance,
      errors: [],
    };
  }

  const { merged, errors } = await suggestExternalEnrichment(
    queries.primary || queries.arabic || "",
  );
  AUTO_ENRICH_CACHE.set(key, { at: Date.now(), merged });
  const { patch, provenance } = fillMissingFromMerged(local, merged);
  return { ran: true, missing, merged, patch, provenance, errors };
}
