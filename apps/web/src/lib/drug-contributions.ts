/**
 * Client helpers for barcode-wiki contributions → drug_contributions + processContribution.
 */
import { ID, ExecutionMethod } from "appwrite";
import { account, databases, functions } from "@/lib/appwrite";
import { fetchMedicinesPage, type MedicineListItem } from "@/lib/medicines-appwrite-page";
import { computeTrustScore, shouldAutoApprove, accountAgeDaysFrom } from "@/lib/trust-score";

const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COL_CONTRIB = "drug_contributions";
const COL_TRUST = "user_trust";

export type ContributionKind = "link_barcode" | "create_product";

export type ContributionPayload = {
  barcode: string;
  kind: ContributionKind;
  medicine_id?: string;
  canonical_id?: number | null;
  name_en?: string;
  name_ar?: string;
  manufacturer?: string;
  scientific_name?: string;
  notes?: string;
};

export type ContributionResult = {
  id: string;
  status: string;
  auto_approved?: boolean;
  trust_score?: number;
};

export async function currentUserId(): Promise<string | null> {
  try {
    const user = await account.get();
    return user?.$id || null;
  } catch {
    return null;
  }
}

export async function searchMedicinesForWiki(query: string): Promise<MedicineListItem[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const page = await fetchMedicinesPage({ limit: 12, filters: { query: term } });
  return page.items || [];
}

export async function readTrustScore(userId: string): Promise<number | null> {
  try {
    const doc = await databases.getDocument(DATABASE_ID, COL_TRUST, userId);
    if (doc?.trust_score != null) return Number(doc.trust_score);
  } catch {
    try {
      const { Query } = await import("appwrite");
      const list = await databases.listDocuments(DATABASE_ID, COL_TRUST, [
        Query.equal("user_id", userId),
        Query.limit(1),
      ]);
      const d = list.documents?.[0];
      if (d?.trust_score != null) return Number(d.trust_score);
    } catch {
      /* none */
    }
  }
  return null;
}

export async function createDrugContribution(
  input: ContributionPayload,
): Promise<ContributionResult> {
  const user = await account.get();
  const userId = user.$id;
  const barcode = String(input.barcode || "").replace(/\D/g, "");
  if (barcode.length < 8) throw new Error("Barcode must be at least 8 digits");
  if (input.kind === "create_product" && !String(input.name_en || "").trim()) {
    throw new Error("Product name is required");
  }
  if (input.kind === "link_barcode" && !input.medicine_id && !input.canonical_id) {
    throw new Error("Pick an existing medicine");
  }

  const storedTrust = await readTrustScore(userId);
  const fallbackScore = computeTrustScore({
    accountAgeDays: accountAgeDaysFrom(user.$createdAt),
    isPharmacist: Array.isArray(user.labels)
      ? user.labels.some((l: string) => /pharm/i.test(l))
      : false,
    isVerifiedRep: Array.isArray(user.labels)
      ? user.labels.some((l: string) => /verif/i.test(l))
      : false,
  });
  const trustScore = storedTrust ?? fallbackScore;

  const payload = {
    barcode,
    kind: input.kind,
    medicine_id: input.medicine_id || undefined,
    canonical_id: input.canonical_id ?? undefined,
    name_en: input.name_en?.trim() || undefined,
    name_ar: input.name_ar?.trim() || undefined,
    manufacturer: input.manufacturer?.trim() || undefined,
    scientific_name: input.scientific_name?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
  };

  const doc = await databases.createDocument(DATABASE_ID, COL_CONTRIB, ID.unique(), {
    barcode,
    medicine_id: input.medicine_id || undefined,
    canonical_id:
      input.canonical_id != null && Number.isFinite(Number(input.canonical_id))
        ? Number(input.canonical_id)
        : undefined,
    kind: input.kind,
    payload: JSON.stringify(payload),
    contributor_id: userId,
    status: "pending",
    created_at: new Date().toISOString(),
    trust_score_at_submit: trustScore,
    name_en: input.name_en?.trim() || undefined,
    name_ar: input.name_ar?.trim() || undefined,
  });

  let processed: { status?: string; auto_approved?: boolean; trust_score?: number } | null =
    null;
  try {
    const execution = await functions.createExecution(
      "processContribution",
      JSON.stringify({ contribution_id: doc.$id }),
      false,
      "/",
      ExecutionMethod.POST,
    );
    const raw = execution.responseBody || "{}";
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    processed = data.result || data;
  } catch {
    /* event trigger / admin queue is the fallback */
  }

  return {
    id: doc.$id,
    status: processed?.status || "pending",
    auto_approved: processed?.auto_approved,
    trust_score: processed?.trust_score ?? trustScore,
  };
}

export { shouldAutoApprove };
