/**
 * Appwrite-backed paginated medicines catalog.
 * Uses Databases.listDocuments with Query.limit / Query.offset and response.total.
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

/** Appwrite allows max 100 documents per listDocuments call. */
export const APPWRITE_PAGE_MAX = 100;

export type MedicineListItem = {
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
  offset: number;
  limit: number;
  source: "appwrite" | "static_fallback";
};

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
    has_verified_dataset: Boolean(doc.has_verified_dataset ?? true),
    id_source: "live_db",
    barcode: (doc.barcode as string) || null,
    code: (doc.code as string) || null,
  };
}

function buildQueries(
  offset: number,
  limit: number,
  filters: MedicinePageFilters,
  searchAttr?: "name_en" | "name_ar" | "scientific_name",
): string[] {
  const q: string[] = [
    Query.limit(Math.min(Math.max(1, limit), APPWRITE_PAGE_MAX)),
    Query.offset(Math.max(0, offset)),
    Query.orderAsc("name_en"),
  ];

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

  const term = (filters.query || "").trim();
  if (term && searchAttr) {
    q.push(Query.search(searchAttr, term));
  }

  return q;
}

/**
 * Fetch one page of medicines from Appwrite with true total count.
 */
export async function fetchMedicinesPage(opts: {
  offset?: number;
  limit?: number;
  filters?: MedicinePageFilters;
}): Promise<MedicinePageResult> {
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(
    APPWRITE_PAGE_MAX,
    Math.max(1, opts.limit ?? 24),
  );
  const filters = opts.filters || {};
  const db = getDatabases();

  if (!db) {
    return {
      items: [],
      total: 0,
      offset,
      limit,
      source: "static_fallback",
    };
  }

  const term = (filters.query || "").trim();

  try {
    if (!term) {
      const res = await db.listDocuments(
        DATABASE_ID,
        COLLECTION_ID,
        buildQueries(offset, limit, filters),
      );
      return {
        items: (res.documents || []).map((d) =>
          mapDoc(d as Record<string, unknown>),
        ),
        total: typeof res.total === "number" ? res.total : res.documents.length,
        offset,
        limit,
        source: "appwrite",
      };
    }

    const attrs: Array<"name_en" | "name_ar" | "scientific_name"> = [
      "name_en",
      "name_ar",
      "scientific_name",
    ];
    for (const attr of attrs) {
      try {
        const res = await db.listDocuments(
          DATABASE_ID,
          COLLECTION_ID,
          buildQueries(offset, limit, filters, attr),
        );
        if (res.documents && res.documents.length > 0) {
          return {
            items: res.documents.map((d) =>
              mapDoc(d as Record<string, unknown>),
            ),
            total:
              typeof res.total === "number" ? res.total : res.documents.length,
            offset,
            limit,
            source: "appwrite",
          };
        }
      } catch {
        /* attribute may lack fulltext index */
      }
    }

    const res = await db.listDocuments(
      DATABASE_ID,
      COLLECTION_ID,
      buildQueries(offset, limit, { ...filters, query: undefined }),
    );
    const sw = term.toLowerCase();
    const filtered = (res.documents || [])
      .map((d) => mapDoc(d as Record<string, unknown>))
      .filter(
        (m) =>
          (m.name_en && m.name_en.toLowerCase().includes(sw)) ||
          (m.name_ar && m.name_ar.includes(term)) ||
          (m.scientific_name && m.scientific_name.toLowerCase().includes(sw)) ||
          (m.manufacturer && m.manufacturer.toLowerCase().includes(sw)),
      );
    return {
      items: filtered,
      total:
        typeof res.total === "number" && filtered.length === res.documents.length
          ? res.total
          : filtered.length,
      offset,
      limit,
      source: "appwrite",
    };
  } catch (err) {
    console.warn("[medicines-appwrite-page] listDocuments failed:", err);
    return {
      items: [],
      total: 0,
      offset,
      limit,
      source: "static_fallback",
    };
  }
}
