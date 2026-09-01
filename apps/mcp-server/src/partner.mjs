/**
 * Partner TPA adapter. Disabled until TPA_BASE_URL + TPA_API_KEY are set.
 * Never send national IDs, policy numbers, or card PANs from the public MCP.
 */
import { checkFormularyHint, INSURANCE_DISCLAIMER_EN, INSURANCE_DISCLAIMER_AR } from "./insurance.mjs";

const BASE = (process.env.TPA_BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.TPA_API_KEY || "";
const TIMEOUT_MS = Number(process.env.TPA_TIMEOUT_MS || 8000);

export function partnerConfigured() {
  return Boolean(BASE && KEY);
}

export function partnerStatus() {
  return {
    configured: partnerConfigured(),
    live_eligibility: false,
    accepts_member_ids: false,
    base_host: BASE ? safeHost(BASE) : null,
    note_en: partnerConfigured()
      ? "Partner endpoint is configured. Coverage probe still refuses member identifiers."
      : "No TPA_BASE_URL / TPA_API_KEY. Use local formulary hints only.",
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function rejectedIdentifier(args = {}) {
  const banned = ["national_id", "nid", "policy_number", "member_id", "card_number", "ssn"];
  return banned.find((k) => args[k]);
}

export async function partnerCoverageProbe(args = {}) {
  const bad = rejectedIdentifier(args);
  if (bad) {
    return {
      not_an_approval: true,
      rejected: true,
      reason: `Public MCP will not send ${bad} to a TPA.`,
      local_hint: checkFormularyHint(args),
      disclaimer_en: INSURANCE_DISCLAIMER_EN,
      disclaimer_ar: INSURANCE_DISCLAIMER_AR,
    };
  }

  const local = checkFormularyHint(args);
  if (!partnerConfigured()) {
    return {
      not_an_approval: true,
      partner_called: false,
      partner_configured: false,
      local_hint: local,
      disclaimer_en: INSURANCE_DISCLAIMER_EN,
      disclaimer_ar: INSURANCE_DISCLAIMER_AR,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/coverage-hint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: args.query || null,
        scientific_name: args.scientific_name || null,
        canonical_id: args.canonical_id || null,
        payer_id: args.payer_id || "private_medical",
      }),
    });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 300) };
    }
    return {
      not_an_approval: true,
      partner_called: true,
      partner_http: res.status,
      partner_body: body,
      local_hint: local,
      disclaimer_en: INSURANCE_DISCLAIMER_EN,
      disclaimer_ar: INSURANCE_DISCLAIMER_AR,
    };
  } catch (err) {
    return {
      not_an_approval: true,
      partner_called: true,
      partner_error: err.name === "AbortError" ? "timeout" : err.message || "fetch failed",
      local_hint: local,
      disclaimer_en: INSURANCE_DISCLAIMER_EN,
      disclaimer_ar: INSURANCE_DISCLAIMER_AR,
    };
  } finally {
    clearTimeout(timer);
  }
}
