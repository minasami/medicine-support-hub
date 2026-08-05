#!/usr/bin/env node
/**
 * NIH RxNorm adapter (public REST).
 * https://rxnav.nlm.nih.gov/RxNormAPIREST.html
 *
 * Usage:
 *   node scripts/aggregator/rxnorm-client.mjs cosentyx
 *   node scripts/aggregator/rxnorm-client.mjs secukinumab --json
 */

const RXNAV = (process.env.RXNAV_BASE || "https://rxnav.nlm.nih.gov/REST").replace(/\/$/, "");

export async function searchRxNorm(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return [];
  const limit = Math.min(Math.max(Number(opts.limit) || 8, 1), 25);
  const url = `${RXNAV}/drugs.json?name=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MedicineSupportHub/1.0" },
  });
  if (!res.ok) throw new Error(`RxNorm HTTP ${res.status}`);
  const data = await res.json();
  const groups = data?.drugGroup?.conceptGroup || [];
  const now = new Date().toISOString();
  const hits = [];
  const qLower = q.toLowerCase();

  for (const g of groups) {
    const tty = String(g.tty || "");
    for (const p of g.conceptProperties || []) {
      const name = String(p.name || p.synonym || "").trim();
      if (!name) continue;
      const rxcui = p.rxcui ? String(p.rxcui) : null;
      const nameLower = name.toLowerCase();
      let confidence = 0.55;
      if (nameLower === qLower) confidence = 0.95;
      else if (nameLower.includes(qLower) || qLower.includes(nameLower.split(" ")[0] || ""))
        confidence = 0.8;
      if (tty === "SBD" || tty === "BPCK" || tty === "SCD")
        confidence = Math.min(0.98, confidence + 0.05);
      hits.push({
        source: "rxnorm",
        query: q,
        queried_at: now,
        name_en: name,
        scientific_name: extractInn(name),
        manufacturer: null,
        drug_class: null,
        indications_summary: null,
        external_id: rxcui,
        confidence,
        source_url: rxcui
          ? `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rxcui}`
          : "https://rxnav.nlm.nih.gov/",
        raw: { tty, synonym: p.synonym },
      });
    }
  }

  hits.sort((a, b) => b.confidence - a.confidence);
  return hits.slice(0, limit);
}

function extractInn(name) {
  const m = String(name).match(/\b([a-z][a-z0-9\-]{3,})\s+\d/i);
  if (m) return m[1].toLowerCase();
  const parts = String(name).replace(/\[.*?\]/g, "").trim().split(/\s+/);
  for (const p of parts) {
    if (/^[a-z][a-z0-9\-]{4,}$/i.test(p) && !/^(ml|mg|mg\/ml|prefilled|syringe|auto)$/i.test(p)) {
      return p.toLowerCase();
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const asJson = process.argv.includes("--json");
  const q = args.join(" ").trim() || "cosentyx";
  const hits = await searchRxNorm(q);
  if (asJson) {
    console.log(JSON.stringify(hits, null, 2));
    return;
  }
  console.log(`RxNorm hits for "${q}": ${hits.length}`);
  for (const h of hits) {
    console.log(`- [${h.external_id}] ${h.name_en} | INN≈${h.scientific_name} | conf=${h.confidence}`);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("rxnorm-client.mjs");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
