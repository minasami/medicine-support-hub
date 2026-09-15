/**
 * OAuth AS routes (/oauth/authorize|token|register|complete|jwks).
 * Rewritten from /oauth/:path* → /api/oauth/:path* so the path is preserved
 * under /api/oauth/… instead of collapsing to bare /api.
 */
import { handleHttp } from "../../src/rpc.mjs";

function normalizeOauthUrl(req) {
  const raw = req.url || "/";
  let url;
  try {
    url = new URL(raw, "http://localhost");
  } catch {
    url = new URL("/", "http://localhost");
  }

  let pathname = url.pathname || "/";

  // Vercel catch-all: /api/oauth/[...path] → query.path is string | string[]
  const segs = req.query?.path;
  if (segs != null) {
    const suffix = Array.isArray(segs) ? segs.filter(Boolean).join("/") : String(segs);
    if (suffix) pathname = `/oauth/${suffix}`;
  } else if (pathname.startsWith("/api/oauth")) {
    pathname = pathname.replace(/^\/api/, "") || "/oauth";
  } else if (!pathname.startsWith("/oauth")) {
    pathname = `/oauth${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  }

  return `${pathname}${url.search || ""}`;
}

export default async function handler(req, res) {
  req.url = normalizeOauthUrl(req);
  await handleHttp(req, res);
}
