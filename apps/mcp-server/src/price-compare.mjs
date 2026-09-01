import { searchMedicines, getMedicine, DISCLAIMER_EN, DISCLAIMER_AR } from "./catalog.mjs";

export const PRICE_TRACK_DISCLAIMER_EN =
  "These are Medicine Support Hub catalog snapshots for the same scientific name. They are not live competitor pharmacy shelf prices and packs may differ.";
export const PRICE_TRACK_DISCLAIMER_AR =
  "هذه لقطات من كتالوج منصة دعم الدواء لنفس الاسم العلمي. ليست أسعار رف صيدليات منافسة، وقد تختلف العبوات.";

export function listPriceSources() {
  return {
    sources: [
      {
        id: "hub_catalog",
        name: "Medicine Support Hub catalog",
        live: true,
        license: "platform snapshot",
        note: "current_price_egp on the matched product",
      },
      {
        id: "inn_alternatives",
        name: "Same-INN brands in the hub catalog",
        live: true,
        license: "platform snapshot",
        note: "other manufacturers of the same scientific_name",
      },
    ],
    not_tracked_yet: [
      "Chefaa / Vezeeta / Dawaagate retail pages",
      "Pharmacy POS feeds",
      "EDA circular PDFs until a licensed dump is imported",
    ],
    how_to_add_external_snapshots:
      "Add dated rows to apps/mcp-server/src/data/price-observations.json with source, license, url, observed_at. Do not scrape sites that forbid it.",
    disclaimer_en: PRICE_TRACK_DISCLAIMER_EN,
    disclaimer_ar: PRICE_TRACK_DISCLAIMER_AR,
  };
}

function innKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .trim();
}

export async function compareInnPrices({ query, canonical_id, limit = 8 } = {}) {
  let product = null;
  if (canonical_id) product = await getMedicine(canonical_id);
  if (!product && query) {
    const hits = await searchMedicines(query, 5);
    product = hits[0] || null;
  }
  if (!product) {
    return {
      found: false,
      query: query || String(canonical_id || ""),
      alternatives: [],
      disclaimer_en: PRICE_TRACK_DISCLAIMER_EN,
      disclaimer_ar: PRICE_TRACK_DISCLAIMER_AR,
      catalog_disclaimer_en: DISCLAIMER_EN,
      catalog_disclaimer_ar: DISCLAIMER_AR,
    };
  }

  const cap = Math.min(Math.max(Number(limit) || 8, 1), 20);
  const inn = product.scientific_name;
  const peers = inn ? await searchMedicines(inn, cap) : [product];
  const key = innKey(inn);
  const alternatives = (peers.length ? peers : [product])
    .filter((row) => !key || innKey(row.scientific_name).includes(key) || key.includes(innKey(row.scientific_name)))
    .map((row) => ({
      canonical_id: row.canonical_id,
      name_en: row.name_en,
      name_ar: row.name_ar,
      manufacturer: row.manufacturer,
      strength: row.strength,
      dosage_form: row.dosage_form,
      current_price_egp: row.current_price_egp,
      is_query_match: String(row.canonical_id) === String(product.canonical_id),
      url: row.url,
    }))
    .sort((a, b) => {
      if (a.current_price_egp == null) return 1;
      if (b.current_price_egp == null) return -1;
      return a.current_price_egp - b.current_price_egp;
    });

  const priced = alternatives.filter((r) => r.current_price_egp != null);
  const prices = priced.map((r) => r.current_price_egp);
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const self = product.current_price_egp;

  return {
    found: true,
    query: query || String(canonical_id),
    scientific_name: inn,
    selected: {
      canonical_id: product.canonical_id,
      name_en: product.name_en,
      name_ar: product.name_ar,
      manufacturer: product.manufacturer,
      current_price_egp: product.current_price_egp,
    },
    alternative_count: alternatives.length,
    priced_count: priced.length,
    min_egp: min,
    max_egp: max,
    spread_egp: min != null && max != null ? Number((max - min).toFixed(2)) : null,
    vs_cheapest_egp:
      self != null && min != null ? Number((self - min).toFixed(2)) : null,
    alternatives,
    disclaimer_en: PRICE_TRACK_DISCLAIMER_EN,
    disclaimer_ar: PRICE_TRACK_DISCLAIMER_AR,
    catalog_disclaimer_en: DISCLAIMER_EN,
    catalog_disclaimer_ar: DISCLAIMER_AR,
  };
}
