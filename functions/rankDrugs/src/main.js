/**
 * rankDrugs — daily collaborative ranking for medicines encyclopedia.
 *
 * Schedule (document in appwrite.json): cron `0 3 * * *` (03:00 UTC daily).
 *
 * search_score formula (weights sum to 1.0):
 *   40% popularity  = log1p(search_count_30d + order_count_30d) / log1p(maxPop)
 *   30% completeness = (has_image*20 + has_description*15 + has_price*10
 *                       + has_barcode*5 + has_ingredients*10) / 60
 *   20% item-item CF cosine similarity from search_logs co-occurrence
 *       (cold start → completeness + popularity only, CF term = 0)
 *   10% quality = editor trust / company verified / recency blend
 *
 * Soft-downrank (collaborative active learning):
 *   - is_hidden / merged_into_* → score *= 0.05
 *   - open catalog_quality_flags (high) → quality *= 0.35; medium *= 0.65
 *   - low completeness + popular still ranks via formula but flags feed quality
 *
 * Writes: search_score, search_count_30d, completeness_score onto medicine docs.
 *
 * Env:
 *   APPWRITE_ENDPOINT / APPWRITE_FUNCTION_API_ENDPOINT
 *   APPWRITE_PROJECT_ID / APPWRITE_FUNCTION_PROJECT_ID
 *   APPWRITE_API_KEY (server key with databases.read/write)
 *   APPWRITE_DATABASE_ID=medicine_support_hub
 *   MEDICINES_COLLECTION_ID=medicines
 *   SEARCH_LOGS_COLLECTION_ID=search_logs
 *   RANK_BATCH_LIMIT (default 500)
 *   RANK_DRY_RUN=1 to skip writes
 */

import { Client, Databases, Query } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID || "medicine_support_hub";
const COL_MED = process.env.MEDICINES_COLLECTION_ID || "medicines";
const COL_LOGS = process.env.SEARCH_LOGS_COLLECTION_ID || "search_logs";
const COL_FLAGS = process.env.FLAGS_COLLECTION_ID || "catalog_quality_flags";
const BATCH = Math.min(Number(process.env.RANK_BATCH_LIMIT || 500), 100);
const DRY = process.env.RANK_DRY_RUN === "1" || process.env.RANK_DRY_RUN === "true";
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
}

function getDb() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID ||
    process.env.APPWRITE_PROJECT_ID;
  const key =
    process.env.APPWRITE_API_KEY ||
    process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Databases(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );
}

function truthyStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** Completeness in [0,1] using catalog signals. */
export function completenessOf(doc) {
  const hasImage = truthyStr(doc.image_url) ? 20 : 0;
  const hasDescription =
    truthyStr(doc.description) || truthyStr(doc.disease_name) ? 15 : 0;
  const hasPrice =
    doc.current_price_egp != null && Number(doc.current_price_egp) > 0 ? 10 : 0;
  const hasBarcode = truthyStr(doc.barcode) || truthyStr(doc.code) ? 5 : 0;
  const hasIngredients =
    truthyStr(doc.ingredients) || truthyStr(doc.scientific_name) ? 10 : 0;
  return (hasImage + hasDescription + hasPrice + hasBarcode + hasIngredients) / 60;
}

/** Quality in [0,1]: verified + company + recency. */
export function qualityOf(doc) {
  let q = 0;
  if (doc.has_verified_dataset) q += 0.45;
  if (truthyStr(doc.company_slug) || truthyStr(doc.manufacturer)) q += 0.25;
  const updated = Date.parse(doc.$updatedAt || doc.$createdAt || "") || 0;
  if (updated) {
    const ageDays = (Date.now() - updated) / (86400 * 1000);
    // fresher = higher; 0 days → 0.3, 365+ → ~0
    q += Math.max(0, 0.3 * (1 - Math.min(ageDays, 365) / 365));
  }
  return Math.min(1, q);
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k] || 0;
    const y = b[k] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Build item→user sparse vectors from search_logs, then item-item CF score
 * as mean cosine to top co-clicked neighbors (capped).
 */
function buildCfScores(logs) {
  /** @type {Map<string, Record<string, number>>} */
  const itemUsers = new Map();
  for (const row of logs) {
    const drug =
      row.drug_id ||
      row.medicine_id ||
      (row.canonical_id != null ? `c:${row.canonical_id}` : null);
    if (!drug) continue;
    const user = row.user_id || `anon:${String(row.query || "").slice(0, 32)}`;
    if (!itemUsers.has(drug)) itemUsers.set(drug, {});
    const vec = itemUsers.get(drug);
    vec[user] = (vec[user] || 0) + 1;
  }

  const ids = [...itemUsers.keys()];
  /** @type {Record<string, number>} */
  const scores = {};
  if (ids.length < 2) {
    for (const id of ids) scores[id] = 0;
    return scores;
  }

  // For each item, average cosine vs up to 20 others (sample for cost)
  const SAMPLE = Math.min(40, ids.length);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const va = itemUsers.get(id);
    let sum = 0;
    let n = 0;
    for (let j = 0; j < SAMPLE; j++) {
      const other = ids[(i + 1 + j) % ids.length];
      if (other === id) continue;
      const sim = cosine(va, itemUsers.get(other));
      if (sim > 0) {
        sum += sim;
        n++;
      }
    }
    scores[id] = n ? sum / n : 0;
  }
  return scores;
}

async function fetchAllLogs(db, sinceIso) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const q = [
      Query.greaterThanEqual("timestamp", sinceIso),
      Query.orderDesc("timestamp"),
      Query.limit(100),
    ];
    if (cursor) q.push(Query.cursorAfter(cursor));
    let res;
    try {
      res = await db.listDocuments(DB, COL_LOGS, q);
    } catch (e) {
      // collection empty / index warming
      break;
    }
    out.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

async function countSearchesByDrug(logs) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of logs) {
    const drug =
      row.drug_id ||
      row.medicine_id ||
      (row.canonical_id != null ? `c:${row.canonical_id}` : null);
    if (!drug) continue;
    counts.set(drug, (counts.get(drug) || 0) + 1);
  }
  return counts;
}


async function fetchOpenFlagSeverity(db) {
  /** @type {Map<string, string>} medicine_id -> worst severity */
  const map = new Map();
  let cursor = null;
  for (let page = 0; page < 40; page++) {
    const q = [
      Query.equal("status", "open"),
      Query.limit(100),
      Query.orderAsc("$id"),
    ];
    if (cursor) q.push(Query.cursorAfter(cursor));
    let res;
    try {
      res = await db.listDocuments(DB, COL_FLAGS, q);
    } catch {
      break;
    }
    for (const d of res.documents || []) {
      const id = d.medicine_id || (d.canonical_id != null ? `c:${d.canonical_id}` : null);
      if (!id) continue;
      const sev = String(d.severity || "medium");
      const prev = map.get(id);
      const rank = { high: 3, medium: 2, low: 1 };
      if (!prev || (rank[sev] || 0) > (rank[prev] || 0)) map.set(id, sev);
      if (d.medicine_id) map.set(d.medicine_id, map.get(id));
      if (d.canonical_id != null) map.set(`c:${d.canonical_id}`, map.get(id));
    }
    if (!res.documents?.length || res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return map;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const db = getDb();
  if (!db) {
    return json(res, 500, {
      success: false,
      error: "Missing Appwrite credentials (APPWRITE_ENDPOINT/PROJECT/API_KEY)",
    });
  }

  const started = Date.now();
  try {
    const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();
    log(`rankDrugs start; lookback since ${sinceIso}; dry=${DRY}`);

    const logs = await fetchAllLogs(db, sinceIso);
    log(`loaded ${logs.length} search_logs`);
    const flagSeverity = await fetchOpenFlagSeverity(db);
    log(`loaded ${flagSeverity.size} flagged medicine keys`);

    const searchCounts = await countSearchesByDrug(logs);
    const cfScores = buildCfScores(logs);

    let maxPop = 1;
    for (const c of searchCounts.values()) maxPop = Math.max(maxPop, c);

    let updated = 0;
    let scanned = 0;
    let cursor = null;
    const samples = [];

    // Paginate medicines
    for (let page = 0; page < 200; page++) {
      const q = [Query.limit(BATCH), Query.orderAsc("$id")];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const pageRes = await db.listDocuments(DB, COL_MED, q);
      if (!pageRes.documents.length) break;

      for (const doc of pageRes.documents) {
        scanned++;
        const drugKeys = [doc.$id, doc.canonical_id != null ? `c:${doc.canonical_id}` : null].filter(Boolean);
        let searches = 0;
        for (const k of drugKeys) searches = Math.max(searches, searchCounts.get(k) || 0);
        const orders = Number(doc.order_count_30d || 0) || 0;
        const popRaw = searches + orders;
        const popularity = Math.log1p(popRaw) / Math.log1p(maxPop + orders);
        const completeness = completenessOf(doc);
        let quality = qualityOf(doc);

        let cf = 0;
        for (const k of drugKeys) cf = Math.max(cf, cfScores[k] || 0);
        const coldStart = searches === 0 && !cf;
        // Cold start: redistribute CF weight into completeness+popularity
        let score;
        if (coldStart) {
          score =
            0.4 * popularity +
            0.3 * completeness +
            0.0 * cf +
            0.1 * quality +
            0.2 * ((popularity + completeness) / 2); // CF mass → pop+complete
        } else {
          score =
            0.4 * popularity +
            0.3 * completeness +
            0.2 * cf +
            0.1 * quality;
        }

        // Soft-downrank hidden / merged / flagged (active learning)
        const hidden = doc.is_hidden === true || Boolean(doc.merged_into_id);
        let flagSev = null;
        for (const k of drugKeys) {
          if (flagSeverity.has(k)) flagSev = flagSeverity.get(k);
        }
        if (flagSev === "high") quality *= 0.35;
        else if (flagSev === "medium") quality *= 0.65;
        else if (flagSev === "low") quality *= 0.85;
        // Re-blend quality term lightly when flagged (avoid full recompute)
        if (flagSev) {
          score = Math.min(score, score * (flagSev === "high" ? 0.55 : flagSev === "medium" ? 0.75 : 0.9));
        }
        if (hidden) score *= 0.05;

        const payload = {
          search_score: Math.round(score * 10000) / 10000,
          search_count_30d: searches,
          completeness_score: Math.round(completeness * 10000) / 10000,
        };

        if (samples.length < 5) {
          samples.push({
            id: doc.$id,
            name: doc.name_en,
            ...payload,
            popularity,
            cf,
            quality,
            coldStart,
          });
        }

        if (!DRY) {
          try {
            await db.updateDocument(DB, COL_MED, doc.$id, payload);
            updated++;
          } catch (e) {
            error(`update ${doc.$id}: ${e.message || e}`);
          }
        }
      }

      cursor = pageRes.documents[pageRes.documents.length - 1].$id;
      if (pageRes.documents.length < BATCH) break;
    }

    const result = {
      success: true,
      dry_run: DRY,
      scanned,
      updated,
      logs: logs.length,
      elapsed_ms: Date.now() - started,
      samples,
      formula:
        "0.4*log1p(pop)/log1p(max) + 0.3*completeness + 0.2*CF_cosine + 0.1*quality (cold-start redistributes CF)",
    };
    log(JSON.stringify(result));
    return json(res, 200, result);
  } catch (err) {
    error(String(err?.message || err));
    return json(res, 500, { success: false, error: String(err?.message || err) });
  }
};
