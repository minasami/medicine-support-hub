/**
 * Appwrite-backed medicines catalog page loader (performance-tuned).
 *
 * Optimizations:
 *  - Singleton Client/Databases
 *  - Query.select projection + cursor pagination (no offset)
 *  - Key filters (equal/startsWith) before fulltext
 *  - Parallel primary search (name_en ∥ name_ar) then sequential fallbacks
 *  - Arabic-script → name_ar first; company heuristic → manufacturer startsWith
 *  - Sticky searchAttr for infinite-scroll append (avoids re-waterfall)
 *  - Short TTL in-memory cache for identical browse/search pages
 *  - Barcode equal before fulltext
 */

import { Client, Databases, Query } from "appwrite";

const ENDPOINT =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_ENDPOINT) ||
  "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_PROJECT_ID) ||
  "6a54ac3a00272c02d6e0";
const DATABASE_ID = "medicine_support_hub";
const COLLECTION_ID = "medicines";

export const APPWRITE_PAGE_MAX = 100;

/** Default page size — balance payload vs round-trips for infinite scroll. */
export const DEFAULT_PAGE_SIZE = 24;

const LIST_SELECT = [
  "$id",
  "canonical_id",
  "name_en",
  "name_ar",
  "scientific_name",
  "manufacturer",
  "category",
  "dosage_form",
  "strength",
  "drug_class",
  "route",
  "product_type",
  "current_price_egp",
  "image_url",
  "public_url",
  "has_verified_dataset",
  "barcode",
  "code",
  "is_medcare_toll",
  "toll_manufacturer",
  "company_slug",
] as const;

export type MedicineListItem = {
  $id?: string;
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  category: string | null;
  dosage_form: string | null;
  strength: string | null;
  drug_class: string | null;
  route: string | null;
  product_type: string | null;
  current_price_egp: number | null;
  image_url?: string | null;
  public_url?: string | null;
  has_verified_dataset?: boolean;
  id_source?: "live_db" | "static_dataset" | "unknown";
  barcode?: string | null;
  code?: string | null;
  is_medcare_toll?: boolean;
  toll_manufacturer?: string | null;
  company_slug?: string | null;
};

export type MedicinePageFilters = {
  manufacturer?: string;
  companySlug?: string;
  drugClass?: string;
  route?: string;
  category?: string;
  scientificName?: string;
  verifiedOnly?: boolean;
  medCareOnly?: boolean;
  query?: string;
  /**
   * Sticky attribute from a previous successful search so infinite-scroll
   * append does not re-run the fulltext waterfall.
   */
  searchAttr?: string | null;
};

export type MedicinePageResult = {
  items: MedicineListItem[];
  total: number;
  limit: number;
  source: "appwrite" | "static_fallback";
  searchAttr?: string | null;
  nextCursor: string | null;
  hasMore: boolean;
  connectionError?: boolean;
  errorMessage?: string | null;
  /** True when served from short TTL memory cache. */
  fromCache?: boolean;
};

const PRIMARY_SEARCH_ATTRS = ["name_en", "name_ar"] as const;
const SECONDARY_SEARCH_ATTRS = [
  "scientific_name",
  "manufacturer",
  "barcode",
] as const;

// —— Singleton client (avoid re-construct per request)
let _db: Databases | null | undefined;
function getDatabases(): Databases | null {
  if (_db !== undefined) return _db;
  try {
    if (!PROJECT_ID) {
      _db = null;
      return null;
    }
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    _db = new Databases(client);
    return _db;
  } catch {
    _db = null;
    return null;
  }
}

// —— Short TTL page cache (browse + first search pages)
const PAGE_CACHE_TTL_MS = 45_000;
const PAGE_CACHE_MAX = 48;
type CacheEntry = { at: number; result: MedicinePageResult };
const pageCache = new Map<string, CacheEntry>();

function cacheKey(
  filters: MedicinePageFilters,
  limit: number,
  cursorAfter: string | null,
): string {
  return JSON.stringify({
    q: (filters.query || "").trim().toLowerCase(),
    mfr: filters.manufacturer || "",
    slug: filters.companySlug || "",
    dc: filters.drugClass || "",
    rt: filters.route || "",
    cat: filters.category || "",
    sci: filters.scientificName || "",
    v: Boolean(filters.verifiedOnly),
    mc: Boolean(filters.medCareOnly),
    sa: filters.searchAttr || "",
    limit,
    cursor: cursorAfter || "",
  });
}

function cacheGet(key: string): MedicinePageResult | null {
  const e = pageCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > PAGE_CACHE_TTL_MS) {
    pageCache.delete(key);
    return null;
  }
  return { ...e.result, fromCache: true };
}

function cacheSet(key: string, result: MedicinePageResult) {
  if (result.connectionError || result.source === "static_fallback") return;
  if (pageCache.size >= PAGE_CACHE_MAX) {
    const first = pageCache.keys().next().value;
    if (first != null) pageCache.delete(first);
  }
  pageCache.set(key, { at: Date.now(), result: { ...result, fromCache: false } });
}

function mapDoc(doc: Record<string, unknown>): MedicineListItem {
  const cid = Number(doc.canonical_id ?? 0);
  return {
    $id: typeof doc.$id === "string" ? doc.$id : undefined,
    canonical_id: cid || 0,
    name_en: (doc.name_en as string) || null,
    name_ar: (doc.name_ar as string) || null,
    scientific_name: (doc.scientific_name as string) || null,
    manufacturer: (doc.manufacturer as string) || null,
    category: (doc.category as string) || null,
    dosage_form: (doc.dosage_form as string) || null,
    strength: (doc.strength as string) || null,
    drug_class: (doc.drug_class as string) || null,
    route: (doc.route as string) || null,
    product_type: (doc.product_type as string) || null,
    current_price_egp:
      doc.current_price_egp != null ? Number(doc.current_price_egp) : null,
    image_url: (doc.image_url as string) || null,
    public_url: (doc.public_url as string) || null,
    has_verified_dataset: Boolean(doc.has_verified_dataset ?? true),
    id_source: "live_db",
    barcode: (doc.barcode as string) || null,
    code: (doc.code as string) || null,
    is_medcare_toll: Boolean(doc.is_medcare_toll),
    toll_manufacturer: (doc.toll_manufacturer as string) || null,
    company_slug: (doc.company_slug as string) || null,
  };
}

function baseFilterQueries(filters: MedicinePageFilters): string[] {
  const q: string[] = [];
  if (filters.medCareOnly) q.push(Query.equal("is_medcare_toll", true));
  const slug = filters.companySlug?.trim();
  if (slug) q.push(Query.equal("company_slug", slug));
  const mfr = filters.manufacturer?.trim();
  if (mfr && !slug) q.push(Query.equal("manufacturer", mfr));
  if (filters.drugClass?.trim())
    q.push(Query.equal("drug_class", filters.drugClass.trim()));
  if (filters.route?.trim()) q.push(Query.equal("route", filters.route.trim()));
  if (filters.category?.trim())
    q.push(Query.equal("category", filters.category.trim()));
  if (filters.scientificName?.trim())
    q.push(Query.equal("scientific_name", filters.scientificName.trim()));
  if (filters.verifiedOnly)
    q.push(Query.equal("has_verified_dataset", true));
  return q;
}

function looksLikeBarcode(term: string): boolean {
  return /^\d{8,14}$/.test(term.replace(/[\s-]/g, ""));
}

function hasArabic(term: string): boolean {
  return /[\u0600-\u06FF]/.test(term);
}

function looksLikeCompanyQuery(term: string): boolean {
  const t = term.trim();
  if (t.length < 3 || looksLikeBarcode(t)) return false;
  if (/\d{2,}/.test(t) && /\b(mg|mcg|ml|iu)\b/i.test(t)) return false;
  return /\b(pharma|pharmaceutical|laborator|labs?|industr|egypt|s\.a\.e|sae|co\.?|group|care|med)\b/i.test(
    t,
  );
}

function withSelectAndOrder(
  q: string[],
  limit: number,
  cursorAfter?: string | null,
  useOrder = true,
): string[] {
  const out = [Query.limit(limit), Query.select([...LIST_SELECT]), ...q];
  if (useOrder) out.splice(1, 0, Query.orderAsc("name_en"));
  if (cursorAfter) out.push(Query.cursorAfter(cursorAfter));
  return out;
}

type QueryMode =
  | "browse"
  | "search"
  | "startsWith"
  | "barcode"
  | "mfrStartsWith";

function buildQueries(opts: {
  limit: number;
  cursorAfter?: string | null;
  filters: MedicinePageFilters;
  mode: QueryMode;
  searchAttr?: string;
  term?: string;
  useOrder?: boolean;
}): string[] {
  const limit = Math.min(Math.max(1, opts.limit), APPWRITE_PAGE_MAX);
  const filtersQ = baseFilterQueries(opts.filters);
  const term = (opts.term || "").trim();
  const useOrder = opts.useOrder !== false;

  if (!term || opts.mode === "browse") {
    return withSelectAndOrder(filtersQ, limit, opts.cursorAfter, useOrder);
  }
  if (opts.mode === "barcode") {
    return withSelectAndOrder(
      [...filtersQ, Query.equal("barcode", term.replace(/[\s-]/g, ""))],
      limit,
      opts.cursorAfter,
      useOrder,
    );
  }
  if (opts.mode === "mfrStartsWith") {
    return withSelectAndOrder(
      [...filtersQ, Query.startsWith("manufacturer", term)],
      limit,
      opts.cursorAfter,
      useOrder,
    );
  }
  if (opts.mode === "startsWith" && opts.searchAttr) {
    return withSelectAndOrder(
      [...filtersQ, Query.startsWith(opts.searchAttr, term)],
      limit,
      opts.cursorAfter,
      useOrder,
    );
  }
  if (opts.mode === "search" && opts.searchAttr) {
    const searchTerm =
      opts.searchAttr === "barcode"
        ? `"${term.replace(/"/g, "")}"`
        : term;
    return withSelectAndOrder(
      [...filtersQ, Query.search(opts.searchAttr, searchTerm)],
      limit,
      opts.cursorAfter,
      useOrder,
    );
  }
  return withSelectAndOrder(filtersQ, limit, opts.cursorAfter, useOrder);
}

function toResult(
  res: { documents: unknown[]; total: number },
  limit: number,
  searchAttr: string | null,
): MedicinePageResult {
  const items = (res.documents || []).map((d) =>
    mapDoc(d as Record<string, unknown>),
  );
  const last = items[items.length - 1];
  const nextCursor = last?.$id || null;
  const total = typeof res.total === "number" ? res.total : items.length;
  const hasMoreStrict = items.length >= limit;
  return {
    items,
    total: total || items.length,
    limit,
    source: "appwrite",
    searchAttr,
    nextCursor: hasMoreStrict ? nextCursor : null,
    hasMore: hasMoreStrict,
    connectionError: false,
    errorMessage: null,
  };
}

async function listSafe(
  db: Databases,
  queries: string[],
  filters?: MedicinePageFilters,
): Promise<{ documents: unknown[]; total: number }> {
  try {
    return await db.listDocuments(DATABASE_ID, COLLECTION_ID, queries);
  } catch (err1) {
    const msg = String((err1 as { message?: string })?.message || err1);
    let stripped = [...queries];

    if (/select|attribute|unknown/i.test(msg)) {
      stripped = stripped.filter((q) => !String(q).includes("select"));
    }
    if (/order|index/i.test(msg)) {
      stripped = stripped.filter((q) => !String(q).includes("orderAsc"));
    }
    if (stripped === queries || stripped.length === queries.length) {
      stripped = queries.filter(
        (q) => !String(q).includes("orderAsc") && !String(q).includes("select"),
      );
    }

    if (filters?.medCareOnly) {
      const hasMed = stripped.some((q) => String(q).includes("is_medcare_toll"));
      if (hasMed) {
        stripped = stripped.filter((q) => !String(q).includes("is_medcare_toll"));
        stripped.push(Query.search("manufacturer", "Med-Care"));
      }
    }
    if (filters?.companySlug) {
      stripped = stripped.filter((q) => !String(q).includes("company_slug"));
      if (filters.manufacturer?.trim()) {
        stripped.push(Query.equal("manufacturer", filters.manufacturer.trim()));
      } else {
        stripped.push(Query.startsWith("manufacturer", filters.companySlug));
      }
    }

    try {
      return await db.listDocuments(DATABASE_ID, COLLECTION_ID, stripped);
    } catch (err2) {
      throw err2 || err1;
    }
  }
}

async function tryQuery(
  db: Databases,
  filters: MedicinePageFilters,
  limit: number,
  cursorAfter: string | null,
  mode: QueryMode,
  term: string,
  searchAttr?: string,
): Promise<MedicinePageResult | null> {
  try {
    const res = await listSafe(
      db,
      buildQueries({
        limit,
        cursorAfter,
        filters,
        mode,
        searchAttr,
        term,
      }),
      filters,
    );
    if (res.documents?.length) {
      return toResult(
        res,
        limit,
        searchAttr ||
          (mode === "mfrStartsWith"
            ? "manufacturer"
            : mode === "barcode"
              ? "barcode"
              : null),
      );
    }
    return null;
  } catch {
    return null;
  }
}

function matchesTerm(m: MedicineListItem, term: string): boolean {
  const sw = term.toLowerCase();
  return Boolean(
    (m.name_en && m.name_en.toLowerCase().includes(sw)) ||
      (m.name_ar && m.name_ar.includes(term)) ||
      (m.scientific_name && m.scientific_name.toLowerCase().includes(sw)) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(sw)) ||
      (m.company_slug && m.company_slug.toLowerCase().includes(sw)) ||
      (m.barcode && String(m.barcode).includes(term)),
  );
}

function matchesCompany(m: MedicineListItem, company: string): boolean {
  const c = company.toLowerCase();
  return Boolean(
    (m.manufacturer && m.manufacturer.toLowerCase().includes(c)) ||
      (m.company_slug && m.company_slug.toLowerCase().includes(c)) ||
      (m.toll_manufacturer && m.toll_manufacturer.toLowerCase().includes(c)),
  );
}

let staticCache: MedicineListItem[] | null = null;

async function loadStaticDataset(): Promise<MedicineListItem[]> {
  if (staticCache) return staticCache;
  try {
    const res = await fetch("/data/egyptian-medicines-dataset.json");
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data?.medicines) ? data.medicines : [];
    // Local mapped array so return type is MedicineListItem[] (not | null)
    const mapped: MedicineListItem[] = list.map(
      (d: Record<string, unknown>) => ({
        ...mapDoc(d),
        id_source: "static_dataset" as const,
      }),
    );
    staticCache = mapped;
    return mapped;
  } catch {
    return [];
  }
}

async function staticPage(
  term: string,
  limit: number,
  cursorAfter: string | null,
  filters: MedicinePageFilters = {},
): Promise<MedicinePageResult> {
  let list = await loadStaticDataset();
  if (filters.medCareOnly) {
    list = list.filter(
      (m) =>
        m.is_medcare_toll ||
        (m.manufacturer && /med[\s-]?care/i.test(m.manufacturer)) ||
        (m.toll_manufacturer && /med/i.test(m.toll_manufacturer)),
    );
  }
  if (filters.companySlug?.trim()) {
    const s = filters.companySlug.trim().toLowerCase();
    list = list.filter(
      (m) => m.company_slug && m.company_slug.toLowerCase() === s,
    );
  } else if (filters.manufacturer?.trim()) {
    list = list.filter((m) => matchesCompany(m, filters.manufacturer!));
  }
  if (term) list = list.filter((m) => matchesTerm(m, term));
  let start = 0;
  if (cursorAfter) {
    const idx = list.findIndex(
      (m) => m.$id === cursorAfter || String(m.canonical_id) === cursorAfter,
    );
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = list.slice(start, start + limit);
  const last = slice[slice.length - 1];
  return {
    items: slice,
    total: list.length,
    limit,
    source: "static_fallback",
    searchAttr: null,
    nextCursor:
      slice.length >= limit && last
        ? last.$id || String(last.canonical_id)
        : null,
    hasMore: start + slice.length < list.length,
    connectionError: false,
    errorMessage: null,
  };
}

export async function fetchMedicinesPage(opts: {
  limit?: number;
  cursorAfter?: string | null;
  offset?: number;
  filters?: MedicinePageFilters;
}): Promise<MedicinePageResult> {
  const limit = Math.min(
    APPWRITE_PAGE_MAX,
    Math.max(1, opts.limit ?? DEFAULT_PAGE_SIZE),
  );
  const filters = opts.filters || {};
  const cursorAfter = opts.cursorAfter || null;
  const db = getDatabases();
  const term = (filters.query || "").trim();
  const key = cacheKey(filters, limit, cursorAfter);

  const cached = cacheGet(key);
  if (cached) return cached;

  const emptyOk = (): MedicinePageResult => ({
    items: [],
    total: 0,
    limit,
    source: "appwrite",
    searchAttr: null,
    nextCursor: null,
    hasMore: false,
    connectionError: false,
    errorMessage: null,
  });

  if (!db) {
    const fb = await staticPage(term, limit, cursorAfter, filters);
    return {
      ...fb,
      connectionError: true,
      errorMessage: "Appwrite client not configured",
    };
  }

  try {
    if (!term) {
      const res = await listSafe(
        db,
        buildQueries({ limit, cursorAfter, filters, mode: "browse" }),
        filters,
      );
      if ((res.documents || []).length || res.total > 0) {
        const out = toResult(res, limit, null);
        cacheSet(key, out);
        return out;
      }
      return staticPage("", limit, cursorAfter, filters);
    }

    const sticky = filters.searchAttr?.trim();
    if (sticky && cursorAfter) {
      const mode: QueryMode =
        sticky === "barcode"
          ? looksLikeBarcode(term)
            ? "barcode"
            : "search"
          : sticky === "manufacturer" && looksLikeCompanyQuery(term)
            ? "mfrStartsWith"
            : "search";
      const hit = await tryQuery(
        db,
        filters,
        limit,
        cursorAfter,
        mode,
        term,
        sticky === "manufacturer" && mode === "mfrStartsWith"
          ? undefined
          : sticky,
      );
      if (hit) {
        hit.searchAttr = sticky;
        cacheSet(key, hit);
        return hit;
      }
    }

    if (looksLikeBarcode(term)) {
      const hit =
        (await tryQuery(db, filters, limit, cursorAfter, "barcode", term)) ||
        (await tryQuery(
          db,
          filters,
          limit,
          cursorAfter,
          "search",
          term,
          "barcode",
        ));
      if (hit) {
        cacheSet(key, hit);
        return hit;
      }
    }

    if (
      looksLikeCompanyQuery(term) &&
      !filters.manufacturer &&
      !filters.companySlug
    ) {
      const hit = await tryQuery(
        db,
        filters,
        limit,
        cursorAfter,
        "mfrStartsWith",
        term,
      );
      if (hit) {
        cacheSet(key, hit);
        return hit;
      }
    }

    if (term.length < 3) {
      const order = hasArabic(term)
        ? (["name_ar", "name_en"] as const)
        : (["name_en", "name_ar"] as const);
      for (const attr of order) {
        const hit = await tryQuery(
          db,
          filters,
          limit,
          cursorAfter,
          "startsWith",
          term,
          attr,
        );
        if (hit) {
          cacheSet(key, hit);
          return hit;
        }
      }
      const fb = await staticPage(term, limit, cursorAfter, filters);
      if (fb.items.length) return fb;
      return emptyOk();
    }

    {
      const primary = hasArabic(term)
        ? (["name_ar", "name_en"] as const)
        : PRIMARY_SEARCH_ATTRS;
      const results = await Promise.all(
        primary.map(async (attr) => {
          const hit = await tryQuery(
            db,
            filters,
            limit,
            cursorAfter,
            "search",
            term,
            attr,
          );
          return hit ? { attr, hit } : null;
        }),
      );
      for (const r of results) {
        if (r?.hit) {
          cacheSet(key, r.hit);
          return r.hit;
        }
      }
    }

    {
      const attr = hasArabic(term) ? "name_ar" : "name_en";
      const hit = await tryQuery(
        db,
        filters,
        limit,
        cursorAfter,
        "startsWith",
        term,
        attr,
      );
      if (hit) {
        cacheSet(key, hit);
        return hit;
      }
    }

    let lastError: unknown = null;
    for (const attr of SECONDARY_SEARCH_ATTRS) {
      try {
        const res = await listSafe(
          db,
          buildQueries({
            limit,
            cursorAfter,
            filters,
            mode: "search",
            searchAttr: attr,
            term,
          }),
          filters,
        );
        if (res.documents?.length) {
          const out = toResult(res, limit, attr);
          cacheSet(key, out);
          return out;
        }
      } catch (e) {
        lastError = e;
      }
    }

    const fb = await staticPage(term, limit, cursorAfter, filters);
    if (fb.items.length) return fb;
    if (!lastError) return emptyOk();

    return {
      ...fb,
      connectionError: true,
      errorMessage: String(
        (lastError as { message?: string })?.message ||
          lastError ||
          "query failed",
      ),
    };
  } catch (err) {
    console.warn("[medicines-appwrite-page] listDocuments failed:", err);
    const fb = await staticPage(term, limit, cursorAfter, filters);
    return {
      ...fb,
      connectionError: fb.items.length === 0,
      errorMessage: String((err as { message?: string })?.message || err),
    };
  }
}
