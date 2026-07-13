import Stripe from "stripe";
import { supabaseConfig } from "./_platform-server.js";

export function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || "");
  if (!key) throw Object.assign(new Error("Pro billing is not configured yet."), { statusCode: 503 });
  return new Stripe(key);
}

export async function requireUser(request) {
  const authorization = String(request.headers.authorization || "");
  const { url, publishableKey } = supabaseConfig();
  if (!authorization.startsWith("Bearer ")) throw Object.assign(new Error("Sign in before managing Pro."), { statusCode: 401 });
  const result = await fetch(`${url}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: authorization } });
  if (!result.ok) throw Object.assign(new Error("Session is invalid or expired."), { statusCode: 401 });
  return { user: await result.json(), url, publishableKey, authorization };
}

export async function serviceRest(path, init = {}) {
  const { url } = supabaseConfig();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!key) throw Object.assign(new Error("Billing persistence is unavailable."), { statusCode: 503 });
  const response = await fetch(`${url}${path}`, { ...init, headers: { apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json",...(init.headers||{}) } });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Billing persistence failed: HTTP ${response.status}`);
  return text ? JSON.parse(text) : null;
}

export function appUrl(request) {
  const configured = String(process.env.APP_URL || "").replace(/\/$/,"");
  if (configured) return configured;
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "");
  return `${String(request.headers["x-forwarded-proto"] || "https")}://${host}`;
}
