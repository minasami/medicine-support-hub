#!/usr/bin/env node
/**
 * Apply MOH/EDA official tariffs onto Appwrite medicines.
 *
 * Sets official_tariff_egp + current_price_egp (unless --official-only)
 * and price_source = moh_eda_tariff.
 *
 * Usage:
 *   node scripts/parse-moh-eda-tariff.mjs --input tariff.csv
 *   node scripts/export-appwrite-medicines.mjs
 *   node scripts/enrich-appwrite-from-moh-tariff.mjs --dry-run
 *   node scripts/enrich-appwrite-from-moh-tariff.mjs --write --limit 200
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
const OFFICIAL_ONLY = hasFlag("--official-only");
const LIMIT = Number(argValue("--limit", "0")) || 0;
const THROTTLE_MS = Number(argValue("--throttle-ms", "100")) || 100;
const MIN_SCORE = Number(argValue("--min-score", "85")) || 85;

const DATA_PATH =
  argValue("--data") || path.join(reportDir, "moh-eda-tariff.json");
const EXPORT_PATH = path.join(reportDir, "appwrite-medicines-export.json");
const STATIC_PATH = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);
const REPORT_PATH = path.join(reportDir, "moh-eda-tariff-enrichment-report.json");

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

function loadTariff() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Missing ${DATA_PATH}. Run parse-moh-eda-tariff.mjs first.`);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  return {
    products: data.products || [],
    tariff_list_version: data.tariff_list_version || data.input || "unknown",
  };
}

function loadDocs() {
  if (fs.existsSync(EXPORT_PATH)) {
    const data = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
    return Array.isArray(data)
      ? data
      : data.documents || data.medicines || [];
  }
  if (fs.existsSync(STATIC_PATH)) {
    console.warn("[tariff] Using static dataset (prefer live export)." );
    const data = JSON.parse(fs.readFileSync(STATIC_PATH, "utf8"));
    return data.medicines || data || [];
  }
  throw new Error("Run export-appwrite-medicines.mjs first");
}

function buildIndex(docs) {
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

function findMatch(product, index) {
  const en = normalizeName(product.name_en);
  const ar = normalizeName(product.name_ar);
  if (en && index.byEn.has(en)) {
    return { doc: index.byEn.get(en)[0], score: 100, method: "exact_en" };
  }
  if (ar && index.byAr.has(ar)) {
    return { doc: index.byAr.get(ar)[0], score: 100, method: "exact_ar" };
  }

  const name = product.display_name || product.name_en || product.name_ar || "";
  let best = null;
  let bestScore = 0;
  for (const d of index.docs) {
    const s = Math.max(
      scoreNames(name, d.name_en),
      scoreNames(name, d.name_ar),
    );
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  if (bestScore >= MIN_SCORE) {
    return { doc: best, score: bestScore, method: "fuzzy" };
  }
  return { doc: null, score: bestScore, method: null };
}

function buildPatch(doc, product, listVersion) {
  const data = {};
  const reasons = [];
  const price = product.official_tariff_egp;
  if (price == null) return { data, reasons };

  data.official_tariff_egp = price;
  reasons.push("set_official_tariff");

  if (!OFFICIAL_ONLY) {
    data.current_price_egp = price;
    reasons.push("set_display_price");
  }

  data.price_source = "moh_eda_tariff";
  data.tariff_updated_at = new Date().toISOString();
  data.tariff_list_version = listVersion;

  if (product.scientific_name && !doc.scientific_name) {
    data.scientific_name = product.scientific_name;
    reasons.push("fill_scientific_name");
  }
  if (product.manufacturer && !doc.manufacturer) {
    data.manufacturer = product.manufacturer;
    reasons.push("fill_manufacturer");
  }
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
    const {
      official_tariff_egp,
      price_source,
      tariff_updated_at,
      tariff_list_version,
      ...core
    } = data;
    // Always keep price write
    const minimal = {
      ...core,
      current_price_egp: data.current_price_egp ?? official_tariff_egp,
    };
    result = await attempt(minimal);
  }
  if (!result.ok) {
    throw new Error(`PATCH ${id} ${result.status}: ${result.text.slice(0, 200)}`);
  }
}

async function main() {
  console.log(`[tariff] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"}`);
  const { products, tariff_list_version } = loadTariff();
  const docs = loadDocs();
  const index = buildIndex(docs);
  console.log(
    `[tariff] products=${products.length} docs=${docs.length} list=${tariff_list_version}`,
  );

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    tariff_list_version,
    stats: {
      scanned: 0,
      matched: 0,
      unmatched: 0,
      patched: 0,
      errors: 0,
    },
    samples: { matched: [], unmatched: [], errors: [] },
  };

  let list = products;
  if (LIMIT > 0) list = products.slice(0, LIMIT);

  for (const product of list) {
    report.stats.scanned += 1;
    if (product.official_tariff_egp == null) {
      report.stats.unmatched += 1;
      continue;
    }
    const { doc, score, method } = findMatch(product, index);
    if (!doc) {
      report.stats.unmatched += 1;
      if (report.samples.unmatched.length < 25) {
        report.samples.unmatched.push({
          name: product.display_name,
          score,
        });
      }
      continue;
    }
    report.stats.matched += 1;
    const { data, reasons } = buildPatch(doc, product, tariff_list_version);
    const id = doc.$id || doc.id;
    if (report.samples.matched.length < 30) {
      report.samples.matched.push({
        product: product.display_name,
        matched: doc.name_en || doc.name_ar,
        score,
        method,
        id,
        reasons,
        patch: data,
      });
    }
    if (IS_WRITE && id) {
      try {
        await patchDocument(id, data);
        report.stats.patched += 1;
        if (THROTTLE_MS) await sleep(THROTTLE_MS);
      } catch (err) {
        report.stats.errors += 1;
        if (report.samples.errors.length < 15) {
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
  console.log(`[tariff] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
