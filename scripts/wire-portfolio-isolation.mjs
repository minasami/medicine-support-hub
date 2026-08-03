#!/usr/bin/env node
/**
 * Apply portfolio isolation patches to company-medicine-addition-form.tsx
 * so Med-Care (and any non-Eva) reps cannot see/edit Eva products.
 *
 * Usage: node scripts/wire-portfolio-isolation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(
  root,
  "apps/web/src/components/company-medicine-addition-form.tsx",
);

let s = fs.readFileSync(target, "utf8");
let n = 0;

function rep(a, b, label) {
  if (!s.includes(a)) {
    console.warn("skip (not found):", label);
    return;
  }
  s = s.replace(a, b);
  n += 1;
  console.log("applied:", label);
}

rep(
  'import { normalizeCompanyName } from "@/lib/search-engine";\nimport { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";',
  `import { normalizeCompanyName } from "@/lib/search-engine";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
import {
  normalizeCompanySlug,
  productBelongsToCompany,
  readScopedPortfolioFromLocalStorage,
} from "@/lib/company-portfolio-scope";`,
  "imports",
);

rep(
  "export function CompanyMedicineAdditionForm({ companySlug }: { companySlug?: string }) {",
  "export function CompanyMedicineAdditionForm({ companySlug, companyName }: { companySlug?: string; companyName?: string }) {",
  "props",
);

rep(
  `  const loadPortfolio = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoadingPortfolio(true);
      const userEmail = (session.user.email || "").toLowerCase().trim();`,
  `  const loadPortfolio = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoadingPortfolio(true);
      const userEmail = (session.user.email || "").toLowerCase().trim();
      if (!companySlug || !normalizeCompanySlug(companySlug)) {
        setPortfolio([]);
        setLoadingPortfolio(false);
        return;
      }`,
  "hard-scope-slug",
);

// Broad includes → strict belongs
rep(
  `              if (targetKey && targetKey !== "pharma") {
                return mfgKey === targetKey || tmKey === targetKey || tollKey === targetKey || mfgKey.includes(targetKey) || tmKey.includes(targetKey);
              }`,
  `              if (targetKey && targetKey !== "pharma") {
                return productBelongsToCompany(
                  { manufacturer: rawMfg, trademark_owner: tm, toll_manufacturer: toll },
                  companySlug || detectedCompany,
                  detectedCompany,
                );
              }`,
  "strict-match",
);

rep(
  `      if (!detectedCompany || detectedCompany === "PHARMA") {
        detectedCompany = "SOUL PHARMA";
      }`,
  `      if (!detectedCompany || detectedCompany === "PHARMA") {
        detectedCompany = companyName || companySlug || "";
      }`,
  "no-soul-default",
);

// localStorage isolation marker
if (!s.includes("readScopedPortfolioFromLocalStorage")) {
  const marker = "// 4. Merge custom added & updated products from localStorage";
  const idx = s.indexOf(marker);
  if (idx >= 0) {
    const end = s.indexOf("setPortfolio(fetchedProducts);", idx);
    if (end > idx) {
      const replacement = `// 4. Merge ONLY this company's localStorage portfolio
      const scopeSlug = normalizeCompanySlug(companySlug || detectedCompany || "");
      if (scopeSlug) {
        const customList = readScopedPortfolioFromLocalStorage(scopeSlug, companyName || detectedCompany) as MedicineProduct[];
        for (const customItem of customList) {
          const existingIdx = fetchedProducts.findIndex((p) => p.canonical_id === customItem.canonical_id);
          if (existingIdx >= 0) fetchedProducts[existingIdx] = { ...fetchedProducts[existingIdx], ...customItem };
          else fetchedProducts.unshift(customItem);
        }
        fetchedProducts = fetchedProducts.filter(
          (p) =>
            productBelongsToCompany(p, scopeSlug, companyName || detectedCompany) ||
            normalizeCompanySlug((p as any).company_slug) === scopeSlug,
        );
      } else {
        fetchedProducts = [];
      }

      `;
      s = s.slice(0, idx) + replacement + s.slice(end);
      n += 1;
      console.log("applied: localStorage-scope");
    }
  }
}

rep(
  "}, [session?.user, companySlug, activeProfile?.display_name, activeProfile?.company_slug, supabaseFetch]);",
  "}, [session?.user, companySlug, companyName, activeProfile?.display_name, activeProfile?.company_slug, supabaseFetch]);",
  "deps",
);

fs.writeFileSync(target, s);
console.log(`Done. ${n} patches written to ${target}`);
