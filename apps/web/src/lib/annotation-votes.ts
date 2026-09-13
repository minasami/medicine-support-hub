/**
 * Basic RLAIF voting on `annotations` (3 high-trust users).
 * Vertex MedGemma fine-tune stays deferred in retrainModel.
 */
import { Query, ExecutionMethod } from "appwrite";
import { account, databases, functions } from "@/lib/appwrite";

const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COL_ANN = "annotations";

export type AnnotationRow = {
  $id: string;
  drug_name?: string;
  label_json?: string;
  votes?: string[];
  status?: string;
  confidence?: number;
  created_at?: string;
  user_id?: string;
};

export async function listPendingAnnotations(limit = 20): Promise<AnnotationRow[]> {
  const res = await databases.listDocuments(DATABASE_ID, COL_ANN, [
    Query.equal("status", "pending"),
    Query.orderDesc("created_at"),
    Query.limit(limit),
  ]);
  return (res.documents || []) as unknown as AnnotationRow[];
}

export async function voteOnAnnotation(
  annotationId: string,
  ballot: "up" | "down",
): Promise<{ votes: string[]; status?: string }> {
  const user = await account.get();
  const userId = user.$id;
  const doc = await databases.getDocument(DATABASE_ID, COL_ANN, annotationId);
  const existing = Array.isArray(doc.votes) ? doc.votes.map(String) : [];
  const filtered = existing.filter((v) => !String(v).startsWith(`${userId}:`));
  const next = [...filtered, `${userId}:${ballot}`];
  await databases.updateDocument(DATABASE_ID, COL_ANN, annotationId, { votes: next });

  let status = String(doc.status || "pending");
  try {
    const execution = await functions.createExecution(
      "processContribution",
      JSON.stringify({ annotation_id: annotationId, vote: ballot }),
      false,
      "/",
      ExecutionMethod.POST,
    );
    const raw = execution.responseBody || "{}";
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.tally?.status) status = String(data.tally.status);
  } catch {
    /* leave pending; function/event will tally later */
  }
  return { votes: next, status };
}
