#!/usr/bin/env node
/**
 * Validate a pharmaceutical donation CSV against the donation exchange schema.
 *
 * Usage:
 *   node scripts/validate-donation-csv.mjs [path/to/file.csv]
 *   pnpm run validate:donation-csv -- path/to/file.csv
 *
 * Defaults to scripts/fixtures/donation-ngo-sample.csv
 * Exit 0 if all data rows are valid; exit 1 if any errors or missing columns.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDonationCsv,
  summarizeParse,
} from "./lib/donation-csv-parser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultFixture = join(__dirname, "fixtures", "donation-ngo-sample.csv");

const args = process.argv.slice(2).filter((a) => a !== "--");
const csvPath = resolve(args[0] || defaultFixture);
const jsonOut = args.includes("--json");

if (!existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

const text = readFileSync(csvPath, "utf8");
const result = parseDonationCsv(text);
const summary = summarizeParse(result);

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        file: csvPath,
        summary,
        errors: result.errors.map((e) => ({
          row: e.row_index,
          error: e.error,
          item_code: e.item_code,
          lot_no: e.lot_no,
        })),
        sampleValid: result.valid.slice(0, 3),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\nDonation CSV validation: ${csvPath}\n`);
  console.log(`  Headers mapped : ${summary.mappedColumns.join(", ") || "(none)"}`);
  if (summary.missingRequiredColumns.length) {
    console.log(`  MISSING columns: ${summary.missingRequiredColumns.join(", ")}`);
  }
  console.log(`  Data rows      : ${summary.totalRows}`);
  console.log(`  Valid          : ${summary.validRows}`);
  console.log(`  Errors         : ${summary.errorRows}`);
  console.log(`  Total units    : ${summary.totalUnits.toLocaleString()}`);
  console.log(`  Total value    : ${summary.totalValueEgp.toLocaleString()} EGP`);
  console.log(`  Near-expire    : ${summary.nearExpireCount}`);

  if (result.errors.length) {
    console.log("\n  First errors:");
    for (const e of result.errors.slice(0, 10)) {
      console.log(`    row ${e.row_index}: ${e.error}`);
    }
    if (result.errors.length > 10) {
      console.log(`    … and ${result.errors.length - 10} more`);
    }
  }

  if (result.valid.length) {
    const first = result.valid[0];
    console.log("\n  Sample valid row:");
    console.log(
      `    ${first.item_code} | ${first.item_desc.slice(0, 40)} | lot ${first.lot_no} | qty ${first.quantity_accept} | exp ${first.expiry_date.slice(0, 10)}`,
    );
  }
  console.log("");
}

const ok =
  summary.validRows > 0 &&
  summary.errorRows === 0 &&
  summary.missingRequiredColumns.length === 0;

if (!ok) {
  process.exit(1);
}
