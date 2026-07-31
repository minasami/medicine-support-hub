#!/usr/bin/env node
/**
 * Map static dataset canonical_id → live Appwrite canonical_id.
 *
 * Prerequisites:
 *   node scripts/export-appwrite-medicines.mjs
 *
 * Usage:
 *   node scripts/map-static-to-live-ids.mjs --dry-run
 *   node scripts/map-static-to-live-ids.mjs --write
 *
 * Reads:
 *   apps/web/public/data/egyptian-medicines-dataset.json
 *   scripts/reports/appwrite-medicines-export.json
 *
 * Writes:
 *   scripts/reports/static-to-live-id-map.json
 *   (with --write) updates static dataset: canonical_id = live, legacy_static_id kept
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const staticPath = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);
const exportPath = path.join(
  root,
  "scripts/reports/appwrite-medicines-export.json",
);
const reportDir = path.join(root, "scripts/reports");
const mapPath = path.join(reportDir, "static-to-live-id-map.json");

const write = process.argv.includes("--write");
const dryRun = !write;

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normCode(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

function loadJson(p) {
  if (!fs.existsSync(p)) {
    console.error("Missing file:", p);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const staticRaw = loadJson(staticPath);
  const liveRaw = loadJson(exportPath);

  const staticList = Array.isArray(staticRaw?.medicines)
    ? staticRaw.medicines
    : Array.isArray(staticRaw)
      ? staticRaw
      : [];
  const liveList = Array.isArray(liveRaw?.medicines) ? liveRaw.medicines : [];

  if (!liveList.length) {
    console.error("Live export is empty. Run export-appwrite-medicines.mjs first.");
    process.exit(1);
  }

  // Indexes for live
  const byNameEn = new Map();
  const byNameAr = new Map();
  const byBarcode = new Map();
  const byCode = new Map();

  for (const row of liveList) {
    const id = row.canonical_id;
    if (id == null || Number.isNaN(Number(id))) continue;
    const ne = normName(row.name_en);
    const na = normName(row.name_ar);
    if (ne && !byNameEn.has(ne)) byNameEn.set(ne, row);
    if (na && !byNameAr.has(na)) byNameAr.set(na, row);
    const bc = normCode(row.barcode);
    const cd = normCode(row.code);
    if (bc && !byBarcode.has(bc)) byBarcode.set(bc, row);
    if (cd && !byCode.has(cd)) byCode.set(cd, row);
  }

  const mapRows = [];
  const stats = {
    static_total: staticList.length,
    live_total: liveList.length,
    exact_name_en: 0,
    exact_name_ar: 0,
    exact_barcode: 0,
    exact_code: 0,
    unmatched: 0,
    id_changed: 0,
    id_already_same: 0,
  };

  const updated = staticList.map((s) => {
    const legacy =
      s.legacy_static_id != null
        ? s.legacy_static_id
        : s.canonical_id != null
          ? s.canonical_id
          : null;

    let live = null;
    let method = "unmatched";

    const ne = normName(s.name_en);
    const na = normName(s.name_ar);
    if (ne && byNameEn.has(ne)) {
      live = byNameEn.get(ne);
      method = "exact_name_en";
      stats.exact_name_en += 1;
    } else if (na && byNameAr.has(na)) {
      live = byNameAr.get(na);
      method = "exact_name_ar";
      stats.exact_name_ar += 1;
    } else {
      const bc = normCode(s.barcode);
      const cd = normCode(s.code);
      if (bc && byBarcode.has(bc)) {
        live = byBarcode.get(bc);
        method = "exact_barcode";
        stats.exact_barcode += 1;
      } else if (cd && byCode.has(cd)) {
        live = byCode.get(cd);
        method = "exact_code";
        stats.exact_code += 1;
      } else {
        stats.unmatched += 1;
      }
    }

    const liveId = live?.canonical_id != null ? Number(live.canonical_id) : null;
    const staticId =
      s.canonical_id != null ? Number(s.canonical_id) : null;

    if (liveId != null && staticId != null && liveId !== staticId) {
      stats.id_changed += 1;
    }
    if (liveId != null && staticId != null && liveId === staticId) {
      stats.id_already_same += 1;
    }

    mapRows.push({
      legacy_static_id: legacy,
      static_name_en: s.name_en || null,
      live_canonical_id: liveId,
      live_name_en: live?.name_en || null,
      match_method: method,
      ids_differ: liveId != null && staticId != null && liveId !== staticId,
    });

    if (!liveId) {
      return {
        ...s,
        legacy_static_id: legacy,
        // keep old id for offline only; mark source so links stay name-based
        id_source: "static_dataset",
      };
    }

    return {
      ...s,
      legacy_static_id: legacy,
      canonical_id: liveId,
      id_source: "live_db",
      // optional enrich from live when static empty
      scientific_name: s.scientific_name || live.scientific_name || null,
      manufacturer: s.manufacturer || live.manufacturer || null,
      barcode: s.barcode || live.barcode || null,
      code: s.code || live.code || null,
    };
  });

  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    stats,
    sample_collisions: mapRows
      .filter((r) => r.ids_differ)
      .slice(0, 30),
    sample_unmatched: mapRows
      .filter((r) => r.match_method === "unmatched")
      .slice(0, 30),
    mappings: mapRows,
  };
  fs.writeFileSync(mapPath, JSON.stringify(report, null, 2));

  console.log("=== static → live ID map ===");
  console.log(stats);
  console.log("Map report:", mapPath);
  if (report.sample_collisions.length) {
    console.log("\nSample ID collisions (static id ≠ live id):" );
    for (const c of report.sample_collisions.slice(0, 10)) {
      console.log(
        `  static#${c.legacy_static_id} "${c.static_name_en}" → live#${c.live_canonical_id} "${c.live_name_en}" (${c.match_method})`,
      );
    }
  }

  if (write) {
    const payload = Array.isArray(staticRaw?.medicines)
      ? {
          ...staticRaw,
          version: staticRaw.version || "4.2.0",
          last_updated: new Date().toISOString(),
          total_count: updated.length,
          id_space: "aligned_to_appwrite_where_matched",
          medicines: updated,
        }
      : updated;
    fs.writeFileSync(staticPath, JSON.stringify(payload, null, 2));
    console.log("\nUpdated static dataset:", staticPath);
    console.log(
      "Matched rows now use live canonical_id; unmatched keep legacy ids with id_source=static_dataset.",
    );
  } else {
    console.log("\nDry-run only. Pass --write to rewrite static dataset.");
  }
}

main();
