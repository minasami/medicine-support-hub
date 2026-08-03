#!/usr/bin/env node
/**
 * Parse Egyptian MOH / EDA official tariff CSV into JSON.
 *
 * Usage:
 *   node scripts/parse-moh-eda-tariff.mjs --input path/to/tariff.csv
 *   node scripts/parse-moh-eda-tariff.mjs --input ... --out scripts/reports/moh-eda-tariff.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function argValue(flag, fallback = "") {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function stripBom(s) {
  return String(s || "").replace(/^\uFEFF/, "");
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lines.length) return [];
  const header = splitCsvLine(stripBom(lines[0])).map((h) => stripBom(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = splitCsvLine(lines[i]);
    const row = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = cols[c] ?? "";
    rows.push(row);
  }
  return rows;
}

const ALIASES = {
  name_en: [
    "trade name",
    "english name",
    "product name",
    "name_en",
    "name en",
    "الاسم الانجليزي",
    "الاسم الإنجليزي",
    "medicine name",
  ],
  name_ar: [
    "arabic name",
    "name_ar",
    "name ar",
    "الاسم العربي",
    "الاسم التجاري",
  ],
  scientific_name: [
    "scientific name",
    "generic",
    "generic name",
    "active ingredient",
    "المادة الفعالة",
    "scientific",
  ],
  price: [
    "price",
    "tariff",
    "official price",
    "public price",
    "retail price",
    "السعر",
    "السعر الرسمي",
    "سعر",
    "price_egp",
  ],
  manufacturer: [
    "manufacturer",
    "company",
    "company name",
    "الشركة",
    "الشركة المصنعة",
  ],
  strength: ["strength", "التركيز", "concentration"],
  pack: ["pack", "pack size", "العبوة", "package"],
  reg_no: [
    "registration",
    "reg no",
    "reg_no",
    "registration number",
    "رقم التسجيل",
  ],
};

function normHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(row, logical) {
  const keys = Object.keys(row);
  const aliases = ALIASES[logical] || [];
  for (const k of keys) {
    const nk = normHeader(k);
    if (aliases.includes(nk)) return String(row[k] || "").trim();
  }
  // partial contains
  for (const k of keys) {
    const nk = normHeader(k);
    for (const a of aliases) {
      if (nk.includes(a) || a.includes(nk)) return String(row[k] || "").trim();
    }
  }
  return "";
}

function parsePrice(raw) {
  const s = String(raw || "")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectScript(name) {
  if (/[\u0600-\u06FF]/.test(String(name || ""))) return "ar";
  return "en";
}

function main() {
  const input = argValue("--input") || argValue("-i");
  const out =
    argValue("--out") || path.join(root, "scripts/reports/moh-eda-tariff.json");
  const version = argValue("--version") || path.basename(input || "unknown");

  if (!input || !fs.existsSync(input)) {
    console.error("Usage: node scripts/parse-moh-eda-tariff.mjs --input tariff.csv");
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(input, "utf8"));
  const products = [];
  const seen = new Set();
  let withPrice = 0;

  for (const r of rows) {
    let nameEn = pick(r, "name_en");
    let nameAr = pick(r, "name_ar");
    if (!nameEn && !nameAr) {
      // single name column fallback
      const anyName =
        pick(r, "name_en") ||
        Object.entries(r).find(([k]) => /name|اسم/i.test(k))?.[1] ||
        "";
      const n = String(anyName).trim();
      if (!n) continue;
      if (detectScript(n) === "ar") nameAr = n;
      else nameEn = n;
    }

    const price = parsePrice(pick(r, "price"));
    if (!price && !nameEn && !nameAr) continue;

    const display = nameEn || nameAr;
    const key = `${String(display).toLowerCase()}|${price || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (price) withPrice += 1;

    products.push({
      name_en: nameEn || null,
      name_ar: nameAr || null,
      display_name: display,
      scientific_name: pick(r, "scientific_name") || null,
      manufacturer: pick(r, "manufacturer") || null,
      strength: pick(r, "strength") || null,
      pack: pick(r, "pack") || null,
      registration_no: pick(r, "reg_no") || null,
      official_tariff_egp: price,
      source: "moh_eda_tariff",
      tariff_list_version: version,
    });
  }

  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: "moh_eda_tariff",
    tariff_list_version: version,
    input: path.basename(input),
    stats: {
      raw_rows: rows.length,
      unique_products: products.length,
      with_price: withPrice,
    },
    products,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${out}`);
  console.log(JSON.stringify(payload.stats, null, 2));
}

main();
