/**
 * Legacy destructive importer retained only for an audited emergency rollback.
 *
 * Usage:
 * Normal imports must use the governed medicine contribution/import workflow.
 *
 * You can also set MEDICINES_XLSX_PATH instead of passing a CLI argument.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

const destructiveOverride =
  process.env.LEGACY_MEDICINES_DESTRUCTIVE_IMPORT ===
  "I_UNDERSTAND_THIS_DELETES_THE_LEGACY_CATALOG";

if (!destructiveOverride) {
  throw new Error(
    "This legacy importer deletes and rebuilds the medicines table, so it is disabled by default. " +
      "Submit Excel/CSV datasets through the governed medicine import workflow instead. " +
      "The emergency override is reserved for an approved, backed-up rollback procedure.",
  );
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const req = createRequire(import.meta.url);
const dbReq = createRequire(resolve(rootDir, "lib/db/package.json"));

const XLSX = req("xlsx");
const { Pool } = dbReq("pg");

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

function resolveInputPath() {
  const inputPath = process.argv[2] || process.env.MEDICINES_XLSX_PATH;
  if (!inputPath) {
    throw new Error("Missing Excel path. Pass it as the first argument or set MEDICINES_XLSX_PATH.");
  }

  const absolutePath = resolve(rootDir, inputPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Excel file not found: ${absolutePath}`);
  }

  return absolutePath;
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL.");
}

const xlsxPath = resolveInputPath();
const BATCH_SIZE = 500;

console.log(`Reading Excel file: ${xlsxPath}`);
const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log(`Rows in file: ${rows.length - 1}`);

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

console.log(`Unique medicines parsed: ${medicines.length}`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  console.log("Clearing existing medicines...");
  await client.query("DELETE FROM medicines");
  await client.query("ALTER SEQUENCE medicines_id_seq RESTART WITH 1");

  console.log(`Inserting in batches of ${BATCH_SIZE}...`);
  let inserted = 0;

  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch = medicines.slice(i, i + BATCH_SIZE);
    const placeholders = [];
    const values = [];
    let idx = 1;

    for (const medicine of batch) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(medicine.name_en, medicine.name_ar, medicine.dosage_form, medicine.strength);
    }

    await client.query(
      `INSERT INTO medicines (name_en, name_ar, dosage_form, strength) VALUES ${placeholders.join(",")}`,
      values,
    );

    inserted += batch.length;
    process.stdout.write(`\r${inserted.toLocaleString()} / ${medicines.length.toLocaleString()} inserted...`);
  }

  console.log("\nImport complete.");
  const { rows: countRows } = await client.query("SELECT COUNT(*) FROM medicines");
  console.log(`Total medicines in DB: ${Number(countRows[0].count).toLocaleString()}`);
} finally {
  client.release();
  await pool.end();
}
