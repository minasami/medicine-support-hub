#!/usr/bin/env node
/**
 * Federated medicine search — local gaps filled from multiple encyclopedias.
 *
 * Usage:
 *   node scripts/aggregator/federated-search.mjs cosentyx
 *   node scripts/aggregator/federated-search.mjs "panadol extra" --json
 *   node scripts/aggregator/federated-search.mjs cosentyx --sources=openfda,rxnorm,drugeye
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { searchOpenFda } from "./openfda-client.mjs";
import { searchRxNorm } from "./rxnorm-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function federatedSearch(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return { query: q, hits: [], bySource: {}, merged: null };

  const sourceList = (opts.sources || ["openfda", "rxnorm"])
    .map((s) => String(s).toLowerCase().trim())
    .filter(Boolean);
  const limit = opts.limitPerSource || 5;
  const bySource = {};
  const hits = [];
  const tasks = [];

  if (sourceList.includes("openfda")) {
    tasks.push(
      searchOpenFda(q, { limit })
        .then((r) => {
          bySource.openfda = r;
          hits.push(...r);
        })
        .catch((e) => {
          bySource.openfda = [];
          bySource.openfda_error = String(e?.message || e);
        }),
    );
  }

  if (sourceList.includes("rxnorm")) {
    tasks.push(
      searchRxNorm(q, { limit })
        .then((r) => {
          bySource.rxnorm = r;
          hits.push(...r);
        })
        .catch((e) => {
          bySource.rxnorm = [];
          bySource.rxnorm_error = String(e?.message || e);
        }),
    );
  }

  if (sourceList.includes("drugeye") || opts.includeDrugEye) {
    tasks.push(
      (async () => {
        try {
          const modPath = path.join(__dirname, "..", "drugeye-client.mjs");
          const mod = await import(pathToFileURL(modPath).href);
          const session = await mod.createDrugEyeSession();
          const r = await mod.searchDrugEye(q, { session, limit });
          const mapped = (r.products || r || []).map((p) => ({
            source: "drugeye",
            query: q,
            queried_at: new Date().toISOString(),
            name_en: p.name_en || p.name || null,
            scientific_name: p.scientific_name || null,
            manufacturer: p.manufacturer || null,
            drug_class: p.drug_class || null,
            indications_summary: null,
            external_id: null,
            confidence: 0.75,
            source_url: "http://www.drugeye.pharorg.com/",
            price_egp: p.price_egp ?? null,
            raw: p,
          }));
          bySource.drugeye = mapped;
          hits.push(...mapped);
        } catch (e) {
          bySource.drugeye = [];
          bySource.drugeye_error = String(e?.message || e);
        }
      })(),
    );
  }

  await Promise.all(tasks);
  const merged = mergeHits(hits, q);
  return { query: q, hits, bySource, merged };
}

export function mergeHits(hits, query) {
  if (!hits.length) return null;
  const sorted = [...hits].sort((a, b) => b.confidence - a.confidence);
  const pick = (field) => {
    for (const h of sorted) {
      const v = h[field];
      if (v != null && String(v).trim() !== "") {
        return { value: v, source: h.source, confidence: h.confidence };
      }
    }
    return null;
  };

  let price = null;
  for (const h of sorted) {
    if (h.source === "drugeye" && h.price_egp != null) {
      price = { value: h.price_egp, source: "drugeye", confidence: h.confidence };
      break;
    }
  }

  return {
    query,
    name_en: pick("name_en"),
    scientific_name: pick("scientific_name"),
    manufacturer: pick("manufacturer"),
    drug_class: pick("drug_class"),
    indications_summary: pick("indications_summary"),
    price_egp: price,
    sources_used: [...new Set(sorted.map((h) => h.source))],
    top_confidence: sorted[0]?.confidence ?? 0,
    links: sorted
      .filter((h) => h.source_url)
      .slice(0, 6)
      .map((h) => ({ source: h.source, url: h.source_url, label: h.name_en })),
  };
}

export function fillMissingFields(local, merged) {
  if (!merged) return { patch: {}, provenance: {} };
  const patch = {};
  const provenance = {};

  const tryFill = (localKey, mergedKey) => {
    const cur = local[localKey];
    const empty =
      cur == null ||
      cur === "" ||
      (typeof cur === "number" && !Number.isFinite(cur)) ||
      (typeof cur === "number" && cur === 0 && localKey.includes("price"));
    const m = merged[mergedKey];
    if (empty && m?.value != null) {
      patch[localKey] = m.value;
      provenance[localKey] = `${m.source}:${m.confidence}`;
    }
  };

  tryFill("scientific_name", "scientific_name");
  tryFill("manufacturer", "manufacturer");
  tryFill("drug_class", "drug_class");
  tryFill("current_price_egp", "price_egp");
  if (!local.name_en && merged.name_en?.value) {
    patch.name_en = merged.name_en.value;
    provenance.name_en = `${merged.name_en.source}:${merged.name_en.confidence}`;
  }

  return { patch, provenance };
}

async function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const srcArg = argv.find((a) => a.startsWith("--sources="));
  const sources = srcArg
    ? srcArg.replace("--sources=", "").split(",")
    : ["openfda", "rxnorm"];
  const q = argv.filter((a) => !a.startsWith("--")).join(" ").trim() || "cosentyx";

  const result = await federatedSearch(q, { sources, limitPerSource: 5 });
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Federated search: "${result.query}"`);
  console.log(`Sources: ${Object.keys(result.bySource).join(", ")}`);
  console.log(`Raw hits: ${result.hits.length}`);
  if (result.merged) {
    console.log("Merged proposal:");
    console.log(JSON.stringify(result.merged, null, 2));
  } else {
    console.log("No mergeable hits.");
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("federated-search.mjs");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
