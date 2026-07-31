#!/usr/bin/env node
/**
 * Bulk scan encyclopedia products for likely image mismatches.
 *
 * Usage:
 *   node scripts/detect-image-mismatches.mjs
 *   node scripts/detect-image-mismatches.mjs --source=static
 *   node scripts/detect-image-mismatches.mjs --source=export
 *   node scripts/detect-image-mismatches.mjs --min=high --write-clear-list
 *
 * Sources:
 *   static  → apps/web/public/data/egyptian-medicines-dataset.json
 *   export  → scripts/reports/appwrite-medicines-export.json (run export first)
 *   both    → default: static if present, else export
 *
 * Output:
 *   scripts/reports/image-mismatch-report.json
 *   scripts/reports/image-clear-candidates.json  (with --write-clear-list)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const reportDir = path.join(root, "scripts/reports");
const staticPath = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);
const exportPath = path.join(reportDir, "appwrite-medicines-export.json");

const args = process.argv.slice(2);
const sourceArg =
  args.find((a) => a.startsWith("--source="))?.split("=")[1] || "auto";
const minArg =
  args.find((a) => a.startsWith("--min="))?.split("=")[1] || "medium";
const writeClear = args.includes("--write-clear-list");
const sharedThreshold = Number(
  args.find((a) => a.startsWith("--shared="))?.split("=")[1] || 8,
);

// --- heuristics (kept in sync with apps/web/src/lib/image-mismatch.ts) ---

const GENERIC_HOSTS = [
  "unsplash.com",
  "images.unsplash.com",
  "pexels.com",
  "images.pexels.com",
  "pixabay.com",
  "placeholder.com",
  "via.placeholder.com",
  "placehold.co",
  "placekitten.com",
  "loremflickr.com",
  "picsum.photos",
  "dummyimage.com",
];

const PLACEHOLDER_RE =
  /placeholder|no[_-]?image|default[_-]?med|stock[_-]?photo|generic[_-]?pill|sample[_-]?pack/i;
const PILL_IMAGE_RE =
  /\b(pill|tablet|capsule|blister|pharma[_-]?stock|medicine[_-]?bottle)\b/i;

function tokensFromName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .filter(
      (t) =>
        !["advance", "plus", "forte", "extra", "egypt", "pharma", "medical"].includes(
          t,
        ),
    );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function detect(product, sharedCounts) {
  const reasons = [];
  const details = [];
  const url = String(product.image_url || "").trim();

  if (!url) {
    return {
      severity: "low",
      reasons: ["missing_image"],
      details: ["No image_url"],
      suggest_clear_image: false,
    };
  }

  const host = hostOf(url);
  const blob = `${url} ${product.image_source_url || ""} ${product.image_source_kind || ""}`;

  if (GENERIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    reasons.push("generic_stock_host");
    details.push(`host=${host}`);
  }
  if (PLACEHOLDER_RE.test(blob)) {
    reasons.push("placeholder_pattern");
    details.push("placeholder pattern in URL/source");
  }

  const shared = sharedCounts.get(url) || 0;
  if (shared >= sharedThreshold) {
    reasons.push("shared_stock_url");
    details.push(`same image_url used by ${shared} products`);
  }

  const nameTokens = tokensFromName(product.name_en);
  if (nameTokens.length >= 2) {
    const hit = nameTokens.some((t) => url.toLowerCase().includes(t));
    if (!hit) {
      reasons.push("name_tokens_absent_from_url");
      details.push(`tokens missing from URL: ${nameTokens.slice(0, 5).join(", ")}`);
    }
  }

  if (/\bsachet/i.test(product.name_en || "") && PILL_IMAGE_RE.test(blob)) {
    reasons.push("form_vs_image_keyword_conflict");
    details.push("SACHET in name but pill/blister keywords in image URL");
  }

  if (
    product.image_authenticity_score != null &&
    Number(product.image_authenticity_score) < 40
  ) {
    reasons.push("low_authenticity_score");
    details.push(`authenticity=${product.image_authenticity_score}`);
  }
  if (
    product.image_match_score != null &&
    Number(product.image_match_score) < 40
  ) {
    reasons.push("low_match_score");
    details.push(`match=${product.image_match_score}`);
  }

  const kind = String(product.image_source_kind || "").toLowerCase();
  if (kind && /bulk|scrape|unknown|stock|import/.test(kind) && !product.image_is_verified) {
    reasons.push("unverified_bulk_image");
    details.push(`kind=${product.image_source_kind}`);
  }

  if (!reasons.length) {
    return { severity: "ok", reasons: [], details: [], suggest_clear_image: false };
  }

  let severity = "medium";
  if (
    reasons.includes("generic_stock_host") ||
    reasons.includes("placeholder_pattern") ||
    reasons.includes("form_vs_image_keyword_conflict") ||
    reasons.includes("shared_stock_url")
  ) {
    severity = "high";
  } else if (
    reasons.includes("missing_image") ||
    reasons.includes("unverified_bulk_image")
  ) {
    severity = "low";
  }

  const suggest_clear_image =
    severity === "high" ||
    reasons.includes("generic_stock_host") ||
    reasons.includes("placeholder_pattern") ||
    (reasons.includes("shared_stock_url") && shared >= sharedThreshold * 2);

  return { severity, reasons, details, suggest_clear_image };
}

function loadProducts() {
  const lists = [];

  const wantStatic =
    sourceArg === "static" ||
    sourceArg === "both" ||
    (sourceArg === "auto" && fs.existsSync(staticPath));
  const wantExport =
    sourceArg === "export" ||
    sourceArg === "both" ||
    (sourceArg === "auto" && !fs.existsSync(staticPath) && fs.existsSync(exportPath));

  if (wantStatic && fs.existsSync(staticPath)) {
    const raw = JSON.parse(fs.readFileSync(staticPath, "utf8"));
    const meds = Array.isArray(raw?.medicines)
      ? raw.medicines
      : Array.isArray(raw)
        ? raw
        : [];
    lists.push(...meds.map((m) => ({ ...m, _source: "static" })));
    console.log(`Loaded ${meds.length} from static dataset`);
  }

  if ((wantExport || sourceArg === "export") && fs.existsSync(exportPath)) {
    const raw = JSON.parse(fs.readFileSync(exportPath, "utf8"));
    const meds = Array.isArray(raw?.medicines) ? raw.medicines : [];
    lists.push(...meds.map((m) => ({ ...m, _source: "appwrite_export" })));
    console.log(`Loaded ${meds.length} from Appwrite export`);
  }

  if (!lists.length) {
    console.error(
      "No products loaded. Ensure static dataset exists or run:\n  node scripts/export-appwrite-medicines.mjs",
    );
    process.exit(1);
  }
  return lists;
}

function main() {
  const products = loadProducts();
  const sharedCounts = new Map();
  for (const p of products) {
    const url = String(p.image_url || "").trim();
    if (!url) continue;
    sharedCounts.set(url, (sharedCounts.get(url) || 0) + 1);
  }

  const rank = { ok: 0, low: 1, medium: 2, high: 3 };
  const minRank = rank[minArg] ?? 2;

  const findings = [];
  const byReason = {};
  const bySeverity = { high: 0, medium: 0, low: 0 };

  for (const p of products) {
    const result = detect(p, sharedCounts);
    if (result.severity === "ok") continue;
    if ((rank[result.severity] || 0) < minRank) continue;

    bySeverity[result.severity] = (bySeverity[result.severity] || 0) + 1;
    for (const r of result.reasons) {
      byReason[r] = (byReason[r] || 0) + 1;
    }

    findings.push({
      canonical_id: p.canonical_id ?? null,
      name_en: p.name_en || null,
      manufacturer: p.manufacturer || null,
      image_url: p.image_url || null,
      image_source_kind: p.image_source_kind || null,
      source: p._source,
      severity: result.severity,
      reasons: result.reasons,
      details: result.details,
      suggest_clear_image: result.suggest_clear_image,
    });
  }

  findings.sort((a, b) => rank[b.severity] - rank[a.severity]);

  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, "image-mismatch-report.json");
  const report = {
    generated_at: new Date().toISOString(),
    source: sourceArg,
    min_severity: minArg,
    shared_url_threshold: sharedThreshold,
    scanned: products.length,
    flagged: findings.length,
    by_severity: bySeverity,
    by_reason: byReason,
    sample_high: findings.filter((f) => f.severity === "high").slice(0, 40),
    findings,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== Image mismatch scan ===");
  console.log("Scanned:", products.length);
  console.log("Flagged:", findings.length);
  console.log("By severity:", bySeverity);
  console.log("By reason:", byReason);
  console.log("Report:", reportPath);

  if (findings.filter((f) => f.severity === "high").length) {
    console.log("\nSample HIGH findings:");
    for (const f of findings.filter((x) => x.severity === "high").slice(0, 12)) {
      console.log(
        `  #${f.canonical_id} ${f.name_en} → ${f.reasons.join(", ")}`,
      );
    }
  }

  if (writeClear) {
    const clearList = findings
      .filter((f) => f.suggest_clear_image)
      .map((f) => ({
        canonical_id: f.canonical_id,
        name_en: f.name_en,
        image_url: f.image_url,
        reasons: f.reasons,
      }));
    const clearPath = path.join(reportDir, "image-clear-candidates.json");
    fs.writeFileSync(
      clearPath,
      JSON.stringify(
        { generated_at: new Date().toISOString(), count: clearList.length, items: clearList },
        null,
        2,
      ),
    );
    console.log("Clear candidates:", clearPath, `(${clearList.length})`);
  }
}

main();
