#!/usr/bin/env node
/**
 * Pass-6 pharmacy / catalog packshot scraper (Chat4Data-equivalent).
 *
 * New or expanded sources beyond pass-5 (Doctor M + DwaPrices):
 *   1. egyptiandrugstore.com — OpenCart category listings (medicines + Rx)
 *   2. alfouadpharmacies.com — public Shopify products.json / collection feed
 *   3. kidzmarket-eg.com — Allam Pharmacy Shopify (baby / mother-care)
 *   4. egyptdwa.com — AJAX /ajax/routing.php digraph + trigraph expansion
 *      plus targeted searches for empty high-value / medicine brand stems
 *
 * High-confidence match to Appwrite medicines (strength + form safe);
 * HEAD/GET-verify images; PATCH empty image_url only.
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass6-pharmacy-catalogs.mjs --scrape
 *   node scripts/enrich-product-photos-pass6-pharmacy-catalogs.mjs --dry-run
 *   node scripts/enrich-product-photos-pass6-pharmacy-catalogs.mjs --write
 *   node scripts/enrich-product-photos-pass6-pharmacy-catalogs.mjs --scrape --write
 *
 * Flags:
 *   --scrape
 *   --skip-eds --skip-alfouad --skip-kidz --skip-egyptdwa
 *   --min-score N         default 88
 *   --concurrency N       default 8
 *   --limit N             cap empty docs scanned (0 = all)
 *   --max-patch N         cap patches this run (0 = all)
 *   --skip-verify
 *   --skip-live-check
 *   --dry-run / --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pass6Dir = path.join(root, "artifacts/photos-pass6");
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
const SKIP_EDS = hasFlag("--skip-eds");
const SKIP_ALFOUAD = hasFlag("--skip-alfouad");
const SKIP_KIDZ = hasFlag("--skip-kidz");
const SKIP_EGYPTDWA = hasFlag("--skip-egyptdwa");
const MIN_MATCH = Number(argValue("--min-score", "88")) || 88;
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "8")) || 8);
const THROTTLE_MS = Number(argValue("--throttle-ms", "35")) || 35;
const LIMIT = Number(argValue("--limit", "0")) || 0;
const MAX_PATCH = Number(argValue("--max-patch", "0")) || 0;
const VERIFY_IMAGES = !hasFlag("--skip-verify");
const LIVE_CHECK = !hasFlag("--skip-live-check");

const EXPORT_PATH =
  argValue("--export") || path.join(reportDir, "appwrite-medicines-export.json");
const EDS_JSON = path.join(pass6Dir, "egyptiandrugstore-products.json");
const ALFOUAD_JSON = path.join(pass6Dir, "alfouad-products.json");
const KIDZ_JSON = path.join(pass6Dir, "kidzmarket-products.json");
const EGYPTDWA_JSON = path.join(pass6Dir, "egyptdwa-ajax-products.json");
const COMBINED_JSON = path.join(pass6Dir, "pass6-scraped-products.json");
const CSV_PATH = path.join(pass6Dir, "pass6-chat4data.csv");
const REPORT_PATH = path.join(pass6Dir, "pass6-enrichment-report.json");
const SUMMARY_PATH = path.join(pass6Dir, "pass6-summary.json");
const EMPTY_EST_PATH = path.join(pass6Dir, "empty-image-estimate.json");

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

const HV_RE =
  /\b(concor|plavix|lipitor|januvia|glucophage|crestor|norvasc|cozaar|coveram|augmentin|zithromax|viagra|cataflam|voltaren|nexium|lantus|humalog|panadol|aspirin|zocor|singulair|twynsta|neuroton|librax|coversyl|diovan|xarelto|eliquis|clexane|amaryl|diamicron|forxiga|ozempic|keppra|lyrica|cipralex|one alpha|zyloric|entresto|janumet|brillinta|jardiance|tradjenta|glucovance|amlo|bisoprolol|atorvastatin|rosuvastatin|metformin|omeprazole|esomeprazole|pantoprazole|amoxicillin|ceftriaxone|azithromycin|insulin|ventolin|seretide|symbicort|bricanyl|prednisolone|dexamethasone|hydrocortisone|clopidogrel|warfarin|enoxaparin|rivaroxaban|apixaban|valsartan|losartan|telmisartan|olmesartan|amlodipine|atenolol|carvedilol|nebivolol|ramipril|perindopril|enalapril|furosemide|spironolactone|indapamide|hydrochlorothiazide|levothyroxine|euthyrox|eltroxin|neurobion|milga|b12|vitamin|chicco|avent|pampers|aptamil|similac|pediasure)\b/i;

const COSMETIC_SKIP = new Set([
  "loreal","loreals","nivea","dove","revlon","bourjois","clarins","axe",
  "jordana","amanda","canpol","beurer","jasper","ciao","miracle",
]);

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

function looksLikeMedicine(name) {
  const s = String(name || "");
  if (HV_RE.test(s)) return true;
  if (/\d+\s*(mg|mcg|ml|iu|i\.?u|مجم|مل|مكجم|%|gm)\b/i.test(s)) return true;
  if (/\b(tab|tabs|tablet|cap|caps|syrup|susp|vial|amp|sachet|drops?|oint|cream|gel|spray|pen|inhaler|قرص|كبسول|شراب|فيال|امبول)\b/i.test(s))
    return true;
  return false;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function fetchText(url, options = {}, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": UA,
          Accept: "application/json,text/html,text/plain,*/*",
          ...(options.headers || {}),
        },
      });
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await sleep(400 * Math.pow(2, attempt - 1));
        continue;
      }
      return { ok: res.ok, status: res.status, text };
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(400 * Math.pow(2, attempt - 1));
    }
  }
}

async function fetchJson(url, options = {}, retries = 4) {
  const { ok, status, text } = await fetchText(url, options, retries);
  if (!ok) throw new Error(`${status} ${url}: ${String(text).slice(0, 120)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON from ${url}: ${String(text).slice(0, 120)}`);
  }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function ingestShopifyProduct(p, source, host, seen, products, opts = {}) {
  const img = p.images?.[0]?.src;
  if (!img) return;
  const tags = (p.tags || []).map(String);
  if (opts.skipNonMed) {
    const isNonMed =
      tags.some((t) => /diaper|cosmetic|fragrance|shampoo|perfume|device:|dept:personal/i.test(t)) &&
      !tags.some((t) => /dept:medicine|medication|drug/i.test(t));
    if (isNonMed) return;
  }
  const key = `${source}:${p.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  const price = p.variants?.[0]?.price ?? "";
  const title = String(p.title || "").replace(/\s*--+\s*$/, "").trim();
  if (!title) return;
  products.push({
    source,
    source_id: String(p.id),
    name_en: title,
    name_ar: /[\u0600-\u06ff]/.test(title) ? title : "",
    display_name: title,
    image_url: img,
    price_egp: price !== "" ? Number(price) : null,
    source_page: `https://${host}/products/${p.handle}`,
    tags,
    sku: p.variants?.[0]?.sku || "",
  });
}

async function scrapeShopifyStore(host, { maxPages = 100, label = host, skipNonMed = false } = {}) {
  console.log(`[pass6] scraping ${host} products.json (pages 1–${maxPages}) …`);
  const products = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://${host}/products.json?limit=250&page=${page}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      if (/25000 limit|Page \* Limit/i.test(String(err.message || err))) {
        console.log(`[pass6] ${host} hit Shopify 25k offset cap at page ${page}`);
        break;
      }
      throw err;
    }
    const batch = data.products || [];
    if (!batch.length) break;
    for (const p of batch) ingestShopifyProduct(p, host, host, seen, products, { skipNonMed });
    if (page % 5 === 0 || batch.length < 250) {
      console.log(`[pass6] ${label} page ${page}: cumulative ${products.length}`);
    }
    await sleep(80);
  }
  return products;
}

async function scrapeShopifyCollection(host, handle, { maxPages = 80, label = handle } = {}) {
  console.log(`[pass6] scraping ${host} collection ${handle} …`);
  const products = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://${host}/collections/${handle}/products.json?limit=250&page=${page}`;
    let data;
    try {
      data = await fetchJson(url);
    } catch (err) {
      console.log(`[pass6] ${host} collection ${handle} page ${page} failed: ${err.message}`);
      break;
    }
    const batch = data.products || [];
    if (!batch.length) break;
    for (const p of batch) ingestShopifyProduct(p, host, host, seen, products);
    if (page % 5 === 0 || batch.length < 250) {
      console.log(`[pass6] ${label} page ${page}: cumulative ${products.length}`);
    }
    await sleep(80);
  }
  return products;
}

async function scrapeAlFouad() {
  const fromAll = await scrapeShopifyStore("alfouadpharmacies.com", {
    label: "AlFouad",
  });
  const fromCol = await scrapeShopifyCollection("alfouadpharmacies.com", "all-product", {
    label: "AlFouad all-product",
  });
  const byId = new Map();
  for (const p of [...fromAll, ...fromCol]) byId.set(p.source_id, p);
  const products = [...byId.values()];
  writeJson(ALFOUAD_JSON, {
    scraped_at: new Date().toISOString(),
    source: "alfouadpharmacies.com/products.json",
    count: products.length,
    products,
  });
  console.log(`[pass6] AlFouad → ${products.length} products with images`);
  return products;
}

async function scrapeKidz() {
  const products = await scrapeShopifyStore("kidzmarket-eg.com", {
    label: "Kidzmarket",
  });
  writeJson(KIDZ_JSON, {
    scraped_at: new Date().toISOString(),
    source: "kidzmarket-eg.com/products.json",
    count: products.length,
    products,
  });
  console.log(`[pass6] Kidzmarket → ${products.length} products with images`);
  return products;
}

/* -------------------- egyptian drugstore (OpenCart) -------------------- */

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function edsAbs(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `http:${url}`;
  if (url.startsWith("/")) return `http://egyptiandrugstore.com${url}`;
  return `http://egyptiandrugstore.com/${url}`;
}

function parseEdsListing(html) {
  const products = [];
  const re =
    /<div class="image">[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?class="name"><a href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?(?:class="price"[^>]*>([\s\S]*?)<\/div>)?/gi;
  let m;
  while ((m = re.exec(html))) {
    const img = decodeHtml(m[1]);
    const href = decodeHtml(m[2]).replace(/&amp;/g, "&");
    const title = decodeHtml(m[3]);
    const priceRaw = decodeHtml((m[4] || "").replace(/<[^>]+>/g, " "));
    if (!title) continue;
    if (/no_image|placeholder|ed-store\.png/i.test(img)) continue;
    const idm = href.match(/product_id=(\d+)/);
    const priceN = Number(String(priceRaw).replace(/[^\d.]/g, ""));
    products.push({
      source: "egyptiandrugstore.com",
      source_id: idm ? idm[1] : href,
      name_en: title,
      name_ar: "",
      display_name: title,
      image_url: edsAbs(img).replace(/ /g, "%20"),
      price_egp: Number.isFinite(priceN) && priceN > 0 ? priceN : null,
      source_page: edsAbs(href),
    });
  }
  return products;
}

function extractEdsPaths(html) {
  const paths = new Set();
  const re = /path=([0-9_]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const p = m[1];
    if (/^(242|443|491)(_|$)/.test(p)) paths.add(p);
  }
  return [...paths];
}

function extractEdsTotal(html) {
  const m = html.match(/Showing\s+[\d,]+\s+to\s+[\d,]+\s+of\s+([\d,]+)/i);
  if (!m) return 0;
  return Number(m[1].replace(/,/g, "")) || 0;
}

async function scrapeEdsCategory(pathId, seen, products) {
  let page = 1;
  let total = 0;
  while (page <= 80) {
    const url = `http://egyptiandrugstore.com/index.php?route=product/category&path=${pathId}&limit=100&page=${page}`;
    const { ok, status, text } = await fetchText(url);
    if (!ok) {
      console.log(`[pass6] EDS path=${pathId} page=${page} status=${status}`);
      break;
    }
    if (page === 1) total = extractEdsTotal(text);
    const batch = parseEdsListing(text);
    let added = 0;
    for (const p of batch) {
      if (seen.has(p.source_id)) continue;
      seen.add(p.source_id);
      products.push(p);
      added += 1;
    }
    const morePaths = extractEdsPaths(text);
    if (page === 1) {
      console.log(
        `[pass6] EDS path=${pathId} total≈${total} page1=${batch.length} added=${added}`,
      );
    }
    if (!batch.length) break;
    if (total && page * 100 >= total) break;
    if (batch.length < 20 && page > 1) break;
    page += 1;
    await sleep(90);
    // return extra paths for discovery
    if (page === 2) scrapeEdsCategory._extra = morePaths;
  }
  return extractEdsPaths; // unused; discovery happens on first pages in caller
}

async function scrapeEgyptianDrugstore() {
  console.log("[pass6] scraping egyptiandrugstore.com OpenCart categories …");
  const products = [];
  const seen = new Set();
  const queue = ["242", "443", "491"];
  const queued = new Set(queue);
  while (queue.length) {
    const pathId = queue.shift();
    let page = 1;
    let total = 0;
    while (page <= 80) {
      const url = `http://egyptiandrugstore.com/index.php?route=product/category&path=${pathId}&limit=100&page=${page}`;
      const { ok, status, text } = await fetchText(url);
      if (!ok) {
        console.log(`[pass6] EDS path=${pathId} page=${page} status=${status}`);
        break;
      }
      if (page === 1) {
        total = extractEdsTotal(text);
        for (const extra of extractEdsPaths(text)) {
          if (!queued.has(extra)) {
            queued.add(extra);
            queue.push(extra);
          }
        }
      }
      const batch = parseEdsListing(text);
      let added = 0;
      for (const p of batch) {
        if (seen.has(p.source_id)) continue;
        seen.add(p.source_id);
        products.push(p);
        added += 1;
      }
      if (page === 1 || added) {
        console.log(
          `[pass6] EDS path=${pathId} p${page} listed=${batch.length} added=${added} total=${products.length} of≈${total}`,
        );
      }
      if (!batch.length) break;
      if (total && page * 100 >= total) break;
      page += 1;
      await sleep(90);
    }
  }
  writeJson(EDS_JSON, {
    scraped_at: new Date().toISOString(),
    source: "egyptiandrugstore.com OpenCart categories",
    count: products.length,
    products,
  });
  console.log(`[pass6] EDS → ${products.length} products with images`);
  return products;
}

/* -------------------- EgyptDwa AJAX -------------------- */

async function egyptDwaSearch(q) {
  const body = `search=1&searchq=${encodeURIComponent(q)}`;
  const { ok, text } = await fetchText("https://egyptdwa.com/ajax/routing.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://egyptdwa.com/search",
    },
    body,
  });
  if (!ok || !text || text === "xxxx") return [];
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function egyptDwaRowToProduct(rz) {
  const img = String(rz.img || "").trim();
  if (!img || /no.?image|placeholder|default/i.test(img)) return null;
  const id = String(rz.id || "");
  if (!id) return null;
  return {
    source: "egyptdwa.com",
    source_id: id,
    name_en: rz.name || "",
    name_ar: rz.arabic || "",
    display_name: rz.name || rz.arabic || "",
    image_url: `https://egyptdwa.com/dwa/${img}`,
    price_egp: rz.price != null && rz.price !== "" ? Number(rz.price) : null,
    source_page: `https://egyptdwa.com/m/${id}`,
    active: rz.active || "",
    visits: rz.visits || "",
  };
}

function collectEmptyBrandQueries(docList) {
  const counts = new Map();
  for (const d of docList) {
    if (!isEmptyImage(d.image_url)) continue;
    const blob = `${d.name_en || ""} ${d.name_ar || ""}`;
    if (!looksLikeMedicine(blob) && !HV_RE.test(blob)) continue;
    const n = brandNorm(d.name_en || d.name_ar || "");
    const tok = n.split(" ").find((t) => isSig(t) && t.length >= 4);
    if (!tok) continue;
    if (COSMETIC_SKIP.has(tok)) continue;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const queries = [];
  for (const [tok] of ranked.slice(0, 900)) {
    queries.push(tok);
    if (tok.length >= 5) queries.push(tok.slice(0, 4));
  }
  // Always include HV seeds
  const hvSeeds = [
    "concor","plavix","lipitor","januvia","glucophage","crestor","norvasc",
    "cozaar","coveram","augmentin","zithromax","cataflam","voltaren","nexium",
    "lantus","humalog","panadol","singulair","twynsta","neuroton","librax",
    "coversyl","diovan","xarelto","eliquis","clexane","amaryl","diamicron",
    "forxiga","ozempic","keppra","lyrica","cipralex","zyloric","entresto",
    "janumet","brillinta","jardiance","euthyrox","ventolin","seretide",
    "symbicort","neurobion","amoxicillin","atorvastatin","metformin",
  ];
  for (const s of hvSeeds) queries.push(s);
  return [...new Set(queries)];
}

async function scrapeEgyptDwa(docList) {
  console.log("[pass6] scraping egyptdwa.com /ajax/routing.php (digraph + brands) …");
  const byId = new Map();

  async function ingest(q) {
    const rows = await egyptDwaSearch(q);
    let added = 0;
    for (const rz of rows) {
      const p = egyptDwaRowToProduct(rz);
      if (!p) continue;
      if (!byId.has(p.source_id)) {
        byId.set(p.source_id, p);
        added += 1;
      }
    }
    return { rows: rows.length, added };
  }

  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
  const saturated = [];

  // Phase 1: digraphs (single-char is noisy / not prefix-safe)
  for (const a of alphabet) {
    for (const b of alphabet) {
      const q = a + b;
      const r = await ingest(q);
      if (r.rows >= 100) saturated.push(q);
      if (r.added) {
        if (r.added >= 5) {
          console.log(
            `[pass6] EgyptDwa q=${q} rows=${r.rows} added=${r.added} total=${byId.size}`,
          );
        }
      }
      await sleep(70);
    }
  }
  console.log(`[pass6] EgyptDwa after digraphs total=${byId.size} saturated=${saturated.length}`);

  // Phase 2: trigraphs for saturated digraphs (letters only to bound runtime)
  const letter3 = "abcdefghijklmnopqrstuvwxyz".split("");
  let tri = 0;
  for (const pref of saturated) {
    if (!/^[a-z]{2}$/.test(pref)) continue;
    for (const c of letter3) {
      const q = pref + c;
      const r = await ingest(q);
      tri += 1;
      if (r.added >= 3) {
        console.log(
          `[pass6] EgyptDwa q=${q} rows=${r.rows} added=${r.added} total=${byId.size}`,
        );
      }
      await sleep(70);
    }
  }
  console.log(`[pass6] EgyptDwa after ${tri} trigraphs total=${byId.size}`);

  // Phase 3: empty HV / medicine brand stems
  const brandQs = collectEmptyBrandQueries(docList);
  console.log(`[pass6] EgyptDwa brand-stem queries=${brandQs.length}`);
  let bAdded = 0;
  for (const q of brandQs) {
    const r = await ingest(q);
    bAdded += r.added;
    if (r.added >= 2) {
      console.log(`[pass6] EgyptDwa brand q=${q} added=${r.added} total=${byId.size}`);
    }
    await sleep(70);
  }
  console.log(`[pass6] EgyptDwa brand phase added=${bAdded} total=${byId.size}`);

  const products = [...byId.values()];
  writeJson(EGYPTDWA_JSON, {
    scraped_at: new Date().toISOString(),
    source: "egyptdwa.com/ajax/routing.php",
    count: products.length,
    products,
  });
  console.log(`[pass6] EgyptDwa → ${products.length} products with images`);
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
  console.log(`[pass6] Chat4Data CSV → ${CSV_PATH} (${products.length} rows)`);
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
  addFile(EDS_JSON);
  addFile(ALFOUAD_JSON);
  addFile(KIDZ_JSON);
  addFile(EGYPTDWA_JSON);
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
  let liveEmpty = 0;
  let liveFilled = 0;
  let liveSampled = 0;
  if (ENDPOINT && API_KEY) {
    const cursors = [
      "med_10000","med_20000","med_30000","med_40000",
      "med_50000","med_60000","med_70000","med_80000",
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
        /* ignore */
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
  writeJson(EMPTY_EST_PATH, est);
  console.log("[pass6] empty estimate:", JSON.stringify(est.live_sample));
  return est;
}

function hvScore(doc) {
  const blob = `${doc.name_en || ""} ${doc.name_ar || ""}`;
  if (HV_RE.test(blob)) return 2;
  if (looksLikeMedicine(blob)) return 1;
  return 0;
}

async function main() {
  fs.mkdirSync(pass6Dir, { recursive: true });
  console.log(
    `[pass6] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} scrape=${DO_SCRAPE} min=${MIN_MATCH} conc=${CONCURRENCY}`,
  );

  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Appwrite export missing: ${EXPORT_PATH}`);
  }
  const docs = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const docList = Array.isArray(docs) ? docs : docs.documents || [];
  console.log(`[pass6] export docs=${docList.length}`);

  let scraped = [];
  if (DO_SCRAPE) {
    if (!SKIP_ALFOUAD) scraped = scraped.concat(await scrapeAlFouad());
    else if (fs.existsSync(ALFOUAD_JSON)) {
      scraped = scraped.concat(JSON.parse(fs.readFileSync(ALFOUAD_JSON, "utf8")).products || []);
    }
    if (!SKIP_KIDZ) scraped = scraped.concat(await scrapeKidz());
    else if (fs.existsSync(KIDZ_JSON)) {
      scraped = scraped.concat(JSON.parse(fs.readFileSync(KIDZ_JSON, "utf8")).products || []);
    }
    if (!SKIP_EDS) scraped = scraped.concat(await scrapeEgyptianDrugstore());
    else if (fs.existsSync(EDS_JSON)) {
      scraped = scraped.concat(JSON.parse(fs.readFileSync(EDS_JSON, "utf8")).products || []);
    }
    if (!SKIP_EGYPTDWA) scraped = scraped.concat(await scrapeEgyptDwa(docList));
    else if (fs.existsSync(EGYPTDWA_JSON)) {
      scraped = scraped.concat(JSON.parse(fs.readFileSync(EGYPTDWA_JSON, "utf8")).products || []);
    }
    const byKey = new Map();
    for (const p of scraped) byKey.set(`${p.source}:${p.source_id}`, p);
    scraped = [...byKey.values()];
    writeJson(COMBINED_JSON, {
      scraped_at: new Date().toISOString(),
      count: scraped.length,
      by_source: scraped.reduce((acc, p) => {
        acc[p.source] = (acc[p.source] || 0) + 1;
        return acc;
      }, {}),
      products: scraped,
    });
    writeChat4DataCsv(scraped);
  } else {
    scraped = loadScrapedProducts();
    console.log(`[pass6] loaded cached scrape products=${scraped.length}`);
    if (!scraped.length) {
      throw new Error("No scraped products found. Run with --scrape first.");
    }
    if (!fs.existsSync(CSV_PATH)) writeChat4DataCsv(scraped);
  }

  const emptyEst = await estimateEmptyCoverage(docList);
  const byStem = buildProductIndex(scraped);
  console.log(`[pass6] product stem keys=${byStem.size}`);

  const productStems = new Set([...byStem.keys()]);
  let emptyDocs = docList.filter((d) => {
    if (!isEmptyImage(d.image_url)) return false;
    const blob = brandNorm(`${d.name_en || ""} ${d.name_ar || ""}`);
    const toks = blob.split(" ").filter(isSig);
    return toks.some((tok) => productStems.has(tok));
  });
  emptyDocs.sort((a, b) => hvScore(b) - hvScore(a));
  if (LIMIT > 0) emptyDocs = emptyDocs.slice(0, LIMIT);
  console.log(`[pass6] empty docs overlapping scrape stems=${emptyDocs.length}`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    pass: "pass6-pharmacy-catalogs",
    min_score: MIN_MATCH,
    sources: scraped.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      acc.total_scraped = (acc.total_scraped || 0) + 1;
      return acc;
    }, {}),
    empty_estimate: emptyEst,
    provenance:
      "egyptiandrugstore.com + alfouadpharmacies.com + kidzmarket-eg.com + egyptdwa.com ajax (pass6)",
    stats: {
      empty_scanned: 0,
      matched: 0,
      no_match: 0,
      bad_image: 0,
      skipped_live_already_filled: 0,
      skipped_missing_doc: 0,
      patched: 0,
      errors: 0,
      high_value_matched: 0,
      by_source: {},
    },
    samples: { before_after: [], high_value: [], errors: [] },
    patched_rows: [],
  };

  const candidates = [];
  let iScan = 0;
  for (const doc of emptyDocs) {
    report.stats.empty_scanned += 1;
    iScan += 1;
    if (iScan % 10000 === 0) {
      console.log(`[pass6] scanned ${iScan}/${emptyDocs.length} candidates=${candidates.length}`);
    }
    const best = findBestProduct(doc, byStem);
    if (!best) {
      report.stats.no_match += 1;
      continue;
    }
    report.stats.matched += 1;
    const job = {
      id: doc.$id,
      matched: doc.name_en || doc.name_ar,
      product: best.product.display_name || best.product.name_en,
      score: best.score,
      source: best.product.source,
      source_page: best.product.source_page,
      image_url: best.product.image_url,
      price_egp: best.product.price_egp,
      provenance: `${best.product.source}:packshot (pass6)`,
      hv: hvScore(doc) >= 2,
    };
    if (job.hv) report.stats.high_value_matched += 1;
    candidates.push(job);
    if (MAX_PATCH > 0 && candidates.length >= MAX_PATCH * 3) break;
  }
  console.log(`[pass6] raw candidates=${candidates.length}; verifying unique images…`);

  const uniqueUrls = [...new Set(candidates.map((c) => c.image_url))];
  console.log(`[pass6] unique image URLs to verify: ${uniqueUrls.length}`);
  let verified = 0;
  await mapPool(uniqueUrls, Math.min(Math.max(CONCURRENCY, 16), 24), async (url) => {
    await verifyImage(url);
    verified += 1;
    if (verified % 200 === 0 || verified === uniqueUrls.length) {
      console.log(`[pass6] verified ${verified}/${uniqueUrls.length}`);
    }
  });

  const patchJobs = [];
  for (const job of candidates) {
    const ok = verifiedOk.get(job.image_url);
    if (!ok) {
      report.stats.bad_image += 1;
      continue;
    }
    if (report.samples.before_after.length < 80) report.samples.before_after.push(job);
    if (job.hv && report.samples.high_value.length < 40) report.samples.high_value.push(job);
    patchJobs.push(job);
    if (MAX_PATCH > 0 && patchJobs.length >= MAX_PATCH) break;
  }

  console.log(`[pass6] high-confidence jobs=${patchJobs.length}`);

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
        report.stats.by_source[job.source] = (report.stats.by_source[job.source] || 0) + 1;
        if (report.patched_rows.length < 500) report.patched_rows.push(job);
        const doc = docList.find((d) => d.$id === job.id);
        if (doc) doc.image_url = job.image_url;
        if (THROTTLE_MS) await sleep(THROTTLE_MS);
      } catch (err) {
        report.stats.errors += 1;
        if (report.samples.errors.length < 40) {
          report.samples.errors.push({ id: job.id, error: String(err.message || err) });
        }
      }
    });
    fs.writeFileSync(EXPORT_PATH, JSON.stringify(docList));
  } else {
    report.dry_run_would_patch = patchJobs.length;
    report.stats.by_source = patchJobs.reduce((acc, j) => {
      acc[j.source] = (acc[j.source] || 0) + 1;
      return acc;
    }, {});
  }

  let stillEmpty = 0;
  for (const d of docList) if (isEmptyImage(d.image_url)) stillEmpty += 1;

  const bySrc = scraped.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {});

  const summary = {
    generated_at: new Date().toISOString(),
    pass: "pass6-pharmacy-catalogs",
    sources_used: Object.keys(bySrc),
    rows_scraped: scraped.length,
    by_source_scraped: bySrc,
    matched_jobs: patchJobs.length,
    patched: report.stats.patched,
    skipped_live_already_filled: report.stats.skipped_live_already_filled,
    still_empty_export_estimate: stillEmpty,
    prior_empty_estimate: emptyEst.live_sample?.estimate_empty ?? emptyEst.export_empty,
    chat4data_csv: "artifacts/photos-pass6/pass6-chat4data.csv",
    scripts: [
      "scripts/enrich-product-photos-pass6-pharmacy-catalogs.mjs",
      "npm run photos:enrich:pass6[:dry|:scrape]",
    ],
    ui: { changes: "none — data-only", version_bump: false },
  };

  writeJson(REPORT_PATH, report);
  writeJson(SUMMARY_PATH, summary);
  console.log(`[pass6] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
