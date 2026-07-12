import { errorStatus, requirePlatformAdmin, sendJson, supabaseConfig } from "./_platform-server.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "POST required." });
  try {
    await requirePlatformAdmin(request);
    const { url } = supabaseConfig();
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    if (!serviceRoleKey) return sendJson(response, 503, { message: "SUPABASE_SERVICE_ROLE_KEY is required for a controlled search-index refresh." });
    const refresh = await fetch(`${url}/rest/v1/rpc/refresh_medicine_search_index_v1`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(55000),
    });
    const text = await refresh.text();
    const data = text ? JSON.parse(text) : null;
    if (!refresh.ok) throw new Error(data?.message || data?.error || `Search-index refresh returned HTTP ${refresh.status}.`);
    return sendJson(response, 200, data || { refreshed: true });
  } catch (error) {
    console.error("admin-search-index", error);
    return sendJson(response, errorStatus(error), { message: error instanceof Error ? error.message : "Could not refresh medicine search." });
  }
}
