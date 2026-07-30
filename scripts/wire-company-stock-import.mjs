#!/usr/bin/env node
/** Patch account.tsx to render CompanyStockCsvImport for verified reps. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("apps/web/src/pages/account.tsx");
if (!existsSync(path)) {
  console.error("Run from repo root");
  process.exit(1);
}
let src = readFileSync(path, "utf8");
if (src.includes("CompanyStockCsvImport")) {
  console.log("Already wired");
  process.exit(0);
}
src = src.replace(
  'import { CompanyMedicineAdditionForm } from "@/components/company-medicine-addition-form";',
  `import { CompanyMedicineAdditionForm } from "@/components/company-medicine-addition-form";\nimport { CompanyStockCsvImport } from "@/components/company-stock-csv-import";`,
);
src = src.replace(
  "<CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />",
  `<CompanyStockCsvImport\n            companySlug={repMembership.companySlug}\n            companyName={repMembership.companyName}\n            defaultOrgCode={repMembership.companyName?.toUpperCase().includes("EVA") ? "EVA" : undefined}\n          />\n          <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />`,
);
if (!src.includes("CompanyStockCsvImport")) {
  console.error("Patch failed");
  process.exit(1);
}
writeFileSync(path, src);
console.log("Patched", path);
