/**
 * Lightweight schema checks for Node CLI (no Zod dependency).
 * Mirrors apps/web/src/lib/donation-schema.ts rules used at import time.
 */

export function validateParsedRow(row) {
  const problems = [];
  if (!row || typeof row !== "object") {
    return ["row is not an object"];
  }
  if (!String(row.item_code || "").trim()) problems.push("item_code required");
  if (!String(row.item_desc || "").trim()) problems.push("item_desc required");
  if (!String(row.lot_no || "").trim()) problems.push("lot_no required");
  if (!String(row.expiry_date || "").trim()) problems.push("expiry_date required");
  const qty = Number(row.quantity_accept);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    problems.push("quantity_accept must be positive integer");
  }
  const price = Number(row.list_price_egp ?? 0);
  if (!Number.isFinite(price) || price < 0) {
    problems.push("list_price_egp must be >= 0");
  }
  if (String(row.item_code || "").length > 64) problems.push("item_code max 64");
  if (String(row.item_desc || "").length > 512) problems.push("item_desc max 512");
  if (String(row.lot_no || "").length > 64) problems.push("lot_no max 64");
  return problems;
}

export function validateImportPayload(payload) {
  const problems = [];
  if (!payload || typeof payload !== "object") return ["payload required"];
  if (!String(payload.orgId || "").trim()) problems.push("orgId required");
  if (!String(payload.title || "").trim()) problems.push("title required");
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    problems.push("rows must be a non-empty array");
  }
  return problems;
}

export function validateRequestPayload(payload) {
  const problems = [];
  if (!payload || typeof payload !== "object") return ["payload required"];
  if (!String(payload.requesterOrgId || "").trim()) {
    problems.push("requesterOrgId required");
  }
  if (!String(payload.requestedBy || "").trim()) {
    problems.push("requestedBy required");
  }
  const qty = Number(payload.quantity);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
    problems.push("quantity must be positive integer");
  }
  const available = Number(payload.available ?? Infinity);
  if (Number.isFinite(available) && qty > available) {
    problems.push("quantity exceeds available");
  }
  return problems;
}
