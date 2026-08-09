/**
 * One-shot: wire loadCompanyPortfolio into company-medicine-addition-form.tsx
 * Run: node scripts/wire-medcare-portfolio-loader.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const formPath = path.join(
  root,
  "apps/web/src/components/company-medicine-addition-form.tsx",
);

let src = fs.readFileSync(formPath, "utf8");
if (src.includes("loadCompanyPortfolio")) {
  console.log("Already wired — nothing to do");
  process.exit(0);
}

const oldImport = `import {
  normalizeCompanySlug,
  productBelongsToCompany,
  readScopedPortfolioFromLocalStorage,
} from "@/lib/company-portfolio-scope";
import { planContributionSave } from "@/lib/company-contribution-workflow";`;

const newImport = `import {
  normalizeCompanySlug,
} from "@/lib/company-portfolio-scope";
import { planContributionSave } from "@/lib/company-contribution-workflow";
import {
  loadCompanyPortfolio,
} from "@/lib/load-company-portfolio";`;

if (!src.includes(oldImport)) {
  console.error("Import block not found — form layout changed; wire manually.");
  process.exit(1);
}
src = src.replace(oldImport, newImport);

const start = src.indexOf("  const loadPortfolio = useCallback(async () => {");
const end = src.indexOf("  useEffect(() => {\n    void loadPortfolio();\n  }, [loadPortfolio]);");
if (start < 0 || end < 0) {
  console.error("loadPortfolio block markers not found");
  process.exit(1);
}

const replacement = `  const loadPortfolio = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoadingPortfolio(true);
      const result = await loadCompanyPortfolio({
        companySlug,
        companyName,
        userEmail: session.user.email,
      });
      setActiveProfile({
        id: result.resolvedSlug,
        organization_id: \`org_\${result.resolvedSlug}\`,
        company_slug: result.resolvedSlug,
        display_name: result.resolvedName,
      });
      setPortfolio(result.products as MedicineProduct[]);
      if (result.source === "appwrite_medcare") {
        setExistingTollManufacturers(["Med-Care"]);
      }
    } catch (e) {
      console.error("Error loading portfolio:", e);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [session?.user, companySlug, companyName]);

`;

src = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(formPath, src);
console.log("Wired loadCompanyPortfolio into", formPath);
