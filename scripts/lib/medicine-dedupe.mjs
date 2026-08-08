/**
 * Multi-source medicine catalog deduplication.
 *
 * Identity priority (first match wins cluster membership):
 *  1. Normalized barcode (8–14 digits)
 *  2. Normalized product code
 *  3. name_en + strength token + dosage form
 *  4. name_en + manufacturer (when both present)
 *  5. name_en only (weak — last resort)
 *
 * Merge prefers non-empty / higher-quality fields (scientific_name, manufacturer, etc.).
 */

const FRAGRANCE_RE =
  /\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|eau\s*de\s*cologne|perfume|parfum|cologne|aftershave)\b/i;
const COSMETIC_RE =
  /\b(cream|lotion|shampoo|conditioner|soap|face\s*wash|body\s*wash|moisturizer|sunscreen|lipstick|mascara|deodorant)\b/i;
const MEDICINE_HINT =
  /\b(mg|mcg|iu|ml|tablet|capsule|ampoule|vial|syrup|suspension|inject|film.?coated)\b/i;
const MEDCARE_RE = /\bmed[\s\-]?care\b|ميد\s*كير/i;
const STRENGTH_RE =
  /(\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|ug|g|ml|iu|i\.?u\.?|%)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:ml|g))?)/i;

export function normText(s) {
  return String(s || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normBarcode(s) {
  const digits = String(s || "").replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 14) return digits;
  return "";
}

export function normCode(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

export function normMfr(s) {
  return String(s || "")
    .toLowerCase()
    .replace(
      /\b(s\.a\.e\.?|sae|ltd|llc|inc|co\.?|company|pharma|pharmaceuticals?|group)\b/gi,
      "",
    )
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse "MED CARE > PARTNER" into structured toll fields. */
export function parseTollManufacturer(raw) {
  const s = String(raw || "").trim();
  if (!s)
    return { manufacturer: null, toll_manufacturer: null, is_medcare_toll: false };
  const isMed = MEDCARE_RE.test(s);
  if (s.includes(">")) {
    const parts = s
      .split(">")
      .map((p) => p.trim())
      .filter(Boolean);
    const left = parts[0] || "";
    const right = parts[parts.length - 1] || "";
    if (MEDCARE_RE.test(left)) {
      return {
        manufacturer: right || left,
        toll_manufacturer: "Med-Care",
        is_medcare_toll: true,
        raw_manufacturer: s,
      };
    }
    if (MEDCARE_RE.test(right)) {
      return {
        manufacturer: left || right,
        toll_manufacturer: "Med-Care",
        is_medcare_toll: true,
        raw_manufacturer: s,
      };
    }
  }
  return {
    manufacturer: s,
    toll_manufacturer: isMed ? "Med-Care" : null,
    is_medcare_toll: isMed,
    raw_manufacturer: s,
  };
}

export function extractStrength(nameEn) {
  const m = String(nameEn || "").match(STRENGTH_RE);
  return m
    ? m[1].replace(/\s+/g, "").toLowerCase().replace(",", ".")
    : "";
}

export function classifyProductType(nameEn) {
  const n = nameEn || "";
  if (FRAGRANCE_RE.test(n)) return "fragrance";
  if (COSMETIC_RE.test(n) && !MEDICINE_HINT.test(n)) return "cosmetic";
  if (MEDICINE_HINT.test(n)) return "medicine";
  return "unknown";
}

/**
 * Build ordered identity keys for a record (most reliable first).
 * @returns {string[]}
 */
export function identityKeys(rec) {
  const keys = [];
  const bc = normBarcode(rec.barcode);
  if (bc) keys.push(`bc:${bc}`);

  const code = normCode(rec.code);
  if (code && code.length >= 3) keys.push(`cd:${code}`);

  const name = normText(rec.name_en || rec.commercial_name_en);
  const strength =
    extractStrength(rec.name_en || rec.commercial_name_en) ||
    normText(rec.strength);
  const form = normText(rec.dosage_form || rec.route).slice(0, 24);

  if (name && strength) {
    keys.push(`ns:${name}|${strength}${form ? `|${form}` : ""}`);
  }

  const mfr = normMfr(rec.manufacturer || rec.raw_manufacturer);
  if (name && mfr) keys.push(`nm:${name}|${mfr}`);

  if (name) keys.push(`n:${name}`);

  return keys;
}

function fieldScore(rec) {
  let s = 0;
  if (rec.scientific_name) s += 4;
  if (rec.manufacturer || rec.raw_manufacturer) s += 2;
  if (rec.barcode) s += 2;
  if (rec.drug_class || rec.category) s += 1;
  if (rec.route || rec.dosage_form) s += 1;
  if (rec.current_price_egp || rec.price_egp) s += 1;
  if (rec.name_ar) s += 1;
  if (rec.has_verified_dataset) s += 2;
  if (rec.image_url) s += 1;
  return s;
}

function prefer(a, b) {
  if (a == null || a === "") return b ?? null;
  if (b == null || b === "") return a;
  if (typeof a === "string" && typeof b === "string") {
    return a.length >= b.length ? a : b;
  }
  return a;
}

/** Merge two records into one, keeping the better field values. */
export function mergeRecords(a, b) {
  const tollA = parseTollManufacturer(a.raw_manufacturer || a.manufacturer);
  const tollB = parseTollManufacturer(b.raw_manufacturer || b.manufacturer);
  const base = fieldScore(a) >= fieldScore(b) ? { ...a } : { ...b };
  const other = fieldScore(a) >= fieldScore(b) ? b : a;

  const merged = {
    ...base,
    name_en: prefer(base.name_en, other.name_en),
    name_ar: prefer(base.name_ar, other.name_ar),
    scientific_name: prefer(base.scientific_name, other.scientific_name),
    manufacturer: prefer(
      tollA.manufacturer || base.manufacturer,
      tollB.manufacturer || other.manufacturer,
    ),
    raw_manufacturer: prefer(
      base.raw_manufacturer || base.manufacturer,
      other.raw_manufacturer || other.manufacturer,
    ),
    barcode: prefer(
      normBarcode(base.barcode) || base.barcode,
      normBarcode(other.barcode) || other.barcode,
    ),
    code: prefer(base.code, other.code),
    drug_class: prefer(base.drug_class, other.drug_class),
    category: prefer(base.category, other.category),
    route: prefer(base.route, other.route),
    dosage_form: prefer(base.dosage_form, other.dosage_form),
    strength: prefer(base.strength, other.strength),
    image_url: prefer(base.image_url, other.image_url),
    product_type:
      prefer(
        base.product_type !== "unknown" ? base.product_type : null,
        other.product_type !== "unknown" ? other.product_type : null,
      ) || classifyProductType(prefer(base.name_en, other.name_en)),
    has_verified_dataset: Boolean(
      base.has_verified_dataset ||
        other.has_verified_dataset ||
        prefer(base.scientific_name, other.scientific_name),
    ),
    current_price_egp: (() => {
      const pa = Number(base.current_price_egp ?? base.price_egp);
      const pb = Number(other.current_price_egp ?? other.price_egp);
      if (pa > 0 && pb > 0) return pa;
      return pa > 0 ? pa : pb > 0 ? pb : null;
    })(),
    is_medcare_toll: Boolean(
      tollA.is_medcare_toll ||
        tollB.is_medcare_toll ||
        base.is_medcare_toll ||
        other.is_medcare_toll,
    ),
    toll_manufacturer:
      tollA.toll_manufacturer ||
      tollB.toll_manufacturer ||
      base.toll_manufacturer ||
      other.toll_manufacturer ||
      null,
    sources: [
      ...new Set([
        ...(base.sources || (base.source ? [base.source] : [])),
        ...(other.sources || (other.source ? [other.source] : [])),
      ]),
    ],
    merge_count: (base.merge_count || 1) + (other.merge_count || 1),
  };

  if (!merged.canonical_id) {
    merged.canonical_id = base.canonical_id || other.canonical_id || null;
  }
  return merged;
}

/**
 * Deduplicate an array of medicine-like records.
 * @param {object[]} records
 * @param {{ startCanonicalId?: number }} [opts]
 * @returns {{ medicines: object[], stats: object }}
 */
export function dedupeMedicines(records, opts = {}) {
  let nextId = opts.startCanonicalId ?? 10001;
  /** @type {Map<string, number>} */
  const keyToCluster = new Map();
  /** @type {object[]} */
  const clusters = [];

  const stats = {
    input: records.length,
    merged_pairs: 0,
    by_key_type: { bc: 0, cd: 0, ns: 0, nm: 0, n: 0 },
    medcare_toll: 0,
    with_barcode: 0,
    with_scientific: 0,
  };

  for (const raw of records) {
    if (!raw) continue;
    const nameEn = (raw.name_en || raw.commercial_name_en || "").trim();
    const nameAr = (raw.name_ar || raw.commercial_name_ar || "").trim();
    if (!nameEn && !nameAr) continue;

    const toll = parseTollManufacturer(raw.manufacturer || raw.raw_manufacturer);
    const rec = {
      name_en: nameEn || nameAr,
      name_ar: nameAr || null,
      scientific_name: (raw.scientific_name || "").trim() || null,
      manufacturer: toll.manufacturer,
      raw_manufacturer: toll.raw_manufacturer || raw.manufacturer || null,
      toll_manufacturer: toll.toll_manufacturer,
      is_medcare_toll: toll.is_medcare_toll,
      barcode: normBarcode(raw.barcode) || raw.barcode || null,
      code: raw.code || raw.custom_product_code || null,
      drug_class: raw.drug_class || null,
      category: raw.category || raw.drug_class || null,
      route: raw.route || null,
      dosage_form: raw.dosage_form || null,
      strength: raw.strength || extractStrength(nameEn) || null,
      current_price_egp:
        raw.current_price_egp != null
          ? Number(raw.current_price_egp)
          : raw.price_egp != null
            ? Number(raw.price_egp)
            : raw.price != null
              ? Number(raw.price)
              : null,
      image_url: raw.image_url || "",
      product_type: raw.product_type || classifyProductType(nameEn),
      has_verified_dataset: Boolean(
        raw.has_verified_dataset || raw.scientific_name,
      ),
      source: raw.source || null,
      sources: raw.sources || (raw.source ? [raw.source] : []),
      merge_count: 1,
      canonical_id:
        raw.canonical_id != null ? Number(raw.canonical_id) : null,
    };

    const keys = identityKeys(rec);
    let clusterIdx = -1;
    let matchedKeyType = null;
    for (const k of keys) {
      if (keyToCluster.has(k)) {
        clusterIdx = keyToCluster.get(k);
        matchedKeyType = k.split(":")[0];
        break;
      }
    }

    if (clusterIdx >= 0) {
      clusters[clusterIdx] = mergeRecords(clusters[clusterIdx], rec);
      stats.merged_pairs += 1;
      if (matchedKeyType && stats.by_key_type[matchedKeyType] != null) {
        stats.by_key_type[matchedKeyType] += 1;
      }
      for (const k of identityKeys(clusters[clusterIdx])) {
        keyToCluster.set(k, clusterIdx);
      }
    } else {
      if (rec.canonical_id == null) rec.canonical_id = nextId++;
      clusterIdx = clusters.length;
      clusters.push(rec);
      for (const k of keys) keyToCluster.set(k, clusterIdx);
    }
  }

  for (const m of clusters) {
    if (m.is_medcare_toll) stats.medcare_toll += 1;
    if (normBarcode(m.barcode)) stats.with_barcode += 1;
    if (m.scientific_name) stats.with_scientific += 1;
  }

  stats.output = clusters.length;
  stats.reduction = records.length - clusters.length;
  stats.reduction_pct =
    records.length > 0
      ? Math.round(
          ((records.length - clusters.length) / records.length) * 1000,
        ) / 10
      : 0;

  return { medicines: clusters, stats };
}

export function normalizeSourceRow(row, sourceTag) {
  return {
    ...row,
    name_en: row.name_en || row.commercial_name_en || row.name || "",
    name_ar: row.name_ar || row.commercial_name_ar || "",
    scientific_name: row.scientific_name || row.inn || null,
    manufacturer: row.manufacturer || row.mfr || null,
    barcode: row.barcode || row.ean || null,
    code: row.code || row.custom_product_code || null,
    current_price_egp:
      row.current_price_egp ?? row.price_egp ?? row.price ?? null,
    source: sourceTag,
  };
}

export default {
  dedupeMedicines,
  mergeRecords,
  identityKeys,
  parseTollManufacturer,
  normalizeSourceRow,
  normBarcode,
  normText,
  normMfr,
};
