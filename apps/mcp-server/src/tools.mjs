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
import { listPriceWatchlist, runPriceAlerts } from "./price-alerts.mjs";
import { USER_TOOLS, USER_TOOL_NAMES, callUserTool } from "./user-tools.mjs";
import { authRequiredResult } from "./auth-context.mjs";

export const SERVER_INFO = { name: "medicine-support-hub", version: "0.3.1" };
export const INSTRUCTIONS = [
  "Medicine Support Hub provides Egyptian medicine catalog search, indicative EGP cost estimates, same-INN price comparisons, catalog price alerts, and generic insurance HINTS.",
  "Public catalog tools work without login. Account tools (support requests, prescriptions, contributions, personal watchlist) require OAuth — sign in via medicinesupport.app / Google (Appwrite).",
  "Always include tool disclaimers when discussing prices or coverage.",
  "Never invent a price if unit_egp or current_price_egp is null.",
  "INN alternatives and price alerts use hub catalog snapshots, not competitor pharmacy shelf prices.",
  "Never present insurance hints as eligibility, pre-authorization, a claim decision, or a pharmacy quote.",
  "Never send national IDs, policy numbers, or card numbers through these tools.",
  "Prefer confirming pack/strength when multiple products match.",
].join(" ");

const NOAUTH = [{ type: "noauth" }];

/** OpenAI Apps / MCP clients require these hints on every tool. */
function toolAnnotations({ title, readOnlyHint = true, destructiveHint = false, openWorldHint = true, idempotentHint = true }) {
  return {
    title,
    readOnlyHint,
    destructiveHint,
    openWorldHint,
    idempotentHint,
  };
}

const PUBLIC_TOOLS = [
  {
    name: "search_medicines",
    annotations: toolAnnotations({ title: "Search medicines", openWorldHint: true }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Get medicine", openWorldHint: true }),
    securitySchemes: NOAUTH,
    description: "Get one catalog product by canonical_id or document id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "estimate_cost",
    annotations: toolAnnotations({ title: "Estimate cost", openWorldHint: true }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Popular medicines", openWorldHint: true }),
    securitySchemes: NOAUTH,
    description: "Starter list of commonly searched Egyptian pharmacy brands.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_disclaimer",
    annotations: toolAnnotations({ title: "Disclaimers", openWorldHint: false }),
    securitySchemes: NOAUTH,
    description: "Official price and insurance-hint disclaimers in Arabic and English.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_price_sources",
    annotations: toolAnnotations({ title: "Price sources", openWorldHint: false }),
    securitySchemes: NOAUTH,
    description: "Which price sources are live. Does not scrape competitor pharmacy websites.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "compare_inn_prices",
    annotations: toolAnnotations({ title: "Compare INN prices", openWorldHint: true }),
    securitySchemes: NOAUTH,
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
    name: "list_price_watchlist",
    annotations: toolAnnotations({ title: "Price watchlist", openWorldHint: false }),
    securitySchemes: NOAUTH,
    description: "Brands watched for catalog price-change alerts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "check_price_alerts",
    annotations: toolAnnotations({ title: "Check price alerts", openWorldHint: true }),
    securitySchemes: NOAUTH,
    description: "Compare the watchlist to the last catalog snapshot. Does not persist a new snapshot from MCP.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_payers",
    annotations: toolAnnotations({ title: "List payers", openWorldHint: false }),
    securitySchemes: NOAUTH,
    description: "List generic Egypt payer templates (self-pay, UHIA, private medical, employer TPA). Not a live insurer directory.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "explain_benefit_terms",
    annotations: toolAnnotations({ title: "Explain benefit terms", openWorldHint: false }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Estimate patient share", openWorldHint: true }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Formulary hint", openWorldHint: true }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Pre-auth checklist", openWorldHint: false }),
    securitySchemes: NOAUTH,
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
    annotations: toolAnnotations({ title: "Partner status", openWorldHint: false }),
    securitySchemes: NOAUTH,
    description: "Whether a partner TPA endpoint is configured. Does not check a member.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "partner_coverage_probe",
    annotations: toolAnnotations({ title: "Partner coverage probe", openWorldHint: true }),
    securitySchemes: NOAUTH,
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

export const TOOLS = [...PUBLIC_TOOLS, ...USER_TOOLS];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj };
}

export async function callTool(name, args = {}, auth = null) {
  if (USER_TOOL_NAMES.has(name)) {
    return callUserTool(name, args, auth?.user || null);
  }
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
    case "list_price_watchlist":
      return textResult(listPriceWatchlist());
    case "check_price_alerts":
      return textResult(await runPriceAlerts({ persist: false }));
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
