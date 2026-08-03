/**
 * Appwrite Function: eda-tariff-sync
 *
 * Applies Egyptian MOH/EDA official tariffs to the medicines collection.
 *
 * Modes
 * -----
 * 1) Cron / schedule
 *    Body: {} or { "mode": "cron", "limit": 50 }
 *    Loads tariff JSON from TARIFF_JSON_URL (or embedded minimal noop).
 *
 * 2) Remote tariff JSON
 *    { "mode": "url", "url": "https://.../moh-eda-tariff.json", "limit": 100 }
 *
 * 3) Single product patch
 *    { "name_en": "Panadol Extra", "price_egp": 32.5, "document_id": "..." }
 *
 * Env
 * ---
 *   APPWRITE_API_KEY, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID
 *   APPWRITE_DATABASE_ID, APPWRITE_MEDICINES_COLLECTION_ID
 *   TARIFF_JSON_URL          optional public JSON from parse-moh-eda-tariff
 *   TARIFF_CRON_LIMIT        default 40
 *   TARIFF_MIN_SCORE         default 85
 *   TARIFF_THROTTLE_MS       default 150
 */

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  return 0;
}

function headers() {
  return {
    "X-Appwrite-Project": PROJECT,
    "X-Appwrite-Key": API_KEY,
    "Content-Type": "application/json",
  };
}

async function listMedicines(limit) {
  const queries = [
    JSON.stringify({ method: "limit", values: [limit] }),
    JSON.stringify({ method: "orderDesc", values: ["$updatedAt"] }),
  ];
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(q)}`).join("&");
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents?${qs}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`list ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const data = await res.json();
  return data.documents || [];
}

async function searchByName(name) {
  const n = encodeURIComponent(name);
  // Try exact name_en first
  let url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: "equal", attribute: "name_en", values: [name] }))}&queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [5] }))}`;
  let res = await fetch(url, { headers: headers() });
  if (res.ok) {
    const data = await res.json();
    if (data.documents?.length) return data.documents;
  }
  // Fallback: recent page + client filter
  const page = await listMedicines(200);
  const t = normalizeName(name);
  return page.filter((d) => {
    const en = normalizeName(d.name_en);
    const ar = normalizeName(d.name_ar);
    return en === t || ar === t || en.includes(t) || t.includes(en);
  });
}

async function patchDoc(id, data) {
  const url = `${ENDPOINT}/databases/${DATABASE_ID}/collections/${MEDICINES}/documents/${encodeURIComponent(id)}`;
  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ data: payload }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }
  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    const { official_tariff_egp, price_source, tariff_updated_at, tariff_list_version, ...rest } =
      data;
    result = await attempt({
      ...rest,
      current_price_egp: data.current_price_egp ?? official_tariff_egp,
    });
  }
  if (!result.ok) {
    throw new Error(`PATCH ${result.status}: ${result.text.slice(0, 160)}`);
  }
}

async function loadTariffJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Tariff JSON HTTP ${res.status}`);
  return res.json();
}

function pickBest(docs, name) {
  let best = null;
  let bestScore = -1;
  for (const d of docs) {
    const s = Math.max(scoreNames(name, d.name_en), scoreNames(name, d.name_ar));
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }
  return { doc: best, score: bestScore };
}

async function applyTariffRow(product, minScore, log) {
  const name = product.display_name || product.name_en || product.name_ar;
  const price = product.official_tariff_egp ?? product.price_egp;
  if (!name || price == null) return { status: "skip" };

  const docs = await searchByName(String(name));
  const { doc, score } = pickBest(docs, String(name));
  if (!doc || score < minScore) {
    return { status: "no_match", name, score };
  }

  const listVersion = product.tariff_list_version || "function";
  const data = {
    official_tariff_egp: Number(price),
    current_price_egp: Number(price),
    price_source: "moh_eda_tariff",
    tariff_updated_at: new Date().toISOString(),
    tariff_list_version: listVersion,
  };

  await patchDoc(doc.$id, data);
  log?.(`Tariff applied: ${name} → ${doc.name_en || doc.$id} EGP ${price}`);
  return {
    status: "patched",
    name,
    document_id: doc.$id,
    score,
    price: Number(price),
  };
}

export default async ({ req, res, log, error }) => {
  try {
    if (!API_KEY) {
      return res.json(
        { success: false, error: "APPWRITE_API_KEY not configured" },
        500,
      );
    }

    const body = parseBody(req);
    const minScore = Number(process.env.TARIFF_MIN_SCORE || body.min_score || 85);
    const throttleMs = Number(
      process.env.TARIFF_THROTTLE_MS || body.throttle_ms || 150,
    );

    // Single product
    if (body.name_en || body.name_ar || body.display_name) {
      const product = {
        name_en: body.name_en,
        name_ar: body.name_ar,
        display_name: body.display_name || body.name_en || body.name_ar,
        official_tariff_egp: body.price_egp ?? body.official_tariff_egp,
        tariff_list_version: body.tariff_list_version || "manual",
      };
      if (body.document_id && product.official_tariff_egp != null) {
        await patchDoc(body.document_id, {
          official_tariff_egp: Number(product.official_tariff_egp),
          current_price_egp: Number(product.official_tariff_egp),
          price_source: "moh_eda_tariff",
          tariff_updated_at: new Date().toISOString(),
          tariff_list_version: product.tariff_list_version,
        });
        return res.json({
          success: true,
          mode: "single",
          document_id: body.document_id,
          price: product.official_tariff_egp,
        });
      }
      const result = await applyTariffRow(product, minScore, log);
      return res.json({ success: true, mode: "single", result });
    }

    const mode =
      body.mode ||
      (req.headers?.["x-appwrite-trigger"] === "schedule" ? "cron" : "cron");

    const tariffUrl =
      body.url || process.env.TARIFF_JSON_URL || "";

    if (!tariffUrl && mode !== "single") {
      log("No TARIFF_JSON_URL configured — cron idle.");
      return res.json({
        success: true,
        job: "eda_tariff_sync",
        status: "idle",
        message:
          "Set TARIFF_JSON_URL to a published moh-eda-tariff.json from parse-moh-eda-tariff.mjs",
        timestamp: new Date().toISOString(),
      });
    }

    log(`Loading tariff JSON from ${tariffUrl}`);
    const tariff = await loadTariffJson(tariffUrl);
    const products = tariff.products || [];
    const limit = Number(
      body.limit || process.env.TARIFF_CRON_LIMIT || 40,
    );
    const slice = products.slice(0, limit);

    const results = [];
    let patched = 0;
    let unmatched = 0;
    let errors = 0;

    for (const product of slice) {
      try {
        const r = await applyTariffRow(
          {
            ...product,
            tariff_list_version:
              product.tariff_list_version || tariff.tariff_list_version,
          },
          minScore,
          log,
        );
        results.push(r);
        if (r.status === "patched") patched += 1;
        else if (r.status === "no_match") unmatched += 1;
      } catch (err) {
        errors += 1;
        results.push({ status: "error", error: String(err.message || err) });
        log(`Error: ${err.message || err}`);
      }
      if (throttleMs > 0) await sleep(throttleMs);
    }

    return res.json({
      success: true,
      job: "eda_tariff_sync",
      mode,
      scanned: slice.length,
      patched,
      unmatched,
      errors,
      results: results.slice(0, 30),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    error("eda-tariff-sync: " + String(err.message || err));
    return res.json(
      { success: false, error: String(err.message || err) },
      500,
    );
  }
};
