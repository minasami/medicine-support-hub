/**
 * Appwrite Function: drugeye-refresh
 *
 * Modes
 * -----
 * 1) Single product (admin / manual execution)
 *    Body JSON:
 *      {
 *        name_en: string,
 *        document_id?: string,
 *        apply?: boolean,
 *        force_price?: boolean
 *      }
 *
 * 2) Cron / scheduled batch
 *    Body JSON (or empty with schedule trigger):
 *      {
 *        mode: "cron",
 *        limit?: number,          // default 20
 *        force_price?: boolean,
 *        throttle_ms?: number     // default 800
 *      }
 *    Selects medicines with missing/zero price and enriches from DrugEye.
 *
 * Env (Function variables)
 * -----------------------
 *   APPWRITE_ENDPOINT
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY              (server key with documents write)
 *   APPWRITE_DATABASE_ID         default medicine_support_hub
 *   APPWRITE_MEDICINES_COLLECTION_ID  default medicines
 *   DRUGEYE_SEARCH_URL           optional override
 *   DRUGEYE_CRON_LIMIT           default 20
 *   DRUGEYE_CRON_THROTTLE_MS     default 800
 *   DRUGEYE_MIN_SCORE            default 40
 *
 * Schedule suggestion: every 6 hours (0 *\/6 * * *)
 */

const DRUGEYE_URL =
  process.env.DRUGEYE_SEARCH_URL ||
  "http://www.drugeye.pharorg.com/drugeyeapp/android-search/drugeye-android-live-go.aspx";

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

const MEDICINES =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
  "medicines";

const UA =
  "Mozilla/5.0 (Linux; Android 13; MedicineSupportHubFn) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeCookie(existing, setCookieList) {
  const jar = new Map();
  for (const part of String(existing || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const raw of setCookieList || []) {
    const first = String(raw).split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function setCookiesFromResponse(res) {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseProducts(html, query) {
  const cells = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(html))) cells.push(stripTags(m[1]));

  const products = [];
  let i = 0;
  while (i < cells.length) {
    const name = cells[i] || "";
    const lower = name.toLowerCase();
    if (
      !name ||
      name.length < 3 ||
      ACTION_LABELS.has(lower) ||
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
    if (ACTION_LABELS.has(scientific.toLowerCase())) {
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
      query,
    });
    i += 5;
    while (
      i < cells.length &&
      ACTION_LABELS.has((cells[i] || "").toLowerCase())
    ) {
      i += 1;
    }
  }
  return products;
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(query, name) {
  const nq = normalizeName(query);
  const np = normalizeName(name);
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

function pickBest(products, query) {
  if (!products.length) return { hit: null, score: 0 };
  let best = products[0];
  let bestScore = -1;
  for (const p of products) {
    const s = scoreMatch(query, p.name_en);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return { hit: best, score: bestScore };
}

async function searchDrugEye(query) {
  const getRes = await fetch(DRUGEYE_URL, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  const getHtml = await getRes.text();
  let cookie = mergeCookie("", setCookiesFromResponse(getRes));
  const viewState = extractHidden(getHtml, "__VIEWSTATE");
  const viewStateGenerator = extractHidden(getHtml, "__VIEWSTATEGENERATOR");
  const eventValidation = extractHidden(getHtml, "__EVENTVALIDATION");
  if (!viewState || !eventValidation) {
    throw new Error("DrugEye form tokens missing — site structure may have changed.");
  }

  const body = new URLSearchParams({
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __EVENTVALIDATION: eventValidation,
    ttt: query,
    b1: "search",
    TttHelper: "drug eye welcome you",
    Passgenericname: "",
  }).toString();

  const postRes = await fetch(DRUGEYE_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      Accept: "text/html",
    },
    body,
  });
  const postHtml = await postRes.text();
  if (!postRes.ok) throw new Error(`DrugEye HTTP ${postRes.status}`);
  return parseProducts(postHtml, query);
}

function appwriteHeaders() {
  return {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": API_KEY,
    "Content-Type": "application/json",
  };
}

async function getDoc(documentId) {
  if (!API_KEY || !documentId) return null;
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents/${encodeURIComponent(documentId)}`;
  const res = await fetch(url, { headers: appwriteHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function patchDoc(documentId, data) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY is not configured on the function.");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents/${encodeURIComponent(documentId)}`;

  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: appwriteHeaders(),
      body: JSON.stringify({ data: payload }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    const { price_source, price_updated_at, ...core } = data;
    result = await attempt(core);
  }
  if (!result.ok) {
    throw new Error(`Appwrite PATCH ${result.status}: ${result.text.slice(0, 240)}`);
  }
  return true;
}

function buildPatch(existing, hit, forcePrice) {
  const data = {};
  const reasons = [];
  const currentPrice =
    existing?.current_price_egp != null ? Number(existing.current_price_egp) : null;

  if (hit.price_egp != null && Number.isFinite(hit.price_egp)) {
    const empty =
      currentPrice == null || currentPrice === 0 || Number.isNaN(currentPrice);
    if (forcePrice || empty) {
      data.current_price_egp = hit.price_egp;
      reasons.push(empty ? "fill_price" : "force_price");
    }
  }

  const sci = existing?.scientific_name;
  if (
    hit.scientific_name &&
    (!sci ||
      /^active pharmaceutical ingredients$/i.test(String(sci)) ||
      /^medicine catalog product/i.test(String(sci)))
  ) {
    data.scientific_name = hit.scientific_name;
    reasons.push("fill_scientific_name");
  }

  if (hit.drug_class && !existing?.drug_class) {
    data.drug_class = hit.drug_class;
    reasons.push("fill_drug_class");
  }
  if (hit.manufacturer && !existing?.manufacturer) {
    data.manufacturer = hit.manufacturer;
    reasons.push("fill_manufacturer");
  }

  data.price_source = "drugeye.pharorg.com";
  data.price_updated_at = new Date().toISOString();
  return { data, reasons };
}

async function refreshOne(nameEn, documentId, apply, forcePrice, log) {
  const products = await searchDrugEye(nameEn);
  const { hit, score } = pickBest(products, nameEn);
  const minScore = Number(process.env.DRUGEYE_MIN_SCORE || 40);

  if (!hit || score < minScore) {
    return {
      ok: false,
      message: "No confident DrugEye match.",
      query: nameEn,
      score,
      candidates: products.slice(0, 8),
      applied: false,
    };
  }

  let existing = null;
  if (documentId) existing = await getDoc(documentId);

  const { data, reasons } = buildPatch(existing, hit, forcePrice);
  const coreKeys = [
    "current_price_egp",
    "scientific_name",
    "drug_class",
    "manufacturer",
  ];
  const hasCore = coreKeys.some((k) => k in data);

  let applied = false;
  if (apply && documentId && hasCore) {
    await patchDoc(documentId, data);
    applied = true;
    log?.(`Applied ${nameEn} → ${hit.name_en} EGP ${hit.price_egp}`);
  }

  return {
    ok: true,
    query: nameEn,
    score,
    hit,
    candidates: products.slice(0, 8),
    proposed_patch: data,
    reasons,
    document_id: documentId || null,
    applied,
    message: applied
      ? `Updated from DrugEye: ${hit.name_en} (EGP ${hit.price_egp}).`
      : hasCore
        ? `Match found; not applied.`
        : "Match found; no field changes needed.",
  };
}

/** List a page of medicines missing price for cron. */
async function listMissingPrice(limit) {
  if (!API_KEY) throw new Error("APPWRITE_API_KEY required for cron mode");

  // Prefer rows with null/0 price. Appwrite equal queries: try isNull then fallback to recent page.
  const queries = [
    JSON.stringify({ method: "limit", values: [limit] }),
    JSON.stringify({ method: "orderDesc", values: ["$updatedAt"] }),
  ];
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents?${qs}`;
  const res = await fetch(url, { headers: appwriteHeaders() });
  if (!res.ok) {
    throw new Error(`list documents ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const docs = data.documents || [];
  return docs.filter((d) => {
    const p = d.current_price_egp;
    return p == null || p === "" || Number(p) === 0;
  }).slice(0, limit);
}

async function runCron({ limit, forcePrice, throttleMs }, log) {
  const candidates = await listMissingPrice(limit);
  log(`Cron candidates missing price: ${candidates.length}`);

  const results = [];
  let patched = 0;
  let matched = 0;
  let errors = 0;

  for (const doc of candidates) {
    const name = String(doc.name_en || "").trim();
    if (!name) continue;
    try {
      const r = await refreshOne(name, doc.$id, true, forcePrice, log);
      if (r.ok) matched += 1;
      if (r.applied) patched += 1;
      results.push({
        document_id: doc.$id,
        name_en: name,
        status: r.applied ? "patched" : r.ok ? "matched" : "no_match",
        score: r.score,
        drugeye_name: r.hit?.name_en,
        price_egp: r.hit?.price_egp,
      });
    } catch (err) {
      errors += 1;
      results.push({
        document_id: doc.$id,
        name_en: name,
        status: "error",
        error: String(err.message || err),
      });
      log(`Cron error for ${name}: ${err.message || err}`);
    }
    if (throttleMs > 0) await sleep(throttleMs);
  }

  return {
    ok: true,
    mode: "cron",
    scanned: candidates.length,
    matched,
    patched,
    errors,
    results,
    timestamp: new Date().toISOString(),
  };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async ({ req, res, log, error }) => {
  try {
    const body = parseBody(req);
    const method = String(req.method || "POST").toUpperCase();

    // Schedule trigger often arrives as GET or empty POST
    const isCron =
      body.mode === "cron" ||
      body.mode === "schedule" ||
      req.headers?.["x-appwrite-trigger"] === "schedule" ||
      (method === "GET" && !body.name_en);

    if (isCron && !body.name_en) {
      log("Running DrugEye cron batch…");
      const limit = Number(
        body.limit || process.env.DRUGEYE_CRON_LIMIT || 20,
      );
      const throttleMs = Number(
        body.throttle_ms || process.env.DRUGEYE_CRON_THROTTLE_MS || 800,
      );
      const forcePrice = Boolean(body.force_price);
      const report = await runCron({ limit, forcePrice, throttleMs }, log);
      log(
        `Cron done: scanned=${report.scanned} matched=${report.matched} patched=${report.patched} errors=${report.errors}`,
      );
      return res.json(report);
    }

    const nameEn = String(body.name_en || body.query || "").trim();
    if (!nameEn) {
      return res.json(
        {
          ok: false,
          message:
            'Provide name_en for single refresh, or { "mode": "cron" } for batch.',
        },
        400,
      );
    }

    const documentId = body.document_id ? String(body.document_id).trim() : "";
    const forcePrice = Boolean(body.force_price);
    const apply =
      body.apply === undefined ? Boolean(documentId) : Boolean(body.apply);

    log(`Single refresh: ${nameEn} (apply=${apply}, doc=${documentId || "none"})`);
    const result = await refreshOne(nameEn, documentId, apply, forcePrice, log);
    return res.json(result);
  } catch (err) {
    error("drugeye-refresh: " + String(err.message || err));
    return res.json(
      {
        ok: false,
        message: String(err.message || err),
      },
      500,
    );
  }
};
