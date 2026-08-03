#!/usr/bin/env node
/**
 * Parse EgyptDwa medicines CSV (medicines3.csv style) into JSON.
 *
 * Columns:
 *   Category image, Category views, Category title, Medicine Name,
 *   Views, Price, Category link, Image, Medicine Name link
 *
 * Usage:
 *   node scripts/parse-egyptdwa-medicines.mjs --input path/to/medicines3.csv
 *   node scripts/parse-egyptdwa-medicines.mjs --input ... --out scripts/reports/egyptdwa-medicines.json
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

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!lines.length) return [];
  const header = splitCsvLine(stripBom(lines[0]));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const row = {};
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = cols[c] ?? "";
    }
    rows.push(row);
  }
  return rows;
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
      } else {
        inQuotes = !inQuotes;
      }
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

function firstUrl(raw) {
  const m = String(raw || "").match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[,;.]+$/, "") : "";
}

function extractEgyptDwaId(url) {
  const m = String(url || "").match(/\/m\/(\d+)/i);
  return m ? Number(m[1]) : null;
}

function detectScript(name) {
  const s = String(name || "");
  if (/[\u0600-\u06FF]/.test(s)) return "ar";
  return "en";
}

function normalizeKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const input =
    argValue("--input") ||
    argValue("-i") ||
    path.join(root, "scripts/fixtures/egyptdwa-medicines3.csv");
  const out =
    argValue("--out") ||
    path.join(root, "scripts/reports/egyptdwa-medicines.json");

  if (!fs.existsSync(input)) {
    console.error(`Input not found: ${input}`);
    console.error("Pass --input path/to/medicines3.csv");
    process.exit(1);
  }

  const text = fs.readFileSync(input, "utf8");
  const rawRows = parseCsv(text);

  const products = [];
  const seen = new Set();
  let withPrice = 0;
  let withImage = 0;

  for (const r of rawRows) {
    // Support BOM on first header
    const name = String(
      r["Medicine Name"] || r["medicine name"] || "",
    ).trim();
    if (!name) continue;

    const priceRaw = String(r["Price"] || "0").replace(/,/g, "");
    const price = Number(priceRaw);
    const image = String(r["Image"] || "").trim();
    const categoryAr = String(r["Category title"] || "").trim();
    const sourceUrl = firstUrl(r["Medicine Name link"] || "");
    const egyptdwaId = extractEgyptDwaId(sourceUrl);
    const views = Number(r["Views"] || 0) || 0;

    const key = `${normalizeKey(name)}|${egyptdwaId || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const script = detectScript(name);
    const row = {
      name_en: script === "en" ? name : null,
      name_ar: script === "ar" ? name : null,
      display_name: name,
      current_price_egp: Number.isFinite(price) && price > 0 ? price : null,
      image_url: image || null,
      category: categoryAr || null,
      category_ar: categoryAr || null,
      egyptdwa_id: egyptdwaId,
      egyptdwa_source_url: sourceUrl || null,
      category_link: String(r["Category link"] || "").trim() || null,
      views,
      source: "egyptdwa.com",
    };
    if (row.current_price_egp) withPrice += 1;
    if (row.image_url) withImage += 1;
    products.push(row);
  }

  const payload = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: "egyptdwa.com",
    input: path.basename(input),
    stats: {
      raw_rows: rawRows.length,
      unique_products: products.length,
      with_price: withPrice,
      with_image: withImage,
    },
    products,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${out}`);
  console.log(JSON.stringify(payload.stats, null, 2));
}

main();
