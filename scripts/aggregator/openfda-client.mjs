#!/usr/bin/env node
/**
 * OpenFDA drug label adapter (public API, no key required for modest volume).
 * https://open.fda.gov/apis/drug/label/
 *
 * Usage:
 *   node scripts/aggregator/openfda-client.mjs cosentyx
 *   node scripts/aggregator/openfda-client.mjs "secukinumab" --json
 */

const OPENFDA_LABEL =
  process.env.OPENFDA_LABEL_URL ||
  "https://api.fda.gov/drug/label.json";

function first(arr) {
  if (Array.isArray(arr) && arr.length) return String(arr[0]);
  if (typeof arr === "string") return arr;
  return null;
}

function clip(text, max = 400) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<object[]>}
 */
export async function searchOpenFda(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const limit = Math.min(Math.max(Number(opts.limit) || 5, 1), 20);
  const escaped = q.replace(/"/g, "").trim();
  const attempts = [
    `openfda.brand_name:"${escaped}"`,
    `openfda.generic_name:"${escaped}"`,
    escaped,
  ];
  let results = [];
  for (const search of attempts) {
    const url = `${OPENFDA_LABEL}?search=${encodeURIComponent(search)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "MedicineSupportHub/1.0" },
    });
    if (res.status === 404) continue;
    if (!res.ok) continue;
    const data = await res.json();
    results = Array.isArray(data.results) ? data.results : [];
    if (results.length) break;
  }
  const now = new Date().toISOString();

  return results.map((r) => {
    const of = r.openfda || {};
    const brand = first(of.brand_name);
    const generic = first(of.generic_name);
    const mfr = first(of.manufacturer_name);
    const pharm = first(of.pharm_class_epc) || first(of.pharm_class_cs);
    const setId = first(of.spl_set_id) || r.id || null;
    return {
      source: "openfda",
      query: q,
      queried_at: now,
      name_en: brand || generic,
      scientific_name: generic,
      manufacturer: mfr,
      drug_class: pharm,
      indications_summary: clip(first(r.indications_and_usage)),
      external_id: setId ? String(setId) : null,
      confidence: brand && brand.toLowerCase().includes(escaped.toLowerCase()) ? 0.9 : 0.7,
      source_url: setId
        ? `https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(brand || generic || q)}`
        : "https://open.fda.gov/apis/drug/label/",
      raw: { id: r.id, route: of.route, product_type: of.product_type },
    };
  });
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const asJson = process.argv.includes("--json");
  const q = args.join(" ").trim() || "cosentyx";
  const hits = await searchOpenFda(q, { limit: 5 });
  if (asJson) {
    console.log(JSON.stringify(hits, null, 2));
    return;
  }
  console.log(`OpenFDA hits for "${q}": ${hits.length}`);
  for (const h of hits) {
    console.log(`- ${h.name_en} | INN=${h.scientific_name} | ${h.manufacturer} | conf=${h.confidence}`);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("openfda-client.mjs");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
