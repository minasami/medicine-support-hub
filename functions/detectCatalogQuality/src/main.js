/**
 * detectCatalogQuality — daily / on-demand catalog quality scanner.
 *
 * Detects:
 *  - near_duplicate: similar name + manufacturer + strength (fuzzy);
 *    skips distinct SKU variants (pack count, ml volume, IM/IV, numbered EDT)
 *  - same_barcode: identical barcode on distinct docs
 *  - misinfo_contradiction: e.g. name vs scientific mismatch heuristics
 *  - broken_image: image_url present but clearly placeholder/broken pattern
 *  - popular_incomplete: high search_count_30d but low completeness
 *
 * Writes open flags to `catalog_quality_flags` (deduped by fingerprint).
 *
 * Schedule: cron `30 4 * * *` (after rankDrugs) or HTTP POST { limit?, dry? }.
 *
 * Env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,
 *      APPWRITE_DATABASE_ID, MEDICINES_COLLECTION_ID, FLAGS_COLLECTION_ID
 */

import { Client, Databases, ID, Query } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || process.env.DATABASE_ID || "medicine_support_hub";
const COL_MED = process.env.MEDICINES_COLLECTION_ID || "medicines";
const COL_FLAGS = process.env.FLAGS_COLLECTION_ID || "catalog_quality_flags";
const BATCH = Math.min(Number(process.env.DETECT_BATCH_LIMIT || 100), 100);
const DRY = process.env.DETECT_DRY_RUN === "1" || process.env.DETECT_DRY_RUN === "true";

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
}

function pickEnv(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function getDb() {
  const endpoint = pickEnv(
    "APPWRITE_FUNCTION_API_ENDPOINT",
    "APPWRITE_ENDPOINT",
  );
  const project = pickEnv(
    "APPWRITE_FUNCTION_PROJECT_ID",
    "APPWRITE_PROJECT_ID",
  );
  const key = pickEnv("APPWRITE_API_KEY", "APPWRITE_FUNCTION_API_KEY");
  if (!endpoint || !project || !key) {
    return {
      __missing: true,
      endpoint: Boolean(endpoint),
      project: Boolean(project),
      key: Boolean(key),
      envKeys: Object.keys(process.env)
        .filter((k) => /APPWRITE|DATABASE|FLAGS|MEDICINES/i.test(k))
        .sort(),
    };
  }
  return new Databases(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );
}

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigramDice(a, b) {
  const s1 = normalize(a).replace(/\s/g, "");
  const s2 = normalize(b).replace(/\s/g, "");
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;
  const bg = (s) => {
    const set = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      set.set(g, (set.get(g) || 0) + 1);
    }
    return set;
  };
  const A = bg(s1);
  const B = bg(s2);
  let inter = 0;
  for (const [g, c] of A) {
    if (B.has(g)) inter += Math.min(c, B.get(g));
  }
  const total = [...A.values()].reduce((x, y) => x + y, 0) +
    [...B.values()].reduce((x, y) => x + y, 0);
  return total ? (2 * inter) / total : 0;
}

function completenessOf(doc) {
  let n = 0;
  if (doc.image_url && !/unsplash|placeholder|no_image/i.test(doc.image_url)) n += 20;
  if (doc.description || doc.disease_name) n += 15;
  if (doc.current_price_egp != null && Number(doc.current_price_egp) > 0) n += 10;
  if (doc.barcode || doc.code) n += 5;
  if (doc.ingredients || doc.scientific_name) n += 10;
  return n / 60;
}

function fingerprint(flagType, a, b) {
  const ids = [a, b || ""].map(String).sort();
  return `${flagType}:${ids[0]}:${ids[1]}`.slice(0, 120);
}


/**
 * True when two product names differ only by a distinct retail SKU dimension:
 * pack count, pack volume (ml), IM vs IV route, or numbered fragrance/EDT variant.
 * Typo pairs (e.g. AVASTIN vs AVASTING) must NOT match — cores stay unequal.
 * @returns {string|null} skip reason, or null if not a safe distinct-variant skip
 */
export function skuVariantSkipReason(nameA, nameB) {
  const rawA = String(nameA || "");
  const rawB = String(nameB || "");
  if (!rawA.trim() || !rawB.trim()) return null;

  const pack = packCountVariant(rawA, rawB);
  if (pack) return pack;
  const vol = volumeVariant(rawA, rawB);
  if (vol) return vol;
  const route = routeImIvVariant(rawA, rawB);
  if (route) return route;
  const frag = numberedFragranceVariant(rawA, rawB);
  if (frag) return frag;
  return null;
}

const PACK_UNIT =
  "sachets?|capsules?|caps?\\.?|tablets?|tabs?\\.?|pieces?|pcs?\\.?|ampoules?|amps?\\.?|vials?|pens?|syringes?|soft\\s*gels?|softgels?|" +
  "قرص|اقراص|كبسولات|كبسوله|كبسول|اكياس|كيس|قطع|قطعه";
const PACK_RE = new RegExp(`\\b(\\d+)\\s*(${PACK_UNIT})\\b`, "gi");

function extractPackCounts(name) {
  const out = [];
  const re = new RegExp(PACK_RE.source, PACK_RE.flags);
  let m;
  while ((m = re.exec(name)) !== null) {
    out.push(Number(m[1]));
  }
  return out;
}

function stripPackCounts(name) {
  return normalize(String(name).replace(new RegExp(PACK_RE.source, PACK_RE.flags), " "));
}

function packCountVariant(a, b) {
  const packsA = extractPackCounts(a);
  const packsB = extractPackCounts(b);
  if (!packsA.length || !packsB.length) return null;
  const coreA = stripPackCounts(a);
  const coreB = stripPackCounts(b);
  if (!coreA || !coreB || coreA !== coreB) return null;
  const key = (arr) => [...arr].sort((x, y) => x - y).join(",");
  if (key(packsA) === key(packsB)) return null;
  return "pack_count";
}

/** Standalone pack / bottle volumes in ml (strength ratios like 400MG/16ML stripped first). */
const STRENGTH_RATIO_RE = /\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|iu|i\.?u\.?)\s*\/\s*\d+(?:[.,]\d+)?\s*ml\b/gi;
const VOLUME_RE = /\b(\d+(?:[.,]\d+)?)\s*ml\b/gi;

function withoutStrengthRatios(name) {
  return String(name).replace(new RegExp(STRENGTH_RATIO_RE.source, STRENGTH_RATIO_RE.flags), " ");
}

function extractVolumes(name) {
  const out = [];
  const cleaned = withoutStrengthRatios(name);
  const re = new RegExp(VOLUME_RE.source, VOLUME_RE.flags);
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    out.push(String(m[1]).replace(",", "."));
  }
  return out;
}

function stripVolumes(name) {
  const cleaned = withoutStrengthRatios(name);
  return normalize(cleaned.replace(new RegExp(VOLUME_RE.source, VOLUME_RE.flags), " "));
}

function volumeVariant(a, b) {
  const volsA = extractVolumes(a);
  const volsB = extractVolumes(b);
  if (!volsA.length || !volsB.length) return null;
  const coreA = stripVolumes(a);
  const coreB = stripVolumes(b);
  if (!coreA || !coreB || coreA !== coreB) return null;
  const key = (arr) => [...arr].map(Number).sort((x, y) => x - y).join(",");
  if (key(volsA) === key(volsB)) return null;
  return "volume";
}

const ROUTE_TOKEN_RE = /\bI\.?\s*([MV])\.?/gi;

function routeImIvVariant(a, b) {
  const routes = (name) => {
    const set = new Set();
    const re = new RegExp(ROUTE_TOKEN_RE.source, ROUTE_TOKEN_RE.flags);
    let m;
    while ((m = re.exec(name)) !== null) {
      set.add(m[1].toUpperCase());
    }
    return set;
  };
  const ra = routes(a);
  const rb = routes(b);
  if (!ra.size || !rb.size) return null;
  const hasImIv =
    (ra.has("M") && rb.has("V")) || (ra.has("V") && rb.has("M"));
  if (!hasImIv) return null;
  const strip = (name) =>
    normalize(String(name).replace(new RegExp(ROUTE_TOKEN_RE.source, ROUTE_TOKEN_RE.flags), " "));
  const coreA = strip(a);
  const coreB = strip(b);
  if (!coreA || !coreB || coreA !== coreB) return null;
  return "route_IM_IV";
}

const FRAGRANCE_HINT_RE =
  /\b(edt|edp|edc|eau\s*de\s*(?:toilette|parfum|cologne)|perfume|parfum|cologne|aftershave)\b/i;

function numberedFragranceVariant(a, b) {
  if (!FRAGRANCE_HINT_RE.test(a) || !FRAGRANCE_HINT_RE.test(b)) return null;
  // Drop fragrance markers + optional small variant integers (e.g. "LYRA 2 EDT" / "LYRA EDT").
  const strip = (name) =>
    normalize(
      String(name)
        .replace(FRAGRANCE_HINT_RE, " ")
        .replace(/\b(\d{1,2})\b/g, " "),
    );
  const coreA = strip(a);
  const coreB = strip(b);
  if (!coreA || !coreB || coreA !== coreB) return null;
  // Require an actual surface difference (otherwise identical names).
  if (normalize(a) === normalize(b)) return null;
  return "numbered_EDT";
}


async function existingOpenFingerprints(db) {
  const set = new Set();
  let cursor = null;
  for (let page = 0; page < 30; page++) {
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
      if (d.fingerprint) set.add(d.fingerprint);
    }
    if (!res.documents?.length || res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return set;
}

async function writeFlag(db, flag, dry) {
  if (dry) return { written: false, dry: true };
  try {
    await db.createDocument(DB, COL_FLAGS, ID.unique(), flag);
    return { written: true };
  } catch (e) {
    return { written: false, error: e.message || String(e) };
  }
}

async function loadMedicines(db, maxDocs, startAfter = null) {
  const out = [];
  let cursor = startAfter || null;
  const pages = Math.ceil(maxDocs / BATCH);
  for (let page = 0; page < pages; page++) {
    const q = [Query.limit(BATCH), Query.orderAsc("$id")];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await db.listDocuments(DB, COL_MED, q);
    if (!res.documents?.length) break;
    out.push(...res.documents);
    cursor = res.documents[res.documents.length - 1].$id;
    if (res.documents.length < BATCH) break;
    if (out.length >= maxDocs) break;
  }
  const next_cursor = out.length ? out[out.length - 1].$id : startAfter;
  return { docs: out.slice(0, maxDocs), next_cursor };
}

export function detectIssues(docs) {
  /** @type {Array<Record<string, unknown>>} */
  const flags = [];
  const byBarcode = new Map();
  const visible = docs.filter((d) => !d.is_hidden && d.lifecycle_status !== "archived");

  for (const doc of visible) {
    const bc = String(doc.barcode || doc.code || "").replace(/\s/g, "");
    if (bc && /^\d{8,14}$/.test(bc)) {
      if (!byBarcode.has(bc)) byBarcode.set(bc, []);
      byBarcode.get(bc).push(doc);
    }
  }

  for (const [bc, group] of byBarcode) {
    if (group.length < 2) continue;
    const primary = group[0];
    for (let i = 1; i < group.length; i++) {
      const peer = group[i];
      flags.push({
        flag_type: "same_barcode",
        severity: "high",
        status: "open",
        score: 1,
        summary: `Same barcode ${bc} on distinct products`,
        medicine_id: primary.$id,
        canonical_id: primary.canonical_id ?? null,
        name_en: primary.name_en || "",
        peer_medicine_id: peer.$id,
        peer_canonical_id: peer.canonical_id ?? null,
        fingerprint: fingerprint("same_barcode", primary.$id, peer.$id),
        detail_json: JSON.stringify({ barcode: bc }),
        created_at: new Date().toISOString(),
      });
    }
  }

  // Near-duplicate pairwise within coarse manufacturer buckets (cost-capped).
  // Use first token / prefix so "GSK" and "GSK Egypt" share a bucket.
  const buckets = new Map();
  for (const doc of visible) {
    const mfrFull = normalize(doc.manufacturer || "");
    const mfr = (mfrFull.split(" ")[0] || mfrFull).slice(0, 12) || "_none";
    if (!buckets.has(mfr)) buckets.set(mfr, []);
    buckets.get(mfr).push(doc);
    // Also index by name prefix for cross-mfr identical trade names
    const np = normalize(doc.name_en || doc.name_ar || "").slice(0, 8) || "_n";
    const nk = `n:${np}`;
    if (!buckets.has(nk)) buckets.set(nk, []);
    buckets.get(nk).push(doc);
  }

  for (const group of buckets.values()) {
    const n = Math.min(group.length, 80);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = group[i];
        const b = group[j];
        const nameSim = bigramDice(a.name_en || a.name_ar, b.name_en || b.name_ar);
        if (nameSim < 0.78) continue;
        const skipReason = skuVariantSkipReason(
          a.name_en || a.name_ar,
          b.name_en || b.name_ar,
        );
        if (skipReason) continue;
        const strA = normalize(a.strength || "");
        const strB = normalize(b.strength || "");
        const strengthSame = !strA || !strB || strA === strB;
        const mfrSim = bigramDice(a.manufacturer || "", b.manufacturer || "");
        if (!strengthSame && mfrSim < 0.5) continue;
        if (nameSim < 0.88 && mfrSim < 0.6) continue;
        flags.push({
          flag_type: "near_duplicate",
          severity: nameSim >= 0.92 ? "high" : "medium",
          status: "open",
          score: Math.round(nameSim * 1000) / 1000,
          summary: `Near-duplicate names (${Math.round(nameSim * 100)}%): ${(a.name_en || "").slice(0, 40)} ≈ ${(b.name_en || "").slice(0, 40)}`,
          medicine_id: a.$id,
          canonical_id: a.canonical_id ?? null,
          name_en: a.name_en || "",
          peer_medicine_id: b.$id,
          peer_canonical_id: b.canonical_id ?? null,
          fingerprint: fingerprint("near_duplicate", a.$id, b.$id),
          detail_json: JSON.stringify({
            nameSim,
            mfrSim,
            strengthA: a.strength || null,
            strengthB: b.strength || null,
          }),
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  for (const doc of visible) {
    const img = String(doc.image_url || "");
    if (img && /unsplash\.com|placeholder|via\.placeholder|no_image|example\.com/i.test(img)) {
      flags.push({
        flag_type: "broken_image",
        severity: "low",
        status: "open",
        score: 0.6,
        summary: "Image URL looks like a placeholder / broken source",
        medicine_id: doc.$id,
        canonical_id: doc.canonical_id ?? null,
        name_en: doc.name_en || "",
        fingerprint: fingerprint("broken_image", doc.$id, ""),
        detail_json: JSON.stringify({ image_url: img.slice(0, 200) }),
        created_at: new Date().toISOString(),
      });
    }

    const sci = normalize(doc.scientific_name || "");
    const name = normalize(doc.name_en || "");
    // Contradiction heuristic: scientific looks like a brand, or price absurd
    const price = Number(doc.current_price_egp);
    if (Number.isFinite(price) && (price < 0 || price > 500000)) {
      flags.push({
        flag_type: "misinfo_contradiction",
        severity: "medium",
        status: "open",
        score: 0.7,
        summary: `Implausible price_egp=${price}`,
        medicine_id: doc.$id,
        canonical_id: doc.canonical_id ?? null,
        name_en: doc.name_en || "",
        fingerprint: fingerprint("misinfo_price", doc.$id, ""),
        detail_json: JSON.stringify({ price }),
        created_at: new Date().toISOString(),
      });
    }
    if (sci && name && sci === name && /tablet|capsule|syrup|mg\b/i.test(doc.name_en || "")) {
      // weak signal — skip noise
    }
    if (
      sci &&
      name &&
      sci.length > 4 &&
      name.length > 4 &&
      !name.includes(sci.split(" ")[0]) &&
      bigramDice(sci, name) < 0.15 &&
      doc.has_verified_dataset === false
    ) {
      flags.push({
        flag_type: "misinfo_contradiction",
        severity: "low",
        status: "open",
        score: 0.45,
        summary: "Scientific name weakly related to trade name (unverified)",
        medicine_id: doc.$id,
        canonical_id: doc.canonical_id ?? null,
        name_en: doc.name_en || "",
        fingerprint: fingerprint("misinfo_name_sci", doc.$id, ""),
        detail_json: JSON.stringify({ scientific_name: doc.scientific_name }),
        created_at: new Date().toISOString(),
      });
    }

    const searches = Number(doc.search_count_30d || 0);
    const complete =
      doc.completeness_score != null
        ? Number(doc.completeness_score)
        : completenessOf(doc);
    if (searches >= 8 && complete < 0.35) {
      flags.push({
        flag_type: "popular_incomplete",
        severity: "medium",
        status: "open",
        score: Math.min(1, searches / 40),
        summary: `Popular (searches=${searches}) but incomplete (${Math.round(complete * 100)}%)`,
        medicine_id: doc.$id,
        canonical_id: doc.canonical_id ?? null,
        name_en: doc.name_en || "",
        fingerprint: fingerprint("popular_incomplete", doc.$id, ""),
        detail_json: JSON.stringify({ searches, complete }),
        created_at: new Date().toISOString(),
      });
    }
  }

  return flags;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const db = getDb();
  if (!db || db.__missing) {
    return json(res, 500, {
      success: false,
      error: "Missing Appwrite credentials",
      debug: db && db.__missing ? db : null,
    });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    body = {};
  }
  const maxDocs = Math.min(Number(body.limit || process.env.DETECT_MAX_DOCS || 2000), 5000);
  const dry = body.dry === true || DRY;
  const startAfter = body.cursorAfter || body.cursor_after || null;

  const started = Date.now();
  try {
    log(`detectCatalogQuality start; max=${maxDocs}; dry=${dry}; cursorAfter=${startAfter || ""}`);
    const loaded = await loadMedicines(db, maxDocs, startAfter);
    const docs = loaded.docs;
    log(`loaded ${docs.length} medicines`);
    const candidates = detectIssues(docs);
    const existing = await existingOpenFingerprints(db);
    let written = 0;
    let skipped = 0;
    const samples = [];

    for (const flag of candidates) {
      if (existing.has(flag.fingerprint)) {
        skipped++;
        continue;
      }
      const result = await writeFlag(db, flag, dry);
      if (result.written || dry) {
        written++;
        existing.add(flag.fingerprint);
        if (samples.length < 8) samples.push(flag);
      } else if (result.error) {
        error(`flag write: ${result.error}`);
      }
    }

    return json(res, 200, {
      success: true,
      dry_run: dry,
      scanned: docs.length,
      candidates: candidates.length,
      written,
      skipped_existing: skipped,
      elapsed_ms: Date.now() - started,
      next_cursor: loaded.next_cursor,
      samples,
    });
  } catch (e) {
    error(e.message || String(e));
    return json(res, 500, { success: false, error: e.message || String(e) });
  }
};
