#!/usr/bin/env node
/**
 * High-confidence product packshot enrichment from EgyptDwa CSV JSON.
 *
 * Strength-aware matching (rejects dose mismatches). Prefer docs missing
 * image_url. Never overwrite a good existing image_url. Batch PATCH via
 * APPWRITE_API_KEY.
 *
 * Usage:
 *   node scripts/enrich-product-photos-from-csv.mjs --dry-run
 *   node scripts/enrich-product-photos-from-csv.mjs --write --concurrency 8
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");
const artifactsDir = path.join(root, "artifacts");

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
const MIN_MATCH = Number(argValue("--min-score", "85")) || 85;
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "6")) || 6);
const THROTTLE_MS = Number(argValue("--throttle-ms", "40")) || 40;
const LIMIT = Number(argValue("--limit", "0")) || 0;
const DATA_PATH =
  argValue("--data") || path.join(reportDir, "egyptdwa-medicines.json");
const EXPORT_PATH =
  argValue("--export") || path.join(reportDir, "appwrite-medicines-export.json");
const REPORT_PATH = path.join(
  artifactsDir,
  "product-photos-enrichment-report.json",
);
const REPORT_PATH_ALT = path.join(
  reportDir,
  "product-photos-enrichment-report.json",
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const PHOTO_ALIASES = [
  [/توينستا/g, "twynsta"], [/توينيستا/g, "twynsta"],
  [/سينجولير/g, "singulair"], [/سنجيولير/g, "singulair"], [/سينجولاير/g, "singulair"],
  [/زيلوريك/g, "zyloric"], [/زايلوريك/g, "zyloric"], [/زوكور/g, "zocor"],
  [/ون[-\s]?الفا/g, "one alpha"], [/نيوروتون/g, "neuroton"], [/ليبراكس/g, "librax"],
  [/برانداجليم/g, "prandaglim"], [/كونكور/g, "concor"], [/وحدة\s*دولية/g, "iu"],
];
function applyPhotoAliases(s) {
  let t = String(s || "");
  for (const [re, rep] of PHOTO_ALIASES) t = t.replace(re, rep);
  return t;
}
function normalizeName(s) {
  let t = applyPhotoAliases(s)
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "");
  t = t
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u0624\u0626\u0621]/g, "")
    .replace(/[\u0660-\u0669]/g, (d) =>
      String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)),
    );
  t = t
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}/\\|+*=~`'\"]/g, " ")
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/\b\d+([.,]\d+)?\s*(mg|mcg|ug|g|ml|iu|i\.?u\.?|%|مجم|ملغم|مكجم|مل|جم)\b/gi, " ")
    .replace(
      /\b(xr|er|sr|cr|mr|odt|dt|fc|f\.?c\.?|film coated|extended release|immediate release|prefilled|syringe|caps?|tabs?|tablets?|vial|amp|soft|hard|illegal import)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function extractDoseTokens(s) {
  const out = [];
  const re =
    /(\d+(?:[.,]\d+)?)\s*(mg|mcg|ug|g|ml|iu|i\.?u\.?|%|مجم|ملغم|مكجم|مل|جم)?/gi;
  let m;
  const raw = String(s || "");
  while ((m = re.exec(raw))) {
    const num = m[1].replace(",", ".");
    const unit = (m[2] || "").toLowerCase().replace(/\./g, "");
    // skip bare pack counts like "30" without unit when followed by tabs/caps keywords nearby
    if (!unit) {
      const after = raw.slice(m.index + m[0].length, m.index + m[0].length + 12).toLowerCase();
      if (/\b(tab|tabs|cap|caps|قرص|كبسول|فيال|amp|vial|pcs|sheet|جرعة)/i.test(after)) {
        continue; // pack size
      }
      // keep first bare number as potential strength when no units present later handled by primary
      out.push({ num, unit: "" });
      continue;
    }
    out.push({ num, unit });
  }
  return out;
}

function primaryStrengthKey(s) {
  const toks = extractDoseTokens(s).filter((t) => t.unit);
  if (!toks.length) {
    // fallback: first number that looks like strength (has decimal or typical dose)
    const all = extractDoseTokens(s);
    return all.length ? all[0].num : null;
  }
  return toks[0].num;
}

function strengthsCompatible(a, b) {
  const ka = primaryStrengthKey(a);
  const kb = primaryStrengthKey(b);
  if (!ka || !kb) return true; // can't verify — allow other score gates
  if (ka === kb) return true;
  // allow if either string contains the other's primary dose with a unit
  const aHas = new RegExp(`\\b${kb.replace(".", "[.,]")}\\s*(mg|mcg|iu|ml|g|مجم|مل)`, "i").test(
    String(a),
  );
  const bHas = new RegExp(`\\b${ka.replace(".", "[.,]")}\\s*(mg|mcg|iu|ml|g|مجم|مل)`, "i").test(
    String(b),
  );
  return aHas || bHas;
}

function tokenJaccard(a, b) {
  const A = new Set(normalizeName(a).split(" ").filter(Boolean));
  const B = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function scoreNames(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (!strengthsCompatible(a, b)) return 0;

  if (na === nb) return 100;
  if (na.startsWith(nb) || nb.startsWith(na)) return 90;
  if (na.includes(nb) || nb.includes(na)) return 82;
  const j = tokenJaccard(a, b);
  return Math.round(j * 100);
}

const STOP = new Set([
  "mg","ml","mcg","ug","g","gm","iu","tab","tabs","tablet","tablets","cap","caps",
  "capsule","capsules","vial","amp","gel","cream","ointment","syrup","suspension",
  "injection","prefilled","syringe","oral","for","and","with","قرص","اقراص","كبسول",
  "شراب","حقن","فيال","امبول","مجم","مل",
]);

function isSig(t) {
  if (!t || t.length < 3) return false;
  if (/^\d+$/.test(t)) return false;
  if (STOP.has(t.toLowerCase())) return false;
  return true;
}

function isPlaceholderImage(url) {
  const u = String(url || "");
  if (!u.trim()) return true;
  if (/unsplash\.com|placeholder|via\.placeholder|no_image|picsum/i.test(u)) return true;
  return false;
}

function loadProducts() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  return data.products || data.medicines || (Array.isArray(data) ? data : []);
}

function loadDocs() {
  const data = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  return Array.isArray(data) ? data : data.documents || data.medicines || [];
}

function buildIndexes(docs) {
  const byNorm = new Map();
  const byStem = new Map();
  for (const d of docs) {
    for (const field of [d.name_en, d.name_ar]) {
      const n = normalizeName(field);
      if (!n) continue;
      if (!byNorm.has(n)) byNorm.set(n, []);
      byNorm.get(n).push(d);
      for (const tok of n.split(" ")) {
        if (!isSig(tok)) continue;
        if (!byStem.has(tok)) byStem.set(tok, []);
        byStem.get(tok).push(d);
      }
    }
  }
  return { byNorm, byStem, docs };
}

function docLabel(d) {
  return d.name_en || d.name_ar || d.$id;
}

function findMatches(product, indexes) {
  const name = product.display_name || product.name_en || product.name_ar || "";
  const n = normalizeName(name);
  if (!n) return [];

  const candidateSet = new Set();
  const exact = indexes.byNorm.get(n) || [];
  for (const d of exact) candidateSet.add(d);
  for (const tok of n.split(" ").filter(isSig)) {
    for (const d of indexes.byStem.get(tok) || []) candidateSet.add(d);
  }

  const scored = [];
  for (const d of candidateSet) {
    const s = Math.max(
      scoreNames(name, d.name_en),
      scoreNames(name, d.name_ar),
      scoreNames(product.name_en, d.name_en),
      scoreNames(product.name_ar, d.name_ar),
    );
    if (s >= MIN_MATCH) {
      scored.push({
        doc: d,
        score: s,
        method: s >= 100 ? "exact_norm_strength" : s >= 90 ? "prefix_strength" : "fuzzy_strong",
      });
    }
  }
  scored.sort((a, b) => {
    // Prefer missing images, then higher score
    const ai = isPlaceholderImage(a.doc.image_url) ? 0 : 1;
    const bi = isPlaceholderImage(b.doc.image_url) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return b.score - a.score;
  });
  return scored;
}

function buildPatch(doc, product) {
  const data = {};
  const reasons = [];
  if (product.image_url && isPlaceholderImage(doc.image_url)) {
    data.image_url = product.image_url;
    reasons.push("fill_image");
  }
  const curPrice =
    doc.current_price_egp != null ? Number(doc.current_price_egp) : null;
  const emptyPrice =
    curPrice == null || curPrice === 0 || Number.isNaN(curPrice);
  if (product.current_price_egp != null && emptyPrice) {
    data.current_price_egp = product.current_price_egp;
    reasons.push("fill_price");
  }
  if (product.category && !doc.category) {
    data.category = product.category;
    reasons.push("fill_category");
  }
  if (product.egyptdwa_source_url && !doc.egyptdwa_source_url) {
    data.egyptdwa_source_url = product.egyptdwa_source_url;
    reasons.push("fill_egyptdwa_url");
  }
  return { data, reasons };
}

async function fetchWithRetry(url, options, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(400 * Math.pow(2, attempt - 1));
        continue;
      }
      return { ok: res.ok, status: res.status, text };
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await sleep(400 * Math.pow(2, attempt - 1));
    }
  }
}

async function patchDocument(id, data) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY required for --write");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;
  async function attempt(payload) {
    return fetchWithRetry(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": PROJECT,
        "X-Appwrite-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });
  }
  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    const { egyptdwa_source_url, source, ...rest } = data;
    if (Object.keys(rest).length) result = await attempt(rest);
  }
  if (!result.ok && result.status === 404) {
    return { missing: true };
  }
  if (!result.ok) {
    throw new Error(`PATCH ${id} ${result.status}: ${result.text.slice(0, 180)}`);
  }
  return { missing: false };
}

async function mapPool(items, concurrency, worker) {
  let i = 0;
  const results = new Array(items.length);
  async function run() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
  return results;
}

async function main() {
  console.log(
    `[photos] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} min_score=${MIN_MATCH} concurrency=${CONCURRENCY}`,
  );
  const products = loadProducts();
  const docs = loadDocs();
  console.log(`[photos] products=${products.length} docs=${docs.length}`);
  const indexes = buildIndexes(docs);

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    min_score: MIN_MATCH,
    source_csv: "product-photos-source.csv / egyptdwa",
    provenance: "egyptdwa.com:packshot",
    stats: {
      scanned: 0,
      matched_products: 0,
      skipped_low_confidence: 0,
      image_fill_targets: 0,
      patched: 0,
      skipped_no_change: 0,
      skipped_missing_doc: 0,
      errors: 0,
      still_missing_after: 0,
    },
    samples: {
      before_after: [],
      unmatched: [],
      errors: [],
      strength_rejected_examples: [],
    },
    unmatched_names: [],
    updated_ids: [],
  };

  let list = products;
  if (LIMIT > 0) list = products.slice(0, LIMIT);

  const patchJobs = [];
  const claimedDocIds = new Set(); // one product image per doc

  for (const product of list) {
    report.stats.scanned += 1;
    const matches = findMatches(product, indexes);
    if (!matches.length) {
      report.stats.skipped_low_confidence += 1;
      if (report.samples.unmatched.length < 50) {
        report.samples.unmatched.push({
          name: product.display_name,
          egyptdwa_id: product.egyptdwa_id,
        });
      }
      report.unmatched_names.push(product.display_name);
      continue;
    }
    report.stats.matched_products += 1;

    // Update all high-confidence matches that need an image (covers EN/AR duplicates)
    const targets = matches.filter(
      (m) =>
        product.image_url &&
        isPlaceholderImage(m.doc.image_url) &&
        !claimedDocIds.has(m.doc.$id),
    );
    if (!targets.length) {
      report.stats.skipped_no_change += 1;
      continue;
    }

    for (const m of targets) {
      const { data, reasons } = buildPatch(m.doc, product);
      if (!data.image_url) {
        // only egyptdwa url / price — still ok but count separately
        if (!Object.keys(data).length) continue;
      }
      claimedDocIds.add(m.doc.$id);
      if (data.image_url) report.stats.image_fill_targets += 1;
      const job = {
        id: m.doc.$id,
        product: product.display_name,
        matched: docLabel(m.doc),
        score: m.score,
        method: m.method,
        reasons,
        patch: data,
        before_image: m.doc.image_url || null,
        after_image: data.image_url || m.doc.image_url || null,
      };
      if (report.samples.before_after.length < 40) {
        report.samples.before_after.push(job);
      }
      patchJobs.push(job);
    }
  }

  console.log(
    `[photos] jobs=${patchJobs.length} image_targets=${report.stats.image_fill_targets} unmatched=${report.stats.skipped_low_confidence}`,
  );

  if (IS_WRITE) {
    await mapPool(patchJobs, CONCURRENCY, async (job) => {
      try {
        const res = await patchDocument(job.id, job.patch);
        if (res.missing) {
          report.stats.skipped_missing_doc += 1;
        } else {
          report.stats.patched += 1;
          report.updated_ids.push(job.id);
          // mutate local export cache
          const doc = docs.find((d) => d.$id === job.id);
          if (doc && job.patch.image_url) doc.image_url = job.patch.image_url;
        }
        if (THROTTLE_MS) await sleep(THROTTLE_MS);
      } catch (err) {
        report.stats.errors += 1;
        if (report.samples.errors.length < 30) {
          report.samples.errors.push({
            id: job.id,
            error: String(err.message || err),
          });
        }
      }
    });
  }

  // still missing among CSV products after this pass (local view)
  for (const product of list) {
    const matches = findMatches(product, indexes);
    const anyImg = matches.some((m) => !isPlaceholderImage(m.doc.image_url));
    if (!anyImg) report.stats.still_missing_after += 1;
  }

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
  const payload = JSON.stringify(report, null, 2);
  fs.writeFileSync(REPORT_PATH, payload, "utf8");
  fs.writeFileSync(REPORT_PATH_ALT, payload, "utf8");
  // also workspace root copy
  fs.writeFileSync(
    path.join("/workspace", "product-photos-enrichment-report.json"),
    payload,
    "utf8",
  );
  console.log(`[photos] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
