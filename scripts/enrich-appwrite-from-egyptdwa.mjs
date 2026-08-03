#!/usr/bin/env node
/**
 * Enrich Appwrite medicines from EgyptDwa parsed dataset.
 *
 * Matching: normalized English/Arabic name (exact, then starts-with / contains).
 * Updates empty fields only (unless --force-price / --force-image):
 *   current_price_egp, image_url, category, egyptdwa_source_url
 *
 * Env:
 *   APPWRITE_API_KEY (required for --write)
 *   APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT, APPWRITE_DATABASE_ID
 *   APPWRITE_MEDICINES_COLLECTION_ID
 *
 * Usage:
 *   node scripts/parse-egyptdwa-medicines.mjs --input path/to/medicines3.csv
 *   node scripts/export-appwrite-medicines.mjs   # optional but recommended
 *   node scripts/enrich-appwrite-from-egyptdwa.mjs --dry-run
 *   node scripts/enrich-appwrite-from-egyptdwa.mjs --write --limit 100
 *   node scripts/enrich-appwrite-from-egyptdwa.mjs --write --force-price
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const FORCE_IMAGE = hasFlag("--force-image");
const LIMIT = Number(argValue("--limit", "0")) || 0;
const THROTTLE_MS = Number(argValue("--throttle-ms", "120")) || 120;

const DATA_PATH =
  argValue("--data") || path.join(reportDir, "egyptdwa-medicines.json");
const EXPORT_PATH = path.join(reportDir, "appwrite-medicines-export.json");
const STATIC_PATH = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);
const REPORT_PATH = path.join(reportDir, "egyptdwa-enrichment-report.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNames(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.startsWith(nb) || nb.startsWith(na)) return 85;
  if (na.includes(nb) || nb.includes(na)) return 70;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter || 1;
  return (inter / union) * 55;
}

function loadEgyptDwa() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(
      `Missing ${DATA_PATH}. Run: node scripts/parse-egyptdwa-medicines.mjs --input <csv>`,
    );
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  return data.products || data.medicines || (Array.isArray(data) ? data : []);
}

function loadAppwriteDocs() {
  if (fs.existsSync(EXPORT_PATH)) {
    const data = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
    return Array.isArray(data)
      ? data
      : data.documents || data.medicines || [];
  }
  if (fs.existsSync(STATIC_PATH)) {
    console.warn(
      "[egyptdwa] No live export found; using static dataset (ids may not be Appwrite $id).",
    );
    const data = JSON.parse(fs.readFileSync(STATIC_PATH, "utf8"));
    return data.medicines || data || [];
  }
  throw new Error(
    "No Appwrite export or static dataset. Run scripts/export-appwrite-medicines.mjs",
  );
}

function docId(doc) {
  return doc.$id || doc.id || null;
}

function buildIndexes(docs) {
  const byEn = new Map();
  const byAr = new Map();
  for (const d of docs) {
    const en = normalizeName(d.name_en);
    const ar = normalizeName(d.name_ar);
    if (en) {
      if (!byEn.has(en)) byEn.set(en, []);
      byEn.get(en).push(d);
    }
    if (ar) {
      if (!byAr.has(ar)) byAr.set(ar, []);
      byAr.get(ar).push(d);
    }
  }
  return { byEn, byAr, docs };
}

function findMatch(product, indexes) {
  const name = product.display_name || product.name_en || product.name_ar || "";
  const n = normalizeName(name);
  if (!n) return { doc: null, score: 0, method: null };

  if (product.name_en) {
    const hits = indexes.byEn.get(normalizeName(product.name_en));
    if (hits?.length) return { doc: hits[0], score: 100, method: "exact_en" };
  }
  if (product.name_ar) {
    const hits = indexes.byAr.get(normalizeName(product.name_ar));
    if (hits?.length) return { doc: hits[0], score: 100, method: "exact_ar" };
  }

  // Fuzzy over a capped sample for speed
  let best = null;
  let bestScore = 0;
  let method = "fuzzy";
  for (const d of indexes.docs) {
    const s = Math.max(
      scoreNames(name, d.name_en),
      scoreNames(name, d.name_ar),
    );
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  if (bestScore >= 85) return { doc: best, score: bestScore, method };
  if (bestScore >= 70) return { doc: best, score: bestScore, method: "weak" };
  return { doc: null, score: bestScore, method: null };
}

function isPlaceholderImage(url) {
  const u = String(url || "");
  if (!u) return true;
  if (/unsplash\.com|placeholder|via\.placeholder/i.test(u)) return true;
  return false;
}

function buildPatch(doc, product) {
  const data = {};
  const reasons = [];

  const curPrice =
    doc.current_price_egp != null ? Number(doc.current_price_egp) : null;
  const emptyPrice =
    curPrice == null || curPrice === 0 || Number.isNaN(curPrice);
  if (
    product.current_price_egp != null &&
    (FORCE_PRICE || emptyPrice)
  ) {
    data.current_price_egp = product.current_price_egp;
    reasons.push(emptyPrice ? "fill_price" : "force_price");
  }

  if (
    product.image_url &&
    (FORCE_IMAGE || isPlaceholderImage(doc.image_url))
  ) {
    data.image_url = product.image_url;
    reasons.push(isPlaceholderImage(doc.image_url) ? "fill_image" : "force_image");
  }

  if (product.category && !doc.category) {
    data.category = product.category;
    reasons.push("fill_category");
  }

  if (product.egyptdwa_source_url) {
    if (!doc.egyptdwa_source_url) {
      data.egyptdwa_source_url = product.egyptdwa_source_url;
      reasons.push("fill_egyptdwa_url");
    }
  }

  // Prefer filling Arabic name if live is empty and source is Arabic
  if (product.name_ar && !doc.name_ar) {
    data.name_ar = product.name_ar;
    reasons.push("fill_name_ar");
  }

  return { data, reasons };
}

async function patchDocument(id, data) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY required for --write");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;

  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    // Drop attributes that may not exist on collection
    const {
      egyptdwa_source_url,
      ...rest
    } = data;
    result = await attempt(rest);
  }
  if (!result.ok) {
    throw new Error(`PATCH ${id} ${result.status}: ${result.text.slice(0, 200)}`);
  }
}

async function main() {
  console.log(`[egyptdwa] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"}`);
  const products = loadEgyptDwa();
  const docs = loadAppwriteDocs();
  console.log(`[egyptdwa] products=${products.length} appwrite_docs=${docs.length}`);

  const indexes = buildIndexes(docs);
  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    stats: {
      scanned: 0,
      matched: 0,
      weak: 0,
      unmatched: 0,
      patched: 0,
      skipped_no_change: 0,
      errors: 0,
    },
    samples: {
      matched: [],
      unmatched: [],
      errors: [],
    },
  };

  let list = products;
  if (LIMIT > 0) list = products.slice(0, LIMIT);

  for (const product of list) {
    report.stats.scanned += 1;
    const { doc, score, method } = findMatch(product, indexes);
    if (!doc || score < 70) {
      report.stats.unmatched += 1;
      if (report.samples.unmatched.length < 30) {
        report.samples.unmatched.push({
          name: product.display_name,
          score,
        });
      }
      continue;
    }
    if (method === "weak") report.stats.weak += 1;
    else report.stats.matched += 1;

    const { data, reasons } = buildPatch(doc, product);
    const core = Object.keys(data).filter(
      (k) => k !== "egyptdwa_source_url",
    );
    if (!core.length && !data.egyptdwa_source_url) {
      report.stats.skipped_no_change += 1;
      continue;
    }

    const id = docId(doc);
    if (report.samples.matched.length < 40) {
      report.samples.matched.push({
        product: product.display_name,
        matched: doc.name_en || doc.name_ar,
        score,
        method,
        document_id: id,
        reasons,
        patch: data,
      });
    }

    if (IS_WRITE && id) {
      try {
        await patchDocument(id, data);
        report.stats.patched += 1;
        if (THROTTLE_MS > 0) await sleep(THROTTLE_MS);
      } catch (err) {
        report.stats.errors += 1;
        if (report.samples.errors.length < 20) {
          report.samples.errors.push({
            id,
            error: String(err.message || err),
          });
        }
      }
    }
  }

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  console.log(`[egyptdwa] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
