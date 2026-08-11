/**
 * Adaptive Signal Aggregator (Appwrite Function)
 *
 * Ingests privacy-preserving search signals, aggregates alias candidates,
 * and supports human approve/reject before shared catalog rules change.
 *
 * Actions (JSON body.action):
 *  - ingest     { events: AnonEvent[] }
 *  - list_pending
 *  - approve    { fromQuery, toQuery, reviewer? }
 *  - reject     { fromQuery, toQuery, reviewer? }
 *  - list_approved
 *  - stats
 *
 * Collections (create once in Console — see docs):
 *  - adaptive_signal_daily
 *  - adaptive_alias_candidates
 *  - adaptive_alias_decisions
 */

import { Client, Databases, ID, Query } from "node-appwrite";
import { createHash } from "node:crypto";

const DB =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.DATABASE_ID ||
  "medicine_support_hub";
const COL_DAILY = process.env.ADAPTIVE_DAILY_COLLECTION || "adaptive_signal_daily";
const COL_CANDIDATES =
  process.env.ADAPTIVE_CANDIDATES_COLLECTION || "adaptive_alias_candidates";
const COL_DECISIONS =
  process.env.ADAPTIVE_DECISIONS_COLLECTION || "adaptive_alias_decisions";

/** Minimum independent supports before candidate is reviewable */
const MIN_SUPPORT = Number(process.env.ADAPTIVE_MIN_SUPPORT || 3);

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-appwrite-project,x-adaptive-key",
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

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Normalize query for aggregation (no PII). */
function normQuery(q) {
  return String(q || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

/** Non-reversible fingerprint for optional analytics (not stored with raw if POLICY=hash_only). */
function fingerprint(q, salt) {
  return createHash("sha256")
    .update(`${salt}|${normQuery(q)}`)
    .digest("hex")
    .slice(0, 24);
}

function getDb() {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  return new Databases(client);
}

function requireAdmin(req, body) {
  const adminKey = process.env.ADAPTIVE_ADMIN_KEY || "";
  if (!adminKey) return true; // if unset, allow (dev); set in prod
  const hdr = req.headers["x-adaptive-key"] || req.headers["X-Adaptive-Key"] || "";
  const bodyKey = body.adminKey || "";
  return hdr === adminKey || bodyKey === adminKey;
}

async function upsertCandidate(db, fromQuery, toQuery, delta = 1) {
  const from = normQuery(fromQuery);
  const to = normQuery(toQuery);
  if (!from || !to || from === to) return null;
  if (from.length < 3 || to.length < 3) return null;

  const key = `${from}=>${to}`;
  const existing = await db.listDocuments(DB, COL_CANDIDATES, [
    Query.equal("pair_key", [key]),
    Query.limit(1),
  ]);

  if (existing.documents?.length) {
    const doc = existing.documents[0];
    const support = Number(doc.support || 0) + delta;
    const status =
      doc.status === "approved" || doc.status === "rejected"
        ? doc.status
        : support >= MIN_SUPPORT
          ? "pending_review"
          : "accumulating";
    return db.updateDocument(DB, COL_CANDIDATES, doc.$id, {
      support,
      status,
      last_seen: new Date().toISOString(),
    });
  }

  return db.createDocument(DB, COL_CANDIDATES, ID.unique(), {
    pair_key: key,
    from_query: from,
    to_query: to,
    support: delta,
    status: delta >= MIN_SUPPORT ? "pending_review" : "accumulating",
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  });
}

async function bumpDaily(db, type, count = 1) {
  const day = dayKey();
  const key = `${day}:${type}`;
  const existing = await db.listDocuments(DB, COL_DAILY, [
    Query.equal("day_type_key", [key]),
    Query.limit(1),
  ]);
  if (existing.documents?.length) {
    const doc = existing.documents[0];
    return db.updateDocument(DB, COL_DAILY, doc.$id, {
      count: Number(doc.count || 0) + count,
    });
  }
  return db.createDocument(DB, COL_DAILY, ID.unique(), {
    day_type_key: key,
    day,
    event_type: type,
    count,
  });
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  const body = parseBody(req);
  const action = (body.action || req.query?.action || "ingest").toLowerCase();
  const db = getDb();

  if (!db) {
    error("Appwrite DB client not configured (endpoint/project/key)");
    return json(res, 500, { ok: false, error: "server_not_configured" });
  }

  try {
    // ——— INGEST anonymized batch ———
    if (action === "ingest") {
      const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
      let accepted = 0;
      let aliases = 0;

      for (const ev of events) {
        const type = String(ev.type || "");
        if (
          ![
            "search_success",
            "search_empty",
            "result_click",
            "healing_recovery",
            "healing_failure",
            "query_reformulated",
          ].includes(type)
        ) {
          continue;
        }

        try {
          await bumpDaily(db, type, 1);
        } catch (e) {
          log(`daily bump skip: ${e.message || e}`);
        }

        // Alias candidates: explicit reformulation or empty→success pair from client
        if (type === "query_reformulated" && ev.fromQuery && ev.toQuery) {
          try {
            await upsertCandidate(db, ev.fromQuery, ev.toQuery, 1);
            aliases += 1;
          } catch (e) {
            log(`candidate skip: ${e.message || e}`);
          }
        }

        accepted += 1;
      }

      log(`ingest accepted=${accepted} aliases=${aliases}`);
      return json(res, 200, { ok: true, accepted, aliases });
    }

    // ——— LIST PENDING (human review queue) ———
    if (action === "list_pending") {
      if (!requireAdmin(req, body)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const list = await db.listDocuments(DB, COL_CANDIDATES, [
        Query.equal("status", ["pending_review"]),
        Query.orderDesc("support"),
        Query.limit(Math.min(Number(body.limit) || 50, 100)),
      ]);
      return json(res, 200, {
        ok: true,
        candidates: (list.documents || []).map((d) => ({
          id: d.$id,
          fromQuery: d.from_query,
          toQuery: d.to_query,
          support: d.support,
          status: d.status,
          lastSeen: d.last_seen,
        })),
      });
    }

    // ——— APPROVE (human gate) ———
    if (action === "approve") {
      if (!requireAdmin(req, body)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const from = normQuery(body.fromQuery);
      const to = normQuery(body.toQuery);
      if (!from || !to) {
        return json(res, 400, { ok: false, error: "fromQuery_and_toQuery_required" });
      }
      const pairKey = `${from}=>${to}`;

      // Mark candidate
      const existing = await db.listDocuments(DB, COL_CANDIDATES, [
        Query.equal("pair_key", [pairKey]),
        Query.limit(1),
      ]);
      if (existing.documents?.length) {
        await db.updateDocument(DB, COL_CANDIDATES, existing.documents[0].$id, {
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewer: String(body.reviewer || "admin").slice(0, 80),
        });
      }

      await db.createDocument(DB, COL_DECISIONS, ID.unique(), {
        pair_key: pairKey,
        from_query: from,
        to_query: to,
        decision: "approved",
        reviewer: String(body.reviewer || "admin").slice(0, 80),
        note: String(body.note || "").slice(0, 240),
        decided_at: new Date().toISOString(),
        promoted: false,
      });

      log(`approved ${pairKey}`);
      return json(res, 200, {
        ok: true,
        decision: "approved",
        pairKey,
        next: "Run scripts/promote-approved-aliases.mjs to merge into expand-search-query.ts",
      });
    }

    // ——— REJECT ———
    if (action === "reject") {
      if (!requireAdmin(req, body)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const from = normQuery(body.fromQuery);
      const to = normQuery(body.toQuery);
      const pairKey = `${from}=>${to}`;

      const existing = await db.listDocuments(DB, COL_CANDIDATES, [
        Query.equal("pair_key", [pairKey]),
        Query.limit(1),
      ]);
      if (existing.documents?.length) {
        await db.updateDocument(DB, COL_CANDIDATES, existing.documents[0].$id, {
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewer: String(body.reviewer || "admin").slice(0, 80),
        });
      }

      await db.createDocument(DB, COL_DECISIONS, ID.unique(), {
        pair_key: pairKey,
        from_query: from,
        to_query: to,
        decision: "rejected",
        reviewer: String(body.reviewer || "admin").slice(0, 80),
        note: String(body.note || "").slice(0, 240),
        decided_at: new Date().toISOString(),
        promoted: false,
      });

      return json(res, 200, { ok: true, decision: "rejected", pairKey });
    }

    // ——— LIST APPROVED (for promote script) ———
    if (action === "list_approved") {
      if (!requireAdmin(req, body)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const list = await db.listDocuments(DB, COL_DECISIONS, [
        Query.equal("decision", ["approved"]),
        Query.equal("promoted", [false]),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
      return json(res, 200, {
        ok: true,
        approved: (list.documents || []).map((d) => ({
          id: d.$id,
          fromQuery: d.from_query,
          toQuery: d.to_query,
          reviewer: d.reviewer,
          decidedAt: d.decided_at,
        })),
      });
    }

    // ——— MARK PROMOTED ———
    if (action === "mark_promoted") {
      if (!requireAdmin(req, body)) {
        return json(res, 401, { ok: false, error: "unauthorized" });
      }
      const ids = Array.isArray(body.ids) ? body.ids : [];
      let n = 0;
      for (const id of ids.slice(0, 100)) {
        await db.updateDocument(DB, COL_DECISIONS, id, { promoted: true });
        n += 1;
      }
      return json(res, 200, { ok: true, marked: n });
    }

    // ——— STATS ———
    if (action === "stats") {
      const day = dayKey();
      const daily = await db.listDocuments(DB, COL_DAILY, [
        Query.equal("day", [day]),
        Query.limit(20),
      ]);
      const pending = await db.listDocuments(DB, COL_CANDIDATES, [
        Query.equal("status", ["pending_review"]),
        Query.limit(1),
      ]);
      return json(res, 200, {
        ok: true,
        day,
        daily: (daily.documents || []).map((d) => ({
          type: d.event_type,
          count: d.count,
        })),
        pendingReviewTotal: pending.total,
      });
    }

    return json(res, 400, { ok: false, error: "unknown_action", action });
  } catch (e) {
    error(String(e?.message || e));
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
};
