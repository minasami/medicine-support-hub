/**
 * Imports the Egyptian Medicines Database (Excel) into the PostgreSQL medicines table.
 * Run from workspace root: node scripts/import-egyptian-medicines.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// Resolve from pnpm store directly — avoids hoisting issues
const XLSX_MOD = resolve(rootDir, "node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/xlsx.js");
const PG_MOD   = resolve(rootDir, "node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js");

const req = createRequire(import.meta.url);
const XLSX = req(XLSX_MOD);
const { Pool } = req(PG_MOD);

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseDosageForm(name) {
  const n = name.toUpperCase();
  if (/\bSUPP(OSITORY)?\b/.test(n)) return "Suppository";
  if (/\bPATCH\b/.test(n)) return "Patch";
  if (/\bLOZENGE\b/.test(n)) return "Lozenge";
  if (/\bSACHET\b/.test(n)) return "Sachet";
  if (/\bPOWDER\b/.test(n)) return "Powder";
  if (/\bVIAL\b/.test(n)) return "Vial";
  if (/\bAMP(OULE)?\b/.test(n)) return "Ampoule";
  if (/\bINJ(ECTION)?\b/.test(n)) return "Injection";
  if (/\bINFUSION\b/.test(n)) return "Infusion";
  if (/\bSYRUP\b/.test(n)) return "Syrup";
  if (/\bSUSP(ENSION)?\b/.test(n)) return "Suspension";
  if (/\bELIXIR\b/.test(n)) return "Elixir";
  if (/EYE\s+DROPS?/.test(n) || /EAR\s+DROPS?/.test(n) || /NASAL\s+DROPS?/.test(n)) return "Drops";
  if (/\bDROPS?\b/.test(n)) return "Drops";
  if (/\bSOLUTION\b/.test(n)) return "Solution";
  if (/\bSPRAY\b/.test(n)) return "Spray";
  if (/\bINHAL(ER|ATION)?\b/.test(n)) return "Inhaler";
  if (/\bOINTMENT\b/.test(n)) return "Ointment";
  if (/\bGEL\b/.test(n)) return "Gel";
  if (/\bCREAM\b/.test(n)) return "Cream";
  if (/\bLOTION\b/.test(n)) return "Lotion";
  if (/\bFOAM\b/.test(n)) return "Foam";
  if (/\bSHAMPOO\b/.test(n)) return "Shampoo";
  if (/\bCAPS?(ULE)?\b/.test(n) || /SOFT\s+GELATIN/.test(n)) return "Capsule";
  if (/\bTABLETS?\b/.test(n) || /\bTABS?\b/.test(n) || /F\.C\.[\s]?TAB/.test(n)) return "Tablet";
  return "Other";
}

function parseStrength(name) {
  const m = name.match(/(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)*\s*(?:MG\/ML|MG\/5ML|MCG\/ML|IU\/ML|MG|MCG|G\b|ML|IU|%))/i);
  return m ? m[1].trim().toUpperCase() : null;
}

function cleanArabic(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const XLSX_PATH = resolve(rootDir, "attached_assets/Egyptian_Medicines_Database_July_2026_1782125064728.xlsx");
const BATCH_SIZE = 500;

console.log("📖 Reading Excel file…");
const wb = XLSX.readFile(XLSX_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`   Rows in file: ${rows.length - 1}`);

const seen = new Set();
const medicines = [];

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const name_en = (row[3] ?? "").toString().trim();
  const name_ar = cleanArabic((row[2] ?? "").toString());
  if (!name_en || !name_ar) continue;
  const key = name_en.toUpperCase();
  if (seen.has(key)) continue;
  seen.add(key);
  medicines.push({
    name_en,
    name_ar,
    dosage_form: parseDosageForm(name_en),
    strength: parseStrength(name_en),
  });
}

console.log(`   Unique medicines parsed: ${medicines.length}`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  console.log("🗑️  Clearing existing medicines…");
  await client.query("DELETE FROM medicines");
  // Reset sequence so IDs start from 1
  await client.query("ALTER SEQUENCE medicines_id_seq RESTART WITH 1");

  console.log(`⬆️  Inserting in batches of ${BATCH_SIZE}…`);
  let inserted = 0;

  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch = medicines.slice(i, i + BATCH_SIZE);
    const placeholders = [];
    const values = [];
    let idx = 1;
    for (const m of batch) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(m.name_en, m.name_ar, m.dosage_form, m.strength);
    }
    await client.query(
      `INSERT INTO medicines (name_en, name_ar, dosage_form, strength) VALUES ${placeholders.join(",")}`,
      values
    );
    inserted += batch.length;
    process.stdout.write(`\r   ${inserted.toLocaleString()} / ${medicines.length.toLocaleString()} inserted…`);
  }

  console.log("\n✅ Import complete!");
  const { rows: cnt } = await client.query("SELECT COUNT(*) FROM medicines");
  console.log(`   Total medicines in DB: ${Number(cnt[0].count).toLocaleString()}`);
} finally {
  client.release();
  await pool.end();
}
