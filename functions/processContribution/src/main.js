/**
 * processContribution — barcode wiki + TrustScore gate.
 *
 * Triggers:
 *   - databases.medicine_support_hub.collections.drug_contributions.documents.*.create
 *   - databases.medicine_support_hub.collections.drug_contributions.documents.*.update
 *   - HTTP POST { contribution_id } | { process_pending: true } | { vote: ... }
 *
 * TrustScore:
 *   Approved*3 - Rejected*5 + AccountAgeDays/30 + IsVerifiedRep*20 + IsPharmacist*30
 * Auto-approve when score > 50.
 *
 * Safety / governance:
 *   - Contributions start as pending. Low-trust stays pending for admin.
 *   - link_barcode: writes barcode onto an existing medicine only if empty or same.
 *   - create_product: creates a medicines row with lifecycle_status=pending_review
 *     (not published). Public catalog treats missing lifecycle as legacy-visible.
 *   - Never overwrites a different existing barcode without admin.
 *
 * Env:
 *   APPWRITE_ENDPOINT / APPWRITE_FUNCTION_API_ENDPOINT
 *   APPWRITE_PROJECT_ID / APPWRITE_FUNCTION_PROJECT_ID
 *   APPWRITE_API_KEY (or function scopes: documents.read/write, users.read)
 *   APPWRITE_DATABASE_ID=medicine_support_hub
 */

import { Client, Databases, ID, Query, Users } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_CONTRIB = process.env.DRUG_CONTRIBUTIONS_COLLECTION_ID || "drug_contributions";
const COL_TRUST = process.env.USER_TRUST_COLLECTION_ID || "user_trust";
const COL_MED = process.env.MEDICINES_COLLECTION_ID || "medicines";
const COL_ANN = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";
const THRESHOLD = Number(process.env.TRUST_AUTO_APPROVE_THRESHOLD || 50);
const HIGH_TRUST_VOTERS = Number(process.env.RLAIF_HIGH_TRUST_VOTERS || 3);

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
  const key =
    process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

export function computeTrustScore({
  approved = 0,
  rejected = 0,
  accountAgeDays = 0,
  isVerifiedRep = 0,
  isPharmacist = 0,
} = {}) {
  const a = Math.max(0, Number(approved) || 0);
  const r = Math.max(0, Number(rejected) || 0);
  const age = Math.max(0, Number(accountAgeDays) || 0);
  const ver = isVerifiedRep === true || Number(isVerifiedRep) === 1 ? 1 : 0;
  const pharm = isPharmacist === true || Number(isPharmacist) === 1 ? 1 : 0;
  return Math.round((a * 3 - r * 5 + age / 30 + ver * 20 + pharm * 30) * 100) / 100;
}

function parsePayload(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function eventDocument(body) {
  const nested =
    typeof body.data === "string"
      ? (() => {
          try {
            return JSON.parse(body.data);
          } catch {
            return {};
          }
        })()
      : body.data || body;
  if (nested && (nested.$id || nested.barcode || nested.contributor_id)) return nested;
  if (body && (body.$id || body.barcode)) return body;
  return null;
}

async function loadUserHints(users, userId, log) {
  const hints = {
    accountCreatedAt: null,
    isPharmacist: false,
    isVerifiedRep: false,
    labels: [],
  };
  if (!users || !userId) return hints;
  try {
    const user = await users.get(userId);
    hints.accountCreatedAt = user.$createdAt || null;
    const labels = Array.isArray(user.labels) ? user.labels.map((l) => String(l).toLowerCase()) : [];
    hints.labels = labels;
    hints.isPharmacist = labels.some((l) =>
      ["pharmacist", "pharm", "pharmacy"].includes(l),
    );
    hints.isVerifiedRep = labels.some((l) =>
      ["verified_rep", "verified-rep", "company_rep", "verified"].includes(l),
    );
    const prefs = user.prefs && typeof user.prefs === "object" ? user.prefs : {};
    if (prefs.is_pharmacist === true || prefs.isPharmacist === true) hints.isPharmacist = true;
    if (prefs.is_verified_rep === true || prefs.isVerifiedRep === true) hints.isVerifiedRep = true;
    const role = String(prefs.role || prefs.user_role || "").toLowerCase();
    if (role === "pharmacist") hints.isPharmacist = true;
  } catch (e) {
    log?.(`users.get ${userId}: ${e.message || e}`);
  }
  return hints;
}

function ageDays(createdAt) {
  if (!createdAt) return 0;
  const t = Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

async function upsertTrust(db, userId, hints, bump, log) {
  let existing = null;
  try {
    existing = await db.getDocument(DB, COL_TRUST, userId);
  } catch {
    try {
      const list = await db.listDocuments(DB, COL_TRUST, [
        Query.equal("user_id", userId),
        Query.limit(1),
      ]);
      existing = list.documents?.[0] || null;
    } catch {
      existing = null;
    }
  }

  const approved =
    (existing ? Number(existing.approved_count) || 0 : 0) + (bump?.approved || 0);
  const rejected =
    (existing ? Number(existing.rejected_count) || 0 : 0) + (bump?.rejected || 0);
  const isPharmacist =
    hints.isPharmacist ||
    existing?.is_pharmacist === true ||
    Number(existing?.is_pharmacist) === 1;
  const isVerifiedRep =
    hints.isVerifiedRep ||
    existing?.is_verified_rep === true ||
    Number(existing?.is_verified_rep) === 1;
  const createdAt =
    existing?.account_created_at || hints.accountCreatedAt || new Date().toISOString();
  const score = computeTrustScore({
    approved,
    rejected,
    accountAgeDays: ageDays(createdAt),
    isVerifiedRep,
    isPharmacist,
  });

  const payload = {
    user_id: userId,
    approved_count: approved,
    rejected_count: rejected,
    account_created_at: createdAt,
    is_verified_rep: isVerifiedRep,
    is_pharmacist: isPharmacist,
    trust_score: score,
    updated_at: new Date().toISOString(),
  };

  try {
    if (existing) {
      await db.updateDocument(DB, COL_TRUST, existing.$id, payload);
    } else {
      await db.createDocument(DB, COL_TRUST, userId, payload);
    }
  } catch (e) {
    log?.(`upsertTrust: ${e.message || e}`);
    if (!existing) {
      try {
        await db.createDocument(DB, COL_TRUST, ID.unique(), payload);
      } catch (e2) {
        log?.(`upsertTrust create: ${e2.message || e2}`);
      }
    }
  }
  return { ...payload, $id: existing?.$id || userId };
}

async function applyLinkBarcode(db, contrib, log) {
  const payload = parsePayload(contrib.payload);
  const barcode = String(contrib.barcode || payload.barcode || "").replace(/\D/g, "");
  const medicineId = contrib.medicine_id || payload.medicine_id || "";
  const canonicalId = contrib.canonical_id || payload.canonical_id;
  if (!barcode) return { applied: false, reason: "missing_barcode" };

  let doc = null;
  if (medicineId) {
    try {
      doc = await db.getDocument(DB, COL_MED, medicineId);
    } catch {
      doc = null;
    }
  }
  if (!doc && canonicalId) {
    const list = await db.listDocuments(DB, COL_MED, [
      Query.equal("canonical_id", Number(canonicalId)),
      Query.limit(1),
    ]);
    doc = list.documents?.[0] || null;
  }
  if (!doc) return { applied: false, reason: "medicine_not_found" };

  const current = String(doc.barcode || "").replace(/\D/g, "");
  if (current && current !== barcode) {
    return {
      applied: false,
      reason: "barcode_conflict",
      medicine_id: doc.$id,
      existing_barcode: current,
    };
  }
  if (current === barcode) {
    return { applied: true, reason: "already_set", medicine_id: doc.$id };
  }

  const patch = { barcode };
  await db.updateDocument(DB, COL_MED, doc.$id, patch);
  log?.(`linked barcode ${barcode} → ${doc.$id}`);
  return { applied: true, medicine_id: doc.$id, barcode };
}

async function applyCreateProduct(db, contrib, log) {
  const payload = parsePayload(contrib.payload);
  const barcode = String(contrib.barcode || payload.barcode || "").replace(/\D/g, "");
  const nameEn = String(payload.name_en || contrib.name_en || "").trim();
  if (!barcode || !nameEn) return { applied: false, reason: "missing_name_or_barcode" };

  const existing = await db.listDocuments(DB, COL_MED, [
    Query.equal("barcode", barcode),
    Query.limit(1),
  ]);
  if (existing.documents?.length) {
    return {
      applied: false,
      reason: "barcode_already_on_catalog",
      medicine_id: existing.documents[0].$id,
    };
  }

  const canonicalId =
    Number(payload.canonical_id) ||
    Number(contrib.canonical_id) ||
    800_000_000 + (Number(barcode.slice(-8)) || Math.floor(Date.now() % 100_000_000));

  const doc = {
    canonical_id: canonicalId,
    name_en: nameEn.slice(0, 256),
    name_ar: String(payload.name_ar || contrib.name_ar || "").slice(0, 256) || undefined,
    manufacturer: String(payload.manufacturer || "").slice(0, 256) || undefined,
    scientific_name: String(payload.scientific_name || "").slice(0, 256) || undefined,
    barcode,
    lifecycle_status: "pending_review",
    source_kind: "community_contribution",
    contributed_by_user_id: contrib.contributor_id || undefined,
  };

  let created;
  try {
    created = await db.createDocument(DB, COL_MED, ID.unique(), doc);
  } catch (e) {
    const msg = String(e.message || e);
    if (/lifecycle_status|source_kind|contributed_by_user_id|unknown attribute/i.test(msg)) {
      const slim = {
        canonical_id: canonicalId,
        name_en: doc.name_en,
        name_ar: doc.name_ar,
        manufacturer: doc.manufacturer,
        scientific_name: doc.scientific_name,
        barcode,
      };
      created = await db.createDocument(DB, COL_MED, ID.unique(), slim);
    } else {
      throw e;
    }
  }
  log?.(`created pending medicine ${created.$id} barcode=${barcode}`);
  return {
    applied: true,
    medicine_id: created.$id,
    canonical_id: canonicalId,
    lifecycle_status: "pending_review",
  };
}

async function processOne(db, users, contrib, log) {
  const status = String(contrib.status || "pending").toLowerCase();
  const userId = String(contrib.contributor_id || "");
  const kind = String(contrib.kind || contrib.action || "create_product");

  if (status === "rejected") {
    return { id: contrib.$id, status: "rejected", skipped: true };
  }
  if (status === "approved" && contrib.applied_at) {
    return { id: contrib.$id, status: "approved", skipped: true };
  }

  const hints = await loadUserHints(users, userId, log);
  const trust = userId
    ? await upsertTrust(db, userId, hints, null, log)
    : { trust_score: 0 };
  const score = Number(trust.trust_score) || 0;
  const highTrust = score > THRESHOLD;

  const adminForce = status === "approved";
  if (!highTrust && !adminForce) {
    if (contrib.trust_score_at_submit == null || contrib.trust_score_at_submit !== score) {
      try {
        await db.updateDocument(DB, COL_CONTRIB, contrib.$id, {
          trust_score_at_submit: score,
        });
      } catch {
        /* optional attr */
      }
    }
    return {
      id: contrib.$id,
      status: "pending",
      trust_score: score,
      auto_approved: false,
      reason: "trust_score_not_above_threshold",
    };
  }

  let apply = { applied: false };
  try {
    if (kind === "link_barcode" || kind === "add_to_existing") {
      apply = await applyLinkBarcode(db, contrib, log);
    } else {
      apply = await applyCreateProduct(db, contrib, log);
    }
  } catch (e) {
    log?.(`apply failed: ${e.message || e}`);
    apply = { applied: false, reason: String(e.message || e) };
  }

  const conflict = apply.reason === "barcode_conflict";
  const nextStatus = apply.applied && !conflict ? "approved" : "pending";
  const now = new Date().toISOString();

  const update = {
    status: nextStatus,
    trust_score_at_submit: score,
  };
  if (apply.medicine_id) update.medicine_id = apply.medicine_id;
  if (apply.canonical_id) update.canonical_id = apply.canonical_id;
  if (nextStatus === "approved") {
    update.reviewed_at = now;
    update.reviewed_by = highTrust && !adminForce ? "processContribution" : contrib.reviewed_by || "admin";
    update.applied_at = now;
  }
  if (apply.reason) update.notes = String(apply.reason).slice(0, 512);

  try {
    await db.updateDocument(DB, COL_CONTRIB, contrib.$id, update);
  } catch (e) {
    log?.(`contrib update: ${e.message || e}`);
  }

  if (nextStatus === "approved" && userId && status !== "approved") {
    await upsertTrust(db, userId, hints, { approved: 1 }, log);
  }

  return {
    id: contrib.$id,
    status: nextStatus,
    trust_score: score,
    auto_approved: highTrust && nextStatus === "approved",
    apply,
  };
}

async function tallyAnnotationVotes(db, users, annotation, log) {
  const votes = Array.isArray(annotation.votes) ? annotation.votes : [];
  let approve = 0;
  let reject = 0;
  const seen = new Set();
  for (const raw of votes) {
    const s = String(raw || "");
    const [uid, ballot] = s.includes(":") ? s.split(":") : [s, "up"];
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const hints = await loadUserHints(users, uid, log);
    const trust = await upsertTrust(db, uid, hints, null, log);
    if (Number(trust.trust_score) <= THRESHOLD) continue;
    if (ballot === "down" || ballot === "reject" || ballot === "no") reject += 1;
    else approve += 1;
  }
  let next = annotation.status || "pending";
  if (approve >= HIGH_TRUST_VOTERS) next = "approved";
  else if (reject >= HIGH_TRUST_VOTERS) next = "rejected";
  if (next !== annotation.status) {
    try {
      await db.updateDocument(DB, COL_ANN, annotation.$id, { status: next });
    } catch (e) {
      log?.(`annotation status: ${e.message || e}`);
    }
  }
  return { approve, reject, status: next, high_trust_needed: HIGH_TRUST_VOTERS };
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const client = getClient();
  if (!client) {
    return json(res, 500, {
      success: false,
      error: "Missing Appwrite endpoint/project/key",
    });
  }
  const db = new Databases(client);
  const users = new Users(client);
  const body = parseBody(req);

  try {
    if (body.vote && body.annotation_id) {
      const ann = await db.getDocument(DB, COL_ANN, body.annotation_id);
      const tally = await tallyAnnotationVotes(db, users, ann, log);
      return json(res, 200, { success: true, annotation_id: ann.$id, tally });
    }

    const eventName = String(req.headers?.["x-appwrite-event"] || req.headers?.["X-Appwrite-Event"] || "");
    const eventDoc = eventDocument(body);
    if (eventDoc?.$id && (eventDoc.barcode || eventDoc.contributor_id || eventDoc.status)) {
      const latest = await db.getDocument(DB, COL_CONTRIB, eventDoc.$id).catch(() => eventDoc);
      const isUpdateEvent = eventName.includes(".update");
      // Skip update-event loops from our own writes unless admin just approved.
      if (
        isUpdateEvent &&
        String(latest.status || "").toLowerCase() !== "approved" &&
        latest.applied_at
      ) {
        return json(res, 200, { success: true, skipped: true, reason: "already_applied" });
      }
      if (
        isUpdateEvent &&
        String(latest.status || "pending").toLowerCase() === "pending" &&
        latest.trust_score_at_submit != null &&
        latest.notes
      ) {
        return json(res, 200, { success: true, skipped: true, reason: "pending_already_scored" });
      }
      const result = await processOne(db, users, latest, log);
      return json(res, 200, { success: true, result, event: eventName || "payload" });
    }

    if (body.contribution_id) {
      const doc = await db.getDocument(DB, COL_CONTRIB, body.contribution_id);
      const result = await processOne(db, users, doc, log);
      return json(res, 200, { success: true, result });
    }

    if (body.process_pending || req.method === "GET") {
      const pending = await db.listDocuments(DB, COL_CONTRIB, [
        Query.equal("status", "pending"),
        Query.limit(25),
      ]);
      const results = [];
      for (const doc of pending.documents || []) {
        results.push(await processOne(db, users, doc, log));
      }
      return json(res, 200, {
        success: true,
        processed: results.length,
        results,
        threshold: THRESHOLD,
      });
    }

    return json(res, 400, {
      success: false,
      error: "Pass contribution_id, process_pending, or rely on collection events",
    });
  } catch (e) {
    error?.(e.message || e);
    return json(res, 500, { success: false, error: String(e.message || e) });
  }
};
