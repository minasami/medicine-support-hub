#!/usr/bin/env node
/** Patch entity-detail.tsx static-dataset product_url to use encyclopediaProductUrl */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("apps/web/src/pages/entity-detail.tsx");
if (!existsSync(path)) {
  console.error("Run from repo root");
  process.exit(1);
}

let src = readFileSync(path, "utf8");
if (src.includes("encyclopediaProductUrl")) {
  console.log("Already patched");
  process.exit(0);
}

src = src.replace(
  `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";`,
  `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";
import { encyclopediaProductUrl } from "@/lib/catalog-links";`,
);

const oldMap = `safeRows = matches.map((m: any) => ({
              id: String(m.canonical_id),
              product_name: m.name_en,
              product_url: \`/catalog/\${m.canonical_id}\`,
              disease_name: m.category || m.drug_class || "Pharma",
              final_price: m.current_price_egp ? Number(m.current_price_egp) : null,
              price_currency: "EGP",
              prescription_required: "yes",
              drug_variant: m.scientific_name || m.drug_class || "",
              company_name: m.raw_manufacturer || m.manufacturer || "SOUL PHARMA",
              company_slug: companySlug,
              generic_name: m.scientific_name || "",
              total_count: matches.length,
            }));`;

const newMap = `safeRows = matches.map((m: any) => ({
              id: String(m.canonical_id || m.name_en),
              product_name: m.name_en,
              product_url: encyclopediaProductUrl({
                nameEn: m.name_en,
                canonicalId: m.canonical_id,
                idSource: "static_dataset",
              }),
              disease_name: m.category || m.drug_class || "Pharma",
              final_price: m.current_price_egp ? Number(m.current_price_egp) : null,
              price_currency: "EGP",
              prescription_required: "yes",
              drug_variant: m.scientific_name || m.drug_class || "",
              company_name: m.raw_manufacturer || m.manufacturer || "Company",
              company_slug: companySlug,
              generic_name: m.scientific_name || "",
              total_count: matches.length,
            }));`;

if (!src.includes("product_url: `/catalog/${m.canonical_id}`")) {
  // try alternate formatting
  if (src.includes('product_url: `/catalog/${m.canonical_id}`')) {
    src = src.replace(
      "product_url: `/catalog/${m.canonical_id}`",
      `product_url: encyclopediaProductUrl({ nameEn: m.name_en, canonicalId: m.canonical_id, idSource: "static_dataset" })`,
    );
  } else {
    console.warn("Could not find exact product_url pattern; applying loose replace");
    src = src.replace(
      /product_url:\s*`\/catalog\/\$\{m\.canonical_id\}`/g,
      `product_url: encyclopediaProductUrl({ nameEn: m.name_en, canonicalId: m.canonical_id, idSource: "static_dataset" })`,
    );
  }
} else {
  src = src.replace(oldMap, newMap);
}

writeFileSync(path, src);
console.log("Patched", path);
