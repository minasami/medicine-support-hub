#!/usr/bin/env node
/**
 * One-shot patcher for local working trees.
 * Inserts provenance import + panel into medicine-detail.tsx and
 * provenance recorder into company-medicine-addition-form.tsx.
 *
 * Usage: node scripts/wire-provenance-into-pages.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const detailPath = resolve(root, "apps/web/src/pages/medicine-detail.tsx");
const formPath = resolve(
  root,
  "apps/web/src/components/company-medicine-addition-form.tsx",
);

function patchDetail(src) {
  if (src.includes("MedicineProvenancePanel")) {
    console.log("medicine-detail.tsx already wired");
    return src;
  }
  let out = src.replace(
    'import { ShareContributeActions } from "@/components/share-contribute-actions";',
    `import { ShareContributeActions } from "@/components/share-contribute-actions";
import { MedicineProvenancePanel } from "@/components/medicine-provenance-panel";`,
  );
  out = out.replace(
    `<div className="mt-4">
        <ShareContributeActions
          title={title}
          contributionUrl={\`/industry?medicine=\${product.canonical_id}#participate\`}
        />
      </div>`,
    `<div className="mt-4">
        <ShareContributeActions
          title={title}
          contributionUrl={\`/industry?medicine=\${product.canonical_id}#participate\`}
        />
      </div>
      <MedicineProvenancePanel
        canonicalId={product.canonical_id}
        hasCompanyVerifiedSource={product.has_company_verified_source}
      />`,
  );
  if (!out.includes("MedicineProvenancePanel")) {
    throw new Error("Failed to wire MedicineProvenancePanel into medicine-detail.tsx");
  }
  return out;
}

function patchForm(src) {
  if (src.includes("recordCompanyProductProvenance")) {
    console.log("company-medicine-addition-form.tsx already wired");
    return src;
  }
  let out = src.replace(
    'import { normalizeCompanyName } from "@/lib/search-engine";',
    `import { normalizeCompanyName } from "@/lib/search-engine";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";`,
  );
  const needle = `localStorage.setItem(\`medicine_update_\${productPayload.canonical_id}\`, JSON.stringify(productPayload));`;
  const insertion = `${needle}

          recordCompanyProductProvenance({
            canonicalId: Number(productPayload.canonical_id),
            isUpdate: Boolean(canonicalId),
            companyName: activeProfile?.display_name,
            companySlug: activeProfile?.company_slug || companySlug,
            actorUserId: session?.user?.id,
            actorEmail: session?.user?.email,
            productPayload: productPayload as Record<string, unknown>,
          });`;
  if (!out.includes(needle)) {
    // fallback: after setMessage success
    const alt = `setMessage(canonicalId ? \`Successfully updated \"\${medicineName.trim()}\".\` : \`Successfully published new medicine \"\${medicineName.trim()}\".\`);`;
    if (!out.includes("setMessage(canonicalId")) {
      throw new Error("Could not find insertion point in company form");
    }
    out = out.replace(
      alt,
      `recordCompanyProductProvenance({
        canonicalId: Number(productPayload.canonical_id),
        isUpdate: Boolean(canonicalId),
        companyName: activeProfile?.display_name,
        companySlug: activeProfile?.company_slug || companySlug,
        actorUserId: session?.user?.id,
        actorEmail: session?.user?.email,
        productPayload: productPayload as Record<string, unknown>,
      });
      ${alt}`,
    );
  } else {
    out = out.replace(needle, insertion);
  }
  return out;
}

if (!existsSync(detailPath) || !existsSync(formPath)) {
  console.error("Run from repository root");
  process.exit(1);
}

writeFileSync(detailPath, patchDetail(readFileSync(detailPath, "utf8")), "utf8");
console.log("Patched", detailPath);
writeFileSync(formPath, patchForm(readFileSync(formPath, "utf8")), "utf8");
console.log("Patched", formPath);
console.log("Done. Commit the two page/component files.");
