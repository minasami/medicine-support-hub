/**
 * Platform-admin catalog actions on medicines: edit, hide/unhide, merge.
 * Writes Appwrite `medicines` (+ optional audit docs). Client-gated via
 * isPlatformAdminUser; server permissions still apply.
 */
import { ID, Query } from "appwrite";
import { databases } from "@/lib/appwrite";
import type { MedicineListItem } from "@/lib/medicines-appwrite-page";

const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const MEDICINES_ID = "medicines";
const AUDIT_ID = "catalog_admin_audit";
const FLAGS_ID = "catalog_quality_flags";

export type CatalogEditFields = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
  dosage_form?: string | null;
  drug_class?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  current_price_egp?: number | null;
  description?: string | null;
};

export type CatalogAdminResult = {
  ok: boolean;
  message: string;
  documentId?: string;
  error?: string;
};

function cleanStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

async function writeAudit(entry: Record<string, unknown>): Promise<void> {
  try {
    await databases.createDocument(DATABASE_ID, AUDIT_ID, ID.unique(), {
      ...entry,
      at: new Date().toISOString(),
    });
  } catch {
    /* audit collection may not exist yet — best effort */
  }
}

export async function resolveMedicineDocId(
  item: Pick<MedicineListItem, "$id" | "canonical_id">,
): Promise<string | null> {
  if (item.$id) return item.$id;
  const cid = Number(item.canonical_id);
  if (!Number.isFinite(cid) || cid <= 0) return null;
  try {
    const byMed = await databases.getDocument(
      DATABASE_ID,
      MEDICINES_ID,
      `med_${cid}`,
    );
    if (byMed?.$id) return byMed.$id;
  } catch {
    /* fall through */
  }
  try {
    const res = await databases.listDocuments(DATABASE_ID, MEDICINES_ID, [
      Query.equal("canonical_id", [cid]),
      Query.limit(1),
    ]);
    const doc = res.documents?.[0];
    return doc?.$id || null;
  } catch {
    return null;
  }
}

export async function setMedicineHidden(opts: {
  item: Pick<MedicineListItem, "$id" | "canonical_id" | "name_en">;
  hidden: boolean;
  actorEmail?: string | null;
  reason?: string;
}): Promise<CatalogAdminResult> {
  const docId = await resolveMedicineDocId(opts.item);
  if (!docId) {
    return { ok: false, message: "Could not resolve medicine document id." };
  }
  try {
    await databases.updateDocument(DATABASE_ID, MEDICINES_ID, docId, {
      is_hidden: opts.hidden,
    });
    await writeAudit({
      action: opts.hidden ? "hide" : "unhide",
      medicine_id: docId,
      canonical_id: opts.item.canonical_id ?? null,
      actor_email: opts.actorEmail || "",
      reason: opts.reason || "",
      detail: opts.item.name_en || "",
    });
    return {
      ok: true,
      documentId: docId,
      message: opts.hidden ? "Product hidden from public catalog." : "Product unhidden.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: "Hide/unhide failed.", error: msg, documentId: docId };
  }
}

export async function editMedicineFields(opts: {
  item: Pick<MedicineListItem, "$id" | "canonical_id" | "name_en">;
  fields: CatalogEditFields;
  actorEmail?: string | null;
}): Promise<CatalogAdminResult> {
  const docId = await resolveMedicineDocId(opts.item);
  if (!docId) {
    return { ok: false, message: "Could not resolve medicine document id." };
  }
  const payload: Record<string, unknown> = {};
  const f = opts.fields;
  for (const key of [
    "name_en",
    "name_ar",
    "scientific_name",
    "manufacturer",
    "strength",
    "dosage_form",
    "drug_class",
    "barcode",
    "image_url",
    "description",
  ] as const) {
    if (f[key] !== undefined) payload[key] = cleanStr(f[key]) ?? null;
  }
  if (f.current_price_egp !== undefined) {
    const n = f.current_price_egp == null ? null : Number(f.current_price_egp);
    payload.current_price_egp = n != null && Number.isFinite(n) ? n : null;
  }
  if (!Object.keys(payload).length) {
    return { ok: false, message: "No fields to update." };
  }
  try {
    await databases.updateDocument(DATABASE_ID, MEDICINES_ID, docId, payload);
    await writeAudit({
      action: "edit",
      medicine_id: docId,
      canonical_id: opts.item.canonical_id ?? null,
      actor_email: opts.actorEmail || "",
      reason: "",
      detail: JSON.stringify(Object.keys(payload)),
    });
    return {
      ok: true,
      documentId: docId,
      message: `Updated ${Object.keys(payload).length} field(s).`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: "Edit failed.", error: msg, documentId: docId };
  }
}

/**
 * Merge source into target: copy missing fields onto target, hide source,
 * set merged_into_* redirect, write audit. Does not delete source.
 */
export async function mergeMedicineIntoTarget(opts: {
  source: MedicineListItem;
  target: MedicineListItem;
  actorEmail?: string | null;
  reason?: string;
}): Promise<CatalogAdminResult> {
  const sourceId = await resolveMedicineDocId(opts.source);
  const targetId = await resolveMedicineDocId(opts.target);
  if (!sourceId || !targetId) {
    return { ok: false, message: "Could not resolve source or target document." };
  }
  if (sourceId === targetId) {
    return { ok: false, message: "Source and target must be different." };
  }

  const fillKeys = [
    "name_ar",
    "scientific_name",
    "manufacturer",
    "strength",
    "dosage_form",
    "drug_class",
    "barcode",
    "image_url",
    "description",
    "ingredients",
    "category",
    "route",
  ] as const;

  const targetPatch: Record<string, unknown> = {};
  for (const k of fillKeys) {
    const tv = (opts.target as Record<string, unknown>)[k];
    const sv = (opts.source as Record<string, unknown>)[k];
    const tEmpty = tv == null || String(tv).trim() === "";
    const sOk = sv != null && String(sv).trim() !== "";
    if (tEmpty && sOk) targetPatch[k] = sv;
  }
  if (
    (opts.target.current_price_egp == null ||
      !Number.isFinite(Number(opts.target.current_price_egp))) &&
    opts.source.current_price_egp != null &&
    Number.isFinite(Number(opts.source.current_price_egp))
  ) {
    targetPatch.current_price_egp = Number(opts.source.current_price_egp);
  }

  try {
    if (Object.keys(targetPatch).length) {
      await databases.updateDocument(DATABASE_ID, MEDICINES_ID, targetId, targetPatch);
    }
    await databases.updateDocument(DATABASE_ID, MEDICINES_ID, sourceId, {
      is_hidden: true,
      merged_into_id: targetId,
      merged_into_canonical_id: opts.target.canonical_id || null,
      lifecycle_status: "archived",
    });
    await writeAudit({
      action: "merge",
      medicine_id: sourceId,
      canonical_id: opts.source.canonical_id ?? null,
      actor_email: opts.actorEmail || "",
      reason: opts.reason || "admin_merge",
      detail: JSON.stringify({
        target_id: targetId,
        target_canonical_id: opts.target.canonical_id,
        fields_copied: Object.keys(targetPatch),
      }),
    });
    // Mark related open duplicate flags as resolved when possible
    try {
      const flags = await databases.listDocuments(DATABASE_ID, FLAGS_ID, [
        Query.equal("medicine_id", [sourceId]),
        Query.equal("status", ["open"]),
        Query.limit(25),
      ]);
      for (const f of flags.documents || []) {
        await databases.updateDocument(DATABASE_ID, FLAGS_ID, f.$id, {
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution: `merged_into:${targetId}`,
        });
      }
    } catch {
      /* flags optional */
    }
    return {
      ok: true,
      documentId: targetId,
      message: `Merged into ${opts.target.name_en || targetId}; source hidden.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: "Merge failed.", error: msg };
  }
}

export type QualityFlag = {
  $id: string;
  medicine_id?: string;
  canonical_id?: number;
  flag_type: string;
  severity?: string;
  status?: string;
  score?: number;
  summary?: string;
  detail_json?: string;
  peer_medicine_id?: string;
  peer_canonical_id?: number;
  name_en?: string;
  created_at?: string;
};

export async function listCatalogQualityFlags(opts?: {
  status?: string;
  limit?: number;
}): Promise<QualityFlag[]> {
  const status = opts?.status || "open";
  const limit = Math.min(opts?.limit ?? 50, 100);
  try {
    const res = await databases.listDocuments(DATABASE_ID, FLAGS_ID, [
      Query.equal("status", [status]),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ]);
    return (res.documents || []).map((d) => ({
      $id: d.$id,
      medicine_id: (d as { medicine_id?: string }).medicine_id,
      canonical_id: (d as { canonical_id?: number }).canonical_id,
      flag_type: String((d as { flag_type?: string }).flag_type || ""),
      severity: (d as { severity?: string }).severity,
      status: (d as { status?: string }).status,
      score: (d as { score?: number }).score,
      summary: (d as { summary?: string }).summary,
      detail_json: (d as { detail_json?: string }).detail_json,
      peer_medicine_id: (d as { peer_medicine_id?: string }).peer_medicine_id,
      peer_canonical_id: (d as { peer_canonical_id?: number }).peer_canonical_id,
      name_en: (d as { name_en?: string }).name_en,
      created_at: (d as { $createdAt?: string }).$createdAt,
    }));
  } catch {
    return [];
  }
}

export async function resolveQualityFlag(
  flagId: string,
  resolution: string,
): Promise<CatalogAdminResult> {
  try {
    await databases.updateDocument(DATABASE_ID, FLAGS_ID, flagId, {
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution: resolution.slice(0, 256),
    });
    return { ok: true, message: "Flag resolved." };
  } catch (e) {
    return {
      ok: false,
      message: "Could not resolve flag.",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function searchMergeCandidates(
  query: string,
  excludeCanonicalId?: number,
): Promise<MedicineListItem[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  try {
    const res = await databases.listDocuments(DATABASE_ID, MEDICINES_ID, [
      Query.search("name_en", term),
      Query.limit(20),
    ]);
    return (res.documents || [])
      .map((d) => {
        const doc = d as Record<string, unknown>;
        return {
          $id: d.$id,
          canonical_id: Number(doc.canonical_id || 0),
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
          barcode: (doc.barcode as string) || null,
          is_hidden: Boolean(doc.is_hidden),
        } as MedicineListItem;
      })
      .filter(
        (m) =>
          !excludeCanonicalId ||
          Number(m.canonical_id) !== Number(excludeCanonicalId),
      );
  } catch {
    return [];
  }
}
