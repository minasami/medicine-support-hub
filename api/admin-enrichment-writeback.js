/**
 * POST /api/admin-enrichment-writeback
 *
 * Platform-admin / founder only. Fill-only Appwrite medicine update using
 * server APPWRITE_API_KEY (reliable vs browser SDK permissions).
 *
 * Body:
 *   {
 *     document_id?: string,
 *     canonical_id?: number,
 *     patch: { scientific_name?, manufacturer?, drug_class?, image_url?, indications? },
 *     provenance?: Record<string,string>,
 *     external_ids?: { rxcui?, pubchem_cid? },
 *     actor_email?: string
 *   }
 */

import {
  appwriteConfig,
  appwriteGetDocument,
  appwriteListDocuments,
  appwritePatchDocument,
  errorStatus,
  parseBody,
  requirePlatformAdmin,
  sendJson,
} from "./_platform-server.js";

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === "string") return !v.trim();
  if (typeof v === "number") return !Number.isFinite(v);
  return false;
}

function buildFillOnly(existing, patch, externalIds, provenance) {
  const data = {};
  const reasons = [];
  const p = patch || {};

  const tryFill = (key, targetKey) => {
    const dest = targetKey || key;
    if (!isEmpty(existing?.[dest])) return;
    const v = p[key];
    if (typeof v === "string" && v.trim()) {
      data[dest] = v.trim();
      reasons.push(`fill_${dest}`);
    }
  };

  tryFill("scientific_name");
  tryFill("manufacturer");
  tryFill("drug_class");
  tryFill("image_url");
  if (isEmpty(existing?.description) && isEmpty(existing?.indications)) {
    if (typeof p.indications === "string" && p.indications.trim()) {
      data.description = p.indications.trim();
      reasons.push("fill_description");
    }
  }

  if (externalIds?.rxcui && isEmpty(existing?.rxcui)) {
    data.rxcui = String(externalIds.rxcui);
    reasons.push("fill_rxcui");
  }
  if (externalIds?.pubchem_cid && isEmpty(existing?.pubchem_cid)) {
    data.pubchem_cid = String(externalIds.pubchem_cid);
    reasons.push("fill_pubchem_cid");
  }

  if (provenance && Object.keys(provenance).length) {
    data.field_sources = JSON.stringify(provenance);
    data.last_enriched_at = new Date().toISOString();
  }

  return { data, reasons };
}

async function resolveDocumentId(documentId, canonicalId) {
  const { medicines } = appwriteConfig();
  if (documentId) {
    const direct = await appwriteGetDocument(medicines, documentId);
    if (direct?.$id) return { id: direct.$id, doc: direct };
  }
  const cid = Number(canonicalId);
  if (Number.isFinite(cid) && cid > 0) {
    const byMed = await appwriteGetDocument(medicines, `med_${cid}`);
    if (byMed?.$id) return { id: byMed.$id, doc: byMed };
    const listed = await appwriteListDocuments(medicines, [
      JSON.stringify({ method: "equal", attribute: "canonical_id", values: [cid] }),
      JSON.stringify({ method: "limit", values: [1] }),
    ]).catch(() => null);
    // Appwrite REST query format uses Query helpers encoded differently;
    // fallback: try get med_ id only above.
    const doc = listed?.documents?.[0];
    if (doc?.$id) return { id: doc.$id, doc };
  }
  return { id: null, doc: null };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { message: "POST required." });
  }

  try {
    const admin = await requirePlatformAdmin(request);
    const body = parseBody(request);
    const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
    const documentId = body.document_id ? String(body.document_id).trim() : "";
    const canonicalId = body.canonical_id != null ? Number(body.canonical_id) : null;
    const externalIds = body.external_ids || {};
    const provenance = body.provenance || {};

    if (!Object.keys(patch).length && !externalIds.rxcui && !externalIds.pubchem_cid) {
      return sendJson(response, 400, { message: "patch or external_ids required." });
    }

    const { medicines } = appwriteConfig();
    if (!appwriteConfig().key) {
      return sendJson(response, 503, {
        message: "APPWRITE_API_KEY is not configured on the server.",
      });
    }

    let resolved = await resolveDocumentId(documentId, canonicalId);
    // Simpler list via REST query string if needed
    if (!resolved.id && Number.isFinite(canonicalId) && canonicalId > 0) {
      const { endpoint, project, key, database } = appwriteConfig();
      const q = encodeURIComponent(`equal("canonical_id",[${canonicalId}])`);
      const url = `${endpoint}/databases/${database}/collections/${medicines}/documents?queries[]=${q}&queries[]=${encodeURIComponent('limit(1)')}`;
      const res = await fetch(url, {
        headers: { "X-Appwrite-Project": project, "X-Appwrite-Key": key },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        const doc = data.documents?.[0];
        if (doc) resolved = { id: doc.$id, doc };
      }
    }

    if (!resolved.id) {
      return sendJson(response, 404, {
        message: "Medicine document not found in Appwrite.",
        document_id: documentId || null,
        canonical_id: canonicalId,
      });
    }

    const { data, reasons } = buildFillOnly(
      resolved.doc,
      patch,
      externalIds,
      provenance,
    );

    if (!Object.keys(data).length) {
      return sendJson(response, 200, {
        ok: true,
        applied: false,
        message: "No empty fields to fill.",
        document_id: resolved.id,
        reasons: [],
        admin: admin.profile.full_name || admin.user.email,
      });
    }

    await appwritePatchDocument(medicines, resolved.id, data);

    return sendJson(response, 200, {
      ok: true,
      applied: true,
      document_id: resolved.id,
      fields_written: Object.keys(data),
      reasons,
      message: `Filled ${Object.keys(data).length} field(s) on ${resolved.id}.`,
      admin: admin.profile.full_name || admin.user.email,
      via: admin.via,
    });
  } catch (error) {
    console.error("admin-enrichment-writeback", error);
    return sendJson(response, errorStatus(error), {
      message:
        error instanceof Error ? error.message : "Enrichment write-back failed.",
    });
  }
}
