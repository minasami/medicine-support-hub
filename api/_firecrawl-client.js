const DEFAULT_CLOUD_URL = "https://api.firecrawl.dev";

function normalizedBaseUrl() {
  const raw = String(process.env.FIRECRAWL_API_BASE_URL || DEFAULT_CLOUD_URL).trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(raw);
  } catch {
    const error = new Error("FIRECRAWL_API_BASE_URL must be a valid URL.");
    error.statusCode = 503;
    throw error;
  }
  if (url.username || url.password || url.search || url.hash) {
    const error = new Error("FIRECRAWL_API_BASE_URL cannot contain credentials, query parameters, or fragments.");
    error.statusCode = 503;
    throw error;
  }
  const allowInsecure = String(process.env.FIRECRAWL_ALLOW_INSECURE_LOCALHOST || "").toLowerCase() === "true";
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(allowInsecure && localHost && url.protocol === "http:")) {
    const error = new Error("Firecrawl must use HTTPS outside an explicitly allowed localhost development environment.");
    error.statusCode = 503;
    throw error;
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizedVersion() {
  const version = String(process.env.FIRECRAWL_API_VERSION || "v2").trim().toLowerCase();
  if (!["v1", "v2"].includes(version)) {
    const error = new Error("FIRECRAWL_API_VERSION must be v1 or v2.");
    error.statusCode = 503;
    throw error;
  }
  return version;
}

export function firecrawlConfiguration() {
  const baseUrl = normalizedBaseUrl();
  const apiVersion = normalizedVersion();
  const cloud = baseUrl === DEFAULT_CLOUD_URL;
  const apiKey = String(process.env.FIRECRAWL_API_KEY || "").trim();
  const requireAuth = cloud || String(process.env.FIRECRAWL_REQUIRE_AUTH || "").toLowerCase() === "true";
  return {
    baseUrl,
    apiVersion,
    apiKey,
    cloud,
    mode: cloud ? "cloud" : "self_hosted",
    configured: Boolean(baseUrl && (!requireAuth || apiKey)),
    authConfigured: Boolean(apiKey),
    requireAuth,
  };
}

export async function firecrawlRequest(path, init = {}) {
  const config = firecrawlConfiguration();
  if (!config.configured) {
    const error = new Error(config.cloud
      ? "FIRECRAWL_API_KEY is not configured in server-side environment variables."
      : "The self-hosted Firecrawl endpoint requires authentication, but FIRECRAWL_API_KEY is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const requestedPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  const normalizedPath = requestedPath.replace(/^\/v[12](?=\/)/, `/${config.apiVersion}`);
  const headers = { "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetch(`${config.baseUrl}${normalizedPath}`, {
    ...init,
    headers,
    signal: init.signal || AbortSignal.timeout(55000),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 1000) }; }
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || data?.message || `Firecrawl returned HTTP ${response.status}.`);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return data;
}
