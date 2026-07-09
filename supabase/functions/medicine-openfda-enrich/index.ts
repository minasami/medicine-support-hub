import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Medicine = { id: number; name_en: string | null; name_ar: string | null };
type OpenFdaLabel = { id?: string; openfda?: { brand_name?: string[]; generic_name?: string[]; manufacturer_name?: string[]; substance_name?: string[]; product_ndc?: string[]; package_ndc?: string[]; route?: string[] } };

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const send = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const first = (values?: string[] | null) => Array.isArray(values) && values.length ? values[0] : null;

function normalizeSearchName(medicine: Medicine) {
  return (medicine.name_en || medicine.name_ar || "").replace(/\b\d+\s?(mg|mcg|g|gm|ml|iu|%)\b/gi, "").replace(/\b\d+\b/g, "").replace(/\s+/g, " ").trim();
}

function openFdaUrl(query: string) {
  const safe = query.replace(/"/g, "");
  const search = encodeURIComponent(`openfda.brand_name:"${safe}"+openfda.generic_name:"${safe}"`);
  return `https://api.fda.gov/drug/label.json?search=${search}&limit=5`;
}

async function rest<T>(baseUrl: string, anonKey: string, jwt: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { apikey: anonKey, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || data?.error || text || "Request failed");
  return data as T;
}

async function isPlatformAdmin(baseUrl: string, anonKey: string, jwt: string) {
  const userRes = await fetch(`${baseUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` } });
  if (!userRes.ok) return false;
  const user = await userRes.json();
  const rows = await rest<Array<{ role: string; is_active: boolean }>>(baseUrl, anonKey, jwt, `/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`).catch(() => []);
  const profile = rows[0];
  return Boolean(profile?.is_active && ["platform_admin", "super_admin", "admin"].includes(String(profile.role)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return send({ error: "Method not allowed" }, 405);

  const baseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!baseUrl || !anonKey) return send({ error: "Supabase environment is not configured" }, 500);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return send({ error: "Missing bearer token" }, 401);
  if (!(await isPlatformAdmin(baseUrl, anonKey, jwt))) return send({ error: "Platform admin access required" }, 403);

  const body = await req.json().catch(() => ({}));
  const medicineId = Number(body.medicine_id);
  const queryOverride = String(body.query || "").trim();
  if (!Number.isFinite(medicineId)) return send({ error: "medicine_id is required" }, 400);

  const medicines = await rest<Medicine[]>(baseUrl, anonKey, jwt, `/rest/v1/medicines?select=id,name_en,name_ar&id=eq.${encodeURIComponent(String(medicineId))}&is_active=eq.true&limit=1`);
  const medicine = medicines[0];
  if (!medicine) return send({ error: "Medicine not found" }, 404);

  const query = queryOverride || normalizeSearchName(medicine);
  if (query.length < 2) return send({ error: "Search query is too short" }, 400);

  const sourceUrl = openFdaUrl(query);
  const fdaRes = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
  const fdaJson = await fdaRes.json().catch(() => ({}));
  if (!fdaRes.ok) return send({ error: fdaJson?.error?.message || "openFDA request failed", source_url: sourceUrl }, 502);

  const results = Array.isArray(fdaJson.results) ? fdaJson.results as OpenFdaLabel[] : [];
  const match = results[0];
  if (!match) return send({ medicine, query, source_url: sourceUrl, matches: [], inserted: null, message: "No openFDA matches found" });

  const enrichment = {
    medicine_id: medicine.id,
    manufacturer: first(match.openfda?.manufacturer_name),
    active_ingredient: first(match.openfda?.substance_name) || first(match.openfda?.generic_name),
    atc_code: null,
    barcode: first(match.openfda?.package_ndc) || first(match.openfda?.product_ndc),
    source_name: "openFDA Drug Label API",
    source_url: sourceUrl,
    source_type: "trusted_reference",
    confidence: "needs_review",
    notes: `openFDA label id: ${match.id || "unknown"}. Search query: ${query}.`,
  };

  const insertedRows = await rest<unknown[]>(baseUrl, anonKey, jwt, "/rest/v1/medicine_enrichments?select=*", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(enrichment) });

  return send({ medicine, query, source_url: sourceUrl, inserted: insertedRows[0] || null, matches: results.map((item) => ({ id: item.id, brand_name: item.openfda?.brand_name || [], generic_name: item.openfda?.generic_name || [], manufacturer_name: item.openfda?.manufacturer_name || [], substance_name: item.openfda?.substance_name || [], product_ndc: item.openfda?.product_ndc || [], package_ndc: item.openfda?.package_ndc || [], route: item.openfda?.route || [] })) });
});
