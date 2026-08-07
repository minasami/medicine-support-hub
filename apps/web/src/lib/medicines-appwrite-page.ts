/**
 * Appwrite-backed medicines catalog page loader.
 * - Cursor pagination (Query.cursorAfter) for large catalogs
 * - Fulltext Query.search (≥3 chars) + startsWith for short queries
 * - Quoted barcode search; Query.select for lean payloads
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
];

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
  const q: string[] = [
    Query.select(LIST_SELECT),
    Query.limit(limit),
    Query.orderAsc("name_en"),
    ...baseFilterQueries(opts.filters),
  ];

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

  const empty = (): MedicinePageResult => ({
    items: [],
    total: 0,
    limit,
    source: "static_fallback",
    searchAttr: null,
    nextCursor: null,
    hasMore: false,
  });

  if (!db) return empty();

  const term = (filters.query || "").trim();

  try {
    if (!term) {
      const queries = buildQueries({
        limit,
        cursorAfter,
        filters,
        mode: "browse",
      });
      if (!cursorAfter && (opts.offset || 0) > 0) {
        queries.push(Query.offset(opts.offset || 0));
      }
      const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, queries);
      return toResult(res, limit, null);
    }

    if (looksLikeBarcode(term)) {
      try {
        const res = await db.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
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
        /* fall through */
      }
    }

    if (term.length < 3) {
      for (const attr of ["name_en", "name_ar"] as const) {
        try {
          const res = await db.listDocuments(
            DATABASE_ID,
            COLLECTION_ID,
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
          /* try next */
        }
      }
      return empty();
    }

    for (const attr of FULLTEXT_SEARCH_ATTRS) {
      try {
        const res = await db.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
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
      } catch {
        /* index missing */
      }
    }

    try {
      const res = await db.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
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
    } catch {
      /* ignore */
    }

    return empty();
  } catch (err) {
    console.warn("[medicines-appwrite-page] listDocuments failed:", err);
    return empty();
  }
}
