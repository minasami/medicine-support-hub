#!/usr/bin/env node
/**
 * Pass-7 Crawl4AI packshot enrichment.
 *
 * Scrapes Egyptian pharmacy / pharma listings via Crawl4AI (Playwright) —
 * EgyptDwa deep pages + DwaPrices med.php / related cards — with HTTP
 * trigraph expansion fallback. High-confidence match into Appwrite empty
 * image_url (strength + form safe; HEAD-verify; no overwrite).
 *
 * Usage:
 *   node scripts/enrich-product-photos-pass7-crawl4ai.mjs --scrape
 *   node scripts/enrich-product-photos-pass7-crawl4ai.mjs --dry-run
 *   node scripts/enrich-product-photos-pass7-crawl4ai.mjs --write
 *   node scripts/enrich-product-photos-pass7-crawl4ai.mjs --scrape --write
 *
 * Flags:
 *   --scrape
 *   --skip-crawl4ai          scrape via HTTP-only fallback
 *   --python PATH           Crawl4AI venv python (default /workspace/crawl4ai-venv/bin/python)
 *   --min-score N           default 88
 *   --concurrency N         default 8
 *   --limit N               cap empty docs scanned (0 = all)
 *   --max-patch N
 *   --skip-verify --skip-live-check
 *   --dry-run / --write
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pass7Dir = path.join(root, "artifacts/photos-pass7");
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
const SKIP_CRAWL4AI = hasFlag("--skip-crawl4ai");
const MIN_MATCH = Number(argValue("--min-score", "88")) || 88;
const CONCURRENCY = Math.max(1, Number(argValue("--concurrency", "8")) || 8);
const THROTTLE_MS = Number(argValue("--throttle-ms", "35")) || 35;
const LIMIT = Number(argValue("--limit", "0")) || 0;
const MAX_PATCH = Number(argValue("--max-patch", "0")) || 0;
const VERIFY_IMAGES = !hasFlag("--skip-verify");
const LIVE_CHECK = !hasFlag("--skip-live-check");
const PYTHON =
  argValue("--python") ||
  process.env.CRAWL4AI_PYTHON ||
  "/workspace/crawl4ai-venv/bin/python";

const EXPORT_PATH =
  argValue("--export") || path.join(reportDir, "appwrite-medicines-export.json");
const COMBINED_JSON = path.join(pass7Dir, "pass7-scraped-products.json");
const EGYPTDWA_JSON = path.join(pass7Dir, "egyptdwa-crawl4ai-products.json");
const DWAPRICES_CRAWL_JSON = path.join(pass7Dir, "dwaprices-crawl4ai-products.json");
const DWAPRICES_HTTP_JSON = path.join(pass7Dir, "dwaprices-http-products.json");
const CSV_PATH = path.join(pass7Dir, "pass7-chat4data.csv");
const REPORT_PATH = path.join(pass7Dir, "pass7-enrichment-report.json");
const SUMMARY_PATH = path.join(pass7Dir, "pass7-summary.json");
const EMPTY_EST_PATH = path.join(pass7Dir, "empty-image-estimate.json");

const UA =
  "MedicineSupportHubBot/1.0 (+https://medicinesupport.app; packshot-enrichment)";

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
  /\b(concor|plavix|lipitor|januvia|glucophage|crestor|norvasc|cozaar|coveram|augmentin|zithromax|viagra|cataflam|voltaren|nexium|lantus|humalog|panadol|aspirin|zocor|singulair|twynsta|neuroton|librax|coversyl|diovan|xarelto|eliquis|clexane|amaryl|diamicron|forxiga|ozempic|keppra|lyrica|cipralex|one alpha|zyloric|entresto|janumet|brillinta|jardiance|tradjenta|glucovance|amlo|bisoprolol|atorvastatin|rosuvastatin|metformin|omeprazole|esomeprazole|pantoprazole|amoxicillin|ceftriaxone|azithromycin|insulin|ventolin|seretide|symbicort|bricanyl|prednisolone|dexamethasone|hydrocortisone|clopidogrel|warfarin|enoxaparin|rivaroxaban|apixaban|valsartan|losartan|telmisartan|olmesartan|amlodipine|atenolol|carvedilol|nebivolol|ramipril|perindopril|enalapril|furosemide|spironolactone|indapamide|hydrochlorothiazide|levothyroxine|euthyrox|eltroxin|neurobion|milga|b12|vitamin)\b/i;

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
  "شراب","حقن","فيال","امبول","مجم","مل","بلس","price","egypt","سعر",
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

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function runScrape() {
  fs.mkdirSync(pass7Dir, { recursive: true });
  const pyScript = path.join(root, "scripts/crawl4ai_pass7_scrape.py");
  const args = [pyScript, "--out-dir", pass7Dir, "--concurrency", "6"];
  if (SKIP_CRAWL4AI) args.push("--http-only");
  console.log(`[pass7] launching scraper: ${PYTHON} ${args.join(" ")}`);
  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH:
      process.env.PLAYWRIGHT_BROWSERS_PATH || "/workspace/.cache/ms-playwright",
  };
  const r = spawnSync(PYTHON, args, {
    cwd: root,
    env,
    stdio: "inherit",
    // Crawl can run a long time (EgyptDwa gaps + DwaPrices HTTP trigraphs)
    timeout: 0,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`crawl4ai_pass7_scrape.py exited ${r.status}`);
  }
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
  console.log(`[pass7] Chat4Data CSV → ${CSV_PATH} (${products.length} rows)`);
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
  addFile(EGYPTDWA_JSON);
  addFile(DWAPRICES_CRAWL_JSON);
  addFile(DWAPRICES_HTTP_JSON);
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
  console.log("[pass7] empty estimate:", JSON.stringify(est.live_sample));
  return est;
}

function hvScore(doc) {
  const blob = `${doc.name_en || ""} ${doc.name_ar || ""}`;
  if (HV_RE.test(blob)) return 2;
  if (looksLikeMedicine(blob)) return 1;
  return 0;
}

async function main() {
  fs.mkdirSync(pass7Dir, { recursive: true });
  console.log(
    `[pass7] mode=${IS_WRITE ? "WRITE" : "DRY-RUN"} scrape=${DO_SCRAPE} min=${MIN_MATCH} conc=${CONCURRENCY}`,
  );

  if (!fs.existsSync(EXPORT_PATH)) {
    throw new Error(`Appwrite export missing: ${EXPORT_PATH}`);
  }
  const docs = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8"));
  const docList = Array.isArray(docs) ? docs : docs.documents || [];
  console.log(`[pass7] export docs=${docList.length}`);

  let scraped = [];
  let scrapeMeta = {};
  if (DO_SCRAPE) {
    runScrape();
    scraped = loadScrapedProducts();
    if (fs.existsSync(path.join(pass7Dir, "pass7-scrape-summary.json"))) {
      scrapeMeta = JSON.parse(
        fs.readFileSync(path.join(pass7Dir, "pass7-scrape-summary.json"), "utf8"),
      );
    }
    writeChat4DataCsv(scraped);
  } else {
    scraped = loadScrapedProducts();
    console.log(`[pass7] loaded cached scrape products=${scraped.length}`);
    if (!scraped.length) {
      throw new Error("No scraped products found. Run with --scrape first.");
    }
    if (!fs.existsSync(CSV_PATH)) writeChat4DataCsv(scraped);
    const metaPath = path.join(pass7Dir, "pass7-scrape-summary.json");
    if (fs.existsSync(metaPath)) {
      scrapeMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    }
  }

  const emptyEst = await estimateEmptyCoverage(docList);
  const byStem = buildProductIndex(scraped);
  console.log(`[pass7] product stem keys=${byStem.size}`);

  const productStems = new Set([...byStem.keys()]);
  let emptyDocs = docList.filter((d) => {
    if (!isEmptyImage(d.image_url)) return false;
    const blob = brandNorm(`${d.name_en || ""} ${d.name_ar || ""}`);
    const toks = blob.split(" ").filter(isSig);
    return toks.some((tok) => productStems.has(tok));
  });
  emptyDocs.sort((a, b) => hvScore(b) - hvScore(a));
  if (LIMIT > 0) emptyDocs = emptyDocs.slice(0, LIMIT);
  console.log(`[pass7] empty docs overlapping scrape stems=${emptyDocs.length}`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: IS_WRITE ? "write" : "dry-run",
    pass: "pass7-crawl4ai",
    min_score: MIN_MATCH,
    scrape_meta: scrapeMeta,
    sources: scraped.reduce((acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1;
      acc.total_scraped = (acc.total_scraped || 0) + 1;
      return acc;
    }, {}),
    empty_estimate: emptyEst,
    provenance: "Crawl4AI egyptdwa.com + dwaprices.com (+ HTTP trigraph expand)",
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
      console.log(`[pass7] scanned ${iScan}/${emptyDocs.length} candidates=${candidates.length}`);
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
      via: best.product.via || "",
      source_page: best.product.source_page,
      image_url: best.product.image_url,
      price_egp: best.product.price_egp,
      provenance: `${best.product.source}:packshot (pass7/${best.product.via || "crawl"})`,
      hv: hvScore(doc) >= 2,
    };
    if (job.hv) report.stats.high_value_matched += 1;
    candidates.push(job);
    if (MAX_PATCH > 0 && candidates.length >= MAX_PATCH * 3) break;
  }
  console.log(`[pass7] raw candidates=${candidates.length}; verifying unique images…`);

  const uniqueUrls = [...new Set(candidates.map((c) => c.image_url))];
  console.log(`[pass7] unique image URLs to verify: ${uniqueUrls.length}`);
  let verified = 0;
  await mapPool(uniqueUrls, Math.min(Math.max(CONCURRENCY, 16), 24), async (url) => {
    await verifyImage(url);
    verified += 1;
    if (verified % 200 === 0 || verified === uniqueUrls.length) {
      console.log(`[pass7] verified ${verified}/${uniqueUrls.length}`);
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

  console.log(`[pass7] high-confidence jobs=${patchJobs.length}`);

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
  let filledNow = 0;
  for (const d of docList) {
    if (isEmptyImage(d.image_url)) stillEmpty += 1;
    else filledNow += 1;
  }

  // Post-pass live sample
  let postLive = null;
  if (IS_WRITE && ENDPOINT && API_KEY) {
    const postEst = await estimateEmptyCoverage(docList);
    postLive = postEst.live_sample;
  }

  const bySrc = scraped.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {});

  const verifySamples = [];
  for (const job of (IS_WRITE ? report.patched_rows : patchJobs).slice(0, 8)) {
    let live_ok = null;
    if (IS_WRITE && LIVE_CHECK) {
      try {
        const live = await getDoc(job.id);
        live_ok = !!(live && live.image_url === job.image_url);
      } catch {
        live_ok = false;
      }
    }
    verifySamples.push({
      id: job.id,
      name: job.matched,
      image: job.image_url,
      source: job.source,
      live_ok,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    pass: "pass7-crawl4ai",
    approach: [
      "Crawl4AI (Playwright) scrape of EgyptDwa deep pages missing from pass-6 AJAX",
      "Crawl4AI DwaPrices med.php gap-sample + related-product BFS",
      "HTTP fallback/expand: dwaprices routing-new.php digraph→trigraph + empty brand stems",
      "High-confidence match (min score 88) with strength + dosage-form gates; HV prioritized",
      "HEAD/GET-verify unique image URLs; live Appwrite empty re-check before PATCH; image_url only",
    ],
    sources_used: Object.keys(bySrc),
    crawl4ai_used: scrapeMeta.crawl4ai_used ?? null,
    scrape_notes: scrapeMeta.notes || [],
    rows_scraped: scraped.length,
    by_source_scraped: bySrc,
    pre_pass_empty_estimate: emptyEst.live_sample?.estimate_empty ?? emptyEst.export_empty,
    pre_pass_filled_estimate: emptyEst.live_sample?.estimate_filled ?? emptyEst.export_filled,
    pre_pass_fill_rate_pct: emptyEst.live_sample?.fill_rate_pct ?? emptyEst.export_fill_rate_pct,
    matched_jobs: patchJobs.length,
    patched: report.stats.patched,
    patched_by_source: report.stats.by_source,
    high_value_matched: report.stats.high_value_matched,
    skipped_live_already_filled: report.stats.skipped_live_already_filled,
    skipped_missing_doc: report.stats.skipped_missing_doc,
    bad_image: report.stats.bad_image,
    errors: report.stats.errors,
    post_pass_live_sample: postLive,
    still_empty_estimate: postLive?.estimate_empty ?? stillEmpty,
    still_empty_export_estimate: stillEmpty,
    export_filled_after: filledNow,
    new_fill_pct_export: Number(((filledNow / docList.length) * 100).toFixed(2)),
    chat4data_csv: "artifacts/photos-pass7/pass7-chat4data.csv",
    artifacts: [
      "artifacts/photos-pass7/egyptdwa-crawl4ai-products.json",
      "artifacts/photos-pass7/dwaprices-crawl4ai-products.json",
      "artifacts/photos-pass7/dwaprices-http-products.json",
      "artifacts/photos-pass7/pass7-scraped-products.json",
      "artifacts/photos-pass7/pass7-chat4data.csv",
      "artifacts/photos-pass7/pass7-enrichment-report.json",
      "artifacts/photos-pass7/empty-image-estimate.json",
    ],
    scripts_added: [
      "scripts/crawl4ai_pass7_scrape.py",
      "scripts/enrich-product-photos-pass7-crawl4ai.mjs",
      "scripts/requirements-crawl4ai.txt",
      "docs/PHOTOS_PASS7_CRAWL4AI.md",
      "npm run photos:enrich:pass7",
    ],
    ui: {
      changes: "none — data-only Appwrite image_url patches",
      version_bump: false,
    },
    verify_samples: verifySamples,
  };

  writeJson(REPORT_PATH, report);
  writeJson(SUMMARY_PATH, summary);
  console.log(`[pass7] report → ${REPORT_PATH}`);
  console.log(JSON.stringify(report.stats, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
