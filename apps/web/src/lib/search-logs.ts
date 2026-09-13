/**
 * Best-effort search click logging → Appwrite `search_logs`.
 * Never throws into UX; failures are swallowed.
 */
import { ID } from "appwrite";
import { account, databases } from "@/lib/appwrite";

const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COLLECTION_ID = "search_logs";

export type SearchLogPayload = {
  query?: string;
  drugId?: string;
  medicineId?: string;
  canonicalId?: number | null;
  source?: "encyclopedia" | "global_search" | "world_search" | string;
};

export async function logSearchClick(payload: SearchLogPayload): Promise<void> {
  try {
    let userId = "";
    try {
      const user = await account.get();
      userId = user?.$id || "";
    } catch {
      /* anonymous ok */
    }

    await databases.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
      user_id: userId || undefined,
      query: String(payload.query || "").slice(0, 256),
      drug_id: payload.drugId || payload.medicineId || undefined,
      medicine_id: payload.medicineId || payload.drugId || undefined,
      canonical_id:
        payload.canonicalId != null && Number.isFinite(Number(payload.canonicalId))
          ? Number(payload.canonicalId)
          : undefined,
      timestamp: new Date().toISOString(),
      source: payload.source || "encyclopedia",
    });
  } catch {
    /* best-effort — do not break UX */
  }
}
