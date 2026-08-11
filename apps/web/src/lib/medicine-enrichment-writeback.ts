/**
 * Persist federated enrichment patches to Appwrite medicines (fill-only).
 * Never overwrites non-empty local fields. Platform admin / approved rep only.
 */

import { Client, Databases, Query } from "appwrite";
import { isPlatformAdminUser } from "@/lib/platform-admin";

const ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_ID =
  import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

export type WritebackProduct = {
  id?: string | null;
  $id?: string | null;
  canonical_id?: number | string | null;
  name_en?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  indications?: string | null;
  description?: string | null;
  image_url?: string | null;
  barcode?: string | null;
};

export type EnrichmentWritebackInput = {
  product: WritebackProduct;
  patch: Record<string, string | boolean>;
  provenance?: Record<string, string>;
  externalIds?: { rxcui?: string; pubchem_cid?: string };
  actorEmail?: string | null;
  actorRole?: string | null;
  /** When true, attempt Appwrite update even if role unknown (session JWT present). */
  forceAttempt?: boolean;
};

export type EnrichmentWritebackResult = {
  ok: boolean;
  mode: "appwrite" | "session_only" | "skipped";
  documentId?: string;
  fieldsWritten?: string[];
  error?: string;
};

function getDb(): Databases | null {
  try {
    if (!PROJECT) return null;
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    return new Databases(client);
  } catch {
    return null;
  }
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "number") return !Number.isFinite(v);
  return false;
}

/** Build fill-only payload: only keys that are empty on the product. */
export function buildFillOnlyPayload(
  product: WritebackProduct,
  patch: Record<string, string | boolean>,
  externalIds?: { rxcui?: string; pubchem_cid?: string },
  provenance?: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const tryStr = (localKey: keyof WritebackProduct, patchKey: string, target?: string) => {
    const dest = target || patchKey;
    if (!isEmpty(product[localKey])) return;
    const v = patch[patchKey];
    if (typeof v === "string" && v.trim()) out[dest] = v.trim();
  };

  tryStr("scientific_name", "scientific_name");
  tryStr("manufacturer", "manufacturer");
  tryStr("drug_class", "drug_class");
  tryStr("image_url", "image_url");
  // indications often stored as description
  if (isEmpty(product.indications) && isEmpty(product.description)) {
    const v = patch.indications;
    if (typeof v === "string" && v.trim()) out.description = v.trim();
  }

  if (externalIds?.rxcui) out.rxcui = String(externalIds.rxcui);
  if (externalIds?.pubchem_cid) out.pubchem_cid = String(externalIds.pubchem_cid);

  if (provenance && Object.keys(provenance).length) {
    out.field_sources = JSON.stringify(provenance);
    out.last_enriched_at = new Date().toISOString();
  }

  return out;
}

async function resolveDocumentId(
  db: Databases,
  product: WritebackProduct,
): Promise<string | null> {
  if (product.$id && String(product.$id).length > 2) return String(product.$id);
  if (product.id && !String(product.id).startsWith("n~") && !/^\d+$/.test(String(product.id))) {
    // likely Appwrite $id
    return String(product.id);
  }
  const cid = Number(product.canonical_id || product.id);
  if (Number.isFinite(cid) && cid > 0) {
    try {
      const byMed = await db.getDocument(DATABASE_ID, MEDICINES_ID, `med_${cid}`);
      if (byMed?.$id) return String(byMed.$id);
    } catch {
      /* list */
    }
    try {
      const res = await db.listDocuments(DATABASE_ID, MEDICINES_ID, [
        Query.equal("canonical_id", [cid]),
        Query.limit(1),
      ]);
      const doc = res.documents?.[0];
      if (doc?.$id) return String(doc.$id);
    } catch {
      /* */
    }
  }
  return null;
}

/**
 * Attempt durable write of fill-only enrichment fields.
 * Returns session_only when user is not admin or Appwrite rejects unknown attributes.
 */
export async function writeEnrichmentToAppwrite(
  input: EnrichmentWritebackInput,
): Promise<EnrichmentWritebackResult> {
  const canWrite =
    input.forceAttempt ||
    isPlatformAdminUser({
      email: input.actorEmail,
      profileRole: input.actorRole,
    });

  if (!canWrite) {
    return { ok: true, mode: "session_only" };
  }

  const db = getDb();
  if (!db) {
    return { ok: false, mode: "session_only", error: "Appwrite client unavailable" };
  }

  const full = buildFillOnlyPayload(
    input.product,
    input.patch,
    input.externalIds,
    input.provenance,
  );

  // Core safe attributes (always present in schema)
  const coreKeys = [
    "scientific_name",
    "manufacturer",
    "drug_class",
    "image_url",
    "description",
  ] as const;
  const core: Record<string, unknown> = {};
  for (const k of coreKeys) {
    if (full[k] != null) core[k] = full[k];
  }

  if (!Object.keys(core).length && !full.rxcui && !full.pubchem_cid) {
    return { ok: true, mode: "skipped", fieldsWritten: [] };
  }

  const docId = await resolveDocumentId(db, input.product);
  if (!docId) {
    return {
      ok: false,
      mode: "session_only",
      error: "Could not resolve Appwrite document id",
    };
  }

  // Try with optional identity + provenance attrs first; strip unknown on failure
  const attempts: Record<string, unknown>[] = [
    { ...core, ...pickOptional(full) },
    { ...core },
  ];

  let lastErr = "";
  for (const payload of attempts) {
    if (!Object.keys(payload).length) continue;
    try {
      await db.updateDocument(DATABASE_ID, MEDICINES_ID, docId, payload);
      return {
        ok: true,
        mode: "appwrite",
        documentId: docId,
        fieldsWritten: Object.keys(payload),
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      // retry without optional attrs
    }
  }

  return {
    ok: false,
    mode: "session_only",
    documentId: docId,
    error: lastErr || "updateDocument failed",
  };
}

function pickOptional(full: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["rxcui", "pubchem_cid", "field_sources", "last_enriched_at"]) {
    if (full[k] != null) out[k] = full[k];
  }
  return out;
}
