#!/usr/bin/env node
/** Insert MappingAccuracyDashboard route into App.tsx if missing. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/web/src/App.tsx");
let src = fs.readFileSync(appPath, "utf8");

if (src.includes("MappingAccuracyDashboard")) {
  console.log("Route already present");
  process.exit(0);
}

const lazyImport = `const MappingAccuracyDashboard = lazy(
  () => import("@/pages/mapping-accuracy-dashboard"),
);
`;

if (!src.includes("const BarcodeScanPage")) {
  console.error("Could not find BarcodeScanPage anchor");
  process.exit(1);
}
src = src.replace(
  `const BarcodeScanPage = lazy(() => import("@/pages/barcode-scan"));`,
  `const BarcodeScanPage = lazy(() => import("@/pages/barcode-scan"));
${lazyImport}`,
);

const routeLine = `        <Route path="/admin/mapping-accuracy" component={MappingAccuracyDashboard} />
`;
if (!src.includes('path="/admin/medicine-enrichment"')) {
  console.error("Could not find medicine-enrichment route anchor");
  process.exit(1);
}
src = src.replace(
  `        <Route
          path="/admin/medicine-enrichment"
          component={MedicineEnrichmentAdmin}
        />`,
  `        <Route
          path="/admin/medicine-enrichment"
          component={MedicineEnrichmentAdmin}
        />
${routeLine}`,
);

fs.writeFileSync(appPath, src);
console.log("Wired /admin/mapping-accuracy into App.tsx");
