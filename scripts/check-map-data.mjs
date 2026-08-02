#!/usr/bin/env node
/**
 * scripts/check-map-data.mjs
 *
 * Verifies static-to-live-id-map.json is a real map, not a placeholder or truncated sample.
 * Exit 0 = OK, non-zero = fail (do not ship).
 *
 * Usage:
 *   node scripts/check-map-data.mjs
 *   node scripts/check-map-data.mjs --path apps/web/public/data/static-to-live-id-map.json
 *   node scripts/check-map-data.mjs --min-static 500 --min-bytes 5000
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const mapPath = path.resolve(
  root,
  arg("--path", "apps/web/public/data/static-to-live-id-map.json"),
);
const MIN_STATIC = Number(arg("--min-static", "500"));
const MIN_BYTES = Number(arg("--min-bytes", "5000"));
const STATS_TOLERANCE = Number(arg("--stats-tolerance", "50"));

function fail(msg) {
  console.error(`[check-map-data] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[check-map-data] OK: ${msg}`);
}

if (!fs.existsSync(mapPath)) {
  fail(`File missing: ${mapPath}`);
}

const bytes = fs.statSync(mapPath).size;
const raw = fs.readFileSync(mapPath, "utf8");

if (!raw.trim()) fail("File is empty");

let map;
try {
  map = JSON.parse(raw);
} catch (e) {
  fail(`Invalid JSON: ${e.message}`);
}

if (map.note && String(map.note).toLowerCase().includes("placeholder")) {
  fail(`Placeholder note still present: ${map.note}`);
}

if (!map.generated_at) {
  fail("generated_at is missing (map was never fully written)");
}

const st = map.static_to_live || {};
const nt = map.name_to_live || {};
const amb = map.ambiguous_names || {};

const stCount = Object.keys(st).length;
const ntCount = Object.keys(nt).length;
const ambCount = Object.keys(amb).length;

if (bytes < MIN_BYTES) {
  fail(
    `File too small (${bytes} bytes). Expected >= ${MIN_BYTES}. Likely truncated or placeholder.`,
  );
}

if (stCount < MIN_STATIC) {
  fail(
    `static_to_live has only ${stCount} keys (min ${MIN_STATIC}). Full run should be closer to stats.mapped / static matches.`,
  );
}

const claimedMapped = Number(map.stats?.mapped ?? map.accuracy_summary?.mapped ?? NaN);
if (Number.isFinite(claimedMapped)) {
  const delta = Math.abs(claimedMapped - stCount);
  if (delta > STATS_TOLERANCE) {
    fail(
      `stats.mapped (${claimedMapped}) does not match static_to_live size (${stCount}); delta=${delta} > ${STATS_TOLERANCE}. Truncated sample with inflated stats.`,
    );
  }
}

const claimedNames = Number(map.stats?.names ?? NaN);
if (Number.isFinite(claimedNames) && claimedNames > 0) {
  // name_to_live may intentionally be capped; only flag if claim is high but file almost empty
  if (claimedNames >= 100 && ntCount < 10) {
    fail(
      `stats.names (${claimedNames}) but name_to_live has only ${ntCount} keys — sample payload.`,
    );
  }
}

// Spot-check value types (live ids should be numbers or numeric strings)
let bad = 0;
for (const [k, v] of Object.entries(st).slice(0, 200)) {
  if (v == null || v === "") bad++;
  if (String(k).trim() === "") bad++;
}
if (bad > 0) fail(`Found ${bad} empty keys/values in static_to_live sample`);

console.log(
  JSON.stringify(
    {
      path: mapPath,
      bytes,
      generated_at: map.generated_at,
      version: map.version ?? null,
      static_to_live: stCount,
      name_to_live: ntCount,
      ambiguous_names: ambCount,
      stats: map.stats ?? null,
      accuracy_summary: map.accuracy_summary ?? null,
    },
    null,
    2,
  ),
);

ok(`Map looks consistent (${stCount} static mappings, ${bytes} bytes)`);
process.exit(0);
