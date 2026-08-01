#!/usr/bin/env node
/**
 * Parse Egyptian pharmacy price CSV → deduped product candidates.
 *
 * Usage:
 *   node scripts/parse-egyptian-pharmacy-prices.mjs --input path/to/file.csv
 *   node scripts/parse-egyptian-pharmacy-prices.mjs --input file.csv --medicines-only out/meds.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
function arg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}

const inputPath = arg("input", "");
const outPath =
  arg("out", path.join(__dirname, "reports/egyptian-pharmacy-deduped.json"));
const medsPath = arg(
  "medicines-only",
  path.join(__dirname, "reports/egyptian-pharmacy-medicines.json"),
);

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error(
    "Usage: node scripts/parse-egyptian-pharmacy-prices.mjs --input=/path/to/Items.csv",
  );
  process.exit(1);
}

const FRAGRANCE =
  /\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|perfume|parfum|cologne)\b/i;
const COSMETIC =
  /\b(shampoo|conditioner|cream|lotion|soap|deodorant|deod|sunscreen|lipstick|mascara|shower|styling|hair\s*cream|body\s*wash|face\s*wash|toner|serum|moisturi)\b/i;
const DEVICE =
  /\b(gloves|nebulizer|support|sandal|clipper|tweezers|strip|battery|brush|posture|gauze|plaster)\b/i;
const MEDICINE =
  /\b(mg|mcg|iu|tab|tabs|tablet|cap|caps|capsule|syrup|vial|amp|sachet|injection|susp|oint|drop|drops|f\.?c\.?\s*tab)\b/i;
const OFFER =
  /(\d+\s*%\s*(off|offer|discount)|offer\s*\d+|save\s*\d+|1\+1|خصم|عرض|توفير)/gi;

function clean(s) {
  return String(s || "")
    .replace(/[\x00-\x1f\x7f-\x9f\u200f\u200e]/g, "")
    .trim();
}

function parsePrice(p) {
  const t = clean(p).replace(/,/g, "").replace(/"/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normName(en) {
  let s = clean(en);
  s = s.replace(OFFER, " ");
  s = s.replace(/\$+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function classify(code, name) {
  const c = String(code || "")[0]?.toUpperCase() || "";
  if (FRAGRANCE.test(name)) return "fragrance";
  if (c === "A" || DEVICE.test(name)) return "medical_device";
  if (c === "C" || (COSMETIC.test(name) && !MEDICINE.test(name)))
    return "cosmetic";
  if (c === "M" || MEDICINE.test(name)) return "medicine";
  return "unknown";
}

function validBarcode(bc) {
  const b = clean(bc);
  if (!b) return "";
  if (b === "1000" || b === "0" || b === "1") return "";
  if (/^\d+$/.test(b) && b.length < 8) return "";
  return b;
}

function splitCsvLine(line) {
  const cells = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
      continue;
    }
    if (ch === "," && !q) {
      cells.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells;
}

const text = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const lines = text.split(/\r?\n/).filter((l) => l.trim());
if (lines.length < 2) {
  console.error("No data rows");
  process.exit(1);
}

const groups = new Map();
let raw = 0;

for (let i = 1; i < lines.length; i++) {
  const row = splitCsvLine(lines[i]);
  if (row.length < 5) continue;
  raw += 1;

  const price = parsePrice(row[0]);
  const bc = validBarcode(row[1]);
  const ar = clean(row[2]);
  const en = normName(row[3]);
  const code = clean(row[4]);
  if (!en && !ar) continue;

  const key = bc ? `bc:${bc}` : `n:${(en || ar).toUpperCase()}`;
  let g = groups.get(key);
  if (!g) {
    g = {
      name_en: en,
      name_ar: ar,
      barcode: bc || null,
      codes: new Set(),
      prices: [],
      product_type: classify(code, en),
    };
    groups.set(key, g);
  } else {
    if (en && (!g.name_en || en.length > g.name_en.length)) g.name_en = en;
    if (ar && !g.name_ar) g.name_ar = ar;
    if (bc && !g.barcode) g.barcode = bc;
  }
  if (code) g.codes.add(code);
  if (price != null && price > 0) g.prices.push(price);
}

const products = [];
const byType = {};

for (const [key, g] of groups) {
  const prices = g.prices.slice().sort((a, b) => a - b);
  const codes = [...g.codes].sort();
  const p = {
    dedupe_key: key,
    name_en: g.name_en,
    name_ar: g.name_ar,
    barcode: g.barcode,
    codes,
    code: codes[0] || null,
    product_type: g.product_type,
    price_obs: prices.length,
    min_price_egp: prices[0] ?? null,
    max_price_egp: prices.length ? prices[prices.length - 1] : null,
    median_price_egp: prices.length
      ? prices[Math.floor(prices.length / 2)]
      : null,
    current_price_egp: prices.length
      ? prices[prices.length - 1]
      : null,
  };
  products.push(p);
  byType[p.product_type] = (byType[p.product_type] || 0) + 1;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const payload = {
  generated_at: new Date().toISOString(),
  source: path.basename(inputPath),
  source_rows: raw,
  unique_products: products.length,
  by_type: byType,
  with_barcode: products.filter((p) => p.barcode).length,
  with_price: products.filter((p) => p.current_price_egp != null).length,
  products,
};
fs.writeFileSync(outPath, JSON.stringify(payload));

const meds = products.filter((p) => p.product_type === "medicine");
fs.writeFileSync(
  medsPath,
  JSON.stringify({
    generated_at: payload.generated_at,
    count: meds.length,
    products: meds,
  }),
);

console.log("=== Egyptian pharmacy prices parse ===");
console.log("Source rows:", raw);
console.log("Unique products:", products.length);
console.log("By type:", byType);
console.log("Medicines:", meds.length);
console.log("Wrote:", outPath);
console.log("Medicines:", medsPath);
