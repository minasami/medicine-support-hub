/**
 * Map manufacturer SKUs (item codes) and trade names to encyclopedia canonical_id.
 * Sources (in order): in-memory cache, Appwrite medicines, static Egyptian dataset.
 */

import { normalizeSearchTerm } from "./search-engine";

export type CatalogMatchCandidate = {
  canonical_id: number;
  name_en?: string | null;
  name_ar?: string | null;
  code?: string | null;
  barcode?: string | null;
  manufacturer?: string | null;
};

export type SkuMatchResult = {
  canonical_id: number | null;
  match_method:
    | "exact_code"
    | "exact_barcode"
    | "exact_name"
    | "normalized_name"
    | "prefix_name"
    | "unmatched";
  confidence: number;
  matched_name?: string;
};

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
      /\bfor\s+(libya|sudan|yemen|iraq|ksa|kuwait|bahrain|oman|qatar|uae|china|uganda|rwanda|somalia|lebanon|djibouti|togo|guinea|kazakhstan|south\s+sudan|gaza|eu|uk)\b.*$/i,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

let catalogCache: CatalogMatchCandidate[] | null = null;
let codeIndex: Map<string, CatalogMatchCandidate> | null = null;
let nameIndex: Map<string, CatalogMatchCandidate> | null = null;

export function clearSkuCatalogCache() {
  catalogCache = null;
  codeIndex = null;
  nameIndex = null;
}

function buildIndexes(items: CatalogMatchCandidate[]) {
  catalogCache = items;
  codeIndex = new Map();
  nameIndex = new Map();
  for (const item of items) {
    if (item.code) {
      const c = normalizeCode(item.code);
      if (c && !codeIndex.has(c)) codeIndex.set(c, item);
    }
    if (item.barcode) {
      const b = normalizeCode(item.barcode);
      if (b && !codeIndex.has(b)) codeIndex.set(b, item);
    }
    if (item.name_en) {
      const k = nameKey(item.name_en);
      if (k && !nameIndex.has(k)) nameIndex.set(k, item);
      const stripped = nameKey(stripMarketSuffix(item.name_en));
      if (stripped && !nameIndex.has(stripped)) nameIndex.set(stripped, item);
    }
    if (item.name_ar) {
      const k = nameKey(item.name_ar);
      if (k && !nameIndex.has(k)) nameIndex.set(k, item);
    }
  }
}

/** Load catalog candidates from static dataset (always available offline). */
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

/** Optional Appwrite medicines collection enrichment. */
export async function loadAppwriteCatalogCandidates(
  databases: {
    listDocuments: (
      db: string,
      col: string,
      queries?: string[],
    ) => Promise<{ documents: any[] }>;
  } | null,
  databaseId: string,
  collectionId: string,
): Promise<CatalogMatchCandidate[]> {
  if (!databases) return [];
  try {
    const { Query } = await import("appwrite");
    const res = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(500),
    ]);
    return (res.documents || []).map((doc: any) => ({
      canonical_id: Number(doc.canonical_id || 0),
      name_en: doc.name_en || null,
      name_ar: doc.name_ar || null,
      code: doc.code || doc.item_code || null,
      barcode: doc.barcode || null,
      manufacturer: doc.manufacturer || null,
    })).filter((c) => c.canonical_id > 0);
  } catch {
    return [];
  }
}

export async function ensureSkuCatalogIndex(options?: {
  databases?: any;
  databaseId?: string;
  medicinesCollectionId?: string;
}): Promise<number> {
  if (catalogCache && codeIndex && nameIndex) return catalogCache.length;

  const staticItems = await loadStaticCatalogCandidates();
  let appwriteItems: CatalogMatchCandidate[] = [];
  if (options?.databases && options.databaseId && options.medicinesCollectionId) {
    appwriteItems = await loadAppwriteCatalogCandidates(
      options.databases,
      options.databaseId,
      options.medicinesCollectionId,
    );
  }

  // Prefer Appwrite rows when same code exists; otherwise merge
  const byCode = new Map<string, CatalogMatchCandidate>();
  for (const item of [...staticItems, ...appwriteItems]) {
    const key = item.code
      ? normalizeCode(item.code)
      : `id:${item.canonical_id}`;
    byCode.set(key, item);
  }
  buildIndexes([...byCode.values()]);
  return catalogCache?.length || 0;
}

export function matchSkuToCanonical(
  itemCode: string,
  itemDesc: string,
): SkuMatchResult {
  if (!codeIndex || !nameIndex) {
    return {
      canonical_id: null,
      match_method: "unmatched",
      confidence: 0,
    };
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

  // Prefix: catalog name starts with stripped desc or vice versa (min length 8)
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

  return {
    canonical_id: null,
    match_method: "unmatched",
    confidence: 0,
  };
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

export function summarizeMatches(
  matches: Iterable<SkuMatchResult>,
): {
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
