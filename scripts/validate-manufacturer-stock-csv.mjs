#!/usr/bin/env node
/**
 * Validate a manufacturer stock CSV (Eva Pharma format and variants).
 *
 *   node scripts/validate-manufacturer-stock-csv.mjs [path.csv]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline parser (keep in sync with apps/web/src/lib/manufacturer-stock-csv.ts)
const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function splitCsvLine(line) {
  const cells = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { cells.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  cells.push(current.trim()); return cells;
}
function parseExpiry(raw) {
  const text = String(raw||"").trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (!m) return null;
  let year = Number(m[3]); if (year < 100) year += 2000;
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined) return null;
  return new Date(Date.UTC(year, mon, Number(m[1]), 23, 59, 59)).toISOString();
}
const ALIASES = {
  "item code": "item_code", itemcode: "item_code",
  "item desc": "item_desc", description: "item_desc",
  "lot no": "lot_no", lot: "lot_no",
  "old price list": "price", "price list": "price", price: "price",
  "exp date": "expiry", "expiry date": "expiry",
  "po category": "po_category", category: "po_category",
};

const path = resolve(process.argv[2] || join(__dirname, "fixtures", "eva-pharma-stock-sample.csv"));
if (!existsSync(path)) { console.error("Not found:", path); process.exit(1); }
const text = readFileSync(path, "utf8");
const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
const headers = splitCsvLine(lines[0]).map(normalizeHeader);
const colMap = {};
headers.forEach((h, i) => { if (ALIASES[h]) colMap[i] = ALIASES[h]; });

let valid = 0, errors = 0, withPrice = 0, unique = new Set();
for (let i = 1; i < lines.length; i++) {
  const cells = splitCsvLine(lines[i]);
  const raw = {};
  cells.forEach((c, idx) => { if (colMap[idx]) raw[colMap[idx]] = c; });
  if (!raw.item_code || !raw.item_desc) { errors++; continue; }
  valid++;
  unique.add(raw.item_code);
  if (raw.price && Number(raw.price) > 0) withPrice++;
}

console.log(`\nManufacturer stock CSV: ${path}`);
console.log(`  Mapped headers : ${Object.values(colMap).join(", ")}`);
console.log(`  Valid rows     : ${valid}`);
console.log(`  Error rows     : ${errors}`);
console.log(`  Unique SKUs    : ${unique.size}`);
console.log(`  With price     : ${withPrice}\n`);
process.exit(valid > 0 && errors === 0 ? 0 : valid > 0 ? 0 : 1);
