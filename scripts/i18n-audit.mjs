#!/usr/bin/env node
/**
 * Medicine Support Hub — Arabic i18n audit pipeline
 *
 * Usage:
 *   node scripts/i18n-audit.mjs
 *   node scripts/i18n-audit.mjs --json
 *   node scripts/i18n-audit.mjs --fail              # exit 1 if ANY gap remains
 *   node scripts/i18n-audit.mjs --ci                # CI mode: fail only on critical paths
 *   node scripts/i18n-audit.mjs --critical-only     # only report critical path failures
 *
 * Critical paths: scripts/i18n-critical-paths.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCAN_ROOTS = [
  path.join(ROOT, "apps/web/src/pages"),
  path.join(ROOT, "apps/web/src/components"),
];
const CRITICAL_FILE = path.join(ROOT, "scripts/i18n-critical-paths.json");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const failOnGaps = args.has("--fail");
const ciMode = args.has("--ci");
const criticalOnly = args.has("--critical-only");

function loadCriticalPaths() {
  if (!fs.existsSync(CRITICAL_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(CRITICAL_FILE, "utf8"));
    return Array.isArray(data.paths) ? data.paths : [];
  } catch {
    return [];
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === "ui" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function analyze(file) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const hasUseLanguage =
    /useLanguage\s*\(/.test(text) || /from\s+["']@\/lib\/i18n["']/.test(text);
  const tCalls = (text.match(/\bt\s*\(\s*["'`]/g) || []).length;
  const hardUi = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*import\s|from\s+["']|className=|type\s|interface\s|console\./.test(line))
      continue;
    if (/\bt\s*\(/.test(line)) continue;
    const m = line.match(/>\s*([A-Z][A-Za-z0-9 ,.'%/\-]{6,80})\s*</);
    if (m) hardUi.push({ line: i + 1, sample: m[1].slice(0, 80) });
    const q = line.match(
      /(?:title|label|placeholder|description|children)\s*[:=]\s*["']([A-Z][^"']{8,})["']/i,
    );
    if (q) hardUi.push({ line: i + 1, sample: q[1].slice(0, 80) });
  }
  const needsWork =
    !hasUseLanguage || (hasUseLanguage && tCalls < 3 && hardUi.length > 2);
  return {
    file: rel,
    hasUseLanguage,
    tCalls,
    hardUiSamples: hardUi.slice(0, 8),
    hardUiCount: hardUi.length,
    needsWork,
  };
}

const criticalPaths = loadCriticalPaths();
const criticalSet = new Set(criticalPaths);

const files = SCAN_ROOTS.flatMap((r) => walk(r));
const reports = files
  .map(analyze)
  .sort(
    (a, b) =>
      Number(b.needsWork) - Number(a.needsWork) || a.file.localeCompare(b.file),
  );
const gaps = reports.filter((r) => r.needsWork);
const ok = reports.filter((r) => !r.needsWork);

// Critical failures: listed path missing, or present but no useLanguage
const criticalFailures = [];
for (const p of criticalPaths) {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) {
    criticalFailures.push({ file: p, reason: "missing file" });
    continue;
  }
  const report = analyze(full);
  if (!report.hasUseLanguage) {
    criticalFailures.push({
      file: p,
      reason: "missing useLanguage / @/lib/i18n",
      tCalls: report.tCalls,
    });
  } else if (report.tCalls < 1) {
    criticalFailures.push({
      file: p,
      reason: "useLanguage present but no t() calls",
      tCalls: report.tCalls,
    });
  }
}

const payload = {
  scanned: reports.length,
  localized: ok.length,
  gaps: gaps.length,
  criticalListed: criticalPaths.length,
  criticalFailures: criticalFailures.length,
  criticalFailureItems: criticalFailures,
  items: criticalOnly ? gaps.filter((g) => criticalSet.has(g.file)) : gaps,
};

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("Arabic i18n audit — Medicine Support Hub");
  console.log(`Scanned: ${reports.length} files`);
  console.log(`OK (useLanguage + light chrome): ${ok.length}`);
  console.log(`Gaps (heuristic): ${gaps.length}`);
  console.log(
    `Critical paths: ${criticalPaths.length} | failures: ${criticalFailures.length}`,
  );
  console.log("");

  if (criticalFailures.length) {
    console.log("CRITICAL failures (CI gate):");
    for (const f of criticalFailures) {
      console.log(`  ✗ ${f.file} — ${f.reason}`);
    }
    console.log("");
  }

  if (!criticalOnly && gaps.length) {
    console.log("Priority gaps (informational until fully localized):");
    for (const g of gaps.slice(0, 40)) {
      const mark = criticalSet.has(g.file) ? "[critical] " : "";
      console.log(
        `  - ${mark}${g.file}  useLanguage=${g.hasUseLanguage} t()≈${g.tCalls} hardUI≈${g.hardUiCount}`,
      );
    }
    if (gaps.length > 40) console.log(`  … +${gaps.length - 40} more`);
  }

  console.log(
    "\nModes: --ci (fail critical only) | --fail (fail any gap) | --json",
  );
}

// Write machine-readable summary for artifacts
const outDir = path.join(ROOT, "artifacts");
try {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "i18n-audit-report.json"),
    JSON.stringify(payload, null, 2),
  );
} catch {
  // non-fatal in restricted envs
}

if (ciMode) {
  if (criticalFailures.length) {
    console.error(
      `\ni18n CI failed: ${criticalFailures.length} critical path(s) missing localization.`,
    );
    process.exit(1);
  }
  console.log("\ni18n CI passed (critical paths OK).");
  process.exit(0);
}

if (failOnGaps && gaps.length) process.exit(1);
if (criticalOnly && criticalFailures.length) process.exit(1);
