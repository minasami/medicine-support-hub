import { createHash } from "node:crypto";

export function sendJson(response, status, body) {
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

export function supabaseConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  if (!url || !publishableKey) throw new Error("Supabase server configuration is unavailable.");
  return { url, publishableKey };
}

export async function requirePlatformAdmin(request) {
  const authorization = String(request.headers.authorization || "");
  const { url, publishableKey } = supabaseConfig();
  if (!authorization.startsWith("Bearer ")) {
    const error = new Error("Authenticated platform-admin session required.");
    error.statusCode = 401;
    throw error;
  }

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: authorization },
    signal: AbortSignal.timeout(10000),
  });
  if (!userResponse.ok) {
    const error = new Error("Session is invalid or expired.");
    error.statusCode = 401;
    throw error;
  }
  const user = await userResponse.json();
  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?select=id,role,is_active,full_name&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    { headers: { apikey: publishableKey, Authorization: authorization }, signal: AbortSignal.timeout(10000) },
  );
  const profiles = await profileResponse.json();
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profile?.is_active || !["admin", "platform_admin", "super_admin"].includes(profile.role)) {
    const error = new Error("Platform-admin access required.");
    error.statusCode = 403;
    throw error;
  }
  return { authorization, user, profile, url, publishableKey };
}

export async function supabaseRest(context, path, init = {}) {
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
    const error = new Error(data?.message || data?.error || `Supabase request failed with HTTP ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
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
