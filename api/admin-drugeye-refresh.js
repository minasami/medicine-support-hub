/**
 * POST /api/admin-drugeye-refresh
 *
 * Platform-admin only. Searches DrugEye (PharOrg) and optionally updates
 * the matching Appwrite medicine document.
 *
 * Body:
 *   {
 *     name_en: string,              // required search query
 *     document_id?: string,         // Appwrite document $id
 *     apply?: boolean,              // default true when document_id set
 *     force_price?: boolean         // overwrite existing price
 *   }
 *
 * Env:
 *   APPWRITE_API_KEY (required to apply patches)
 *   APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT, APPWRITE_DATABASE_ID
 *   APPWRITE_MEDICINES_COLLECTION_ID
 *   + Supabase admin session vars used by requirePlatformAdmin
 */

import {
  errorStatus,
  parseBody,
  requirePlatformAdmin,
  sendJson,
} from "./_platform-server.js";

const DRUGEYE_URL =
  process.env.DRUGEYE_SEARCH_URL ||
  "http://www.drugeye.pharorg.com/drugeyeapp/android-search/drugeye-android-live-go.aspx";

const APPWRITE_ENDPOINT = (
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const APPWRITE_PROJECT =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  "6a54ac3a00272c02d6e0";
const APPWRITE_KEY = process.env.APPWRITE_API_KEY || "";
const APPWRITE_DB =
  process.env.APPWRITE_DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  "medicine_support_hub";
const APPWRITE_MEDICINES =
  process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
  "medicines";

const UA =
  "Mozilla/5.0 (Linux; Android 13; MedicineSupportHubAdmin) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";

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
  if (typeof res.headers.getSetCookie === "function") return res.headers.getSetCookie();
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
    if (!name || name.length < 3 || ACTION_LABELS.has(lower) || /^\d+(\.\d+)?$/.test(name)) {
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
    while (i < cells.length && ACTION_LABELS.has((cells[i] || "").toLowerCase())) i += 1;
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
    signal: AbortSignal.timeout(25000),
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
    signal: AbortSignal.timeout(30000),
  });
  const postHtml = await postRes.text();
  if (!postRes.ok) {
    throw new Error(`DrugEye HTTP ${postRes.status}`);
  }
  return parseProducts(postHtml, query);
}

async function getAppwriteDoc(documentId) {
  if (!APPWRITE_KEY) return null;
  const url = `${APPWRITE_ENDPOINT}/databases/${APPWRITE_DB}/collections/${APPWRITE_MEDICINES}/documents/${encodeURIComponent(documentId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT,
      "X-Appwrite-Key": APPWRITE_KEY,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.json();
}

async function patchAppwriteDoc(documentId, data) {
  if (!APPWRITE_KEY) {
    throw new Error("APPWRITE_API_KEY is not configured on the server.");
  }
  const url = `${APPWRITE_ENDPOINT}/databases/${APPWRITE_DB}/collections/${APPWRITE_MEDICINES}/documents/${encodeURIComponent(documentId)}`;

  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT,
        "X-Appwrite-Key": APPWRITE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
      signal: AbortSignal.timeout(20000),
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
    const empty = currentPrice == null || currentPrice === 0 || Number.isNaN(currentPrice);
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { message: "POST required." });
  }

  try {
    const admin = await requirePlatformAdmin(request);
    const body = parseBody(request);
    const nameEn = String(body.name_en || body.query || "").trim();
    const documentId = body.document_id ? String(body.document_id).trim() : "";
    const forcePrice = Boolean(body.force_price);
    const apply =
      body.apply === undefined ? Boolean(documentId) : Boolean(body.apply);

    if (!nameEn) {
      return sendJson(response, 400, { message: "name_en is required." });
    }

    const products = await searchDrugEye(nameEn);
    const { hit, score } = pickBest(products, nameEn);

    if (!hit || score < 35) {
      return sendJson(response, 200, {
        ok: false,
        message: "No confident DrugEye match.",
        query: nameEn,
        score,
        candidates: products.slice(0, 8),
        applied: false,
        admin: admin.profile.full_name || admin.user.id,
      });
    }

    let existing = null;
    if (documentId) {
      existing = await getAppwriteDoc(documentId);
    }

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
      await patchAppwriteDoc(documentId, data);
      applied = true;
    }

    return sendJson(response, 200, {
      ok: true,
      query: nameEn,
      score,
      hit,
      candidates: products.slice(0, 8),
      proposed_patch: data,
      reasons,
      document_id: documentId || null,
      applied,
      skipped_apply: apply && documentId && !hasCore,
      message: applied
        ? `Updated from DrugEye: ${hit.name_en} (EGP ${hit.price_egp}).`
        : hasCore
          ? `Match found; not applied (apply=${apply}, document_id=${documentId || "none"}).`
          : "Match found; no field changes needed.",
      admin: admin.profile.full_name || admin.user.id,
    });
  } catch (error) {
    console.error("admin-drugeye-refresh", error);
    return sendJson(response, errorStatus(error), {
      message:
        error instanceof Error ? error.message : "DrugEye refresh failed.",
    });
  }
}
