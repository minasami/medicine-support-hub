#!/usr/bin/env node
/**
 * Pass-5 pharmacy-catalog packshot scraper (Chat4Data-equivalent).
 *
 * Sources (beyond prior EgyptDwa CSV / AJAX passes):
 *   1. doctormpharmacy.com — public Shopify /products.json (full catalog)
 *   2. dwaprices.com — routing-new.php search (letter / digraph expansion)
 *
 * High-confidence match to Appwrite medicines (strength + form safe);
 * HEAD/GET-verify images; PATCH empty image_url only.
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass5-pharmacy-scrapers.mjs --scrape
 *   node scripts/enrich-product-photos-pass5-pharmacy-scrapers.mjs --dry-run
 *   node scripts/enrich-product-photos-pass5-pharmacy-scrapers.mjs --write
 *   node scripts/enrich-product-photos-pass5-pharmacy-scrapers.mjs --scrape --write
 *
 * Flags:
 *   --scrape              (re)fetch pharmacy catalogs into artifacts/photos-pass5/
 *   --skip-doctorm        skip Doctor M Shopify scrape
 *   --skip-dwaprices      skip DwaPrices digraph scrape
 *   --min-score N         default 88
 *   --concurrency N       default 8
 *   --limit N             cap empty docs scanned (0 = all)
 *   --max-patch N         cap patches this run (0 = all)
 *   --skip-verify         skip image HEAD/GET verify
 *   --skip-live-check     skip live Appwrite empty re-check before PATCH
 *   --dry-run / --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pass5Dir = path.join(root, "artifacts/photos-pass5");
const reportDir = path.join(root, "scripts/reports");

const ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  ""
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

const DO_SCRAPE = hasFlag("--scrape");
const IS_WRITE = hasFlag("--write");
const SKIP_DOCTORM = hasFlag("--skip-doctorm");
const SKIP_DWAPRICES = hasFlag("--skip-dwaprices");
const MIN_MATCH = Number(argValue("--min-score", "88")) || 88;
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "8")) || 8);
const THROTTLE_MS = Number(argValue("--throttle-ms", "35")) || 35;
const LIMIT = Number(argValue("--limit", "0")) || 0;
const MAX_PATCH = Number(argValue("--max-patch", "0")) || 0;
const VERIFY_IMAGES = !hasFlag("--skip-verify");
const LIVE_CHECK = !hasFlag("--skip-live-check");

const EXPORT_PATH =
  argValue("--export") || path.join(reportDir, "appwrite-medicines-export.json");
const DOCTORM_JSON = path.join(pass5Dir, "doctorm-products.json");
const DWAPRICES_JSON = path.join(pass5Dir, "dwaprices-products.json");
const COMBINED_JSON = path.join(pass5Dir, "pass5-scraped-products.json");
const CSV_PATH = path.join(pass5Dir, "pass5-chat4data.csv");
const REPORT_PATH = path.join(pass5Dir, "pass5-enrichment-report.json");
const SUMMARY_PATH = path.join(pass5Dir, "pass5-summary.json");
const EMPTY_EST_PATH = path.join(pass5Dir, "empty-image-estimate.json");

const UA = "MedicineSupportHubBot/1.0 (+https://medicinesupport.app; packshot-enrichment)";

const ALIASES = [
  [/توينستا/g, "twynsta"],
  [/سينجولير/g, "singulair"],
  [/زيلوريك/g, "zyloric"],
  [/زوكور/g, "zocor"],
  [/ون[-\s]?الفا/g, "one alpha"],
  [/نيوروتون/g, "neuroton"],
  [/ليبراكس/g, "librax"],
  [/تريبليكسام/g, "triplexam"],
  [/كونكور/g, "concor"],
  [/بلافيكس/g, "plavix"],
  [/اطفال/g, "paediatric"],
  [/للمضغ/g, "chew"],
  [/حبيبات/g, "granules"],
  [/مكجم/g, "mcg"],
  [/مجم/g, "mg"],
];

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
    if (pa === pb) return true;
    if (B.numbers.includes(pa) && A.numbers.includes(pb)) return true;
    return false;
  }
  return true;
}

function formsCompatible(a, b) {
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
  for (const t of ta) if (tb.has(t)) return true;
  if ((ta.has("amp") || ta.has("vial") || ta.has("pen")) && (tb.has("tab") || tb.has("cap")))
    return false;
  if ((tb.has("amp") || tb.has("vial") || tb.has("pen")) && (ta.has("tab") || ta.has("cap")))
    return false;
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

const STOP = new Set([
  "mg","ml","mcg","ug","g","gm","iu","tab","tabs","tablet","tablets","cap","caps",
  "capsule","capsules","vial","amp","gel","cream","plus","new","old","one","the",
  "for","and","with","oral","dept","medicine","self","medications","قرص","كبسول",
  "شراب","حقن","فيال","امبول","مجم","مل","بلس",
]);

function isSig(t) {
  if (!t || t.length < 3) return false;
  if (/^\d+$/.test(t)) return false;
  if (STOP.has(t.toLowerCase())) return false;
  return true;
}

function isEmptyImage(url) {
  const u = String(url || "");
  if (!u.trim()) return true;
  return /unsplash|placeholder|via\.placeholder|no_image|picsum/i.test(u);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function fetchJson(url, options = {}, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/plain,*/*",
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(400 * Math.pow(2, attempt - 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}: ${text.slice(0, 120)}`);
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON from ${url}: ${text.slice(0, 120)}`);
      }
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(400 * Math.pow(2, attempt - 1));
    }
  }
}

/* -------------------- scrapers -------------------- */

function ingestDoctorMProduct(p, seen, products) {
  const img = p.images?.[0]?.src;
  if (!img) return;
  const tags = (p.tags || []).map(String);
  const isNonMed =
    tags.some((t) => /diaper|cosmetic|fragrance|shampoo|device:|dept:personal/i.test(t)) &&
    !tags.some((t) => /dept:medicine/i.test(t));
  if (isNonMed) return;
  const key = String(p.id);
  if (seen.has(key)) return;
  seen.add(key);
  const price = p.variants?.[0]?.price ?? "";
  const title = String(p.title || "").replace(/\s*--+\s*$/, "").trim();
  products.push({
    source: "doctormpharmacy.com",
    source_id: key,
    name_en: title,
    name_ar: "",
    display_name: title,
    image_url: img,
    price_egp: price !== "" ? Number(price) : null,
    source_page: `https://doctormpharmacy.com/products/${p.handle}`,
    tags,
    sku: p.variants?.[0]?.sku || "",
  });
}

async function scrapeDoctorM() {
  console.log("[pass5] scraping doctormpharmacy.com products.json (pages 1–100) …");
  const products = [];
  const seen = new Set();
  // Shopify caps page*limit at 25000 → max page 100 @ limit 250
  for (let page = 1; page <= 100; page++) {
    const url = `https://doctormpharmacy.com/products.json?limit=250&page=${page}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      if (/25000 limit|Page \* Limit/i.test(String(err.message || err))) {
        console.log(`[pass5] Doctor M hit Shopify 25k offset cap at page ${page}`);
        break;
      }
      throw err;
    }
    const batch = data.products || [];
    if (!batch.length) break;
    for (const p of batch) ingestDoctorMProduct(p, seen, products);
    if (page % 10 === 0) {
      console.log(`[pass5] Doctor M page ${page}: cumulative ${products.length}`);
    }
    await sleep(60);
  }
  fs.writeFileSync(
    DOCTORM_JSON,
    JSON.stringify(
      {
        scraped_at: new Date().toISOString(),
        source: "doctormpharmacy.com/products.json",
        count: products.length,
        products,
      },
      null,
      2,
    ),
  );
  console.log(`[pass5] Doctor M → ${products.length} products with images`);
  return products;
}


async function dwaPricesSearch(q) {
  const body = `search=1&searchq=${encodeURIComponent(q)}`;
  const data = await fetchJson("https://dwaprices.com/routing-new.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return data;
}

function dwaRowToProduct(rz) {
  const img = String(rz.img || "");
  if (!img || !img.startsWith("upload/")) return null;
  if (Number(rz.noimgid) === 1) return null;
  const image_url = `https://dwaprices.com/${img}`;
  return {
    source: "dwaprices.com",
    source_id: String(rz.id),
    name_en: rz.name || "",
    name_ar: rz.arabic || "",
    display_name: rz.name || rz.arabic || "",
    image_url,
    price_egp: rz.price != null && rz.price !== "" ? Number(rz.price) : null,
    source_page: `https://dwaprices.com/med.php?id=${rz.id}`,
    concentration: rz.concentration || "",
    dosage_form: rz.dosage_form || "",
    company: rz.company || "",
    active: rz.active || "",
  };
}

async function scrapeDwaPrices() {
  console.log("[pass5] scraping dwaprices.com routing-new.php (digraph expansion) …");
  const byId = new Map();
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

  async function ingest(q) {
    const data = await dwaPricesSearch(q);
    const rows = data.data || [];
    let added = 0;
    for (const rz of rows) {
      const p = dwaRowToProduct(rz);
      if (!p) continue;
      if (!byId.has(p.source_id)) {
        byId.set(p.source_id, p);
        added += 1;
      }
    }
    return { metadata: Number(data.metadata) || rows.length, rows: rows.length, added };
  }

  // Phase 1: single-char
  const saturated = [];
  for (const ch of alphabet) {
    const r = await ingest(ch);
    console.log(`[pass5] DwaPrices q=${ch} meta=${r.metadata} added=${r.added} total=${byId.size}`);
    if (r.metadata >= 100 || r.rows >= 100) saturated.push(ch);
    await sleep(120);
  }

  // Phase 2: digraphs for saturated prefixes
  for (const a of saturated) {
    for (const b of alphabet) {
      const q = a + b;
      const r = await ingest(q);
      if (r.added || r.metadata) {
        if (r.added > 0) {
          console.log(`[pass5] DwaPrices q=${q} meta=${r.metadata} added=${r.added} total=${byId.size}`);
        }
      }
      await sleep(90);
    }
  }

  const products = [...byId.values()];
  fs.writeFileSync(
    DWAPRICES_JSON,
    JSON.stringify(
      {
        scraped_at: new Date().toISOString(),
        source: "dwaprices.com/routing-new.php",
        count: products.length,
        products,
      },
      null,
      2,
    ),
  );
  console.log(`[pass5] DwaPrices → ${products.length} products with images`);
  return products;
}

function writeChat4DataCsv(products) {
  const header = [
    "Category image",
    "Category views",
    "Category title",
    "Medicine Name",
    "Views",
    "Price",
    "Category link",
    "Image",
    "Medicine Name link",
  ];
  const lines = [header.join(",")];
  for (const p of products) {
    lines.push(
      [
        "",
        "",
        p.source || "",
        csvEscape(p.display_name || p.name_en || ""),
        "",
        p.price_egp ?? "",
        csvEscape(p.source || ""),
        csvEscape(p.image_url || ""),
        csvEscape(p.source_page || ""),
      ].join(","),
    );
  }
  fs.writeFileSync(CSV_PATH, lines.join("\n"));
  console.log(`[pass5] Chat4Data CSV → ${CSV_PATH} (${products.length} rows)`);
}

function loadScrapedProducts() {
  const byKey = new Map();
  function addFile(file) {
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const p of data.products || []) {
      if (!p.image_url) continue;
      const key = `${p.source}:${p.source_id || p.image_url}`;
      byKey.set(key, p);
    }
  }
  addFile(DOCTORM_JSON);
  addFile(DWAPRICES_JSON);
  addFile(COMBINED_JSON);
  return [...byKey.values()];
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
  for (const [k, arr] of byStem) byStem.set(k, [...new Set(arr)]);
  return byStem;
}

function findBestProduct(doc, byStem) {
  const names = [doc.name_en, doc.name_ar].filter(Boolean);
  const docStrengthSrc = `${doc.name_en || ""} ${doc.name_ar || ""}`;
  const candidateSet = new Set();
  for (const name of names) {
    const n = brandNorm(name);
    const toks = n.split(" ").filter(isSig);
    for (const tok of toks.slice(0, 3)) {
      for (const p of byStem.get(tok) || []) candidateSet.add(p);
    }
  }
  let best = null;
  for (const p of candidateSet) {
    const pnames = [p.display_name, p.name_en, p.name_ar].filter(Boolean);
    const prodStrengthSrc = `${p.display_name || ""} ${p.name_en || ""} ${p.name_ar || ""} ${p.concentration || ""}`;
    if (!strengthsCompatible(docStrengthSrc, prodStrengthSrc)) continue;
    if (!formsCompatible(docStrengthSrc, prodStrengthSrc)) continue;
    let score = 0;
    for (const dn of names) {
      for (const pn of pnames) {
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
    const ds = extractStrengths(docStrengthSrc);
    const ps = extractStrengths(prodStrengthSrc);
    let strengthBonus = 0;
    if (ds.numbers[0] && ps.numbers[0] && ds.numbers[0] === ps.numbers[0]) strengthBonus = 1;
    if (ds.compounds.length && ps.compounds.some((c) => ds.compounds.includes(c)))
      strengthBonus = 2;
    // Prefer products that actually declare a unit dose when the doc has one
    if (ds.numbers.length && !ps.numbers.length && !ps.compounds.length) continue;
    const rank = score * 10 + strengthBonus;
    const bestRank = best ? best.score * 10 + (best.strengthBonus || 0) : -1;
    if (!best || rank > bestRank) best = { product: p, score, strengthBonus };
  }
  return best;
}

const verifiedOk = new Map();
async function verifyImage(url) {
  if (!VERIFY_IMAGES) return true;
  if (verifiedOk.has(url)) return verifiedOk.get(url);
  const ctrlTimeout = (ms) => AbortSignal.timeout(ms);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: ctrlTimeout(8000),
    });
    const ct = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    let ok = res.ok && /image\//i.test(ct) && (len === 0 || len > 3000);
    if (!ok && res.ok && /image\//i.test(ct) && len === 0) ok = true;
    if (ok) {
      verifiedOk.set(url, true);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Range: "bytes=0-64" },
      signal: ctrlTimeout(10000),
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

async function getDoc(id) {
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-Key": API_KEY },
  });
  const text = await res.text();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${id} ${res.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

async function patchDocument(id, data) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY required for --write");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "X-Appwrite-Project": PROJECT,
      "X-Appwrite-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const text = await res.text();
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error(`PATCH ${id} ${res.status}: ${text.slice(0, 180)}`);
  return { missing: false };
}

async function mapPool(items, concurrency, worker) {
  let i = 0;
  async function run() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
}

async function estimateEmptyCoverage(docs) {
  let empty = 0;
  let filled = 0;
  for (const d of docs) {
    if (isEmptyImage(d.image_url)) empty += 1;
    else filled += 1;
  }
  // Live sample around several cursors
  let liveEmpty = 0;
  let liveFilled = 0;
  let liveSampled = 0;
  if (ENDPOINT && API_KEY) {
    const cursors = [
      "med_10000",
      "med_20000",
      "med_30000",
      "med_40000",
      "med_50000",
      "med_60000",
      "med_70000",
      "med_80000",
    ];
    for (const c of cursors) {
      try {
        const qs = new URLSearchParams();
        qs.append("queries[]", JSON.stringify({ method: "limit", values: [100] }));
        qs.append("queries[]", JSON.stringify({ method: "orderAsc", values: ["$id"] }));
        qs.append("queries[]", JSON.stringify({ method: "cursorAfter", values: [c] }));
        const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${COLLECTION_ID}/documents?${qs}`;
        const res = await fetch(url, {
          headers: { "X-Appwrite-Project": PROJECT, "X-Appwrite-Key": API_KEY },
        });
        const j = await res.json();
        for (const d of j.documents || []) {
          liveSampled += 1;
          if (isEmptyImage(d.image_url)) liveEmpty += 1;
          else liveFilled += 1;
        }
      } catch {
        /* ignore sample errors */
      }
    }
  }
  const est = {
    generated_at: new Date().toISOString(),
    export_total: docs.length,
    export_empty: empty,
    export_filled: filled,
    export_fill_rate_pct: Number(((filled / docs.length) * 100).toFixed(2)),
    live_sample: {
      sampled: liveSampled,
      empty: liveEmpty,
      filled: liveFilled,
      fill_rate_pct: liveSampled
        ? Number(((liveFilled / liveSampled) * 100).toFixed(2))
        : null,
      estimate_empty: liveSampled
        ? Math.round(docs.length * (liveEmpty / liveSampled))
        : empty,
      estimate_filled: liveSampled
        ? Math.round(docs.length * (liveFilled / liveSampled))
        : filled,
    },
  };
  fs.writeFileSync(EMPTY_EST_PATH, JSON.stringify(est, null, 2));
  console.log("[pass5] empty estimate:", JSON.stringify(est.live_sample));
  return est;
}

async function main() {
  fs.mkdirSync(pass5Dir, { recursive: true });
  console.log(
    `[pass5] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} scrape=${DO_SCRAPE} min=${MIN_MATCH} conc=${CONCURRENCY}`,
  );

  let scraped = [];
  if (DO_SCRAPE) {
    if (!SKIP_DOCTORM) scraped = scraped.concat(await scrapeDoctorM());
    else if (fs.existsSync(DOCTORM_JSON)) {
      const cached = JSON.parse(fs.readFileSync(DOCTORM_JSON, "utf8"));
      scraped = scraped.concat(cached.products || []);
      console.log(`[pass5] reused cached Doctor M (${cached.products?.length || 0})`);
    }
    if (!SKIP_DWAPRICES) scraped = scraped.concat(await scrapeDwaPrices());
    else if (fs.existsSync(DWAPRICES_JSON)) {
      const cached = JSON.parse(fs.readFileSync(DWAPRICES_JSON, "utf8"));
      scraped = scraped.concat(cached.products || []);
      console.log(`[pass5] reused cached DwaPrices (${cached.products?.length || 0})`);
    }
    // Dedup by source:id
    const byKey = new Map();
    for (const p of scraped) byKey.set(`${p.source}:${p.source_id}`, p);
    scraped = [...byKey.values()];
    fs.writeFileSync(
      COMBINED_JSON,
      JSON.stringify(
        {
          scraped_at: new Date().toISOString(),
          count: scraped.length,
          by_source: scraped.reduce((acc, p) => {
            acc[p.source] = (acc[p.source] || 0) + 1;
            return acc;
          }, {}),
          products: scraped,
        },
        null,
        2,
      ),
    );
    writeChat4DataCsv(scraped);
  } else {
    scraped = loadScrapedProducts();
    console.log(`[pass5] loaded cached scrape products=${scraped.length}`);
    if (!scraped.length) {
      throw new Error("No scraped products found. Run with --scrape first.");
    }
    if (!fs.existsSync(CSV_PATH)) writeChat4DataCsv(scraped);
  }

  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Appwrite export missing: ${EXPORT_PATH}`);
  }
  const docs = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const docList = Array.isArray(docs) ? docs : docs.documents || [];
  console.log(`[pass5] export docs=${docList.length}`);

  const emptyEst = await estimateEmptyCoverage(docList);

  const byStem = buildProductIndex(scraped);
  console.log(`[pass5] product stem keys=${byStem.size}`);

  const productStems = new Set([...byStem.keys()]);
  let emptyDocs = docList.filter((d) => {
    if (!isEmptyImage(d.image_url)) return false;
    const blob = brandNorm(`${d.name_en || ""} ${d.name_ar || ""}`);
    const toks = blob.split(" ").filter(isSig);
    return toks.some((tok) => productStems.has(tok));
  });
  if (LIMIT > 0) emptyDocs = emptyDocs.slice(0, LIMIT);
  console.log(`[pass5] empty docs overlapping scrape stems=${emptyDocs.length}`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    pass: "pass5-pharmacy-scrapers",
    min_score: MIN_MATCH,
    sources: {
      doctorm: scraped.filter((p) => p.source === "doctormpharmacy.com").length,
      dwaprices: scraped.filter((p) => p.source === "dwaprices.com").length,
      total_scraped: scraped.length,
    },
    empty_estimate: emptyEst,
    provenance:
      "doctormpharmacy.com Shopify + dwaprices.com routing-new.php (pass5)",
    stats: {
      empty_scanned: 0,
      matched: 0,
      no_match: 0,
      bad_image: 0,
      skipped_live_already_filled: 0,
      skipped_missing_doc: 0,
      patched: 0,
      errors: 0,
      by_source: {},
    },
    samples: { before_after: [], errors: [] },
    patched_rows: [],
  };

  const candidates = [];
  let iScan = 0;
  for (const doc of emptyDocs) {
    report.stats.empty_scanned += 1;
    iScan += 1;
    if (iScan % 10000 === 0) {
      console.log(`[pass5] scanned ${iScan}/${emptyDocs.length} candidates=${candidates.length}`);
    }
    const best = findBestProduct(doc, byStem);
    if (!best) {
      report.stats.no_match += 1;
      continue;
    }
    report.stats.matched += 1;
    candidates.push({
      id: doc.$id,
      matched: doc.name_en || doc.name_ar,
      product: best.product.display_name || best.product.name_en,
      score: best.score,
      source: best.product.source,
      source_page: best.product.source_page,
      image_url: best.product.image_url,
      price_egp: best.product.price_egp,
      provenance: `${best.product.source}:packshot (pass5)`,
    });
    if (MAX_PATCH > 0 && candidates.length >= MAX_PATCH * 3) break;
  }
  console.log(`[pass5] raw candidates=${candidates.length}; verifying unique images…`);

  const uniqueUrls = [...new Set(candidates.map((c) => c.image_url))];
  console.log(`[pass5] unique image URLs to verify: ${uniqueUrls.length}`);
  let verified = 0;
  await mapPool(uniqueUrls, Math.min(Math.max(CONCURRENCY, 16), 24), async (url) => {
    await verifyImage(url);
    verified += 1;
    if (verified % 200 === 0 || verified === uniqueUrls.length) {
      console.log(`[pass5] verified ${verified}/${uniqueUrls.length}`);
    }
  });

  const patchJobs = [];
  for (const job of candidates) {
    const ok = verifiedOk.get(job.image_url);
    if (!ok) {
      report.stats.bad_image += 1;
      continue;
    }
    if (report.samples.before_after.length < 80) {
      report.samples.before_after.push(job);
    }
    patchJobs.push(job);
    if (MAX_PATCH > 0 && patchJobs.length >= MAX_PATCH) break;
  }

  console.log(`[pass5] high-confidence jobs=${patchJobs.length}`);

  if (IS_WRITE) {
    await mapPool(patchJobs, CONCURRENCY, async (job) => {
      try {
        if (LIVE_CHECK) {
          const live = await getDoc(job.id);
          if (!live) {
            report.stats.skipped_missing_doc += 1;
            return;
          }
          if (!isEmptyImage(live.image_url)) {
            report.stats.skipped_live_already_filled += 1;
            return;
          }
        }
        const res = await patchDocument(job.id, { image_url: job.image_url });
        if (res.missing) {
          report.stats.skipped_missing_doc += 1;
          return;
        }
        report.stats.patched += 1;
        report.stats.by_source[job.source] =
          (report.stats.by_source[job.source] || 0) + 1;
        if (report.patched_rows.length < 500) report.patched_rows.push(job);
        const doc = docList.find((d) => d.$id === job.id);
        if (doc) doc.image_url = job.image_url;
        if (THROTTLE_MS) await sleep(THROTTLE_MS);
      } catch (err) {
        report.stats.errors += 1;
        if (report.samples.errors.length < 40) {
          report.samples.errors.push({
            id: job.id,
            error: String(err.message || err),
          });
        }
      }
    });
    // Persist updated export for future passes
    fs.writeFileSync(EXPORT_PATH, JSON.stringify(docList));
  } else {
    report.dry_run_would_patch = patchJobs.length;
    report.stats.by_source = patchJobs.reduce((acc, j) => {
      acc[j.source] = (acc[j.source] || 0) + 1;
      return acc;
    }, {});
  }

  // Post empty estimate (export-based after in-memory updates)
  let stillEmpty = 0;
  for (const d of docList) if (isEmptyImage(d.image_url)) stillEmpty += 1;

  const summary = {
    generated_at: new Date().toISOString(),
    pass: "pass5-pharmacy-scrapers",
    sources_used: [
      !SKIP_DOCTORM || scraped.some((p) => p.source === "doctormpharmacy.com")
        ? "doctormpharmacy.com (Shopify products.json)"
        : null,
      !SKIP_DWAPRICES || scraped.some((p) => p.source === "dwaprices.com")
        ? "dwaprices.com (routing-new.php digraph search)"
        : null,
    ].filter(Boolean),
    rows_scraped: scraped.length,
    by_source_scraped: report.sources,
    matched_jobs: patchJobs.length,
    patched: report.stats.patched,
    skipped_live_already_filled: report.stats.skipped_live_already_filled,
    still_empty_export_estimate: stillEmpty,
    prior_empty_estimate: emptyEst.live_sample?.estimate_empty ?? emptyEst.export_empty,
    chat4data_csv: "artifacts/photos-pass5/pass5-chat4data.csv",
    scripts: [
      "scripts/enrich-product-photos-pass5-pharmacy-scrapers.mjs",
      "npm run photos:enrich:pass5[:dry|:scrape]",
    ],
    ui: { changes: "none — data-only", version_bump: false },
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  console.log(`[pass5] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
