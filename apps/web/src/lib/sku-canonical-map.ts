/**
 * Map manufacturer SKUs (item codes) and trade names to encyclopedia canonical_id.
 * Sources: in-memory cache, Appwrite medicines (paginated), static Egyptian dataset.
 * Matching: exact → normalized → prefix → fuzzy (Levenshtein + token Jaccard).
 */

import { normalizeSearchTerm, stringSimilarity } from "./search-engine";

export type CatalogMatchCandidate = {
  canonical_id: number;
  name_en?: string | null;
  name_ar?: string | null;
  code?: string | null;
  barcode?: string | null;
  manufacturer?: string | null;
};

export type SkuMatchMethod =
  | "exact_code"
  | "exact_barcode"
  | "exact_name"
  | "normalized_name"
  | "prefix_name"
  | "fuzzy_name"
  | "fuzzy_code"
  | "unmatched";

export type SkuMatchResult = {
  canonical_id: number | null;
  match_method: SkuMatchMethod;
  confidence: number;
  matched_name?: string;
};

const FUZZY_NAME_THRESHOLD = 0.78;
const FUZZY_CODE_THRESHOLD = 0.88;
const FUZZY_TOKEN_THRESHOLD = 0.7;
/** Cap fuzzy candidates scanned per query for large catalogs. */
const FUZZY_SCAN_CAP = 4000;
const APPWRITE_PAGE_SIZE = 100;
const APPWRITE_MAX_PAGES = 40; // up to ~4000 live medicines

function normalizeCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

function nameKey(name: string): string {
  return normalizeSearchTerm(name).replace(/\s+/g, "");
}

/** Strip market suffixes like FOR LIBYA / FOR KSA / (OCTOBER) for matching. */
export function stripMarketSuffix(desc: string): string {
  return String(desc || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\bfor\s+(libya|sudan|yemen|iraq|ksa|kuwait|bahrain|oman|qatar|uae|china|uganda|rwanda|somalia|lebanon|djibouti|togo|guinea|kazakhstan|south\s+sudan|gaza|eu|uk|upa)\b.*$/i,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Core brand + form tokens without pure numeric strength fragments. */
export function coreProductTokens(desc: string): string[] {
  const stripped = stripMarketSuffix(desc);
  return normalizeSearchTerm(stripped)
    .split(" ")
    .filter((t) => t.length >= 2 && !/^\d+([.,]\d+)?(mg|ml|g|mcg|iu|%|tab|cap)?$/i.test(t))
    .slice(0, 6);
}

function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const t of a) if (setB.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

let catalogCache: CatalogMatchCandidate[] | null = null;
let codeIndex: Map<string, CatalogMatchCandidate> | null = null;
let nameIndex: Map<string, CatalogMatchCandidate> | null = null;
let nameEntries: { key: string; item: CatalogMatchCandidate; tokens: string[] }[] =
  [];
let codeKeys: string[] = [];

export function clearSkuCatalogCache() {
  catalogCache = null;
  codeIndex = null;
  nameIndex = null;
  nameEntries = [];
  codeKeys = [];
}

function buildIndexes(items: CatalogMatchCandidate[]) {
  catalogCache = items;
  codeIndex = new Map();
  nameIndex = new Map();
  nameEntries = [];
  codeKeys = [];

  for (const item of items) {
    if (item.code) {
      const c = normalizeCode(item.code);
      if (c && !codeIndex.has(c)) {
        codeIndex.set(c, item);
        codeKeys.push(c);
      }
    }
    if (item.barcode) {
      const b = normalizeCode(item.barcode);
      if (b && !codeIndex.has(b)) {
        codeIndex.set(b, item);
        codeKeys.push(b);
      }
    }
    if (item.name_en) {
      const k = nameKey(item.name_en);
      if (k && !nameIndex.has(k)) nameIndex.set(k, item);
      const stripped = nameKey(stripMarketSuffix(item.name_en));
      if (stripped && !nameIndex.has(stripped)) nameIndex.set(stripped, item);
      if (stripped) {
        nameEntries.push({
          key: stripped,
          item,
          tokens: coreProductTokens(item.name_en),
        });
      }
    }
    if (item.name_ar) {
      const k = nameKey(item.name_ar);
      if (k && !nameIndex.has(k)) nameIndex.set(k, item);
    }
  }
}

export async function loadStaticCatalogCandidates(): Promise<
  CatalogMatchCandidate[]
> {
  try {
    const res = await fetch("/data/egyptian-medicines-dataset.json");
    const data = await res.json();
    const list = Array.isArray(data?.medicines)
      ? data.medicines
      : Array.isArray(data)
        ? data
        : [];
    return list
      .filter((m: any) => m && (m.canonical_id || m.id))
      .map((m: any) => ({
        canonical_id: Number(m.canonical_id || m.id),
        name_en: m.name_en || m.name || null,
        name_ar: m.name_ar || null,
        code: m.code || m.item_code || null,
        barcode: m.barcode || null,
        manufacturer: m.manufacturer || m.raw_manufacturer || null,
      }));
  } catch {
    return [];
  }
}

export async function loadAppwriteCatalogCandidates(
  databases: {
    listDocuments: (
      db: string,
      col: string,
      queries?: string[],
    ) => Promise<{ documents: any[]; total?: number }>;
  } | null,
  databaseId: string,
  collectionId: string,
  options?: { manufacturerHint?: string },
): Promise<CatalogMatchCandidate[]> {
  if (!databases) return [];
  try {
    const { Query } = await import("appwrite");
    const all: CatalogMatchCandidate[] = [];
    let offset = 0;

    for (let page = 0; page < APPWRITE_MAX_PAGES; page++) {
      const queries = [Query.limit(APPWRITE_PAGE_SIZE), Query.offset(offset)];
      const res = await databases.listDocuments(databaseId, collectionId, queries);
      const docs = res.documents || [];
      if (!docs.length) break;

      for (const doc of docs) {
        const cid = Number(doc.canonical_id || 0);
        if (cid <= 0) continue;
        all.push({
          canonical_id: cid,
          name_en: doc.name_en || null,
          name_ar: doc.name_ar || null,
          code: doc.code || doc.item_code || null,
          barcode: doc.barcode || null,
          manufacturer: doc.manufacturer || null,
        });
      }

      if (docs.length < APPWRITE_PAGE_SIZE) break;
      offset += APPWRITE_PAGE_SIZE;
    }

    // Optional: boost order so manufacturer-matching rows are preferred in indexes
    const hint = (options?.manufacturerHint || "").toLowerCase();
    if (hint) {
      all.sort((a, b) => {
        const am = String(a.manufacturer || "").toLowerCase().includes(hint) ? 0 : 1;
        const bm = String(b.manufacturer || "").toLowerCase().includes(hint) ? 0 : 1;
        return am - bm;
      });
    }

    return all;
  } catch {
    return [];
  }
}

export async function ensureSkuCatalogIndex(options?: {
  databases?: any;
  databaseId?: string;
  medicinesCollectionId?: string;
  manufacturerHint?: string;
  forceReload?: boolean;
}): Promise<number> {
  if (catalogCache && codeIndex && nameIndex && !options?.forceReload) {
    return catalogCache.length;
  }

  const staticItems = await loadStaticCatalogCandidates();
  let appwriteItems: CatalogMatchCandidate[] = [];
  if (options?.databases && options.databaseId && options.medicinesCollectionId) {
    appwriteItems = await loadAppwriteCatalogCandidates(
      options.databases,
      options.databaseId,
      options.medicinesCollectionId,
      { manufacturerHint: options.manufacturerHint },
    );
  }

  // Prefer live Appwrite rows over static when same code/id
  const byKey = new Map<string, CatalogMatchCandidate>();
  for (const item of staticItems) {
    const key = item.code
      ? `c:${normalizeCode(item.code)}`
      : `id:${item.canonical_id}`;
    byKey.set(key, item);
  }
  for (const item of appwriteItems) {
    const key = item.code
      ? `c:${normalizeCode(item.code)}`
      : `id:${item.canonical_id}`;
    byKey.set(key, item);
  }
  buildIndexes([...byKey.values()]);
  return catalogCache?.length || 0;
}

function fuzzyMatchName(itemDesc: string): SkuMatchResult | null {
  const stripped = stripMarketSuffix(itemDesc);
  const sk = nameKey(stripped);
  if (sk.length < 5) return null;

  const queryTokens = coreProductTokens(itemDesc);
  let best: { score: number; item: CatalogMatchCandidate; key: string } | null =
    null;

  const scan = nameEntries.slice(0, FUZZY_SCAN_CAP);
  for (const entry of scan) {
    if (Math.abs(entry.key.length - sk.length) > Math.max(8, sk.length * 0.45)) {
      continue;
    }

    const tokenScore = tokenJaccard(queryTokens, entry.tokens);
    if (tokenScore < 0.3 && queryTokens.length >= 2) continue;

    const lev = stringSimilarity(sk, entry.key);
    const score = Math.max(lev, tokenScore * 0.95 + lev * 0.05);

    if (score >= FUZZY_NAME_THRESHOLD || tokenScore >= FUZZY_TOKEN_THRESHOLD) {
      if (!best || score > best.score) {
        best = { score, item: entry.item, key: entry.key };
      }
    }
  }

  if (!best) return null;
  return {
    canonical_id: best.item.canonical_id,
    match_method: "fuzzy_name",
    confidence: Math.min(0.8, Math.round(best.score * 100) / 100),
    matched_name: best.item.name_en || undefined,
  };
}

function fuzzyMatchCode(itemCode: string): SkuMatchResult | null {
  const code = normalizeCode(itemCode);
  if (code.length < 5) return null;

  let best: { score: number; item: CatalogMatchCandidate } | null = null;
  const scan = codeKeys.slice(0, FUZZY_SCAN_CAP);
  for (const ck of scan) {
    if (Math.abs(ck.length - code.length) > 4) continue;
    const prefixLen = Math.min(6, code.length, ck.length);
    if (code.slice(0, prefixLen) !== ck.slice(0, prefixLen) && code.length > 8) {
      continue;
    }
    const score = stringSimilarity(code, ck);
    if (score >= FUZZY_CODE_THRESHOLD) {
      if (!best || score > best.score) {
        const item = codeIndex!.get(ck);
        if (item) best = { score, item };
      }
    }
  }

  if (!best) return null;
  return {
    canonical_id: best.item.canonical_id,
    match_method: "fuzzy_code",
    confidence: Math.min(0.75, Math.round(best.score * 100) / 100),
    matched_name: best.item.name_en || undefined,
  };
}

export function matchSkuToCanonical(
  itemCode: string,
  itemDesc: string,
): SkuMatchResult {
  if (!codeIndex || !nameIndex) {
    return { canonical_id: null, match_method: "unmatched", confidence: 0 };
  }

  const code = normalizeCode(itemCode);
  if (code && codeIndex.has(code)) {
    const hit = codeIndex.get(code)!;
    return {
      canonical_id: hit.canonical_id,
      match_method: "exact_code",
      confidence: 1,
      matched_name: hit.name_en || undefined,
    };
  }

  const stripped = stripMarketSuffix(itemDesc);
  const keys = [nameKey(itemDesc), nameKey(stripped)].filter(Boolean);
  for (const k of keys) {
    if (nameIndex.has(k)) {
      const hit = nameIndex.get(k)!;
      return {
        canonical_id: hit.canonical_id,
        match_method: k === nameKey(itemDesc) ? "exact_name" : "normalized_name",
        confidence: k === nameKey(itemDesc) ? 0.95 : 0.85,
        matched_name: hit.name_en || undefined,
      };
    }
  }

  if (stripped.length >= 8) {
    const sk = nameKey(stripped);
    for (const [k, hit] of nameIndex.entries()) {
      if (k.length >= 8 && (k.startsWith(sk) || sk.startsWith(k))) {
        return {
          canonical_id: hit.canonical_id,
          match_method: "prefix_name",
          confidence: 0.65,
          matched_name: hit.name_en || undefined,
        };
      }
    }
  }

  const fuzzyName = fuzzyMatchName(itemDesc);
  if (fuzzyName) return fuzzyName;

  const fuzzyCode = fuzzyMatchCode(itemCode);
  if (fuzzyCode) return fuzzyCode;

  return { canonical_id: null, match_method: "unmatched", confidence: 0 };
}

export function matchManySkus(
  rows: { item_code: string; item_desc: string }[],
): Map<string, SkuMatchResult> {
  const map = new Map<string, SkuMatchResult>();
  for (const row of rows) {
    const key = `${row.item_code}||${row.item_desc}`;
    if (!map.has(key)) {
      map.set(key, matchSkuToCanonical(row.item_code, row.item_desc));
    }
  }
  return map;
}

export function summarizeMatches(matches: Iterable<SkuMatchResult>): {
  matched: number;
  unmatched: number;
  byMethod: Record<string, number>;
} {
  let matched = 0;
  let unmatched = 0;
  const byMethod: Record<string, number> = {};
  for (const m of matches) {
    byMethod[m.match_method] = (byMethod[m.match_method] || 0) + 1;
    if (m.canonical_id) matched += 1;
    else unmatched += 1;
  }
  return { matched, unmatched, byMethod };
}
