/**
 * Appwrite-backed medicines catalog page loader.
 * Resilient: retries without order on failure; static JSON fallback;
 * zero hits \u2260 connection error.
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
};

export type MedicinePageFilters = {
  manufacturer?: string;
  drugClass?: string;
  route?: string;
  category?: string;
  scientificName?: string;
  verifiedOnly?: boolean;
  query?: string;
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
};

const FULLTEXT_SEARCH_ATTRS = [
  "name_en",
  "name_ar",
  "scientific_name",
  "manufacturer",
  "barcode",
] as const;

function getDatabases(): Databases | null {
  try {
    if (!PROJECT_ID) return null;
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    return new Databases(client);
  } catch {
    return null;
  }
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
  };
}

function baseFilterQueries(filters: MedicinePageFilters): string[] {
  const q: string[] = [];
  if (filters.manufacturer?.trim()) {
    q.push(Query.equal("manufacturer", filters.manufacturer.trim()));
  }
  if (filters.drugClass?.trim()) {
    q.push(Query.equal("drug_class", filters.drugClass.trim()));
  }
  if (filters.route?.trim()) {
    q.push(Query.equal("route", filters.route.trim()));
  }
  if (filters.category?.trim()) {
    q.push(Query.equal("category", filters.category.trim()));
  }
  if (filters.scientificName?.trim()) {
    q.push(Query.equal("scientific_name", filters.scientificName.trim()));
  }
  if (filters.verifiedOnly) {
    q.push(Query.equal("has_verified_dataset", true));
  }
  return q;
}

function looksLikeBarcode(term: string): boolean {
  const t = term.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(t);
}

function buildQueries(opts: {
  limit: number;
  cursorAfter?: string | null;
  filters: MedicinePageFilters;
  mode: "browse" | "search" | "startsWith" | "barcode";
  searchAttr?: (typeof FULLTEXT_SEARCH_ATTRS)[number];
  term?: string;
}): string[] {
  const limit = Math.min(Math.max(1, opts.limit), APPWRITE_PAGE_MAX);
  const q: string[] = [Query.limit(limit), Query.orderAsc("name_en"), ...baseFilterQueries(opts.filters)];

  if (opts.cursorAfter) {
    q.push(Query.cursorAfter(opts.cursorAfter));
  }

  const term = (opts.term || "").trim();
  if (!term || opts.mode === "browse") return q;

  if (opts.mode === "barcode") {
    q.push(Query.search("barcode", `"${term.replace(/"/g, "")}"`));
    return q;
  }
  if (opts.mode === "startsWith" && opts.searchAttr) {
    q.push(Query.startsWith(opts.searchAttr, term));
    return q;
  }
  if (opts.mode === "search" && opts.searchAttr) {
    q.push(Query.search(opts.searchAttr, term));
    return q;
  }
  return q;
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
): Promise<{ documents: unknown[]; total: number }> {
  try {
    return await db.listDocuments(DATABASE_ID, COLLECTION_ID, queries);
  } catch (err1) {
    const stripped = queries.filter((q) => !String(q).includes("orderAsc"));
    try {
      return await db.listDocuments(DATABASE_ID, COLLECTION_ID, stripped);
    } catch (err2) {
      throw err2 || err1;
    }
  }
}

function matchesTerm(m: MedicineListItem, term: string): boolean {
  const sw = term.toLowerCase();
  return Boolean(
    (m.name_en && m.name_en.toLowerCase().includes(sw)) ||
      (m.name_ar && m.name_ar.includes(term)) ||
      (m.scientific_name && m.scientific_name.toLowerCase().includes(sw)) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(sw)) ||
      (m.barcode && String(m.barcode).includes(term)),
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
    staticCache = list.map((d: Record<string, unknown>) => ({
      ...mapDoc(d),
      id_source: "static_dataset" as const,
    }));
    return staticCache;
  } catch {
    return [];
  }
}

async function staticPage(
  term: string,
  limit: number,
  cursorAfter: string | null,
): Promise<MedicinePageResult> {
  let list = await loadStaticDataset();
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
  const limit = Math.min(APPWRITE_PAGE_MAX, Math.max(1, opts.limit ?? 24));
  const filters = opts.filters || {};
  const cursorAfter = opts.cursorAfter || null;
  const db = getDatabases();
  const term = (filters.query || "").trim();

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
    const fb = await staticPage(term, limit, cursorAfter);
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
      );
      if ((res.documents || []).length || res.total > 0) {
        return toResult(res, limit, null);
      }
      return staticPage("", limit, cursorAfter);
    }

    if (looksLikeBarcode(term)) {
      try {
        const res = await listSafe(
          db,
          buildQueries({
            limit,
            cursorAfter,
            filters,
            mode: "barcode",
            term,
          }),
        );
        if (res.documents?.length) return toResult(res, limit, "barcode");
      } catch {
        /* continue */
      }
    }

    if (term.length < 3) {
      for (const attr of ["name_en", "name_ar"] as const) {
        try {
          const res = await listSafe(
            db,
            buildQueries({
              limit,
              cursorAfter,
              filters,
              mode: "startsWith",
              searchAttr: attr,
              term,
            }),
          );
          if (res.documents?.length) return toResult(res, limit, attr);
        } catch {
          /* next */
        }
      }
      const fb = await staticPage(term, limit, cursorAfter);
      if (fb.items.length) return fb;
      return emptyOk();
    }

    let lastError: unknown = null;
    for (const attr of FULLTEXT_SEARCH_ATTRS) {
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
        );
        if (res.documents?.length) return toResult(res, limit, attr);
      } catch (e) {
        lastError = e;
      }
    }

    try {
      const res = await listSafe(
        db,
        buildQueries({
          limit,
          cursorAfter,
          filters,
          mode: "startsWith",
          searchAttr: "name_en",
          term,
        }),
      );
      if (res.documents?.length) return toResult(res, limit, "name_en");
    } catch (e) {
      lastError = e;
    }

    const fb = await staticPage(term, limit, cursorAfter);
    if (fb.items.length) return fb;

    if (!lastError) return emptyOk();

    return {
      ...fb,
      connectionError: true,
      errorMessage: String(
        (lastError as any)?.message || lastError || "query failed",
      ),
    };
  } catch (err) {
    console.warn("[medicines-appwrite-page] listDocuments failed:", err);
    const fb = await staticPage(term, limit, cursorAfter);
    return {
      ...fb,
      connectionError: fb.items.length === 0,
      errorMessage: String((err as any)?.message || err),
    };
  }
}
