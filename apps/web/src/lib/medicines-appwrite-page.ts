/**
 * Appwrite-backed medicines catalog page loader.
 * Resilient: retries without order on failure; static JSON fallback;
 * zero hits ≠ connection error.
 * Supports compound queries: active ingredient + company (any order).
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
  is_medcare_toll?: boolean;
  toll_manufacturer?: string | null;
};

export type MedicinePageFilters = {
  manufacturer?: string;
  drugClass?: string;
  route?: string;
  category?: string;
  scientificName?: string;
  verifiedOnly?: boolean;
  medCareOnly?: boolean;
  query?: string;
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
    is_medcare_toll: Boolean(doc.is_medcare_toll),
    toll_manufacturer: (doc.toll_manufacturer as string) || null,
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
  if (filters.medCareOnly) {
    q.push(Query.equal("is_medcare_toll", true));
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
    let stripped = queries.filter((q) => !String(q).includes("orderAsc"));
    if (filters?.medCareOnly) {
      stripped = stripped.filter((q) => !String(q).includes("is_medcare_toll"));
      stripped.push(Query.search("manufacturer", "Med-Care"));
    }
    try {
      return await db.listDocuments(DATABASE_ID, COLLECTION_ID, stripped);
    } catch (err2) {
      throw err2 || err1;
    }
  }
}

const SEARCH_STOP = new Set([
  "mg",
  "ml",
  "tab",
  "tabs",
  "tablet",
  "tablets",
  "cap",
  "caps",
  "capsule",
  "and",
  "or",
  "the",
  "of",
  "for",
  "with",
  "by",
  "co",
  "company",
  "pharma",
  "pharmaceuticals",
  "egypt",
  "from",
]);

function splitSearchTokens(term: string): string[] {
  return term
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !SEARCH_STOP.has(t));
}

function tokenMatchesHay(hay: string, token: string): boolean {
  const t = token.toLowerCase();
  if (t.length <= 3) {
    const parts = hay.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return parts.some((p) => p === t || p.startsWith(t));
  }
  return hay.includes(t);
}

function matchesTerm(m: MedicineListItem, term: string): boolean {
  const hay = [
    m.name_en,
    m.name_ar,
    m.scientific_name,
    m.manufacturer,
    m.barcode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tokens = splitSearchTokens(term);
  if (tokens.length >= 2) {
    const hitCount = tokens.filter((t) => tokenMatchesHay(hay, t)).length;
    return hitCount === tokens.length;
  }

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
  medCareOnly: boolean,
): Promise<MedicinePageResult> {
  const list = await loadStaticDataset();
  let filtered = term ? list.filter((m) => matchesTerm(m, term)) : list;
  if (medCareOnly) {
    filtered = filtered.filter(
      (m) =>
        m.is_medcare_toll ||
        (m.manufacturer && /med[-\s]?care/i.test(m.manufacturer)),
    );
  }
  let start = 0;
  if (cursorAfter) {
    const idx = filtered.findIndex(
      (m) => m.$id === cursorAfter || String(m.canonical_id) === cursorAfter,
    );
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = filtered.slice(start, start + limit);
  const last = slice[slice.length - 1];
  return {
    items: slice,
    total: filtered.length,
    limit,
    source: "static_fallback",
    searchAttr: null,
    nextCursor: slice.length >= limit && last
      ? last.$id || String(last.canonical_id)
      : null,
    hasMore: start + slice.length < filtered.length,
    connectionError: false,
    errorMessage: null,
  };
}

export async function fetchMedicineByCanonicalId(
  canonicalId: number,
): Promise<MedicineListItem | null> {
  const id = Number(canonicalId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDatabases();
  if (db) {
    try {
      const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
        Query.equal("canonical_id", [id]),
        Query.limit(1),
      ]);
      const docs = res?.documents || [];
      if (docs.length) return mapDoc(docs[0] as Record<string, unknown>);
    } catch {
      /* fall through */
    }
  }
  try {
    const list = await loadStaticDataset();
    return list.find((m) => Number(m.canonical_id) === id) || null;
  } catch {
    return null;
  }
}

export async function fetchMedicineByName(
  name: string,
): Promise<MedicineListItem | null> {
  const term = (name || "").trim();
  if (!term) return null;
  try {
    const page = await fetchMedicinesPage({
      limit: 24,
      filters: { query: term },
    });
    const items = page?.items || [];
    if (!items.length) return null;
    const key = term.toUpperCase();
    const exact = items.find(
      (p) => (p.name_en || "").trim().toUpperCase() === key,
    );
    if (exact) return exact;
    const starts = items.find((p) =>
      (p.name_en || "").trim().toUpperCase().startsWith(key),
    );
    if (starts) return starts;
    const live = items.find((p) => p.id_source === "live_db");
    return live || items[0] || null;
  } catch {
    return null;
  }
}

function mergeDocs(batches: Array<{ documents: unknown[]; total: number }>): {
  documents: unknown[];
  total: number;
} {
  const seen = new Set<string>();
  const documents: unknown[] = [];
  for (const batch of batches) {
    for (const doc of batch.documents || []) {
      const d = doc as Record<string, unknown>;
      const key =
        (typeof d.$id === "string" && d.$id) ||
        `c:${d.canonical_id ?? ""}|${d.name_en ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push(doc);
    }
  }
  return { documents, total: documents.length };
}

/**
 * Multi-token search: "paracetamol eva" / "eva paracetamol".
 * Field-aware ranking prefers scientific_name + manufacturer cross matches.
 */
async function multiTokenSearch(
  db: Databases,
  term: string,
  limit: number,
  cursorAfter: string | null,
  filters: MedicinePageFilters,
): Promise<{ documents: unknown[]; total: number } | null> {
  const tokens = splitSearchTokens(term);
  if (tokens.length < 2) return null;

  const probe = tokens.slice(0, 4);
  const attrs = ["name_en", "scientific_name", "manufacturer"] as const;
  const batches: Array<{ documents: unknown[]; total: number }> = [];

  for (const token of probe) {
    for (const attr of attrs) {
      try {
        const mode = token.length < 3 ? "startsWith" : "search";
        const res = await listSafe(
          db,
          buildQueries({
            limit: Math.min(limit, 40),
            cursorAfter: null,
            filters,
            mode: mode as "search" | "startsWith",
            searchAttr: attr,
            term: token,
          }),
          filters,
        );
        if (res.documents?.length) batches.push(res);
      } catch {
        /* next attr */
      }
    }
  }

  if (!batches.length) return null;

  const merged = mergeDocs(batches);
  if (!merged.documents.length) return null;

  const tokenInField = (field: string, token: string): boolean => {
    const f = (field || "").toLowerCase();
    const t = token.toLowerCase();
    if (!f || !t) return false;
    if (t.length <= 3) {
      const parts = f.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      return parts.some((p) => p === t || p.startsWith(t));
    }
    return f.includes(t);
  };

  const scored = merged.documents
    .map((doc) => {
      const m = mapDoc(doc as Record<string, unknown>);
      const en = String(m.name_en || "").toLowerCase();
      const ar = String(m.name_ar || "");
      const sci = String(m.scientific_name || "").toLowerCase();
      const mfr = String(m.manufacturer || "").toLowerCase();

      let cover = 0;
      let sciHits = 0;
      let mfrHits = 0;
      let nameHits = 0;
      for (const t of probe) {
        const inSci = tokenInField(sci, t);
        const inMfr = tokenInField(mfr, t);
        const inName = tokenInField(en, t) || (ar && ar.includes(t));
        if (inSci || inMfr || inName) cover++;
        if (inSci) sciHits++;
        if (inMfr) mfrHits++;
        if (inName) nameHits++;
      }

      const sciMfrCross = sciHits >= 1 && mfrHits >= 1;
      const nameMfrCross = nameHits >= 1 && mfrHits >= 1;
      let rank = 1000;
      if (cover >= probe.length && sciMfrCross) rank = 1;
      else if (cover >= probe.length && nameMfrCross) rank = 2;
      else if (cover >= probe.length && sciHits >= 1) rank = 3;
      else if (cover >= probe.length) rank = 4;
      else if (cover >= 2 && sciMfrCross) rank = 5;
      else if (cover >= 2 && nameMfrCross) rank = 6;
      else if (cover >= 2) rank = 10;
      else if (sciHits >= 1) rank = 40;
      else if (mfrHits >= 1) rank = 50;
      else rank = 80;

      return { doc, cover, rank, m };
    })
    .filter((x) => x.cover >= 1)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.cover - a.cover ||
        String(a.m.name_en || "").localeCompare(String(b.m.name_en || "")),
    );

  const full = scored.filter((x) => x.cover >= probe.length);
  const strongPartial = scored.filter((x) => x.cover >= 2 && x.rank <= 10);
  const chosen = (
    full.length
      ? full
      : strongPartial.length
        ? strongPartial
        : scored.filter((x) => x.rank <= 40)
  ).slice(0, Math.max(limit * 3, 60));

  let start = 0;
  if (cursorAfter) {
    const idx = chosen.findIndex((x) => {
      const id = (x.doc as Record<string, unknown>).$id;
      return id === cursorAfter;
    });
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = chosen.slice(start, start + limit);
  return {
    documents: page.map((x) => x.doc),
    total: chosen.length,
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
    const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
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
        return toResult(res, limit, null);
      }
      return staticPage("", limit, cursorAfter, Boolean(filters.medCareOnly));
    }

    const sticky = (filters.searchAttr || "").trim();
    if (
      sticky &&
      sticky !== "compound" &&
      (FULLTEXT_SEARCH_ATTRS as readonly string[]).includes(sticky)
    ) {
      try {
        const mode =
          term.length < 3 && sticky !== "barcode" ? "startsWith" : "search";
        const res = await listSafe(
          db,
          buildQueries({
            limit,
            cursorAfter,
            filters,
            mode: mode as "search" | "startsWith",
            searchAttr: sticky as (typeof FULLTEXT_SEARCH_ATTRS)[number],
            term,
          }),
          filters,
        );
        if (res.documents?.length) return toResult(res, limit, sticky);
      } catch {
        /* fall through */
      }
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
          filters,
        );
        if (res.documents?.length) return toResult(res, limit, "barcode");
      } catch {
        /* continue */
      }
    }

    if (splitSearchTokens(term).length >= 2) {
      try {
        const multi = await multiTokenSearch(db, term, limit, cursorAfter, filters);
        if (multi?.documents?.length) {
          return toResult(multi, limit, "compound");
        }
      } catch {
        /* fall through */
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
            filters,
          );
          if (res.documents?.length) return toResult(res, limit, attr);
        } catch {
          /* next */
        }
      }
      const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
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
          filters,
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
        filters,
      );
      if (res.documents?.length) return toResult(res, limit, "name_en");
    } catch (e) {
      lastError = e;
    }

    const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
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
    const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
    return {
      ...fb,
      connectionError: fb.items.length === 0,
      errorMessage: String((err as { message?: string })?.message || err),
    };
  }
}
