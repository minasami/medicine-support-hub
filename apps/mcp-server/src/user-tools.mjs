/**
 * OAuth-protected MCP tools bound to Appwrite user id.
 */
import { authRequiredResult } from "./auth-context.mjs";
import {
  createSupportRequest,
  listMyOpenRequests,
  submitPrescriptionRequest,
  submitDrugContribution,
  listMyWatchlist,
  addWatchlistItem,
  checkMyPriceAlerts,
} from "./appwrite-user.mjs";

function toolAnnotations({
  title,
  readOnlyHint = true,
  destructiveHint = false,
  openWorldHint = true,
  idempotentHint = true,
}) {
  return { title, readOnlyHint, destructiveHint, openWorldHint, idempotentHint };
}

const OAUTH2 = [{ type: "oauth2", scopes: ["msh:user"] }];

export const USER_TOOLS = [
  {
    name: "whoami",
    annotations: toolAnnotations({ title: "Who am I", openWorldHint: false, readOnlyHint: true }),
    securitySchemes: OAUTH2,
    description: "Return the signed-in Medicine Support Hub (Appwrite) user bound to the MCP access token.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "submit_support_request",
    annotations: toolAnnotations({
      title: "Submit support request",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: false,
    }),
    securitySchemes: OAUTH2,
    description:
      "Submit a medicine support / NGO-style request for the signed-in user (Appwrite mcp_support_requests). Not the legacy Supabase org workspace table.",
    inputSchema: {
      type: "object",
      properties: {
        medicine_summary: { type: "string", description: "Medicines / need summary" },
        clinical_notes: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"], default: "normal" },
        requested_months: { type: "number" },
        estimated_monthly_cost: { type: "number" },
        contact_phone: { type: "string" },
        city: { type: "string" },
      },
      required: ["medicine_summary"],
    },
  },
  {
    name: "list_my_requests",
    annotations: toolAnnotations({ title: "List my open requests", readOnlyHint: true, openWorldHint: false }),
    securitySchemes: OAUTH2,
    description:
      "List the signed-in user's open support requests, prescriptions, and pending drug contributions.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
    },
  },
  {
    name: "submit_prescription_request",
    annotations: toolAnnotations({
      title: "Submit prescription / pharmacy negotiation",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: false,
    }),
    securitySchemes: OAUTH2,
    description:
      "Start a prescription → pharmacy negotiation record. Accepts text summary and optional Appwrite storage file id/url. Binary upload is not required in v1; deep-link to /rx/upload is returned.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        text: { type: "string" },
        image_id: { type: "string", description: "Appwrite storage file id" },
        image_url: { type: "string" },
        storage_file_id: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              drug_name: { type: "string" },
              name: { type: "string" },
              dose: { type: "string" },
              frequency: { type: "string" },
              duration: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "submit_drug_contribution",
    annotations: toolAnnotations({
      title: "Submit drug / catalog contribution",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: false,
    }),
    securitySchemes: OAUTH2,
    description: "Submit a barcode wiki / catalog contribution to drug_contributions.",
    inputSchema: {
      type: "object",
      properties: {
        barcode: { type: "string" },
        kind: { type: "string", enum: ["link_barcode", "create_product"], default: "create_product" },
        medicine_id: { type: "string" },
        canonical_id: { type: "number" },
        name_en: { type: "string" },
        name_ar: { type: "string" },
        manufacturer: { type: "string" },
        scientific_name: { type: "string" },
        notes: { type: "string" },
      },
      required: ["barcode"],
    },
  },
  {
    name: "list_my_watchlist",
    annotations: toolAnnotations({ title: "List my watchlist", readOnlyHint: true, openWorldHint: false }),
    securitySchemes: OAUTH2,
    description: "List the signed-in user's account-scoped price watchlist (user_watchlist).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, default: 30 } },
    },
  },
  {
    name: "add_watchlist_item",
    annotations: toolAnnotations({
      title: "Add watchlist item",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: false,
    }),
    securitySchemes: OAUTH2,
    description: "Add a medicine to the signed-in user's price watchlist.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        medicine_id: { type: "string" },
        canonical_id: { type: "number" },
        name_en: { type: "string" },
        name_ar: { type: "string" },
        target_price_egp: { type: "number" },
      },
    },
  },
  {
    name: "check_my_price_alerts",
    annotations: toolAnnotations({ title: "Check my price alerts", readOnlyHint: true, openWorldHint: true }),
    securitySchemes: OAUTH2,
    description: "Compare the account watchlist to current catalog prices (not live pharmacy shelves).",
    inputSchema: { type: "object", properties: {} },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj };
}

export async function callUserTool(name, args = {}, user) {
  if (!user?.userId) return authRequiredResult();

  switch (name) {
    case "whoami":
      return textResult({
        user_id: user.userId,
        email: user.email,
        name: user.name,
        scope: user.scope,
        client_id: user.clientId,
      });
    case "submit_support_request":
      return textResult(await createSupportRequest(user, args));
    case "list_my_requests":
      return textResult(await listMyOpenRequests(user, args));
    case "submit_prescription_request":
    case "start_pharmacy_negotiation":
      return textResult(await submitPrescriptionRequest(user, args));
    case "submit_drug_contribution":
      return textResult(await submitDrugContribution(user, args));
    case "list_my_watchlist":
      return textResult(await listMyWatchlist(user, args));
    case "add_watchlist_item":
      return textResult(await addWatchlistItem(user, args));
    case "check_my_price_alerts":
      return textResult(await checkMyPriceAlerts(user));
    default:
      return null;
  }
}

export const USER_TOOL_NAMES = new Set(USER_TOOLS.map((t) => t.name).concat(["start_pharmacy_negotiation"]));
