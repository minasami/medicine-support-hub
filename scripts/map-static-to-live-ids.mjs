#!/usr/bin/env node
/**
 * Map static dataset canonical_id → live Appwrite canonical_id.
 *
 * Features:
 *   - Audit mapping accuracy (confidence, reverse checks)
 *   - Handle duplicate names (manufacturer / barcode / code disambiguation)
 *   - Structured error handling (missing files, bad JSON, empty export)
 *
 * Prerequisites:
 *   node scripts/export-appwrite-medicines.mjs
 *
 * Usage:
 *   node scripts/map-static-to-live-ids.mjs --dry-run
 *   node scripts/map-static-to-live-ids.mjs --write
 *   node scripts/map-static-to-live-ids.mjs --audit-only
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
const auditPath = path.join(reportDir, "mapping-accuracy-audit.json");
const publicMapPath = path.join(
  root,
  "apps/web/public/data/static-to-live-id-map.json",
);

const write = process.argv.includes("--write");
const auditOnly = process.argv.includes("--audit-only");
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

function normMfr(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b(s\.a\.e\.?|sae|ltd|llc|inc|co\.?|company|pharma|pharmaceuticals?)\b/gi, "")
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple token Jaccard for audit (0–1). */
function nameSimilarity(a, b) {
  const ta = new Set(normName(a).split(" ").filter(Boolean));
  const tb = new Set(normName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

function loadJson(p, label) {
  try {
    if (!fs.existsSync(p)) {
      throw new Error(`Missing ${label}: ${p}`);
    }
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) {
      throw new Error(`Empty ${label}: ${p}`);
    }
    return JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[error] Failed to load ${label}:`, msg);
    process.exit(2);
  }
}

function safeWrite(p, data, pretty = false) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(
      p,
      typeof data === "string"
        ? data
        : JSON.stringify(data, null, pretty ? 2 : 0),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[error] Failed to write ${p}:`, msg);
    process.exit(3);
  }
}

/**
 * Pick best live candidate among duplicates.
 * Returns { row, method, confidence, ambiguous, candidates }
 */
function disambiguate(staticRow, candidates) {
  if (!candidates.length) {
    return {
      row: null,
      method: "unmatched",
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };
  }
  if (candidates.length === 1) {
    return {
      row: candidates[0],
      method: "unique",
      confidence: 1,
      ambiguous: false,
      candidates: candidates.map((c) => Number(c.canonical_id)),
    };
  }

  const sBc = normCode(staticRow.barcode);
  const sCd = normCode(staticRow.code);
  const sMfr = normMfr(staticRow.manufacturer);

  // Barcode exact among candidates
  if (sBc) {
    const hit = candidates.filter((c) => normCode(c.barcode) === sBc);
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_barcode",
        confidence: 0.98,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
  }

  // Registration code
  if (sCd) {
    const hit = candidates.filter((c) => normCode(c.code) === sCd);
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_code",
        confidence: 0.95,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
  }

  // Manufacturer
  if (sMfr) {
    const hit = candidates.filter((c) => {
      const m = normMfr(c.manufacturer);
      return m && (m === sMfr || m.includes(sMfr) || sMfr.includes(m));
    });
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_manufacturer",
        confidence: 0.85,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
    if (hit.length > 1) {
      // Prefer highest name similarity + manufacturer
      let best = hit[0];
      let bestSim = -1;
      for (const h of hit) {
        const sim = Math.max(
          nameSimilarity(staticRow.name_en, h.name_en),
          nameSimilarity(staticRow.name_ar, h.name_ar),
        );
        if (sim > bestSim) {
          bestSim = sim;
          best = h;
        }
      }
      if (bestSim >= 0.6) {
        return {
          row: best,
          method: "dup_mfr_similarity",
          confidence: Math.min(0.8, 0.5 + bestSim * 0.3),
          ambiguous: hit.length > 2,
          candidates: candidates.map((c) => Number(c.canonical_id)),
        };
      }
    }
  }

  // Cannot safely pick — mark ambiguous
  return {
    row: null,
    method: "ambiguous_duplicate",
    confidence: 0,
    ambiguous: true,
    candidates: candidates.map((c) => Number(c.canonical_id)),
  };
}

function buildLiveIndexes(liveList) {
  /** @type {Map<string, any[]>} */
  const byNameEn = new Map();
  /** @type {Map<string, any[]>} */
  const byNameAr = new Map();
  /** @type {Map<string, any[]>} */
  const byBarcode = new Map();
  /** @type {Map<string, any[]>} */
  const byCode = new Map();

  for (const row of liveList) {
    const id = row.canonical_id;
    if (id == null || Number.isNaN(Number(id))) continue;

    const ne = normName(row.name_en);
    const na = normName(row.name_ar);
    if (ne) {
      if (!byNameEn.has(ne)) byNameEn.set(ne, []);
      byNameEn.get(ne).push(row);
    }
    if (na) {
      if (!byNameAr.has(na)) byNameAr.set(na, []);
      byNameAr.get(na).push(row);
    }
    const bc = normCode(row.barcode);
    const cd = normCode(row.code);
    if (bc) {
      if (!byBarcode.has(bc)) byBarcode.set(bc, []);
      byBarcode.get(bc).push(row);
    }
    if (cd) {
      if (!byCode.has(cd)) byCode.set(cd, []);
      byCode.get(cd).push(row);
    }
  }

  return { byNameEn, byNameAr, byBarcode, byCode };
}

function matchStaticRow(s, indexes) {
  const { byNameEn, byNameAr, byBarcode, byCode } = indexes;
  const ne = normName(s.name_en);
  const na = normName(s.name_ar);
  const bc = normCode(s.barcode);
  const cd = normCode(s.code);

  // Prefer unique barcode / code first (high confidence)
  if (bc && byBarcode.has(bc)) {
    const r = disambiguate(s, byBarcode.get(bc));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_barcode" : r.method,
        confidence: r.method === "unique" ? 0.99 : r.confidence,
      };
    }
  }
  if (cd && byCode.has(cd)) {
    const r = disambiguate(s, byCode.get(cd));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_code" : r.method,
        confidence: r.method === "unique" ? 0.97 : r.confidence,
      };
    }
  }

  if (ne && byNameEn.has(ne)) {
    const r = disambiguate(s, byNameEn.get(ne));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_name_en" : r.method,
        confidence: r.method === "unique" ? 0.92 : r.confidence,
      };
    }
    if (r.ambiguous) return r;
  }

  if (na && byNameAr.has(na)) {
    const r = disambiguate(s, byNameAr.get(na));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_name_ar" : r.method,
        confidence: r.method === "unique" ? 0.9 : r.confidence,
      };
    }
    if (r.ambiguous) return r;
  }

  return {
    row: null,
    method: "unmatched",
    confidence: 0,
    ambiguous: false,
    candidates: [],
  };
}

function runAccuracyAudit(mapRows) {
  const matched = mapRows.filter((r) => r.live_canonical_id != null);
  const confidences = matched.map((r) => r.confidence || 0);
  const avgConf =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  const high = matched.filter((r) => (r.confidence || 0) >= 0.9).length;
  const medium = matched.filter(
    (r) => (r.confidence || 0) >= 0.7 && (r.confidence || 0) < 0.9,
  ).length;
  const low = matched.filter(
    (r) => (r.confidence || 0) > 0 && (r.confidence || 0) < 0.7,
  ).length;

  // Name similarity check: flagged when mapped names are weakly related
  const weakNameMatches = matched.filter((r) => {
    if (!r.static_name_en || !r.live_name_en) return false;
    if (r.match_method?.includes("barcode") || r.match_method?.includes("code"))
      return false;
    return nameSimilarity(r.static_name_en, r.live_name_en) < 0.5;
  });

  // Reverse: same live id claimed by many static rows with different names
  const liveClaims = new Map();
  for (const r of matched) {
    const id = r.live_canonical_id;
    if (!liveClaims.has(id)) liveClaims.set(id, []);
    liveClaims.get(id).push(r);
  }
  const multiStaticSameLive = [...liveClaims.entries()]
    .filter(([, rows]) => {
      const names = new Set(
        rows.map((x) => normName(x.static_name_en)).filter(Boolean),
      );
      return names.size > 1;
    })
    .map(([liveId, rows]) => ({
      live_canonical_id: liveId,
      static_names: rows.map((x) => x.static_name_en),
      count: rows.length,
    }));

  const accuracy_score =
    matched.length === 0
      ? 0
      : Math.round(
          ((high + medium * 0.7 + low * 0.4) / matched.length) * 1000,
        ) / 10;

  return {
    matched_count: matched.length,
    unmatched_count: mapRows.filter((r) => r.match_method === "unmatched")
      .length,
    ambiguous_count: mapRows.filter((r) => r.ambiguous).length,
    confidence: {
      average: Math.round(avgConf * 1000) / 1000,
      high_ge_0_9: high,
      medium_0_7_to_0_9: medium,
      low_lt_0_7: low,
    },
    accuracy_score_percent: accuracy_score,
    weak_name_matches: weakNameMatches.slice(0, 50),
    weak_name_match_count: weakNameMatches.length,
    multi_static_same_live: multiStaticSameLive.slice(0, 50),
    multi_static_same_live_count: multiStaticSameLive.length,
    pass:
      accuracy_score >= 70 &&
      weakNameMatches.length / Math.max(matched.length, 1) < 0.05,
  };
}

function main() {
  console.log("[map] Starting static → live canonical ID mapping…");

  const staticRaw = loadJson(staticPath, "static dataset");
  const liveRaw = loadJson(exportPath, "Appwrite export");

  const staticList = Array.isArray(staticRaw?.medicines)
    ? staticRaw.medicines
    : Array.isArray(staticRaw)
      ? staticRaw
      : [];
  const liveList = Array.isArray(liveRaw?.medicines) ? liveRaw.medicines : [];

  if (!Array.isArray(staticList) || staticList.length === 0) {
    console.error("[error] Static dataset has no medicines array.");
    process.exit(2);
  }
  if (!liveList.length) {
    console.error(
      "[error] Live export is empty. Run: node scripts/export-appwrite-medicines.mjs",
    );
    process.exit(2);
  }

  const indexes = buildLiveIndexes(liveList);

  // Detect duplicate names in live for reporting
  const liveDupNames = [];
  for (const [name, rows] of indexes.byNameEn.entries()) {
    if (rows.length > 1) {
      liveDupNames.push({
        name_en_norm: name,
        count: rows.length,
        live_ids: rows.map((r) => Number(r.canonical_id)),
        manufacturers: [
          ...new Set(rows.map((r) => r.manufacturer).filter(Boolean)),
        ],
      });
    }
  }

  const mapRows = [];
  const static_to_live = {};
  const name_to_live = {};
  const ambiguous_names = {};
  const stats = {
    static_total: staticList.length,
    live_total: liveList.length,
    exact_name_en: 0,
    exact_name_ar: 0,
    exact_barcode: 0,
    exact_code: 0,
    disambiguated: 0,
    ambiguous: 0,
    unmatched: 0,
    id_changed: 0,
    id_already_same: 0,
  };

  // Seed name_to_live only for UNIQUE live names (no duplicates)
  for (const [name, rows] of indexes.byNameEn.entries()) {
    if (rows.length === 1) {
      name_to_live[name] = Number(rows[0].canonical_id);
    } else {
      ambiguous_names[name] = rows.map((r) => Number(r.canonical_id));
    }
  }
  for (const [name, rows] of indexes.byNameAr.entries()) {
    if (rows.length === 1 && name_to_live[name] == null) {
      name_to_live[name] = Number(rows[0].canonical_id);
    } else if (rows.length > 1 && !ambiguous_names[name]) {
      ambiguous_names[name] = rows.map((r) => Number(r.canonical_id));
    }
  }

  const updated = staticList.map((s) => {
    const legacy =
      s.legacy_static_id != null
        ? s.legacy_static_id
        : s.canonical_id != null
          ? s.canonical_id
          : null;

    const result = matchStaticRow(s, indexes);
    const live = result.row;
    const method = result.method;
    const confidence = result.confidence;
    const ambiguous = result.ambiguous;

    if (method === "exact_name_en") stats.exact_name_en += 1;
    else if (method === "exact_name_ar") stats.exact_name_ar += 1;
    else if (method === "exact_barcode") stats.exact_barcode += 1;
    else if (method === "exact_code") stats.exact_code += 1;
    else if (method.startsWith("dup_")) stats.disambiguated += 1;
    else if (method === "ambiguous_duplicate") stats.ambiguous += 1;
    else if (method === "unmatched") stats.unmatched += 1;

    const liveId = live?.canonical_id != null ? Number(live.canonical_id) : null;
    const staticId = s.canonical_id != null ? Number(s.canonical_id) : null;

    if (liveId != null && staticId != null && liveId !== staticId) {
      stats.id_changed += 1;
    }
    if (liveId != null && staticId != null && liveId === staticId) {
      stats.id_already_same += 1;
    }

    if (liveId != null && legacy != null) {
      static_to_live[String(legacy)] = liveId;
    }
    if (liveId != null && staticId != null) {
      static_to_live[String(staticId)] = liveId;
    }

    // Audit name similarity when matched
    const sim =
      live && s.name_en && live.name_en
        ? nameSimilarity(s.name_en, live.name_en)
        : null;

    mapRows.push({
      legacy_static_id: legacy,
      static_name_en: s.name_en || null,
      static_manufacturer: s.manufacturer || null,
      live_canonical_id: liveId,
      live_name_en: live?.name_en || null,
      live_manufacturer: live?.manufacturer || null,
      match_method: method,
      confidence,
      ambiguous,
      candidate_live_ids: result.candidates,
      name_similarity: sim,
      ids_differ: liveId != null && staticId != null && liveId !== staticId,
    });

    if (!liveId) {
      return {
        ...s,
        legacy_static_id: legacy,
        id_source: "static_dataset",
        mapping_status: ambiguous ? "ambiguous" : "unmatched",
      };
    }

    return {
      ...s,
      legacy_static_id: legacy,
      canonical_id: liveId,
      id_source: "live_db",
      mapping_status: "mapped",
      mapping_confidence: confidence,
      scientific_name: s.scientific_name || live.scientific_name || null,
      manufacturer: s.manufacturer || live.manufacturer || null,
      barcode: s.barcode || live.barcode || null,
      code: s.code || live.code || null,
    };
  });

  const audit = runAccuracyAudit(mapRows);
  audit.live_duplicate_name_count = liveDupNames.length;
  audit.sample_live_duplicate_names = liveDupNames.slice(0, 40);
  audit.generated_at = new Date().toISOString();

  const compact = {
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
  };

  if (!auditOnly) {
    safeWrite(publicMapPath, compact, false);
  }

  const report = {
    generated_at: audit.generated_at,
    dry_run: dryRun,
    audit_only: auditOnly,
    stats,
    accuracy_audit: audit,
    sample_collisions: mapRows.filter((r) => r.ids_differ).slice(0, 30),
    sample_unmatched: mapRows
      .filter((r) => r.match_method === "unmatched")
      .slice(0, 30),
    sample_ambiguous: mapRows.filter((r) => r.ambiguous).slice(0, 30),
    mappings: mapRows,
  };
  safeWrite(mapPath, report, true);
  safeWrite(auditPath, audit, true);

  console.log("\n=== Mapping stats ===");
  console.log(stats);
  console.log("\n=== Accuracy audit ===");
  console.log({
    accuracy_score_percent: audit.accuracy_score_percent,
    confidence_avg: audit.confidence.average,
    high: audit.confidence.high_ge_0_9,
    medium: audit.confidence.medium_0_7_to_0_9,
    low: audit.confidence.low_lt_0_7,
    weak_name_matches: audit.weak_name_match_count,
    multi_static_same_live: audit.multi_static_same_live_count,
    live_duplicate_names: audit.live_duplicate_name_count,
    pass: audit.pass,
  });
  console.log("\nAudit report:", auditPath);
  console.log("Full map report:", mapPath);
  if (!auditOnly) {
    console.log("Public client map:", publicMapPath);
  }

  if (report.sample_ambiguous.length) {
    console.log("\nSample ambiguous (not auto-mapped):");
    for (const a of report.sample_ambiguous.slice(0, 8)) {
      console.log(
        `  "${a.static_name_en}" candidates=${JSON.stringify(a.candidate_live_ids)}`,
      );
    }
  }

  if (write && !auditOnly) {
    try {
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
      safeWrite(staticPath, payload, true);
      console.log("\nUpdated static dataset:", staticPath);
    } catch (err) {
      console.error("[error] Could not update static dataset:", err);
      process.exit(3);
    }
  } else if (!auditOnly) {
    console.log(
      "\nDry-run: public map written. Pass --write to rewrite static dataset IDs.",
    );
  }

  // Non-zero exit if audit fails badly (optional gate for CI)
  if (process.argv.includes("--strict") && !audit.pass) {
    console.error(
      "[error] Accuracy audit did not pass (--strict). See mapping-accuracy-audit.json",
    );
    process.exit(4);
  }

  console.log("[map] Done.");
}

try {
  main();
} catch (err) {
  console.error("[error] Unexpected failure:", err);
  process.exit(1);
}
