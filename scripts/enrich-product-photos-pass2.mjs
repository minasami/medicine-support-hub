#!/usr/bin/env node
/**
 * Pass-2 packshot enrichment (doc-centric, high-confidence).
 *
 * Sources: EgyptDwa CSV products + AJAX search hits.
 * Improves Arabic/English aliases + compound-strength matching.
 * Iterates Appwrite export docs that still lack image_url (fast),
 * finds best product packshot, verifies URL, patches.
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass2.mjs --dry-run
 *   node scripts/enrich-product-photos-pass2.mjs --write --concurrency 8
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");
const artifactsDir = path.join(root, "artifacts");
const pass2Dir = path.join(artifactsDir, "photos-pass2");

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
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "8")) || 8);
const THROTTLE_MS = Number(argValue("--throttle-ms", "35")) || 35;
const LIMIT = Number(argValue("--limit", "0")) || 0;
const VERIFY_IMAGES = !hasFlag("--skip-verify");
const HIGH_VALUE_ONLY = hasFlag("--high-value-only");

const CSV_PRODUCTS =
  argValue("--csv-json") || path.join(reportDir, "egyptdwa-medicines.json");
const SEARCH_PRODUCTS =
  argValue("--search-json") ||
  path.join(pass2Dir, "egyptdwa-search-products.json");
const EXPORT_PATH =
  argValue("--export") || path.join(reportDir, "appwrite-medicines-export.json");
const REPORT_PATH = path.join(pass2Dir, "pass2-enrichment-report.json");

const ALIASES = [
  [/توينستا/g, "twynsta"],
  [/توينيستا/g, "twynsta"],
  [/سينجولير/g, "singulair"],
  [/سنجيولير/g, "singulair"],
  [/سينجولاير/g, "singulair"],
  [/زيلوريك/g, "zyloric"],
  [/زايلوريك/g, "zyloric"],
  [/زوكور/g, "zocor"],
  [/ون[-\s]?الفا/g, "one alpha"],
  [/ونالفا/g, "one alpha"],
  [/نيوروتون/g, "neuroton"],
  [/ليبراكس/g, "librax"],
  [/تريبليكسام/g, "triplexam"],
  [/تريبلكسام/g, "triplexam"],
  [/ديورجوي/g, "durjoy"],
  [/برانداجليم/g, "prandaglim"],
  [/مادوفيت/g, "maddovit"],
  [/بيبون/g, "pepon"],
  [/سولفاكس/g, "sulfax"],
  [/كويلا/g, "quella"],
  [/زانسيستوب/g, "xanthistop"],
  [/بالميفير/g, "palmefer"],
  [/سومازينا/g, "somazina"],
  [/تريباتنس/g, "tribtens"],
  [/فاسلو/g, "vasalo"],
  [/تاروليمس/g, "tarolimus"],
  [/سبازموديجستين/g, "spasmodigestin"],
  [/سبازمو\s*امريز/g, "spasmo amrase"],
  [/بيتولفكس/g, "betolvex"],
  [/اميجراويست/g, "amigrawest"],
  [/ستيميولان/g, "stimulan"],
  [/يونوكرون/g, "unicron"],
  [/اسبيكو/g, "aspico"],
  [/يوريك[-\s]?بيور/g, "uric pure"],
  [/يوريكودروب/g, "uricodrop"],
  [/زيلوكايين/g, "xylocaine"],
  [/تمبورال/g, "tempural"],
  [/فيرميزول/g, "vermezole"],
  [/كونكور/g, "concor"],
  [/وحدة\s*دولية/g, "iu"],
  [/اطفال/g, "paediatric"],
  [/للمضغ/g, "chew"],
  [/حبيبات/g, "granules"],
  [/مكجم/g, "mcg"],
  [/مجم/g, "mg"],
];

const HV_RE =
  /\b(concor|plavix|lipitor|januvia|glucophage|crestor|norvasc|cozaar|coveram|augmentin|zithromax|viagra|cataflam|voltaren|nexium|lantus|humalog|panadol|aspirin|zocor|singulair|twynsta|neuroton|librax|coversyl|diovan|xarelto|eliquis|clexane|amaryl|diamicron|forxiga|ozempic|keppra|lyrica|cipralex|one alpha|zyloric|prandaglim|pepon|sulfax|quella|xanthistop|palmefer|somazina|maddovit|durjoy|fosavance|sterogyl|sansocal|fortamind|valsarcard)\b/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function applyAliases(s) {
  let t = String(s || "");
  for (const [re, rep] of ALIASES) t = t.replace(re, rep);
  return t;
}

function normalizeBase(s) {
  let t = applyAliases(s)
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
    .replace(
      /\b(xr|er|sr|cr|mr|odt|dt|fc|f\.?c\.?|film coated|extended release|immediate release|prefilled|syringe|caps?|capsules?|tabs?|tablets?|vial|amp|amps?|soft|hard|illegal import|n\/?a yet|new|old|chew|chewable|paediatric|pediatric|granules|sachets?|oral|coated|sugar|solution|suspension|cream|gel|lotion|spray|ointment|drops?|pieces?|قرص|اقراص|كبسول|كبسوله|شراب|حقن|فيال|امبول|نقط|كيس|اكياس|قطعه)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function brandNorm(s) {
  return normalizeBase(s)
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStrengths(s) {
  const raw = applyAliases(s);
  const numbers = [];
  const compounds = [];
  const compoundRe =
    /(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+(?:[.,]\d+)?){1,3}(?=\s*(mg|mcg|ug|g|ml|iu|مجم|مكجم|مل|جم)?)/gi;
  let m;
  while ((m = compoundRe.exec(raw))) {
    const parts = m[0].split(/\s*\/\s*/).map((x) => x.replace(",", "."));
    compounds.push(parts.join("/"));
    numbers.push(...parts);
  }
  const unitRe =
    /(\d+(?:[.,]\d+)?)\s*(mg|mcg|ug|g|ml|iu|i\.?u\.?|%|مجم|ملغم|مكجم|مل|جم|miu)/gi;
  while ((m = unitRe.exec(raw))) {
    numbers.push(m[1].replace(",", "."));
  }
  return {
    numbers: [...new Set(numbers)],
    compounds: [...new Set(compounds)],
  };
}

function strengthsCompatible(a, b) {
  const A = extractStrengths(a);
  const B = extractStrengths(b);
  if (A.compounds.length && B.compounds.length) {
    return A.compounds.some((c) => B.compounds.includes(c));
  }
  if (A.compounds.length && B.numbers.length) {
    return A.compounds[0].split("/").every((n) => B.numbers.includes(n));
  }
  if (B.compounds.length && A.numbers.length) {
    return B.compounds[0].split("/").every((n) => A.numbers.includes(n));
  }
  if (A.numbers.length && B.numbers.length) {
    const pa = A.numbers[0];
    const pb = B.numbers[0];
    // Require shared primary dose (or mutual containment for multi-dose forms)
    if (pa === pb) return true;
    if (B.numbers.includes(pa) && A.numbers.includes(pb)) return true;
    return false;
  }
  // If one side has a unit dose and the other doesn't, allow (pack-size-only names)
  return true;
}


/** Reject obvious dosage-form mismatches (amp vs tab, syrup vs cream, etc.). */
function formsCompatible(a, b) {
  const raw = `${a || ""} ${b || ""}`.toLowerCase();
  const A = String(a || "").toLowerCase();
  const B = String(b || "").toLowerCase();
  const forms = [
    [/\b(amp|amps|ampoule|امبول)/, "amp"],
    [/\b(tab|tabs|tablet|tablets|قرص|اقراص)/, "tab"],
    [/\b(cap|caps|capsule|capsules|كبسول)/, "cap"],
    [/\b(syrup|suspension|شراب|معلق)/, "syrup"],
    [/\b(cream|ointment|كريم|مرهم)/, "cream"],
    [/\b(gel|جيل)/, "gel"],
    [/\b(drop|drops|نقط)/, "drops"],
    [/\b(sachet|granule|كيس|حبيبات)/, "sachet"],
    [/\b(pen|cartridge|خرطوش|قلم)/, "pen"],
    [/\b(vial|فيال)/, "vial"],
  ];
  function tags(s) {
    const out = new Set();
    for (const [re, tag] of forms) if (re.test(s)) out.add(tag);
    return out;
  }
  const ta = tags(A);
  const tb = tags(B);
  if (!ta.size || !tb.size) return true;
  // compatible if intersection non-empty
  for (const t of ta) if (tb.has(t)) return true;
  // amp vs tab/cap is never ok
  if ((ta.has("amp") || ta.has("vial") || ta.has("pen")) && (tb.has("tab") || tb.has("cap"))) return false;
  if ((tb.has("amp") || tb.has("vial") || tb.has("pen")) && (ta.has("tab") || ta.has("cap"))) return false;
  return false;
}

function tokenJaccard(a, b) {

  const A = new Set(brandNorm(a).split(" ").filter(Boolean));
  const B = new Set(brandNorm(b).split(" ").filter(Boolean));
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

function scorePair(docName, productName) {
  if (!docName || !productName) return 0;
  if (!strengthsCompatible(docName, productName)) return 0;
  const na = brandNorm(docName);
  const nb = brandNorm(productName);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.startsWith(nb) || nb.startsWith(na)) return 92;
  if (na.includes(nb) || nb.includes(na)) return 86;
  const j = Math.round(tokenJaccard(docName, productName) * 100);
  const ta = na.split(" ").find((t) => t.length >= 3);
  const tb = nb.split(" ").find((t) => t.length >= 3);
  if (ta && tb && ta !== tb && !ta.startsWith(tb) && !tb.startsWith(ta)) {
    return Math.min(j, 70);
  }
  return j;
}

const STOP = new Set([
  "mg","ml","mcg","ug","g","gm","iu","tab","tabs","tablet","tablets","cap","caps",
  "capsule","capsules","vial","amp","gel","cream","plus","new","old","one","the",
  "for","and","with","oral","قرص","كبسول","شراب","حقن","فيال","امبول","مجم","مل","بلس",
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
  if (/unsplash\.com|placeholder|via\.placeholder|no_image|picsum/i.test(u))
    return true;
  return false;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadProducts() {
  const byKey = new Map();
  function addAll(list, tag) {
    for (const p of list) {
      if (!p.image_url) continue;
      const key = String(p.egyptdwa_id || p.image_url);
      const prev = byKey.get(key);
      if (
        !prev ||
        (p.name_en && (!prev.name_en || p.name_en.length > prev.name_en.length))
      ) {
        byKey.set(key, { ...p, _src: tag });
      }
    }
  }
  if (fs.existsSync(SEARCH_PRODUCTS)) {
    const data = loadJson(SEARCH_PRODUCTS);
    addAll(data.products || [], "search");
  }
  if (fs.existsSync(CSV_PRODUCTS)) {
    const data = loadJson(CSV_PRODUCTS);
    addAll(data.products || data.medicines || [], "csv");
  }
  return [...byKey.values()];
}

function loadDocs() {
  const data = loadJson(EXPORT_PATH);
  return Array.isArray(data) ? data : data.documents || data.medicines || [];
}

function buildProductIndex(products) {
  const byStem = new Map();
  for (const p of products) {
    for (const field of [p.display_name, p.name_en, p.name_ar]) {
      const n = brandNorm(field);
      if (!n) continue;
      for (const tok of n.split(" ")) {
        if (!isSig(tok)) continue;
        if (!byStem.has(tok)) byStem.set(tok, []);
        byStem.get(tok).push(p);
      }
    }
  }
  // dedupe lists
  for (const [k, arr] of byStem) {
    byStem.set(k, [...new Set(arr)]);
  }
  return byStem;
}

function findBestProduct(doc, byStem) {
  const names = [doc.name_en, doc.name_ar].filter(Boolean);
  const docStrengthSrc = `${doc.name_en || ""} ${doc.name_ar || ""}`;
  const candidateSet = new Set();
  for (const name of names) {
    const n = brandNorm(name);
    const toks = n.split(" ").filter(isSig);
    // prefer first brand token
    for (const tok of toks.slice(0, 3)) {
      for (const p of byStem.get(tok) || []) candidateSet.add(p);
    }
  }
  let best = null;
  for (const p of candidateSet) {
    const pnames = [p.display_name, p.name_en, p.name_ar].filter(Boolean);
    const prodStrengthSrc = `${p.display_name || ""} ${p.name_en || ""} ${p.name_ar || ""}`;
    // Always compare strengths on full labels (avoids empty AR/EN field bypass)
    if (!strengthsCompatible(docStrengthSrc, prodStrengthSrc)) continue;
    if (!formsCompatible(docStrengthSrc, prodStrengthSrc)) continue;
    let score = 0;
    for (const dn of names) {
      for (const pn of pnames) {
        // brand/token score only; strength already gated above
        const na = brandNorm(dn);
        const nb = brandNorm(pn);
        if (!na || !nb) continue;
        let s = 0;
        if (na === nb) s = 100;
        else if (na.startsWith(nb) || nb.startsWith(na)) s = 92;
        else if (na.includes(nb) || nb.includes(na)) s = 86;
        else {
          s = Math.round(tokenJaccard(dn, pn) * 100);
          const ta = na.split(" ").find((t) => t.length >= 3);
          const tb = nb.split(" ").find((t) => t.length >= 3);
          if (ta && tb && ta !== tb && !ta.startsWith(tb) && !tb.startsWith(ta)) {
            s = Math.min(s, 70);
          }
        }
        score = Math.max(score, s);
      }
    }
    if (score < MIN_MATCH) continue;
    // Prefer product that also shares the same primary unit dose when both have doses
    const ds = extractStrengths(docStrengthSrc);
    const ps = extractStrengths(prodStrengthSrc);
    let strengthBonus = 0;
    if (ds.numbers[0] && ps.numbers[0] && ds.numbers[0] === ps.numbers[0]) strengthBonus = 1;
    if (ds.compounds.length && ps.compounds.some((c) => ds.compounds.includes(c))) strengthBonus = 2;
    const rank = score * 10 + strengthBonus;
    const bestRank = best ? best.score * 10 + (best.strengthBonus || 0) : -1;
    if (!best || rank > bestRank) {
      best = { product: p, score, strengthBonus };
    }
  }
  return best;
}

const verifiedOk = new Map();
async function verifyImage(url) {
  if (!VERIFY_IMAGES) return true;
  if (verifiedOk.has(url)) return verifiedOk.get(url);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "MedicineSupportHubBot/1.0" },
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") || "";
    const ok = res.ok && /image\//i.test(ct);
    verifiedOk.set(url, ok);
    return ok;
  } catch {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "MedicineSupportHubBot/1.0",
          Range: "bytes=0-64",
        },
      });
      const ct = res.headers.get("content-type") || "";
      const ok = (res.ok || res.status === 206) && /image\//i.test(ct);
      verifiedOk.set(url, ok);
      return ok;
    } catch {
      verifiedOk.set(url, false);
      return false;
    }
  }
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
    const { egyptdwa_source_url, ...rest } = data;
    if (Object.keys(rest).length) result = await attempt(rest);
  }
  if (!result.ok && result.status === 404) return { missing: true };
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
    `[pass2] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} min=${MIN_MATCH} conc=${CONCURRENCY} verify=${VERIFY_IMAGES} hv_only=${HIGH_VALUE_ONLY}`,
  );
  const products = loadProducts();
  const docs = loadDocs();
  console.log(`[pass2] products=${products.length} docs=${docs.length}`);
  const byStem = buildProductIndex(products);
  console.log(`[pass2] product stem keys=${byStem.size}`);

  const productStems = new Set([...byStem.keys()]);
  let emptyDocs = docs.filter((d) => {
    if (!isPlaceholderImage(d.image_url)) return false;
    // Only docs that share a significant stem with our product packshot pool
    const blob = brandNorm(`${d.name_en || ""} ${d.name_ar || ""}`);
    const toks = blob.split(" ").filter(isSig);
    return toks.some((tok) => productStems.has(tok));
  });
  if (HIGH_VALUE_ONLY) {
    emptyDocs = emptyDocs.filter((d) =>
      HV_RE.test(`${d.name_en || ""} ${d.name_ar || ""}`),
    );
  }
  if (LIMIT > 0) emptyDocs = emptyDocs.slice(0, LIMIT);
  console.log(`[pass2] empty docs to scan=${emptyDocs.length}`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    min_score: MIN_MATCH,
    provenance: "egyptdwa.com:packshot (csv+ajax-search pass2)",
    stats: {
      empty_scanned: 0,
      matched: 0,
      no_match: 0,
      bad_image: 0,
      image_fill_targets: 0,
      patched: 0,
      skipped_missing_doc: 0,
      errors: 0,
      high_value_matched: 0,
    },
    samples: { before_after: [], concor: [], errors: [] },
    high_value_fills: [],
    updated_ids: [],
  };

  const patchJobs = [];
  const usedProductForDoc = new Set();
  let i = 0;
  for (const doc of emptyDocs) {
    i += 1;
    report.stats.empty_scanned += 1;
    if (i % 5000 === 0) {
      console.log(
        `[pass2] scanned ${i}/${emptyDocs.length} matched=${report.stats.matched}`,
      );
    }
    const best = findBestProduct(doc, byStem);
    if (!best) {
      report.stats.no_match += 1;
      continue;
    }
    report.stats.matched += 1;
    const ok = await verifyImage(best.product.image_url);
    if (!ok) {
      report.stats.bad_image += 1;
      continue;
    }
    const claimKey = doc.$id;
    if (usedProductForDoc.has(claimKey)) continue;
    usedProductForDoc.add(claimKey);

    const data = { image_url: best.product.image_url };
    if (best.product.egyptdwa_source_url) {
      data.egyptdwa_source_url = best.product.egyptdwa_source_url;
    }
    report.stats.image_fill_targets += 1;
    const job = {
      id: doc.$id,
      matched: doc.name_en || doc.name_ar,
      product: best.product.display_name || best.product.name_en,
      score: best.score,
      method:
        best.score >= 100
          ? "exact_brand_strength"
          : best.score >= 90
            ? "prefix_brand_strength"
            : "fuzzy_brand_strength",
      patch: data,
      before_image: doc.image_url || null,
      after_image: data.image_url,
      src: best.product._src,
    };
    if (report.samples.before_after.length < 60) {
      report.samples.before_after.push(job);
    }
    const blob = `${job.matched} ${job.product}`;
    if (HV_RE.test(blob)) {
      report.stats.high_value_matched += 1;
      report.high_value_fills.push({
        id: job.id,
        matched: job.matched,
        product: job.product,
        score: job.score,
        image: job.after_image,
      });
    }
    if (/concor/i.test(blob)) report.samples.concor.push(job);
    patchJobs.push(job);
  }

  console.log(
    `[pass2] jobs=${patchJobs.length} hv=${report.high_value_fills.length} concor=${report.samples.concor.length}`,
  );

  if (IS_WRITE) {
    await mapPool(patchJobs, CONCURRENCY, async (job) => {
      try {
        const res = await patchDocument(job.id, job.patch);
        if (res.missing) report.stats.skipped_missing_doc += 1;
        else {
          report.stats.patched += 1;
          report.updated_ids.push(job.id);
          const doc = docs.find((d) => d.$id === job.id);
          if (doc) doc.image_url = job.patch.image_url;
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
    fs.writeFileSync(EXPORT_PATH, JSON.stringify(docs));
  } else {
    report.dry_run_would_patch = patchJobs.length;
  }

  fs.mkdirSync(pass2Dir, { recursive: true });
  // trim huge arrays for report file
  const out = {
    ...report,
    high_value_fills: report.high_value_fills.slice(0, 200),
    updated_ids_count: report.updated_ids.length,
    updated_ids_sample: report.updated_ids.slice(0, 40),
  };
  delete out.updated_ids;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(out, null, 2));
  console.log(`[pass2] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
