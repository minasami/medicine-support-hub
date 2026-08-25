const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COLLECTION = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";
const API_KEY = process.env.APPWRITE_API_KEY || "";

export const DISCLAIMER_EN =
  "Indicative catalog estimate from Medicine Support Hub — not a pharmacy quote, prescription, insurance decision, or medical advice. Final price depends on pack, manufacturer, and pharmacy.";
export const DISCLAIMER_AR =
  "هذا تقدير إرشادي من قاعدة بيانات منصة Medicine Support Hub وليس عرض سعر من صيدلية أو وصفة أو قرار تأمين أو استشارة طبية. السعر النهائي يختلف حسب العبوة والشركة والصيدلية.";

export const POPULAR = [
  { query: "Zurcal", name_ar: "زوركال", name_en: "Zurcal" },
  { query: "Controloc", name_ar: "كونترولوك", name_en: "Controloc" },
  { query: "Augmentin", name_ar: "أوجمنتين", name_en: "Augmentin" },
  { query: "Brufen", name_ar: "بروفين", name_en: "Brufen" },
  { query: "Cataflam", name_ar: "كتافلام", name_en: "Cataflam" },
  { query: "Panadol", name_ar: "بانادول", name_en: "Panadol" },
  { query: "GABIMASH", name_ar: "جابيماش", name_en: "GABIMASH" },
  { query: "Plavix", name_ar: "بلافيكس", name_en: "Plavix" },
  { query: "Concor", name_ar: "كونكور", name_en: "Concor" },
  { query: "Glucophage", name_ar: "جلوكوفاج", name_en: "Glucophage" },
];

function headers() {
  const h = {
    "X-Appwrite-Project": PROJECT,
    "Content-Type": "application/json",
  };
  if (API_KEY) h["X-Appwrite-Key"] = API_KEY;
  return h;
}

function encodeQueries(queries) {
  return queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join("&");
}

function mapDoc(doc) {
  const price = Number(doc.current_price_egp);
  return {
    canonical_id: doc.canonical_id ?? doc.$id,
    document_id: doc.$id,
    name_en: doc.name_en || "",
    name_ar: doc.name_ar || "",
    scientific_name: doc.scientific_name || "",
    manufacturer: doc.manufacturer || "",
    strength: doc.strength || "",
    dosage_form: doc.dosage_form || "",
    category: doc.category || "",
    drug_class: doc.drug_class || "",
    barcode: doc.barcode || "",
    current_price_egp: Number.isFinite(price) && price > 0 ? price : null,
    url: `${process.env.PUBLIC_SITE_URL || "https://medicinesupport.app"}/catalog/${doc.canonical_id ?? doc.$id}`,
  };
}

async function listDocuments(queries) {
  const qs = encodeQueries(queries);
  const url = `${ENDPOINT}/databases/${DATABASE}/collections/${COLLECTION}/documents?${qs}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Appwrite ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.documents || []).map(mapDoc);
}

export async function searchMedicines(query, limit = 8) {
  const q = String(query || "").trim();
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 20);
  if (!q) return [];

  const attempts = [
    [{ method: "search", attribute: "name_en", values: [q] }, { method: "limit", values: [cap] }],
    [{ method: "search", attribute: "name_ar", values: [q] }, { method: "limit", values: [cap] }],
    [{ method: "search", attribute: "scientific_name", values: [q] }, { method: "limit", values: [cap] }],
  ];

  const seen = new Set();
  const out = [];
  for (const queries of attempts) {
    try {
      const rows = await listDocuments(queries);
      for (const row of rows) {
        const key = String(row.canonical_id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
        if (out.length >= cap) return out;
      }
    } catch {
      // try next attribute
    }
  }

  if (out.length === 0) {
    try {
      const rows = await listDocuments([{ method: "limit", values: [40] }]);
      const nq = q.toLowerCase();
      return rows
        .filter((r) =>
          [r.name_en, r.name_ar, r.scientific_name, r.manufacturer]
            .join(" ")
            .toLowerCase()
            .includes(nq),
        )
        .slice(0, cap);
    } catch {
      return [];
    }
  }
  return out;
}

export async function getMedicine(id) {
  const key = String(id || "").trim();
  if (!key) return null;
  try {
    const byCanonical = await listDocuments([
      { method: "equal", attribute: "canonical_id", values: [Number.isFinite(Number(key)) ? Number(key) : key] },
      { method: "limit", values: [1] },
    ]);
    if (byCanonical[0]) return byCanonical[0];
  } catch {
    /* fall through */
  }
  try {
    const url = `${ENDPOINT}/databases/${DATABASE}/collections/${COLLECTION}/documents/${encodeURIComponent(key)}`;
    const res = await fetch(url, { headers: headers() });
    if (res.ok) return mapDoc(await res.json());
  } catch {
    /* ignore */
  }
  const hits = await searchMedicines(key, 1);
  return hits[0] || null;
}

export async function estimateCost(lines) {
  const results = [];
  for (const line of lines || []) {
    const qty = Math.max(1, Number(line.quantity) || 1);
    let product = null;
    if (line.canonical_id) product = await getMedicine(line.canonical_id);
    if (!product && line.query) {
      const hits = await searchMedicines(line.query, 5);
      product = hits[0] || null;
    }
    if (!product) {
      results.push({
        query: line.query || String(line.canonical_id || ""),
        quantity: qty,
        matched: false,
        name_en: null,
        name_ar: null,
        canonical_id: null,
        unit_egp: null,
        line_egp: null,
      });
      continue;
    }
    const unit = product.current_price_egp;
    results.push({
      query: line.query || String(line.canonical_id),
      quantity: qty,
      matched: true,
      name_en: product.name_en,
      name_ar: product.name_ar,
      strength: product.strength,
      manufacturer: product.manufacturer,
      canonical_id: product.canonical_id,
      unit_egp: unit,
      line_egp: unit == null ? null : Number((unit * qty).toFixed(2)),
      url: product.url,
    });
  }
  const priced = results.filter((r) => r.line_egp != null);
  const total = priced.reduce((s, r) => s + r.line_egp, 0);
  return {
    currency: "EGP",
    lines: results,
    total_egp: Number(total.toFixed(2)),
    priced_lines: priced.length,
    unpriced_lines: results.length - priced.length,
    unmatched_lines: results.filter((r) => !r.matched).length,
    disclaimer_en: DISCLAIMER_EN,
    disclaimer_ar: DISCLAIMER_AR,
  };
}

export async function listPopular() {
  const items = [];
  for (const seed of POPULAR) {
    const hits = await searchMedicines(seed.query, 1);
    items.push({
      ...seed,
      product: hits[0] || null,
    });
  }
  return items;
}
