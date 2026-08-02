import { clearFounderDraft } from "./founder-lead-draft";

/**
 * Submit "Talk to the Founder" partnership leads.
 * Tries Appwrite Cloud, then legacy Supabase, then returns a WhatsApp/email fallback.
 */

export type FounderLeadPayload = {
  contact_name: string;
  email: string;
  phone?: string | null;
  organization_name?: string | null;
  organization_type?: string | null;
  lead_type: string;
  country?: string | null;
  beneficiaries_estimate?: number | null;
  message?: string | null;
  source_path?: string | null;
  priority?: "low" | "normal" | "high";
};

export type FounderLeadResult =
  | { ok: true; channel: "appwrite" | "supabase" | "local" }
  | { ok: false; error: string; fallbackWhatsApp: string; fallbackMailto: string };

const WHATSAPP = "201284590503";
const FOUNDER_EMAIL = "mina.s.tawfik@armaniousfoundation.org";

const RATE_KEY = "msh_founder_lead_last_submit_ms";
const RATE_MS = 45_000;

export function buildWhatsAppUrl(payload: FounderLeadPayload): string {
  const lines = [
    "Hello Mina — Medicine Support Hub contact",
    `Name: ${payload.contact_name}`,
    `Email: ${payload.email}`,
    payload.phone ? `Phone: ${payload.phone}` : null,
    payload.organization_name
      ? `Org: ${payload.organization_name} (${payload.organization_type || "n/a"})`
      : null,
    `Intent: ${payload.lead_type}`,
    payload.country ? `Country: ${payload.country}` : null,
    payload.message ? `Message: ${payload.message}` : null,
    payload.source_path ? `Page: ${payload.source_path}` : null,
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function buildMailtoUrl(payload: FounderLeadPayload): string {
  const subject = encodeURIComponent(
    `[MSH] ${payload.lead_type} — ${payload.contact_name}`,
  );
  const body = encodeURIComponent(
    [
      payload.message || "",
      "",
      `— ${payload.contact_name}`,
      payload.email,
      payload.organization_name || "",
      payload.source_path ? `From: ${payload.source_path}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return `mailto:${FOUNDER_EMAIL}?subject=${subject}&body=${body}`;
}

export function priorityForLeadType(leadType: string): "low" | "normal" | "high" {
  if (leadType === "pilot" || leadType === "institutional") return "high";
  if (leadType === "support" || leadType === "other") return "low";
  return "normal";
}

function rateLimited(): boolean {
  try {
    const last = Number(localStorage.getItem(RATE_KEY) || 0);
    return Date.now() - last < RATE_MS;
  } catch {
    return false;
  }
}

function markSubmitted(): void {
  try {
    localStorage.setItem(RATE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

async function submitAppwrite(payload: FounderLeadPayload): Promise<boolean> {
  const endpoint = (
    import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
  ).replace(/\/+$/, "");
  const project = import.meta.env.VITE_APPWRITE_PROJECT_ID;
  const db = import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
  const table =
    import.meta.env.VITE_APPWRITE_FOUNDER_LEADS_TABLE || "partnership_leads";
  if (!project) return false;

  const res = await fetch(
    `${endpoint}/databases/${db}/collections/${table}/documents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": project,
      },
      body: JSON.stringify({
        documentId: "unique()",
        data: {
          contact_name: payload.contact_name,
          email: payload.email,
          phone: payload.phone || null,
          organization_name: payload.organization_name || null,
          organization_type: payload.organization_type || null,
          lead_type: payload.lead_type,
          priority: payload.priority || priorityForLeadType(payload.lead_type),
          country: payload.country || null,
          beneficiaries_estimate: payload.beneficiaries_estimate ?? null,
          message: payload.message || null,
          source_path: payload.source_path || null,
          status: "new",
        },
      }),
    },
  );
  return res.ok;
}

async function submitSupabase(payload: FounderLeadPayload): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;

  const res = await fetch(`${url}/rest/v1/partnership_leads`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      contact_name: payload.contact_name,
      email: payload.email,
      phone: payload.phone || null,
      organization_name: payload.organization_name || null,
      organization_type: payload.organization_type || null,
      lead_type: payload.lead_type,
      priority: payload.priority || priorityForLeadType(payload.lead_type),
      country: payload.country || null,
      beneficiaries_estimate: payload.beneficiaries_estimate ?? null,
      message: payload.message || null,
      source_path: payload.source_path || null,
    }),
  });
  return res.ok;
}

export async function submitFounderLead(
  payload: FounderLeadPayload,
): Promise<FounderLeadResult> {
  const fallbackWhatsApp = buildWhatsAppUrl(payload);
  const fallbackMailto = buildMailtoUrl(payload);

  if (rateLimited()) {
    return {
      ok: false,
      error: "Please wait a moment before sending another request.",
      fallbackWhatsApp,
      fallbackMailto,
    };
  }

  try {
    if (await submitAppwrite(payload)) {
      markSubmitted();
      clearFounderDraft();
      return { ok: true, channel: "appwrite" };
    }
  } catch {
    /* try next */
  }

  try {
    if (await submitSupabase(payload)) {
      markSubmitted();
      clearFounderDraft();
      return { ok: true, channel: "supabase" };
    }
  } catch {
    /* try fallback */
  }

  markSubmitted();
  return {
    ok: false,
    error:
      "Online form storage is unavailable. Use WhatsApp or email — your message is ready to send.",
    fallbackWhatsApp,
    fallbackMailto,
  };
}

export const FOUNDER_WHATSAPP_PLAIN = `https://wa.me/${WHATSAPP}`;
export const FOUNDER_EMAIL_PLAIN = FOUNDER_EMAIL;
export const FOUNDER_LINKEDIN =
  "https://www.linkedin.com/in/jesussavedmina/";
