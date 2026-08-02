#!/usr/bin/env node
/** Ensure map-static-to-live-ids.mjs embeds accuracy_summary in public compact map. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "scripts/map-static-to-live-ids.mjs");
let src = fs.readFileSync(p, "utf8");

if (src.includes("accuracy_summary:")) {
  console.log("accuracy_summary already embedded");
  process.exit(0);
}

const old = `  const compact = {
    version: 2,
    generated_at: audit.generated_at,
    static_to_live,
    name_to_live,
    /** Names with multiple live products — client must not auto-resolve by name alone */
    ambiguous_names,
    stats: {
      mapped: Object.keys(static_to_live).length,
      names: Object.keys(name_to_live).length,
      ambiguous_name_keys: Object.keys(ambiguous_names).length,
      accuracy_score_percent: audit.accuracy_score_percent,
      ...stats,
    },
  };`;

const neu = `  const compact = {
    version: 2,
    generated_at: audit.generated_at,
    static_to_live,
    name_to_live,
    /** Names with multiple live products — client must not auto-resolve by name alone */
    ambiguous_names,
    accuracy_summary: {
      accuracy_score_percent: audit.accuracy_score_percent,
      matched_count: audit.matched_count,
      unmatched_count: audit.unmatched_count,
      ambiguous_count: audit.ambiguous_count,
      confidence: audit.confidence,
      pass: audit.pass,
      generated_at: audit.generated_at,
    },
    stats: {
      mapped: Object.keys(static_to_live).length,
      names: Object.keys(name_to_live).length,
      ambiguous_name_keys: Object.keys(ambiguous_names).length,
      accuracy_score_percent: audit.accuracy_score_percent,
      exact_name_en: stats.exact_name_en,
      exact_name_ar: stats.exact_name_ar,
      exact_barcode: stats.exact_barcode,
      exact_code: stats.exact_code,
      disambiguated: stats.disambiguated,
      ambiguous: stats.ambiguous,
      unmatched: stats.unmatched,
      ...stats,
    },
  };`;

if (!src.includes(old)) {
  console.error("Could not find compact block to patch");
  process.exit(1);
}
fs.writeFileSync(p, src.replace(old, neu));
console.log("Patched accuracy_summary into map-static-to-live-ids.mjs");
