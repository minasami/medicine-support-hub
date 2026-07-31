#!/usr/bin/env node
/**
 * Cleanup fragrance / cosmetic / placeholder rows in the static encyclopedia dataset.
 *
 * Usage:
 *   node scripts/cleanup-fragrance-cosmetic-products.mjs
 *   node scripts/cleanup-fragrance-cosmetic-products.mjs --dry-run
 *   node scripts/cleanup-fragrance-cosmetic-products.mjs --write
 *
 * Reads:  apps/web/public/data/egyptian-medicines-dataset.json
 * Writes: same file (+ optional report under scripts/reports/)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const datasetPath = path.join(
  root,
  "apps/web/public/data/egyptian-medicines-dataset.json",
);
const reportDir = path.join(root, "scripts/reports");

const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--write");

const PLACEHOLDERS = new Set(
  [
    "active ingredient",
    "therapeutic category",
    "therapeutic product",
    "general medicine",
    "general therapeutics",
    "official medicine",
    "pharmaceutical industry",
    "egyptian pharmaceutical industry",
    "n/a",
    "na",
    "-",
    "—",
  ].map((s) => s.toLowerCase()),
);

function isPlaceholder(v) {
  if (v == null) return true;
  const s = String(v).trim();
  if (!s) return true;
  return PLACEHOLDERS.has(s.toLowerCase());
}

const FRAGRANCE_RE =
  /\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|eau\s*de\s*cologne|perfume|parfum|cologne|aftershave)\b/i;
const COSMETIC_RE =
  /\b(cream|lotion|shampoo|conditioner|soap|face\s*wash|body\s*wash|moisturizer|sunscreen|lipstick|mascara|deodorant|serum)\b/i;
const PERSONAL_RE = /\b(intimate\s*wash|feminine\s*wash|mouthwash|toothpaste)\b/i;
const MEDICINE_HINT =
  /\b(mg|mcg|iu|tablet|capsule|ampoule|vial|syrup|suspension|inject)\b/i;

function classify(row) {
  if (row.product_type && row.product_type !== "unknown") {
    return { product_type: row.product_type, reason: "explicit" };
  }
  const name = `${row.name_en || ""} ${row.name_ar || ""}`;
  if (FRAGRANCE_RE.test(name)) return { product_type: "fragrance", reason: "name" };
  if (PERSONAL_RE.test(name)) return { product_type: "personal_care", reason: "name" };
  if (COSMETIC_RE.test(name) && !MEDICINE_HINT.test(name))
    return { product_type: "cosmetic", reason: "name" };
  if (
    isPlaceholder(row.scientific_name) &&
    (isPlaceholder(row.drug_class) || isPlaceholder(row.category)) &&
    !MEDICINE_HINT.test(name)
  ) {
    return { product_type: "unknown", reason: "placeholders" };
  }
  return { product_type: "medicine", reason: "default" };
}

function applyCleanup(row) {
  const { product_type, reason } = classify(row);
  const before = { ...row };
  const next = { ...row, product_type };
  const changes = [];

  if (row.product_type !== product_type) {
    changes.push(`product_type: ${row.product_type || "(none)"} → ${product_type} (${reason})`);
  }

  if (isPlaceholder(row.scientific_name)) {
    next.scientific_name = null;
    changes.push("clear scientific_name placeholder");
  }
  if (isPlaceholder(row.drug_class)) {
    next.drug_class = null;
    changes.push("clear drug_class placeholder");
  }

  if (product_type === "fragrance") {
    if (isPlaceholder(row.category) || /general\s*medicine/i.test(String(row.category || ""))) {
      next.category = "Fragrance";
      changes.push("category → Fragrance");
    }
    next.has_verified_dataset = false;
    if (!row.route || /oral/i.test(String(row.route))) {
      next.route = "Topical / External";
      changes.push("route → Topical / External");
    }
    if (isPlaceholder(row.dosage_form) || /general\s*medicine|tablet/i.test(String(row.dosage_form || ""))) {
      next.dosage_form = "Spray / Bottle";
      changes.push("dosage_form → Spray / Bottle");
    }
  }

  if (product_type === "cosmetic" || product_type === "personal_care") {
    next.has_verified_dataset = false;
    if (isPlaceholder(row.category) || /general\s*medicine/i.test(String(row.category || ""))) {
      next.category = product_type === "personal_care" ? "Personal Care" : "Cosmetic";
      changes.push(`category → ${next.category}`);
    }
    if (!row.route || /oral/i.test(String(row.route))) {
      next.route = "Topical / External";
      changes.push("route → Topical / External");
    }
  }

  if (product_type !== "medicine" && next.has_verified_dataset) {
    next.has_verified_dataset = false;
    changes.push("has_verified_dataset → false");
  }

  return { next, changes, before, product_type };
}

function main() {
  if (!fs.existsSync(datasetPath)) {
    console.error("Dataset not found:", datasetPath);
    console.error("Skip write; generate report template only.");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const list = Array.isArray(raw?.medicines)
    ? raw.medicines
    : Array.isArray(raw)
      ? raw
      : [];

  const report = {
    ran_at: new Date().toISOString(),
    dry_run: dryRun,
    total_rows: list.length,
    by_type: {},
    changed: 0,
    samples: [],
  };

  const out = list.map((row) => {
    const { next, changes, product_type } = applyCleanup(row);
    report.by_type[product_type] = (report.by_type[product_type] || 0) + 1;
    if (changes.length) {
      report.changed += 1;
      if (report.samples.length < 40) {
        report.samples.push({
          canonical_id: row.canonical_id,
          name_en: row.name_en,
          product_type,
          changes,
        });
      }
    }
    return next;
  });

  console.log("=== Fragrance / cosmetic cleanup ===");
  console.log("Rows:", report.total_rows);
  console.log("Changed:", report.changed);
  console.log("By type:", report.by_type);
  console.log("Mode:", dryRun ? "DRY-RUN (pass --write to persist)" : "WRITE");

  if (report.samples.length) {
    console.log("\nSample changes:");
    for (const s of report.samples.slice(0, 15)) {
      console.log(
        `  #${s.canonical_id} ${s.name_en} → ${s.product_type}: ${s.changes.join("; ")}`,
      );
    }
  }

  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(
    reportDir,
    `fragrance-cleanup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("\nReport:", reportPath);

  if (!dryRun) {
    const payload = Array.isArray(raw?.medicines)
      ? {
          ...raw,
          last_updated: new Date().toISOString(),
          total_count: out.length,
          medicines: out,
        }
      : out;
    fs.writeFileSync(datasetPath, JSON.stringify(payload, null, 2));
    console.log("Updated dataset:", datasetPath);
  }
}

main();
