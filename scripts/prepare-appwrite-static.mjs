import { promises as fs } from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const appSourcePath = path.join(repositoryRoot, "apps/web/src/App.tsx");
const outputDirectory = path.join(repositoryRoot, "apps/web/dist/public");
const indexPath = path.join(outputDirectory, "index.html");
const legacyPublicOrigin = "https://medicine-support-hub.vercel.app";
const rewritableExtensions = new Set([
  ".html",
  ".js",
  ".json",
  ".txt",
  ".xml",
  ".webmanifest",
  ".svg",
]);

function normalizePublicSiteUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("VITE_PUBLIC_SITE_URL must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("VITE_PUBLIC_SITE_URL must be a clean public origin without credentials, query, or hash.");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

async function rewritePublicOrigin(directory, publicSiteUrl) {
  let rewrittenFiles = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      rewrittenFiles += await rewritePublicOrigin(entryPath, publicSiteUrl);
      continue;
    }
    if (!rewritableExtensions.has(path.extname(entry.name))) continue;
    const original = await fs.readFile(entryPath, "utf8");
    if (!original.includes(legacyPublicOrigin)) continue;
    await fs.writeFile(entryPath, original.replaceAll(legacyPublicOrigin, publicSiteUrl), "utf8");
    rewrittenFiles += 1;
  }
  return rewrittenFiles;
}

const configuredPublicSiteUrl = process.env.VITE_PUBLIC_SITE_URL?.trim();
let rewrittenFiles = 0;
if (configuredPublicSiteUrl) {
  rewrittenFiles = await rewritePublicOrigin(
    outputDirectory,
    normalizePublicSiteUrl(configuredPublicSiteUrl),
  );
} else {
  console.warn(
    "VITE_PUBLIC_SITE_URL is not set; Appwrite output will retain the current production canonical origin.",
  );
}

const [appSource, indexHtml] = await Promise.all([
  fs.readFile(appSourcePath, "utf8"),
  fs.readFile(indexPath, "utf8"),
]);

const routePattern = /<Route\s+path="([^"]+)"/g;
const routes = new Set();

for (const match of appSource.matchAll(routePattern)) {
  const route = match[1];
  if (route === "/" || route.includes(":") || route.includes("*")) continue;
  routes.add(route);
}

for (const route of [...routes].sort()) {
  const segments = route.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe route discovered while preparing Appwrite output: ${route}`);
  }

  const routeDirectory = path.join(outputDirectory, ...segments);
  await fs.mkdir(routeDirectory, { recursive: true });
  await fs.writeFile(path.join(routeDirectory, "index.html"), indexHtml);
}

// The Appwrite preview is currently static, so Vercel's server-side integration
// status endpoint is unavailable. Serve a safe, non-secret status response so
// the control center can still load its Supabase-backed settings and queues.
const integrationStatusDirectory = path.join(outputDirectory, "api", "admin-integrations");
await fs.mkdir(integrationStatusDirectory, { recursive: true });
await fs.writeFile(
  path.join(integrationStatusDirectory, "index.html"),
  JSON.stringify({
    google_document_ai: { configured: false, provider: "unavailable_on_appwrite_static_preview" },
    firecrawl: { configured: false, automatic_sync_ready: false, api_version: "v2" },
    image_search: { configured: false },
    cron: { configured: false },
    service_role: { configured: false },
    security: {
      secrets_exposed_to_browser: false,
      automatic_publication: false,
      human_review_required: true,
    },
  }),
  "utf8",
);

// Appwrite Sites does not provide Vercel-style path rewrites. This gives static
// hosts a conventional client-rendered not-found document for dynamic routes.
await fs.writeFile(path.join(outputDirectory, "404.html"), indexHtml);

console.log(
  `Prepared ${routes.size} static route entry points, rewrote ${rewrittenFiles} public-origin files, added an Appwrite-safe integration status, and created 404.html.`,
);
