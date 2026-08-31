import { createHash } from "node:crypto";

const BILLING_ORIGINS = new Set([
  "https://medicinesupport.app",
  "https://www.medicinesupport.app",
  "https://medicine-support-hub.vercel.app",
]);

export function applyCors(request, response) {
  const origin = String(request?.headers?.origin || "");
  if (BILLING_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
    response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  }
}

export function sendJson(response, status, body, request) {
  if (request) applyCors(request, response);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(JSON.stringify(body));
}

export function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body;
}

const FOUNDER_ADMIN_EMAILS = new Set(
  [
    "jesussavedmina@gmail.com",
    "mina.s.saad@pharma.asu.edu.eg",
    "mina.s.tawfik@armaniousfoundation.org",
    ...(String(process.env.PLATFORM_FOUNDER_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)),
  ].map((e) => e.toLowerCase()),
);

export function normalizeEmail(email) {
  return String(email || "")
    .toLowerCase()
    .trim();
}

export function isFounderAdminEmail(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (FOUNDER_ADMIN_EMAILS.has(e)) return true;
  if (e.includes("jesussavedmina")) return true;
  return false;
}

export function supabaseConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  if (!url || !publishableKey) {
    return null;
  }
  return { url, publishableKey };
}

/**
 * Platform admin gate.
 * 1) Founder email allowlist (Appwrite-first deployments) via header/body
 * 2) Optional PLATFORM_ADMIN_SECRET
 * 3) Legacy Supabase session + profiles.role when configured
 */
export async function requirePlatformAdmin(request) {
  const headers = request.headers || {};
  const authorization = String(headers.authorization || headers.Authorization || "");
  const body = (() => {
    try {
      return parseBody(request);
    } catch {
      return {};
    }
  })();

  const emailFromHeader = normalizeEmail(
    headers["x-admin-email"] || headers["X-Admin-Email"] || "",
  );
  const emailFromBody = normalizeEmail(body.actor_email || body.admin_email || "");
  const email = emailFromHeader || emailFromBody;

  const secret = String(
    headers["x-admin-secret"] || headers["X-Admin-Secret"] || body.admin_secret || "",
  );
  const expectedSecret = String(process.env.PLATFORM_ADMIN_SECRET || "").trim();

  if (isFounderAdminEmail(email)) {
    if (!expectedSecret || secret === expectedSecret) {
      return {
        authorization: authorization || "Bearer founder",
        user: { id: `founder:${email}`, email },
        profile: {
          id: `founder:${email}`,
          role: "platform_admin",
          is_active: true,
          full_name: email,
        },
        via: "founder_allowlist",
      };
    }
  }

  const sb = supabaseConfig();
  if (!sb) {
    if (isFounderAdminEmail(email)) {
      return {
        authorization: authorization || "Bearer founder",
        user: { id: `founder:${email}`, email },
        profile: {
          id: `founder:${email}`,
          role: "platform_admin",
          is_active: true,
          full_name: email,
        },
        via: "founder_allowlist_no_supabase",
      };
    }
    const error = new Error(
      "Platform-admin access required (founder email or Supabase session).",
    );
    error.statusCode = 401;
    throw error;
  }

  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authenticated platform-admin session required.");
    error.statusCode = 401;
    throw error;
  }

  const { url, publishableKey } = sb;
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: authorization },
    signal: AbortSignal.timeout(10000),
  });
  if (!userResponse.ok) {
    if (isFounderAdminEmail(email)) {
      return {
        authorization,
        user: { id: `founder:${email}`, email },
        profile: {
          id: `founder:${email}`,
          role: "platform_admin",
          is_active: true,
          full_name: email,
        },
        via: "founder_after_supabase_fail",
      };
    }
    const error = new Error("Session is invalid or expired.");
    error.statusCode = 401;
    throw error;
  }
  const user = await userResponse.json();
  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?select=id,role,is_active,full_name&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    {
      headers: { apikey: publishableKey, Authorization: authorization },
      signal: AbortSignal.timeout(10000),
    },
  );
  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  const roleOk =
    profile?.is_active &&
    ["admin", "platform_admin", "super_admin"].includes(
      String(profile.role || "").toLowerCase(),
    );
  if (!roleOk && !isFounderAdminEmail(user.email || email)) {
    const error = new Error("Platform-admin access required.");
    error.statusCode = 403;
    throw error;
  }
  return {
    authorization,
    user,
    profile: profile || {
      id: user.id,
      role: "platform_admin",
      is_active: true,
      full_name: user.email,
    },
    url,
    publishableKey,
    via: "supabase",
  };
}

export async function supabaseRest(context, path, init = {}) {
  if (!context.url || !context.publishableKey) {
    throw new Error("Supabase is not configured on this deployment.");
  }
  const response = await fetch(`${context.url}${path}`, {
    ...init,
    headers: {
      apikey: context.publishableKey,
      Authorization: context.authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
    signal: init.signal || AbortSignal.timeout(15000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Supabase request failed with HTTP ${response.status}.`,
    );
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

export function sha256(value) {
  const input =
    typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value);
  return createHash("sha256").update(input).digest("hex");
}

export function safeUrl(value, allowedDomain) {
  const parsed = new URL(String(value || ""));
  if (parsed.protocol !== "https:") throw new Error("Only HTTPS sources are allowed.");
  const hostname = parsed.hostname.toLowerCase();
  const permitted = String(allowedDomain || "").toLowerCase();
  if (permitted && hostname !== permitted && !hostname.endsWith(`.${permitted}`)) {
    throw new Error("The requested URL is outside the approved source domain.");
  }
  return parsed.toString();
}

export function errorStatus(error, fallback = 500) {
  return Number.isInteger(error?.statusCode) ? error.statusCode : fallback;
}

/** Shared Appwrite REST helpers for admin API routes. */
export function appwriteConfig() {
  const endpoint = (
    process.env.APPWRITE_ENDPOINT ||
    process.env.VITE_APPWRITE_ENDPOINT ||
    "https://fra.cloud.appwrite.io/v1"
  ).replace(/\/$/, "");
  const project =
    process.env.APPWRITE_PROJECT_ID ||
    process.env.VITE_APPWRITE_PROJECT_ID ||
    "6a54ac3a00272c02d6e0";
  const key = process.env.APPWRITE_API_KEY || "";
  const database =
    process.env.APPWRITE_DATABASE_ID ||
    process.env.VITE_APPWRITE_DATABASE_ID ||
    "medicine_support_hub";
  const medicines =
    process.env.APPWRITE_MEDICINES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID ||
    "medicines";
  return { endpoint, project, key, database, medicines };
}

export async function appwriteGetDocument(collectionId, documentId) {
  const { endpoint, project, key, database } = appwriteConfig();
  if (!key) return null;
  const url = `${endpoint}/databases/${database}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": project,
      "X-Appwrite-Key": key,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function appwriteListDocuments(collectionId, queries = []) {
  const { endpoint, project, key, database } = appwriteConfig();
  if (!key) throw new Error("APPWRITE_API_KEY is not configured on the server.");
  const qs = new URLSearchParams();
  for (const q of queries) qs.append("queries[]", q);
  const url = `${endpoint}/databases/${database}/collections/${encodeURIComponent(collectionId)}/documents?${qs}`;
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": project,
      "X-Appwrite-Key": key,
    },
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Appwrite list ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

export async function appwritePatchDocument(collectionId, documentId, data) {
  const { endpoint, project, key, database } = appwriteConfig();
  if (!key) throw new Error("APPWRITE_API_KEY is not configured on the server.");
  const url = `${endpoint}/databases/${database}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;

  async function attempt(payload) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "X-Appwrite-Project": project,
        "X-Appwrite-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  }

  let result = await attempt(data);
  if (!result.ok && result.status === 400) {
    const {
      rxcui,
      pubchem_cid,
      field_sources,
      last_enriched_at,
      price_source,
      price_updated_at,
      ...core
    } = data;
    if (Object.keys(core).length) {
      result = await attempt(core);
    }
  }
  if (!result.ok) {
    throw new Error(`Appwrite PATCH ${result.status}: ${result.text.slice(0, 240)}`);
  }
  return true;
}
