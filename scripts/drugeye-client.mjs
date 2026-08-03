#!/usr/bin/env node
/**
 * DrugEye (PharOrg) search client
 * http://www.drugeye.pharorg.com/drugeyeapp/android-search/drugeye-android-live-go.aspx
 *
 * Uses the public Android search WebForms UI (session cookie + VIEWSTATE POST).
 * For on-demand enrichment only — do not bulk-crawl the full catalog.
 *
 * Usage:
 *   node scripts/drugeye-client.mjs panadol
 *   node scripts/drugeye-client.mjs "augmentin 1 gm" --json
 *   node scripts/drugeye-client.mjs panadol --limit 5 --out scripts/reports/drugeye-panadol.json
 *
 * Programmatic:
 *   import { searchDrugEye, createDrugEyeSession } from "./drugeye-client.mjs";
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const DRUGEYE_SEARCH_URL =
  process.env.DRUGEYE_SEARCH_URL ||
  "http://www.drugeye.pharorg.com/drugeyeapp/android-search/drugeye-android-live-go.aspx";

const DEFAULT_UA =
  process.env.DRUGEYE_USER_AGENT ||
  "Mozilla/5.0 (Linux; Android 13; MedicineSupportHub) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const ACTION_LABELS = new Set([
  "similars",
  "alternatives",
  "more",
  "images",
  "search",
  "ex",
  "g",
  "p",
  "ph",
  "h",
]);

const UI_NOISE = new Set([
  "drug eye welcome you",
  "اكتب شيئا",
  "write something",
]);

/**
 * @typedef {object} DrugEyeProduct
 * @property {string} name_en
 * @property {number|null} price_egp
 * @property {string|null} scientific_name
 * @property {string|null} drug_class
 * @property {string|null} manufacturer
 * @property {string} source
 * @property {string} queried_at
 * @property {string} query
 */

/**
 * @typedef {object} DrugEyeSession
 * @property {string} cookie
 * @property {string} viewState
 * @property {string} viewStateGenerator
 * @property {string} eventValidation
 */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  const headers = setCookieHeaders || [];
  for (const raw of headers) {
    const first = String(raw).split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function getSetCookie(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractHidden(html, id) {
  const re = new RegExp(
    `id="${id}"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*id="${id}"`,
    "i",
  );
  const m = html.match(re);
  return m ? m[1] || m[2] || "" : "";
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/</gi, "<")
    .replace(/>/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/"/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pull ordered cell texts from the results table region.
 * @param {string} html
 * @returns {string[]}
 */
export function extractCellTexts(html) {
  const cells = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1]);
    cells.push(t);
  }
  return cells;
}

/**
 * Parse DrugEye search HTML into product rows.
 * Layout observed: name | price | scientific | class | manufacturer | [actions…]
 * @param {string} html
 * @param {string} [query]
 * @returns {DrugEyeProduct[]}
 */
export function parseDrugEyeResults(html, query = "") {
  const cells = extractCellTexts(html);
  const queriedAt = new Date().toISOString();
  /** @type {DrugEyeProduct[]} */
  const products = [];
  let i = 0;

  while (i < cells.length) {
    const name = cells[i] || "";
    const nameLower = name.toLowerCase();

    if (
      !name ||
      name.length < 3 ||
      ACTION_LABELS.has(nameLower) ||
      UI_NOISE.has(nameLower) ||
      /^\d+(\.\d+)?$/.test(name)
    ) {
      i += 1;
      continue;
    }

    const priceRaw = cells[i + 1] || "";
    const priceMatch = /^(\d+(?:\.\d+)?)$/.exec(priceRaw);
    if (!priceMatch || i + 4 >= cells.length) {
      i += 1;
      continue;
    }

    const scientific = cells[i + 2] || "";
    const drugClass = cells[i + 3] || "";
    const manufacturer = cells[i + 4] || "";

    // Guard against parsing UI chrome as a product
    if (
      ACTION_LABELS.has(scientific.toLowerCase()) ||
      ACTION_LABELS.has(manufacturer.toLowerCase())
    ) {
      i += 1;
      continue;
    }

    products.push({
      name_en: name,
      price_egp: Number(priceMatch[1]),
      scientific_name: scientific || null,
      drug_class: drugClass || null,
      manufacturer: manufacturer || null,
      source: "drugeye.pharorg.com",
      queried_at: queriedAt,
      query,
    });

    i += 5;
    while (i < cells.length && ACTION_LABELS.has((cells[i] || "").toLowerCase())) {
      i += 1;
    }
  }

  // De-dupe by name_en + price
  const seen = new Set();
  return products.filter((p) => {
    const key = `${p.name_en}::${p.price_egp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {string} url
 * @param {{ method?: string, body?: string, cookie?: string }} [opts]
 */
async function request(url, opts = {}) {
  const headers = {
    "User-Agent": DEFAULT_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const res = await fetch(url, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers,
    body: opts.body,
    redirect: "follow",
  });

  const html = await res.text();
  const cookie = mergeCookies(opts.cookie || "", getSetCookie(res));

  if (!res.ok) {
    throw new Error(`DrugEye HTTP ${res.status}: ${html.slice(0, 200)}`);
  }

  return { html, cookie, status: res.status };
}

/**
 * Open a session and read form tokens.
 * @returns {Promise<DrugEyeSession>}
 */
export async function createDrugEyeSession() {
  const { html, cookie } = await request(DRUGEYE_SEARCH_URL);
  const viewState = extractHidden(html, "__VIEWSTATE");
  const viewStateGenerator = extractHidden(html, "__VIEWSTATEGENERATOR");
  const eventValidation = extractHidden(html, "__EVENTVALIDATION");

  if (!viewState || !eventValidation) {
    throw new Error(
      "DrugEye form tokens missing (page structure may have changed)",
    );
  }

  return {
    cookie,
    viewState,
    viewStateGenerator,
    eventValidation,
  };
}

/**
 * Refresh tokens from an HTML response (after POST the server often rotates VIEWSTATE).
 * @param {DrugEyeSession} session
 * @param {string} html
 * @param {string} cookie
 */
function updateSessionFromHtml(session, html, cookie) {
  session.cookie = cookie || session.cookie;
  const vs = extractHidden(html, "__VIEWSTATE");
  const vg = extractHidden(html, "__VIEWSTATEGENERATOR");
  const ev = extractHidden(html, "__EVENTVALIDATION");
  if (vs) session.viewState = vs;
  if (vg) session.viewStateGenerator = vg;
  if (ev) session.eventValidation = ev;
}

/**
 * Search DrugEye by trade name / keyword.
 * @param {string} query
 * @param {{ session?: DrugEyeSession, throttleMs?: number }} [options]
 * @returns {Promise<{ products: DrugEyeProduct[], session: DrugEyeSession, rawHtmlLength: number }>}
 */
export async function searchDrugEye(query, options = {}) {
  const q = String(query || "").trim();
  if (!q) throw new Error("query is required");

  const throttleMs = options.throttleMs ?? 400;
  if (throttleMs > 0) await sleep(throttleMs);

  const session = options.session || (await createDrugEyeSession());

  const body = new URLSearchParams({
    __VIEWSTATE: session.viewState,
    __VIEWSTATEGENERATOR: session.viewStateGenerator,
    __EVENTVALIDATION: session.eventValidation,
    ttt: q,
    b1: "search",
    TttHelper: "drug eye welcome you",
    Passgenericname: "",
  }).toString();

  const { html, cookie } = await request(DRUGEYE_SEARCH_URL, {
    method: "POST",
    body,
    cookie: session.cookie,
  });

  updateSessionFromHtml(session, html, cookie);
  const products = parseDrugEyeResults(html, q);

  return {
    products,
    session,
    rawHtmlLength: html.length,
  };
}

/**
 * Best effort: pick the result whose normalized name is closest to the query.
 * @param {DrugEyeProduct[]} products
 * @param {string} query
 * @returns {DrugEyeProduct|null}
 */
export function pickBestDrugEyeMatch(products, query) {
  if (!products?.length) return null;
  const nq = normalizeName(query);
  if (!nq) return products[0];

  let best = products[0];
  let bestScore = -1;
  for (const p of products) {
    const np = normalizeName(p.name_en);
    let score = 0;
    if (np === nq) score = 100;
    else if (np.startsWith(nq) || nq.startsWith(np)) score = 80;
    else if (np.includes(nq) || nq.includes(np)) score = 60;
    else {
      const tq = new Set(nq.split(" ").filter(Boolean));
      const tp = new Set(np.split(" ").filter(Boolean));
      let inter = 0;
      for (const t of tq) if (tp.has(t)) inter += 1;
      const union = tq.size + tp.size - inter || 1;
      score = (inter / union) * 50;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function printTable(products) {
  if (!products.length) {
    console.log("No products found.");
    return;
  }
  console.log(
    `${"Name".padEnd(48)} ${"Price".padStart(8)}  ${"Manufacturer".padEnd(24)} Composition`,
  );
  console.log("-".repeat(120));
  for (const p of products) {
    const name = p.name_en.slice(0, 48).padEnd(48);
    const price =
      p.price_egp != null ? String(p.price_egp).padStart(8) : "".padStart(8);
    const mfr = String(p.manufacturer || "").slice(0, 24).padEnd(24);
    const sci = String(p.scientific_name || "").slice(0, 40);
    console.log(`${name} ${price}  ${mfr} ${sci}`);
  }
}

function parseArgs(argv) {
  const args = {
    query: "",
    json: false,
    limit: Infinity,
    out: "",
    help: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--limit") args.limit = Number(argv[++i] || 20);
    else if (a === "--out") args.out = argv[++i] || "";
    else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    } else positional.push(a);
  }
  args.query = positional.join(" ").trim();
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.query) {
    console.log(`DrugEye search client

Usage:
  node scripts/drugeye-client.mjs <query> [--json] [--limit N] [--out file.json]

Examples:
  node scripts/drugeye-client.mjs panadol
  node scripts/drugeye-client.mjs "similac total comfort" --json
  node scripts/drugeye-client.mjs augmentin --limit 10 --out scripts/reports/drugeye-augmentin.json
`);
    process.exit(args.help ? 0 : 1);
  }

  console.error(`[drugeye] searching for: ${args.query}`);
  const { products, rawHtmlLength } = await searchDrugEye(args.query, {
    throttleMs: 0,
  });
  const limited = products.slice(0, args.limit);
  console.error(
    `[drugeye] ${products.length} product(s) parsed (html ${rawHtmlLength} bytes); showing ${limited.length}`,
  );

  if (args.out) {
    const outPath = path.isAbsolute(args.out)
      ? args.out
      : path.join(root, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          query: args.query,
          fetched_at: new Date().toISOString(),
          source: DRUGEYE_SEARCH_URL,
          count: limited.length,
          products: limited,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.error(`[drugeye] wrote ${outPath}`);
  }

  if (args.json) {
    console.log(JSON.stringify(limited, null, 2));
  } else {
    printTable(limited);
    const best = pickBestDrugEyeMatch(limited, args.query);
    if (best) {
      console.log("\nBest match:");
      console.log(
        `  ${best.name_en} · EGP ${best.price_egp} · ${best.manufacturer}`,
      );
    }
  }
}

const isDirect =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirect) {
  main().catch((err) => {
    console.error("[drugeye] error:", err.message || err);
    process.exit(1);
  });
}
