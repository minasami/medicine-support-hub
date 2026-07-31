#!/usr/bin/env node
/** Insert dedicated /companies/eva-pharma route before /companies/:slug */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const appPath = resolve("apps/web/src/App.tsx");
const detailPath = resolve("apps/web/src/pages/entity-detail.tsx");

if (!existsSync(appPath)) {
  console.error("Run from repo root");
  process.exit(1);
}

let app = readFileSync(appPath, "utf8");
if (!app.includes("eva-pharma-company")) {
  app = app.replace(
    `const EntityDetail = lazy(() => import("@/pages/entity-detail"));`,
    `const EntityDetail = lazy(() => import("@/pages/entity-detail"));
const EvaPharmaCompanyPage = lazy(() => import("@/pages/eva-pharma-company"));`,
  );
  app = app.replace(
    `<Route path="/companies/:slug" component={EntityDetail} />`,
    `<Route path="/companies/eva-pharma" component={EvaPharmaCompanyPage} />
        <Route path="/companies/:slug" component={EntityDetail} />`,
  );
  writeFileSync(appPath, app);
  console.log("Patched App.tsx with /companies/eva-pharma route");
} else {
  console.log("App.tsx already has eva-pharma route");
}

// Also patch entity-detail fallbacks for other companies / slug variants
if (existsSync(detailPath)) {
  let src = readFileSync(detailPath, "utf8");
  if (!src.includes("resolvePublicCompanyProfiles") && !src.includes("getFallbackSourceProfile")) {
    src = src.replace(
      `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";`,
      `import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";
import { resolvePublicCompanyProfiles } from "@/lib/resolve-public-company";
import { matchesCompanyInDataset } from "@/lib/resolve-public-company";`,
    );

    // Make profile fetches resilient
    src = src.replace(
      `const [sourceRows, officialRows, contributionRows] =
            await Promise.all([
              supabaseFetch<CompanyProfile[]>(
                \`/rest/v1/medicine_company_profiles?select=\${sourceSelect}&company_slug=eq.\${encode(resolvedSlug)}&limit=1\`,
              ),
              supabaseFetch<OfficialProfile[]>(
                \`/rest/v1/industry_company_profiles?select=\${officialSelect}&company_slug=eq.\${encode(resolvedSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1\`,
              ),
              supabaseFetch<CompanyContribution[]>(
                \`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.\${encode(resolvedSlug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50\`,
              ),
            ]);
          let source = sourceRows[0] ?? null;
          let official = officialRows[0] ?? null;
          if (!source && resolvedSlug.includes("soulpharma")) {`,
      `let sourceRows: CompanyProfile[] = [];
          let officialRows: OfficialProfile[] = [];
          let contributionRows: CompanyContribution[] = [];
          try {
            [sourceRows, officialRows, contributionRows] = await Promise.all([
              supabaseFetch<CompanyProfile[]>(
                \`/rest/v1/medicine_company_profiles?select=\${sourceSelect}&company_slug=eq.\${encode(resolvedSlug)}&limit=1\`,
              ).catch(() => [] as CompanyProfile[]),
              supabaseFetch<OfficialProfile[]>(
                \`/rest/v1/industry_company_profiles?select=\${officialSelect}&company_slug=eq.\${encode(resolvedSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1\`,
              ).catch(() => [] as OfficialProfile[]),
              supabaseFetch<CompanyContribution[]>(
                \`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.\${encode(resolvedSlug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50\`,
              ).catch(() => [] as CompanyContribution[]),
            ]);
          } catch {
            /* profile APIs may be unavailable during migration */
          }
          let source = sourceRows[0] ?? null;
          let official = officialRows[0] ?? null;
          const resolved = resolvePublicCompanyProfiles({
            resolvedSlug,
            sourceFromDb: source,
            officialFromDb: official,
          });
          source = (resolved.source as CompanyProfile | null) || source;
          official = (resolved.official as OfficialProfile | null) || official;
          if (!source && resolvedSlug.includes("soulpharma_DISABLED")) {`,
    );

    // Dataset match helper for portfolio
    src = src.replace(
      `let matches = dataset.medicines.filter((m: any) => {
              const rawMfg = String(m.raw_manufacturer || m.manufacturer || "");
              const tm = String(m.trademark_owner || "");
              const nameEn = String(m.name_en || "");
              const cid = Number(m.canonical_id || 0);

              const mfgKey = normalizeCompanyName(rawMfg);
              const tmKey = normalizeCompanyName(tm);

              if (targetCompanyKey === "soulpharma") {
                return mfgKey === "soulpharma" || tmKey === "soulpharma" || (cid >= 80001 && cid <= 80005);
              }

              if (targetCompanyKey && targetCompanyKey !== "pharma") {
                return mfgKey.includes(targetCompanyKey) || tmKey.includes(targetCompanyKey);
              }

              return rawMfg.toLowerCase().includes(companySlug.toLowerCase());
            });`,
      `let matches = dataset.medicines.filter((m: any) =>
              matchesCompanyInDataset(companySlug, m, normalizeCompanyName),
            );`,
    );

    writeFileSync(detailPath, src);
    console.log("Patched entity-detail.tsx fallbacks");
  } else {
    console.log("entity-detail already has fallback wiring");
  }
}

console.log("Done. Commit App.tsx + eva-pharma-company.tsx (+ entity-detail if changed).");
