import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Medicine = {
  id: number;
  name_en: string | null;
  name_ar: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
};

type OpenFdaLabel = {
  id?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    substance_name?: string[];
    product_ndc?: string[];
    package_ndc?: string[];
    route?: string[];
    pharm_class_epc?: string[];
  };
};

const headers = {
  "Content-Type": "application/json",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function res(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function first(values?: string[] | null) {
  return Array.isArray(values) && values.length ? values[0] : null;
}

function clean(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizeSearchName(medicine: Medicine) {
  const name = clean(medicine.name_en) || clean(medicine.name_ar) || "";
  return name
    .replace(/\b\d+(?:[.,]\d+)?\s?(mg|mcg|g|gm|gram|grams|ml|iu|units?|%)\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\b(f\.?c\.?|tabs?|caps?|cream|gel|syrup|sachets?|old|new\d*)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function openFdaQueries(query: string) {
  const quoted = query.replace(/["\\]/g, " ").trim();
  return [
    `openfda.brand_name:"${quoted}"`,
    `openfda.generic_name:"${quoted}"`,
    `openfda.substance_name:"${quoted}"`,
  ];
}

function openFdaUrl(search: string) {
  return `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(search)}&limit=5`;
}

async function fetchOpenFda(query: string) {
  const attempts = openFdaQueries(query);
  const errors: string[] = [];
  for (const search of attempts) {
    const url = openFdaUrl(search);
    const api = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await api.json().catch(() => ({}));
    if (api.ok && Array.isArray(json.results) && json.results.length) {
      return { url, results: json.results as OpenFdaLabel[] };
    }
    errors.push(json?.error?.message || `${api.status} ${api.statusText}`);
  }
  return { url: openFdaUrl(attempts[0]), results: [] as OpenFdaLabel[], errors };
}

async function supabaseJson<T>(url: string, key: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || text || "Supabase request failed");
  return data as T;
}

async function getUser(supabaseUrl: string, anonKey: string, jwt: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}` },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) return null;
  return data as { id: string; email?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return res({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return res({ error: "Supabase environment is not configured" }, 500);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return res({ error: "Missing bearer token" }, 401);

  const user = await getUser(supabaseUrl, anonKey, jwt);
  if (!user) return res({ error: "Invalid session" }, 401);

  const profiles = await supabaseJson<Array<{ role: string; is_active: boolean }>>(
    `${supabaseUrl}/rest/v1/profiles?select=role,is_active&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    serviceKey,
  );
  const profile = profiles[0];
  const isAdmin = Boolean(profile?.is_active && ["platform_admin", "super_admin", "admin"].includes(String(profile.role)));
  if (!isAdmin) return res({ error: "Platform admin access required" }, 403);

  const body = await req.json().catch(() => ({}));
  const medicineId = Number(body.medicine_id);
  const queryOverride = clean(body.query);
  if (!Number.isFinite(medicineId)) return res({ error: "medicine_id is required" }, 400);

  const medicines = await supabaseJson<Medicine[]>(
    `${supabaseUrl}/rest/v1/medicines?select=id,name_en,name_ar,manufacturer,active_ingredient,atc_code,barcode&id=eq.${encodeURIComponent(String(medicineId))}&is_active=eq.true&limit=1`,
    serviceKey,
  );
  const medicine = medicines[0];
  if (!medicine) return res({ error: "Medicine not found" }, 404);

  const query = queryOverride || normalizeSearchName(medicine);
  if (query.length < 2) return res({ error: "Search query is too short", medicine }, 400);

  const openfda = await fetchOpenFda(query);
  const chosen = openfda.results[0];
  if (!chosen) {
    return res({ medicine, query, source_url: openfda.url, matches: [], inserted: null, message: "No openFDA matches found", attempts: openfda.errors ?? [] });
  }

  const enrichment = {
    medicine_id: medicine.id,
    manufacturer: first(chosen.openfda?.manufacturer_name),
    active_ingredient: first(chosen.openfda?.substance_name) || first(chosen.openfda?.generic_name),
    atc_code: null,
    barcode: first(chosen.openfda?.package_ndc) || first(chosen.openfda?.product_ndc),
    source_name: "openFDA Drug Label API",
    source_url: openfda.url,
    source_type: "trusted_reference",
    confidence: "needs_review",
    notes: `openFDA label id: ${chosen.id || "unknown"}. Search query: ${query}. Saved by ${user.email || user.id}.`,
  };

  const inserted = await supabaseJson<unknown[]>(`${supabaseUrl}/rest/v1/medicine_enrichments?select=*`, serviceKey, {
    method: "POST",
    body: JSON.stringify(enrichment),
  });

  const matches = openfda.results.map((item) => ({
    id: item.id,
    brand_name: item.openfda?.brand_name || [],
    generic_name: item.openfda?.generic_name || [],
    manufacturer_name: item.openfda?.manufacturer_name || [],
    substance_name: item.openfda?.substance_name || [],
    product_ndc: item.openfda?.product_ndc || [],
    package_ndc: item.openfda?.package_ndc || [],
    route: item.openfda?.route || [],
    pharm_class_epc: item.openfda?.pharm_class_epc || [],
  }));

  return res({ medicine, query, source_url: openfda.url, matches, inserted });
});
