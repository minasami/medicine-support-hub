#!/usr/bin/env node
/**
 * Patch entity-detail.tsx to use company-profile-fallbacks for Eva/Soul
 * and to build a minimal entity when dataset products exist.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("apps/web/src/pages/entity-detail.tsx");
if (!existsSync(path)) {
  console.error("Run from repo root");
  process.exit(1);
}

let src = readFileSync(path, "utf8");
if (src.includes("company-profile-fallbacks")) {
  console.log("Already wired");
  process.exit(0);
}

// 1. Import helpers
src = src.replace(
  `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";`,
  `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";
import {
  getFallbackOfficialProfile,
  getFallbackSourceProfile,
  isEvaPharmaSlug,
  preferredCompanySlug,
} from "@/lib/company-profile-fallbacks";`,
);

// 2. Replace Soul-only source fallback block
const sourceBlock = `if (!source && resolvedSlug.includes("soulpharma")) {
            source = {
              id: "soulpharma_source_profile",
              company_name: "Soul Pharma",
              company_slug: resolvedSlug,
              origin: "Egypt",
              source_name: "EDA Tariff & Verified Industry Network",
              source_currency: "EGP",
              product_count: 12,
              active_product_count: 12,
              archived_product_count: 0,
              prescription_product_count: 8,
              disease_area_count: 5,
              generic_count: 7,
              min_price: 15,
              max_price: 280,
              therapeutic_areas: ["Cardiology", "Antibiotics", "Analgesics", "Dermatology"],
              leading_generics: ["Paracetamol", "Amoxicillin", "Omeprazole"],
              portfolio_sample: ["Soul Pharma Formulations"],
              dataset_metadata: null,
              latest_source_update: new Date().toISOString(),
            };
          }`;

const sourceReplacement = `if (!source) {
            const fb = getFallbackSourceProfile(resolvedSlug);
            if (fb) source = fb as CompanyProfile;
          }`;

if (!src.includes(sourceBlock)) {
  console.error("Could not find Soul source fallback block");
  process.exit(1);
}
src = src.replace(sourceBlock, sourceReplacement);

// 3. Replace Soul-only official fallback
const officialStart = `if (!official && resolvedSlug.includes("soulpharma")) {`;
const officialIdx = src.indexOf(officialStart);
if (officialIdx < 0) {
  console.error("Could not find Soul official fallback");
  process.exit(1);
}
// Find matching closing of this if block - next "          }\n\n          // Merge live"
const officialEndMarker = `          }\n\n          // Merge live representative updates`;
const officialEnd = src.indexOf(officialEndMarker, officialIdx);
if (officialEnd < 0) {
  console.error("Could not find end of official fallback");
  process.exit(1);
}
src =
  src.slice(0, officialIdx) +
  `if (!official) {
            const fbOfficial = getFallbackOfficialProfile(resolvedSlug);
            if (fbOfficial) official = fbOfficial as OfficialProfile;
          }

          // Merge live representative updates` +
  src.slice(officialEnd + officialEndMarker.length - "// Merge live representative updates".length);

// 4. Improve nextEntity name when fallbacks present (already uses official || source)
// Prefer preferred slug for Eva
src = src.replace(
  `const cleanRouteSlug = cleanCompanyRouteSlug(resolvedSlug) || resolvedSlug;`,
  `const cleanRouteSlug =
            preferredCompanySlug(resolvedSlug) ||
            cleanCompanyRouteSlug(resolvedSlug) ||
            resolvedSlug;`,
);

// 5. In dataset portfolio filter, treat eva-pharma like soul
src = src.replace(
  `if (targetCompanyKey === "soulpharma") {
                return mfgKey === "soulpharma" || tmKey === "soulpharma" || (cid >= 80001 && cid <= 80005);
              }`,
  `if (targetCompanyKey === "soulpharma") {
                return mfgKey === "soulpharma" || tmKey === "soulpharma" || (cid >= 80001 && cid <= 80005);
              }

              if (targetCompanyKey === "evapharma" || isEvaPharmaSlug(companySlug)) {
                return (
                  mfgKey.includes("eva") ||
                  tmKey.includes("eva") ||
                  mfgKey.includes("evapharma") ||
                  tmKey.includes("evapharma") ||
                  String(m.raw_manufacturer || m.manufacturer || "")
                    .toLowerCase()
                    .includes("eva")
                );
              }`,
);

// 6. Fix default company_name in dataset mapping when slug is eva
src = src.replace(
  `company_name: m.raw_manufacturer || m.manufacturer || "SOUL PHARMA",`,
  `company_name:
                m.raw_manufacturer ||
                m.manufacturer ||
                (isEvaPharmaSlug(companySlug) ? "EVA Pharma" : "Company"),`,
);

writeFileSync(path, src);
console.log("Patched", path);
