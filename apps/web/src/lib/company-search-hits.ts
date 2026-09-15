import { Client, Databases, Query } from "appwrite";
import { fetchMedicinesPage } from "@/lib/medicines-appwrite-page";
import { expandSearchQuery } from "@/lib/expand-search-query";
import { normalizeSearchKey } from "@/lib/search-normalize";

export type CompanyHit = {
  company_slug: string;
  display_name: string;
  product_count?: number | null;
  verification_status?: string | null;
  origin?: string | null;
};

const ENDPOINT =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_ENDPOINT) ||
  "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_PROJECT_ID) ||
  "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COMPANIES_COLLECTION =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_COMPANIES_COLLECTION_ID) ||
  "company_profiles";

function getDatabases(): Databases | null {
  try {
    if (!PROJECT_ID) return null;
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    return new Databases(client);
  } catch {
    return null;
  }
}

export async function fetchCompanyHits(
  term: string,
  limit = 8,
): Promise<CompanyHit[]> {
  const db = getDatabases();
  if (!db) return [];
  const q = term.trim();
  if (!q) {
    try {
      const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
        Query.limit(limit),
        Query.orderDesc("product_count"),
      ]);
      return (res.documents || []).map((doc) => ({
        company_slug: String(doc.company_slug || ""),
        display_name: String(doc.display_name || doc.company_slug || ""),
        product_count:
          doc.product_count != null ? Number(doc.product_count) : null,
        verification_status: (doc.verification_status as string) || null,
        origin: (doc.origin as string) || null,
      }));
    } catch {
      return [];
    }
  }

  const prefix = q.slice(0, 1).toUpperCase() + q.slice(1);
  const expanded = expandSearchQuery(q, 6);
  const variants = Array.from(
    new Set([q, q.toUpperCase(), q.toLowerCase(), prefix, ...expanded]),
  );
  const seen = new Set<string>();
  const hits: CompanyHit[] = [];

  for (const variant of variants) {
    if (hits.length >= limit) break;
    try {
      const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
        Query.limit(limit),
        Query.startsWith("display_name", variant),
      ]);
      for (const doc of res.documents || []) {
        const slug = String(doc.company_slug || "");
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        hits.push({
          company_slug: slug,
          display_name: String(doc.display_name || slug),
          product_count:
            doc.product_count != null ? Number(doc.product_count) : null,
          verification_status: (doc.verification_status as string) || null,
          origin: (doc.origin as string) || null,
        });
      }
    } catch {
      /* try next variant */
    }
  }
  // Contains fallback (normalized) when prefix probes miss
  if (hits.length < limit) {
    try {
      const qn = normalizeSearchKey(q);
      const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
        Query.limit(Math.min(40, limit * 4)),
        Query.search("display_name", q),
      ]);
      for (const doc of res.documents || []) {
        if (hits.length >= limit) break;
        const slug = String(doc.company_slug || "");
        const name = String(doc.display_name || slug);
        if (!slug || seen.has(slug)) continue;
        if (qn && !normalizeSearchKey(name).includes(qn) && !normalizeSearchKey(name).startsWith(qn.slice(0, Math.min(6, qn.length)))) {
          continue;
        }
        seen.add(slug);
        hits.push({
          company_slug: slug,
          display_name: name,
          product_count:
            doc.product_count != null ? Number(doc.product_count) : null,
          verification_status: (doc.verification_status as string) || null,
          origin: (doc.origin as string) || null,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return hits.slice(0, limit);
}

export async function fetchCatalogAndCompanyTotals(): Promise<{
  catalogTotal: number | null;
  companyTotal: number | null;
  error: string | null;
}> {
  try {
    const [catalog, companies] = await Promise.all([
      fetchMedicinesPage({ limit: 1, filters: {} }),
      (async () => {
        const db = getDatabases();
        if (!db) return null;
        try {
          const res = await db.listDocuments(DATABASE_ID, COMPANIES_COLLECTION, [
            Query.limit(1),
          ]);
          return typeof res.total === "number" ? res.total : null;
        } catch {
          return null;
        }
      })(),
    ]);

    const catalogTotal =
      catalog.connectionError && catalog.total <= 0
        ? null
        : typeof catalog.total === "number"
          ? catalog.total
          : null;

    return {
      catalogTotal,
      companyTotal: companies,
      error:
        catalog.connectionError && catalogTotal == null
          ? catalog.errorMessage || "Catalog unavailable"
          : null,
    };
  } catch (err) {
    return {
      catalogTotal: null,
      companyTotal: null,
      error: err instanceof Error ? err.message : "Metrics unavailable",
    };
  }
}

export function formatCatalogMetric(
  value: number | null,
  loading: boolean,
): string {
  if (loading) return "…";
  if (value == null) return "—";
  if (value >= 5000) return `${value.toLocaleString()}+`;
  return value.toLocaleString();
}
