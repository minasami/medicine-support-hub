import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://medicine-support-hub.vercel.app";
const outputDir = path.resolve("apps/web/public/sitemaps");
const sitemapIndexPath = path.resolve("apps/web/public/sitemap.xml");
const requestPageSize = 1000;
const sitemapPageSize = 45000;

const staticRoutes = [
  "/",
  "/search",
  "/medicines",
  "/verified-products",
  "/network",
  "/companies",
  "/integrations",
  "/data-sources/item-export-20260501",
  "/manifesto",
  "/vision",
  "/platform",
  "/solutions",
  "/security",
  "/research",
  "/contact",
  "/brand",
  "/ngo",
  "/clinical-assistant",
  "/request",
  "/impact",
];

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlSet(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

function sitemapIndex(files) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...files.map((file) => `  <sitemap><loc>${xmlEscape(`${baseUrl}/sitemaps/${file}`)}</loc><lastmod>${today}</lastmod></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
}

async function fetchJsonWithRetry(url, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function fetchCatalogIds() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    console.warn("SEO sitemap generation: Supabase environment variables are unavailable; publishing static routes only.");
    return [];
  }

  const headers = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    Accept: "application/json",
  };

  const ids = [];
  let lastId = 0;

  while (true) {
    const query = new URLSearchParams({
      select: "id",
      order: "id.asc",
      limit: String(requestPageSize),
    });
    if (lastId > 0) query.set("id", `gt.${lastId}`);

    const rows = await fetchJsonWithRetry(
      `${supabaseUrl}/rest/v1/medicines_catalog_enriched_v1?${query.toString()}`,
      headers,
    );

    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      const id = Number(row?.id);
      if (Number.isInteger(id) && id > 0) ids.push(id);
    }

    const nextLastId = Number(rows.at(-1)?.id);
    if (!Number.isInteger(nextLastId) || nextLastId <= lastId) {
      throw new Error("SEO sitemap generation stopped because catalog pagination did not advance.");
    }
    lastId = nextLastId;
    if (rows.length < requestPageSize) break;
  }

  return [...new Set(ids)].sort((a, b) => a - b);
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const files = ["static.xml"];
  await writeFile(
    path.join(outputDir, "static.xml"),
    urlSet(staticRoutes.map((route) => `${baseUrl}${route}`)),
    "utf8",
  );

  const productIds = await fetchCatalogIds();
  for (let offset = 0; offset < productIds.length; offset += sitemapPageSize) {
    const page = Math.floor(offset / sitemapPageSize) + 1;
    const filename = `catalog-${page}.xml`;
    const urls = productIds
      .slice(offset, offset + sitemapPageSize)
      .map((id) => `${baseUrl}/catalog/${id}`);
    await writeFile(path.join(outputDir, filename), urlSet(urls), "utf8");
    files.push(filename);
  }

  await writeFile(sitemapIndexPath, sitemapIndex(files), "utf8");
  console.log(`SEO sitemap generation: ${staticRoutes.length} static URLs and ${productIds.length} catalog URLs across ${files.length} sitemap files.`);
}

await main();
