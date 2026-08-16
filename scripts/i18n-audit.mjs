#!/usr/bin/env node
/**
 * Medicine Support Hub — Arabic i18n audit pipeline
 *
 * Scans apps/web/src for pages/components that still lack useLanguage / t().
 * Usage:
 *   node scripts/i18n-audit.mjs
 *   node scripts/i18n-audit.mjs --json
 *   node scripts/i18n-audit.mjs --fail   # exit 1 if gaps remain (CI)
 *
 * Pipeline model (manual or CI):
 *   1. Run this audit → list files missing i18n
 *   2. Localize UI chrome with t("English", "العربية")
 *   3. Re-run until exit 0
 *   4. Optional: pair with Grok/agent skill "arabic-i18n" for batch rewrites
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

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const failOnGaps = args.has("--fail");

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
  // Heuristic: JSX text / quoted Title Case UI without nearby t(
  const hardUi = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*import\s|from\s+["']|className=|type\s|interface\s|console\./.test(line))
      continue;
    if (/\bt\s*\(/.test(line)) continue;
    const m = line.match(/>\s*([A-Z][A-Za-z0-9 ,.'%/\-]{6,80})\s*</);
    if (m) hardUi.push({ line: i + 1, sample: m[1].slice(0, 80) });
    const q = line.match(/(?:title|label|placeholder|description|children)\s*[:=]\s*["']([A-Z][^"']{8,})["']/i);
    if (q) hardUi.push({ line: i + 1, sample: q[1].slice(0, 80) });
  }
  const needsWork = !hasUseLanguage || (hasUseLanguage && tCalls < 3 && hardUi.length > 2);
  return {
    file: rel,
    hasUseLanguage,
    tCalls,
    hardUiSamples: hardUi.slice(0, 8),
    hardUiCount: hardUi.length,
    needsWork,
  };
}

const files = SCAN_ROOTS.flatMap((r) => walk(r));
const reports = files.map(analyze).sort((a, b) => Number(b.needsWork) - Number(a.needsWork) || a.file.localeCompare(b.file));
const gaps = reports.filter((r) => r.needsWork);
const ok = reports.filter((r) => !r.needsWork);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        scanned: reports.length,
        localized: ok.length,
        gaps: gaps.length,
        items: gaps,
      },
      null,
      2,
    ),
  );
} else {
  console.log("Arabic i18n audit — Medicine Support Hub");
  console.log(`Scanned: ${reports.length} files`);
  console.log(`OK (useLanguage + light chrome): ${ok.length}`);
  console.log(`Gaps: ${gaps.length}`);
  console.log("");
  if (gaps.length) {
    console.log("Priority gaps (missing or thin i18n):");
    for (const g of gaps.slice(0, 60)) {
      console.log(
        `  - ${g.file}  useLanguage=${g.hasUseLanguage} t()≈${g.tCalls} hardUI≈${g.hardUiCount}`,
      );
      for (const s of g.hardUiSamples.slice(0, 2)) {
        console.log(`      L${s.line}: ${s.sample}`);
      }
    }
    if (gaps.length > 60) console.log(`  … +${gaps.length - 60} more`);
  }
  console.log("\nNext: localize with t(\"EN\", \"AR\") then re-run. CI: --fail");
}

if (failOnGaps && gaps.length) process.exit(1);
