/**
 * submit-annotation — RLAIF correction vote.
 * 3-vote majority → approved; trust_score +5 (majority agree) / -2 (disagree with majority when settled).
 */
import { Client, Databases, ID, Query } from "node-appwrite";
import { z } from "zod";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_ANN = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";
const COL_TRUST = process.env.USER_TRUST_COLLECTION_ID || "user_trust";
const COL_PROFILES = process.env.USER_PROFILES_COLLECTION_ID || "user_profiles";
const VOTES_NEEDED = Number(process.env.RLAIF_VOTES_NEEDED || 3);
const REWARD = Number(process.env.RLAIF_TRUST_REWARD || 5);
const PENALTY = Number(process.env.RLAIF_TRUST_PENALTY || 2);

const InputSchema = z.object({
  annotation_id: z.string().min(1),
  pharmacist_id: z.string().min(1),
  corrected_json: z.union([z.array(z.any()), z.record(z.any()), z.string()]),
  ballot: z.enum(["approve", "reject", "correct"]).optional().default("correct"),
});

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-appwrite-project,x-appwrite-key",
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function getClient() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

function normalizeVotes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [raw];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

function fingerprint(payload) {
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  // stable-ish fingerprint for majority compare
  return s.replace(/\s+/g, " ").trim().slice(0, 4000);
}

async function bumpTrust(db, userId, delta, log) {
  if (!userId || !delta) return null;
  let doc = null;
  try {
    doc = await db.getDocument(DB, COL_TRUST, userId);
  } catch {
    try {
      const list = await db.listDocuments(DB, COL_TRUST, [
        Query.equal("user_id", userId),
        Query.limit(1),
      ]);
      doc = list.documents[0] || null;
    } catch (e) {
      log(`trust lookup: ${e.message || e}`);
    }
  }
  const prev = Number(doc?.trust_score || 50);
  const next = Math.max(0, Math.round((prev + delta) * 100) / 100);
  const patch = {
    user_id: userId,
    trust_score: next,
    updated_at: new Date().toISOString(),
  };
  if (delta > 0) patch.approved_count = Number(doc?.approved_count || 0) + 1;
  if (delta < 0) patch.rejected_count = Number(doc?.rejected_count || 0) + 1;

  try {
    if (doc) {
      await db.updateDocument(DB, COL_TRUST, doc.$id, patch);
    } else {
      await db.createDocument(DB, COL_TRUST, userId, {
        ...patch,
        approved_count: delta > 0 ? 1 : 0,
        rejected_count: delta < 0 ? 1 : 0,
        is_pharmacist: true,
      });
    }
  } catch (e) {
    log(`trust write: ${e.message || e}`);
  }

  // best-effort mirror on user_profiles
  try {
    const profiles = await db.listDocuments(DB, COL_PROFILES, [
      Query.equal("user_id", userId),
      Query.limit(1),
    ]);
    if (profiles.documents[0]) {
      await db.updateDocument(DB, COL_PROFILES, profiles.documents[0].$id, {
        trust_score: next,
      });
    }
  } catch (e) {
    log(`profile trust mirror: ${e.message || e}`);
  }
  return next;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const parsed = InputSchema.safeParse(parseBody(req));
  if (!parsed.success) {
    return json(res, 400, {
      success: false,
      error: "Invalid input",
      issues: parsed.error.issues,
    });
  }
  const input = parsed.data;
  const client = getClient();
  if (!client) {
    return json(res, 500, { success: false, error: "Missing Appwrite credentials" });
  }
  const db = new Databases(client);

  try {
    const ann = await db.getDocument(DB, COL_ANN, input.annotation_id);
    if (["approved", "used_for_training"].includes(String(ann.status))) {
      return json(res, 409, { success: false, error: "Annotation already settled" });
    }

    const corrected =
      typeof input.corrected_json === "string"
        ? input.corrected_json
        : JSON.stringify(input.corrected_json);
    const fp = fingerprint(corrected);
    const voteToken = `${input.pharmacist_id}:${input.ballot}:${fp.slice(0, 64)}`;

    let votes = normalizeVotes(ann.votes);
    votes = votes.filter((v) => !String(v).startsWith(`${input.pharmacist_id}:`));
    votes.push(voteToken);

    const patch = {
      votes: Array.isArray(ann.votes) ? votes : JSON.stringify(votes),
      status: "in_review",
      ground_truth_json: corrected,
    };

    // majority by fingerprint of corrected payload
    const byFp = new Map();
    for (const v of votes) {
      const parts = String(v).split(":");
      const key = parts.slice(2).join(":") || parts[1] || "x";
      byFp.set(key, (byFp.get(key) || 0) + 1);
    }
    let majorityFp = null;
    let majorityCount = 0;
    for (const [k, c] of byFp) {
      if (c > majorityCount) {
        majorityCount = c;
        majorityFp = k;
      }
    }

    let settled = false;
    let rewards = [];
    if (votes.length >= VOTES_NEEDED && majorityCount >= Math.ceil(VOTES_NEEDED / 2) + (VOTES_NEEDED % 2 === 0 ? 0 : 0)) {
      // require strict majority among collected votes, and at least VOTES_NEEDED votes
      const needed = Math.floor(VOTES_NEEDED / 2) + 1;
      if (majorityCount >= needed && votes.length >= VOTES_NEEDED) {
        settled = true;
        patch.status = "approved";
        // pick a ground truth from a majority voter
        const winner = votes.find((v) => String(v).includes(`:${majorityFp}`));
        if (winner) {
          // keep current ground_truth_json if this submission matches majority
          if (fp.slice(0, 64) === majorityFp) patch.ground_truth_json = corrected;
        }
        for (const v of votes) {
          const pid = String(v).split(":")[0];
          const agrees = String(v).includes(`:${majorityFp}`);
          const delta = agrees ? REWARD : -PENALTY;
          const score = await bumpTrust(db, pid, delta, log);
          rewards.push({ pharmacist_id: pid, delta, trust_score: score });
        }
      }
    }

    await db.updateDocument(DB, COL_ANN, input.annotation_id, patch);

    return json(res, 200, {
      success: true,
      annotation_id: input.annotation_id,
      votes: votes.length,
      votes_needed: VOTES_NEEDED,
      status: patch.status,
      settled,
      rewards,
    });
  } catch (err) {
    error(String(err.message || err));
    return json(res, 500, { success: false, error: String(err.message || err) });
  }
};
