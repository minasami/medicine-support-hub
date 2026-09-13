/**
 * retrainModel — weekly RLAIF stub (does NOT block this PR).
 *
 * Intended schedule: `0 4 * * 0` (Sunday 04:00 UTC).
 *
 * Full loop (next slice):
 *   1. Collect annotations with status=approved and votes from ≥3 trusted users
 *   2. Compute trust_score per annotator
 *   3. Export training pack for Vertex AI MedGemma fine-tune
 *   4. Kick off Vertex job via VERTEX_* / GOOGLE_CLOUD_* credentials
 *
 * This scaffold only summarizes annotation queue stats.
 */

import { Client, Databases, Query } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
}

function getDb() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Databases(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );
}

export default async ({ req, res, log }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const db = getDb();
  const stats = { pending: 0, approved: 0, rejected: 0, total: 0 };

  if (db) {
    try {
      for (const status of ["pending", "approved", "rejected"]) {
        const r = await db.listDocuments(DB, COL, [
          Query.equal("status", status),
          Query.limit(1),
        ]);
        stats[status] = r.total || 0;
        stats.total += r.total || 0;
      }
    } catch (e) {
      log(`annotations stats: ${e.message || e}`);
    }
  }

  log("retrainModel stub — no Vertex fine-tune in this slice");
  return json(res, 200, {
    success: true,
    stub: true,
    message:
      "RLAIF retrain scaffold only. Wire Vertex MedGemma fine-tune when ≥3-user trust_score voting is live.",
    annotation_stats: stats,
    todos: [
      "Voting UI lives at /annotations; tally via processContribution (3 high-trust users)",
      "Export approved label_json packs",
      "Call Vertex AI custom training with VERTEX_* credentials",
    ],
  });
};
