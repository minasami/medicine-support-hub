/**
 * Persist federated enrichment patches to Appwrite medicines (fill-only).
 * Prefer server API (APPWRITE_API_KEY) for platform admins; fall back to browser SDK.
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

export function buildFillOnlyPayload(
  product: WritebackProduct,
  patch: Record<string, string | boolean>,
  externalIds?: { rxcui?: string; pubchem_cid?: string },
  provenance?: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const tryStr = (
    localKey: keyof WritebackProduct,
    patchKey: string,
    target?: string,
  ) => {
    const dest = target || patchKey;
    if (!isEmpty(product[localKey])) return;
    const v = patch[patchKey];
    if (typeof v === "string" && v.trim()) out[dest] = v.trim();
  };

  tryStr("scientific_name", "scientific_name");
  tryStr("manufacturer", "manufacturer");
  tryStr("drug_class", "drug_class");
  tryStr("image_url", "image_url");
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
  if (
    product.id &&
    !String(product.id).startsWith("n~") &&
    !/^\d+$/.test(String(product.id))
  ) {
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

async function tryServerWriteback(
  input: EnrichmentWritebackInput,
): Promise<EnrichmentWritebackResult | null> {
  try {
    const stringPatch: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(input.patch || {})) {
      if (typeof v === "string" || typeof v === "boolean") stringPatch[k] = v;
    }
    const res = await fetch("/api/admin-enrichment-writeback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.actorEmail
          ? { "X-Admin-Email": String(input.actorEmail) }
          : {}),
      },
      body: JSON.stringify({
        document_id: input.product.$id || input.product.id || undefined,
        canonical_id: input.product.canonical_id ?? undefined,
        patch: stringPatch,
        provenance: input.provenance || {},
        external_ids: input.externalIds || {},
        actor_email: input.actorEmail || undefined,
      }),
    });
    if (res.status === 404 || res.status === 405) return null;
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      applied?: boolean;
      document_id?: string;
      fields_written?: string[];
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        mode: "session_only",
        error: data.message || `HTTP ${res.status}`,
      };
    }
    if (data.applied) {
      return {
        ok: true,
        mode: "appwrite",
        documentId: data.document_id,
        fieldsWritten: data.fields_written || [],
      };
    }
    return {
      ok: true,
      mode: "skipped",
      documentId: data.document_id,
      fieldsWritten: [],
    };
  } catch {
    return null;
  }
}

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

  // Prefer server route (API key) for reliable permissions
  const server = await tryServerWriteback(input);
  if (server && (server.mode === "appwrite" || server.mode === "skipped")) {
    return server;
  }

  const db = getDb();
  if (!db) {
    return {
      ok: false,
      mode: "session_only",
      error: server?.error || "Appwrite client unavailable",
    };
  }

  const full = buildFillOnlyPayload(
    input.product,
    input.patch,
    input.externalIds,
    input.provenance,
  );

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
      error:
        server?.error || "Could not resolve Appwrite document id",
    };
  }

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
    }
  }

  return {
    ok: false,
    mode: "session_only",
    documentId: docId,
    error: lastErr || server?.error || "updateDocument failed",
  };
}

function pickOptional(full: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ["rxcui", "pubchem_cid", "field_sources", "last_enriched_at"]) {
    if (full[k] != null) out[k] = full[k];
  }
  return out;
}
