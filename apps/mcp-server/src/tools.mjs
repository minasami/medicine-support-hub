import { estimateCost, getMedicine, searchMedicines, listPopular, DISCLAIMER_AR, DISCLAIMER_EN } from "./catalog.mjs";
import {
  listPayers,
  explainBenefitTerms,
  estimatePatientShare,
  checkFormularyHint,
  draftPreauthChecklist,
  INSURANCE_DISCLAIMER_EN,
  INSURANCE_DISCLAIMER_AR,
} from "./insurance.mjs";
import { partnerStatus, partnerCoverageProbe } from "./partner.mjs";
import { listPriceSources, compareInnPrices } from "./price-compare.mjs";

export const SERVER_INFO = { name: "medicine-support-hub", version: "0.2.2" };
export const INSTRUCTIONS = [
  "Medicine Support Hub provides Egyptian medicine catalog search, indicative EGP cost estimates, same-INN price comparisons, and generic insurance HINTS.",
  "Always include tool disclaimers when discussing prices or coverage.",
  "Never invent a price if unit_egp or current_price_egp is null.",
  "INN alternatives are other catalog brands, not competitor pharmacy shelf prices.",
  "Never present insurance hints as eligibility, pre-authorization, a claim decision, or a pharmacy quote.",
  "Never send national IDs, policy numbers, or card numbers through these tools.",
  "Prefer confirming pack/strength when multiple products match.",
].join(" ");

export const TOOLS = [
  {
    name: "search_medicines",
    description: "Search the Medicine Support Hub Egyptian catalog by brand, Arabic name, or scientific name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_medicine",
    description: "Get one catalog product by canonical_id or document id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "estimate_cost",
    description: "Estimate indicative total cost in EGP for a list of medicines. Always show the returned disclaimer.",
    inputSchema: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: { type: "string" },
              canonical_id: { type: ["string", "number"] },
              quantity: { type: "number", minimum: 1, default: 1 },
            },
          },
        },
        locale: { type: "string", enum: ["ar", "en"], default: "ar" },
      },
      required: ["lines"],
    },
  },
  {
    name: "list_popular_medicines",
    description: "Starter list of commonly searched Egyptian pharmacy brands.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_disclaimer",
    description: "Official price and insurance-hint disclaimers in Arabic and English.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_price_sources",
    description: "Which price sources are live. Does not scrape competitor pharmacy websites.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "compare_inn_prices",
    description: "Compare catalog prices of other brands with the same scientific name. Not live competitor shelf prices.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        canonical_id: { type: ["string", "number"] },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
    },
  },
  {
    name: "list_payers",
    description: "List generic Egypt payer templates (self-pay, UHIA, private medical, employer TPA). Not a live insurer directory.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "explain_benefit_terms",
    description: "Explain typical outpatient medicine copay and cap for a payer template. Not the member's real policy.",
    inputSchema: {
      type: "object",
      properties: {
        payer_id: { type: "string", enum: ["self_pay", "uhia", "private_medical", "employer_tpa"], default: "private_medical" },
      },
    },
  },
  {
    name: "estimate_patient_share",
    description: "Apply a template copay to a catalog price. Result is a hint, not adjudication.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        canonical_id: { type: ["string", "number"] },
        quantity: { type: "number", minimum: 1, default: 1 },
        payer_id: { type: "string", enum: ["self_pay", "uhia", "private_medical", "employer_tpa"], default: "private_medical" },
      },
    },
  },
  {
    name: "check_formulary_hint",
    description: "Local coverage hint (outpatient / chronic / prior-auth typical / excluded / unknown). Not a TPA formulary check.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        scientific_name: { type: "string" },
        category: { type: "string" },
      },
    },
  },
  {
    name: "draft_preauth_checklist",
    description: "Documents usually needed for a medicine pre-auth request in Egypt. Does not submit anything.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        payer_id: { type: "string", enum: ["self_pay", "uhia", "private_medical", "employer_tpa"], default: "private_medical" },
      },
    },
  },
  {
    name: "partner_status",
    description: "Whether a partner TPA endpoint is configured. Does not check a member.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "partner_coverage_probe",
    description: "Product-only coverage probe. Refuses national ID / policy / member / card numbers. Falls back to local hints if no TPA is configured.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        scientific_name: { type: "string" },
        canonical_id: { type: ["string", "number"] },
        payer_id: { type: "string", enum: ["self_pay", "uhia", "private_medical", "employer_tpa"], default: "private_medical" },
      },
    },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj };
}

export async function callTool(name, args = {}) {
  switch (name) {
    case "search_medicines": {
      const items = await searchMedicines(args.query, args.limit);
      return textResult({ query: args.query, count: items.length, items, disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    }
    case "get_medicine": {
      const item = await getMedicine(args.id);
      return textResult({ found: Boolean(item), item, disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    }
    case "estimate_cost":
      return textResult(await estimateCost(args.lines || []));
    case "list_popular_medicines":
      return textResult({ items: await listPopular(), disclaimer_en: DISCLAIMER_EN, disclaimer_ar: DISCLAIMER_AR });
    case "get_disclaimer":
      return textResult({
        disclaimer_en: DISCLAIMER_EN,
        disclaimer_ar: DISCLAIMER_AR,
        insurance_disclaimer_en: INSURANCE_DISCLAIMER_EN,
        insurance_disclaimer_ar: INSURANCE_DISCLAIMER_AR,
        site: process.env.PUBLIC_SITE_URL || "https://medicinesupport.app",
      });
    case "list_price_sources":
      return textResult(listPriceSources());
    case "compare_inn_prices":
      return textResult(await compareInnPrices(args));
    case "list_payers":
      return textResult(listPayers());
    case "explain_benefit_terms":
      return textResult(explainBenefitTerms(args.payer_id));
    case "estimate_patient_share":
      return textResult(
        await estimatePatientShare(args, async ({ query, canonical_id }) => {
          if (canonical_id) return getMedicine(canonical_id);
          if (query) {
            const hits = await searchMedicines(query, 1);
            return hits[0] || null;
          }
          return null;
        }),
      );
    case "check_formulary_hint":
      return textResult(checkFormularyHint(args));
    case "draft_preauth_checklist":
      return textResult(draftPreauthChecklist(args));
    case "partner_status":
      return textResult(partnerStatus());
    case "partner_coverage_probe":
      return textResult(await partnerCoverageProbe(args));
    default:
      throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32601 });
  }
}
