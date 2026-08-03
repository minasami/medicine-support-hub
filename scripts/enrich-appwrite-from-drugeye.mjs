#!/usr/bin/env node
/**
 * Enrich Appwrite `medicines` from DrugEye (PharOrg) search results.
 *
 * Flow:
 *   1. Load candidate docs (export file, or live list when --live-list)
 *   2. For each name → DrugEye search (throttled)
 *   3. Best name match → proposed field patches
 *   4. --dry-run writes a report; --write PATCHes Appwrite
 *
 * Env:
 *   APPWRITE_API_KEY          required for --write / --live-list
 *   APPWRITE_PROJECT_ID       default 6a54ac3a00272c02d6e0
 *   APPWRITE_ENDPOINT         default https://fra.cloud.appwrite.io/v1
 *   APPWRITE_DATABASE_ID      default medicine_support_hub
 *   APPWRITE_MEDICINES_COLLECTION_ID  default medicines
 *
 * Usage:
 *   node scripts/enrich-appwrite-from-drugeye.mjs --dry-run --limit 20
 *   node scripts/enrich-appwrite-from-drugeye.mjs --write --limit 50
 *   node scripts/enrich-appwrite-from-drugeye.mjs --dry-run --names "panadol,augmentin"
 *   node scripts/enrich-appwrite-from-drugeye.mjs --write --force-price --limit 10
 *
 * Prefer a prior export:
 *   node scripts/export-appwrite-medicines.mjs
 *   node scripts/enrich-appwrite-from-drugeye.mjs --dry-run
 *
 * Legal: on-demand enrichment only — do not bulk-crawl DrugEye.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDrugEyeSession,
  normalizeName,
  pickBestDrugEyeMatch,
  searchDrugEye,
} from "./drugeye-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DATABASE_ID =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  "medicine_support_hub";
const COLLECTION_ID =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
  "medicines";

const EXPORT_PATH = path.join(reportDir, "appwrite-medicines-export.json");
const REPORT_PATH = path.join(reportDir, "drugeye-enrichment-report.json");

function argValue(flag, fallback = "") {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const IS_WRITE = hasFlag("--write");
const IS_DRY = hasFlag("--dry-run") || !IS_WRITE;
const FORCE_PRICE = hasFlag("--force-price");
const LIVE_LIST = hasFlag("--live-list");
const LIMIT = Number(argValue("--limit", "25")) || 25;
const THROTTLE_MS = Number(argValue("--throttle-ms", "700")) || 700;
const MIN_SCORE = Number(argValue("--min-score", "40")) || 40;
const NAMES_ARG = argValue("--names", "");
const OFFSET = Number(argValue("--offset", "0")) || 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function scoreNameMatch(query, candidateName) {
  const nq = normalizeName(query);
  const np = normalizeName(candidateName);
  if (!nq || !np) return 0;
  if (np === nq) return 100;
  if (np.startsWith(nq) || nq.startsWith(np)) return 85;
  if (np.includes(nq) || nq.includes(np)) return 70;
  const tq = new Set(nq.split(" ").filter(Boolean));
  const tp = new Set(np.split(" ").filter(Boolean));
  let inter = 0;
  for (const t of tq) if (tp.has(t)) inter += 1;
  const union = tq.size + tp.size - inter || 1;
  return (inter / union) * 55;
}

function loadExportDocs() {
  if (!fs.existsSync(EXPORT_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const docs = Array.isArray(raw)
    ? raw
    : raw.documents || raw.medicines || raw.items || [];
  return docs.map(normalizeDoc).filter((d) => d.$id || d.canonical_id);
}

function normalizeDoc(doc) {
  return {
    $id: doc.$id || doc.id || null,
    canonical_id:
      doc.canonical_id != null ? Number(doc.canonical_id) : null,
    name_en: doc.name_en || doc.name || null,
    name_ar: doc.name_ar || null,
    scientific_name: doc.scientific_name || null,
    manufacturer: doc.manufacturer || null,
    drug_class: doc.drug_class || null,
    current_price_egp:
      doc.current_price_egp != null && doc.current_price_egp !== ""
        ? Number(doc.current_price_egp)
        : null,
    barcode: doc.barcode || null,
  };
}

async function listAppwritePage(offset, limit = 100) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY is required for --live-list");
  const queries = [
    JSON.stringify({ method: "limit", values: [limit] }),
    JSON.stringify({ method: "offset", values: [offset] }),
    JSON.stringify({ method: "orderAsc", values: ["canonical_id"] }),
  ];
  const qs = queries
    .map((q) => `queries[]=${encodeURIComponent(q)}`)
    .join("&");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents?${qs}`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Appwrite list ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.documents || []).map(normalizeDoc);
}

async function loadCandidates() {
  if (NAMES_ARG) {
    return NAMES_ARG.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name_en, i) => ({
        $id: null,
        canonical_id: null,
        name_en,
        name_ar: null,
        scientific_name: null,
        manufacturer: null,
        drug_class: null,
        current_price_egp: null,
        barcode: null,
        _synthetic: true,
        _index: i,
      }));
  }

  if (LIVE_LIST) {
    console.log("[drugeye-enrich] loading candidates from Appwrite (--live-list)…");
    const page = await listAppwritePage(OFFSET, LIMIT);
    return page;
  }

  const fromExport = loadExportDocs();
  if (fromExport?.length) {
    console.log(
      `[drugeye-enrich] loaded ${fromExport.length} docs from ${EXPORT_PATH}`,
    );
    return fromExport.slice(OFFSET, OFFSET + LIMIT);
  }

  // Fallback: static public dataset names (no $id → match-only report unless export exists)
  const staticPath = path.join(
    root,
    "apps/web/public/data/egyptian-medicines-dataset.json",
  );
  if (fs.existsSync(staticPath)) {
    const data = JSON.parse(fs.readFileSync(staticPath, "utf8"));
    const meds = data.medicines || data || [];
    console.log(
      `[drugeye-enrich] fallback static dataset (${meds.length} rows) — patches need $id from export for --write`,
    );
    return meds
      .map(normalizeDoc)
      .filter((d) => d.name_en)
      .slice(OFFSET, OFFSET + LIMIT);
  }

  throw new Error(
    "No candidates. Run export-appwrite-medicines.mjs, or pass --names, or --live-list with APPWRITE_API_KEY.",
  );
}

/**
 * Build patch payload for one Appwrite document vs a DrugEye hit.
 */
function buildPatch(doc, hit, score) {
  /** @type {Record<string, unknown>} */
  const data = {};
  const reasons = [];

  if (hit.price_egp != null && Number.isFinite(hit.price_egp)) {
    const empty =
      doc.current_price_egp == null ||
      doc.current_price_egp === 0 ||
      Number.isNaN(doc.current_price_egp);
    if (FORCE_PRICE || empty) {
      data.current_price_egp = hit.price_egp;
      reasons.push(empty ? "fill_price" : "force_price");
    }
  }

  if (
    hit.scientific_name &&
    (!doc.scientific_name ||
      /^active pharmaceutical ingredients$/i.test(String(doc.scientific_name)) ||
      /^medicine catalog product/i.test(String(doc.scientific_name)))
  ) {
    data.scientific_name = hit.scientific_name;
    reasons.push("fill_scientific_name");
  }

  if (hit.drug_class && !doc.drug_class) {
    data.drug_class = hit.drug_class;
    reasons.push("fill_drug_class");
  }

  if (hit.manufacturer && !doc.manufacturer) {
    data.manufacturer = hit.manufacturer;
    reasons.push("fill_manufacturer");
  }

  // Provenance string fields if the collection has them (ignored if attribute missing)
  data.price_source = "drugeye.pharorg.com";
  data.price_updated_at = hit.queried_at || new Date().toISOString();

  return {
    data,
    reasons,
    score,
    drugeye_name: hit.name_en,
    drugeye_price: hit.price_egp,
  };
}

async function patchDocument(docId, data) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY is required for --write");

  // Try with provenance fields; on 400 retry without unknown attributes
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(docId)}`;

  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json",
        "X-Appwrite-Response-Format": "1.6.0",
      },
      body: JSON.stringify({ data: payload }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  let result = await attempt(data);
  if (
    !result.ok &&
    result.status === 400 &&
    (data.price_source != null || data.price_updated_at != null)
  ) {
    const { price_source, price_updated_at, ...core } = data;
    result = await attempt(core);
  }

  if (!result.ok) {
    throw new Error(`PATCH ${docId} → ${result.status}: ${result.text.slice(0, 280)}`);
  }
  return true;
}

async function main() {
  console.log("[drugeye-enrich] mode:", IS_WRITE ? "WRITE" : "DRY-RUN");
  console.log(
    `[drugeye-enrich] target ${ENDPOINT} / ${DATABASE_ID} / ${COLLECTION_ID}`,
  );
  console.log(
    `[drugeye-enrich] limit=${LIMIT} offset=${OFFSET} throttleMs=${THROTTLE_MS} minScore=${MIN_SCORE} forcePrice=${FORCE_PRICE}`,
  );

  if (IS_WRITE && !API_KEY) {
    console.error("APPWRITE_API_KEY is required for --write");
    process.exit(1);
  }

  const candidates = await loadCandidates();
  console.log(`[drugeye-enrich] candidates: ${candidates.length}`);

  let session = null;
  try {
    session = await createDrugEyeSession();
  } catch (err) {
    console.error("[drugeye-enrich] session failed:", err.message || err);
    process.exit(1);
  }

  const report = {
    started_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    source: "drugeye.pharorg.com",
    limit: LIMIT,
    results: [],
    summary: {
      scanned: 0,
      matched: 0,
      skipped_low_score: 0,
      skipped_no_hit: 0,
      patched: 0,
      patch_errors: 0,
      no_changes: 0,
    },
  };

  for (const doc of candidates) {
    report.summary.scanned += 1;
    const query = String(doc.name_en || "").trim();
    if (!query) {
      report.results.push({ status: "skip", reason: "empty_name", doc });
      continue;
    }

    let products = [];
    try {
      const res = await searchDrugEye(query, {
        session,
        throttleMs: THROTTLE_MS,
      });
      session = res.session;
      products = res.products;
    } catch (err) {
      console.warn(`[drugeye-enrich] search failed for "${query}":`, err.message);
      report.results.push({
        status: "search_error",
        query,
        error: String(err.message || err),
        doc_id: doc.$id,
      });
      // refresh session on hard failures
      try {
        session = await createDrugEyeSession();
      } catch {
        /* keep old */
      }
      continue;
    }

    if (!products.length) {
      report.summary.skipped_no_hit += 1;
      report.results.push({
        status: "no_hit",
        query,
        doc_id: doc.$id,
        canonical_id: doc.canonical_id,
      });
      console.log(`  · ${query} → no DrugEye hits`);
      continue;
    }

    const hit = pickBestDrugEyeMatch(products, query);
    const score = scoreNameMatch(query, hit.name_en);
    if (score < MIN_SCORE) {
      report.summary.skipped_low_score += 1;
      report.results.push({
        status: "low_score",
        query,
        score,
        drugeye_name: hit.name_en,
        doc_id: doc.$id,
      });
      console.log(
        `  · ${query} → low score ${score.toFixed(1)} vs "${hit.name_en}"`,
      );
      continue;
    }

    report.summary.matched += 1;
    const { data, reasons, drugeye_name, drugeye_price } = buildPatch(
      doc,
      hit,
      score,
    );

    // Core fields only for "has changes" (ignore provenance-only)
    const coreKeys = [
      "current_price_egp",
      "scientific_name",
      "drug_class",
      "manufacturer",
    ];
    const hasCore = coreKeys.some((k) => k in data);

    if (!hasCore) {
      report.summary.no_changes += 1;
      report.results.push({
        status: "no_changes",
        query,
        score,
        drugeye_name,
        drugeye_price,
        doc_id: doc.$id,
        canonical_id: doc.canonical_id,
      });
      console.log(`  · ${query} → matched "${drugeye_name}" (no field changes)`);
      continue;
    }

    const entry = {
      status: IS_WRITE ? "patched" : "would_patch",
      query,
      score,
      drugeye_name,
      drugeye_price,
      reasons,
      patch: data,
      doc_id: doc.$id,
      canonical_id: doc.canonical_id,
    };

    if (IS_WRITE) {
      if (!doc.$id) {
        entry.status = "missing_doc_id";
        report.summary.patch_errors += 1;
        report.results.push(entry);
        console.warn(`  · ${query} → matched but no Appwrite $id (export needed)`);
        continue;
      }
      try {
        await patchDocument(doc.$id, data);
        report.summary.patched += 1;
        console.log(
          `  ✓ ${query} → ${drugeye_name} EGP ${drugeye_price} [${reasons.join(", ")}]`,
        );
        await sleep(150);
      } catch (err) {
        entry.status = "patch_error";
        entry.error = String(err.message || err);
        report.summary.patch_errors += 1;
        console.warn(`  ✗ ${query}:`, err.message || err);
      }
    } else {
      console.log(
        `  · ${query} → would patch from "${drugeye_name}" EGP ${drugeye_price} [${reasons.join(", ")}]`,
      );
    }

    report.results.push(entry);
  }

  report.finished_at = new Date().toISOString();
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("\n[drugeye-enrich] summary", report.summary);
  console.log(`[drugeye-enrich] report → ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error("[drugeye-enrich] fatal:", err.message || err);
  process.exit(1);
});
