/**
 * Wire expandSearchQuery into fetchMedicinesPage so typos like
 * "Nortryptalin" also try "nortriptyline" + scientific_name startsWith.
 *
 *   node scripts/wire-expand-search-query.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "apps/web/src/lib/medicines-appwrite-page.ts");
let s = fs.readFileSync(p, "utf8");

if (s.includes("expandSearchQuery")) {
  console.log("Already wired");
  process.exit(0);
}

// import
if (!s.includes('from "@/lib/expand-search-query"')) {
  const anchor = 'import { Client, Databases, Query } from "appwrite";';
  if (!s.includes(anchor)) {
    console.error("import anchor missing");
    process.exit(1);
  }
  s = s.replace(
    anchor,
    anchor + '\nimport { expandSearchQuery } from "@/lib/expand-search-query";',
  );
}

// After the main FULLTEXT_SEARCH_ATTRS loop fails, before static fallback,
// try expanded terms + scientific_name startsWith.
// Find the static fallback at end of search branch.
const marker = "const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));\n      if (fb.items.length) return fb;\n      return emptyOk();";

// There may be multiple similar blocks — replace the last occurrence in search path.
// Safer: insert expansion block before first "staticPage(term" after fulltext loop.

const expandBlock = `
    // Typo / INN variants (e.g. Nortryptalin → nortriptyline)
    const variants = expandSearchQuery(term).filter((v) => v.toLowerCase() !== term.toLowerCase());
    for (const v of variants) {
      for (const attr of FULLTEXT_SEARCH_ATTRS) {
        try {
          const res = await listSafe(
            db,
            buildQueries({
              limit,
              cursorAfter: null,
              filters,
              mode: "search",
              searchAttr: attr,
              term: v,
            }),
            filters,
          );
          if (res.documents?.length) return toResult(res, limit, attr);
        } catch {
          /* next */
        }
      }
      // Prefix on scientific name / trade name (key indexes)
      for (const attr of ["scientific_name", "name_en"] as const) {
        try {
          const res = await listSafe(
            db,
            buildQueries({
              limit,
              cursorAfter: null,
              filters,
              mode: "startsWith",
              searchAttr: attr,
              term: v,
            }),
            filters,
          );
          if (res.documents?.length) return toResult(res, limit, attr);
        } catch {
          /* next */
        }
      }
    }

    const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
      if (fb.items.length) return fb;
      return emptyOk();`;

// Only replace the empty-result path after search attempts (term.length >= 3).
// Use a distinctive nearby context from the file.
const ctx = `if (res.documents?.length) return toResult(res, limit, attr);
        } catch (err) {
          lastError = err;
        }
      }

      const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));
      if (fb.items.length) return fb;
      return emptyOk();`;

// Try looser match
const idx = s.lastIndexOf(
  "const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));",
);
if (idx < 0) {
  console.error("staticPage fallback not found");
  process.exit(1);
}

// Find the block that is the search empty path (after fulltext for-loop).
// Insert expansion only once before the last staticPage in the function.
const before = s.lastIndexOf("for (const attr of FULLTEXT_SEARCH_ATTRS)");
if (before < 0) {
  console.error("FULLTEXT loop not found");
  process.exit(1);
}

// From after the fulltext loop's closing — locate staticPage after that loop
const afterLoop = s.indexOf(
  "const fb = await staticPage(term, limit, cursorAfter, Boolean(filters.medCareOnly));",
  before,
);
if (afterLoop < 0) {
  console.error("fallback after fulltext not found");
  process.exit(1);
}

const endFb = s.indexOf("return emptyOk();", afterLoop);
if (endFb < 0) {
  console.error("emptyOk not found");
  process.exit(1);
}
const end = endFb + "return emptyOk();".length;

s = s.slice(0, afterLoop) + expandBlock + s.slice(end);

fs.writeFileSync(p, s);
console.log("Wired expandSearchQuery into", p);
