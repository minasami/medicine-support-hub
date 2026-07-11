import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://medicine-support-hub.vercel.app";
const outputDir = path.resolve("apps/web/public/sitemaps");
const sitemapIndexPath = path.resolve("apps/web/public/sitemap.xml");
const entityDirectoryPath = path.resolve("apps/web/public/entity-directory.json");
const requestPageSize = 1000;
const sitemapPageSize = 45000;

const staticRoutes = [
  "/",
  "/search",
  "/medicines",
  "/verified-products",
  "/network",
  "/companies",
  "/generics",
  "/diseases",
  "/industry",
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

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

function seoEntitySlug(value) {
  const base = value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 82) || "entity";
  return `${base}-${shortHash(value)}`;
}

function cleanDiseaseEntityName(value) {
  return value.replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

function entityPath(type, slug) {
  const prefix = type === "company" ? "companies" : type === "generic" ? "generics" : "diseases";
  return `/${prefix}/${encodeURIComponent(slug)}`;
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

function supabaseContext() {
  const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  };
}

async function fetchCatalogIds(context) {
  if (!context) return [];
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
      `${context.url}/rest/v1/medicines_catalog_enriched_v1?${query.toString()}`,
      context.headers,
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

async function fetchEntityDirectory(context) {
  if (!context) return { generatedAt: new Date().toISOString(), entities: [] };

  const companyQuery = new URLSearchParams({
    select: "company_name,company_slug,origin,product_count,active_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price",
    order: "product_count.desc,company_name.asc",
    limit: "1000",
  });
  const facetQuery = new URLSearchParams({
    select: "facet_type,facet_value,records",
    facet_type: "in.(generic,disease)",
    order: "facet_type.asc,records.desc,facet_value.asc",
    limit: "5000",
  });
  const officialCompanyQuery = new URLSearchParams({
    select: "company_slug,display_name,company_type,description,website_url,logo_url,country,city,therapeutic_areas,product_categories,capabilities,support_programs",
    verification_status: "eq.verified",
    is_public: "eq.true",
    order: "display_name.asc",
    limit: "1000",
  });

  const [companies, facets, officialCompanies] = await Promise.all([
    fetchJsonWithRetry(`${context.url}/rest/v1/medicine_company_profiles?${companyQuery.toString()}`, context.headers),
    fetchJsonWithRetry(`${context.url}/rest/v1/verified_medicine_product_filter_facets?${facetQuery.toString()}`, context.headers),
    fetchJsonWithRetry(`${context.url}/rest/v1/industry_company_profiles?${officialCompanyQuery.toString()}`, context.headers),
  ]);

  const companyEntities = new Map();
  for (const row of Array.isArray(companies) ? companies : []) {
    const slug = String(row.company_slug || "").trim();
    const name = String(row.company_name || "").trim();
    if (!slug || !name) continue;
    companyEntities.set(slug, {
      type: "company",
      slug,
      name,
      records: Number(row.product_count || 0),
      activeRecords: Number(row.active_product_count || 0),
      prescriptionRecords: Number(row.prescription_product_count || 0),
      genericCount: Number(row.generic_count || 0),
      diseaseCount: Number(row.disease_area_count || 0),
      origin: row.origin || null,
      minPrice: row.min_price == null ? null : Number(row.min_price),
      maxPrice: row.max_price == null ? null : Number(row.max_price),
    });
  }

  for (const row of Array.isArray(officialCompanies) ? officialCompanies : []) {
    const slug = String(row.company_slug || "").trim();
    const name = String(row.display_name || "").trim();
    if (!slug || !name) continue;
    const existing = companyEntities.get(slug) || {
      type: "company",
      slug,
      name,
      records: 0,
      activeRecords: 0,
      prescriptionRecords: 0,
      genericCount: 0,
      diseaseCount: 0,
      origin: row.country || null,
      minPrice: null,
      maxPrice: null,
    };
    companyEntities.set(slug, {
      ...existing,
      name,
      official: true,
      companyType: row.company_type || null,
      description: row.description || null,
      website: row.website_url || null,
      logoUrl: row.logo_url || null,
      country: row.country || null,
      city: row.city || null,
      therapeuticAreas: Array.isArray(row.therapeutic_areas) ? row.therapeutic_areas : [],
      productCategories: Array.isArray(row.product_categories) ? row.product_categories : [],
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      supportPrograms: Array.isArray(row.support_programs) ? row.support_programs : [],
    });
  }

  const entities = [...companyEntities.values()];
  for (const row of Array.isArray(facets) ? facets : []) {
    const type = row.facet_type === "generic" ? "generic" : row.facet_type === "disease" ? "disease" : null;
    const sourceValue = String(row.facet_value || "").trim();
    if (!type || !sourceValue) continue;
    const name = type === "disease" ? cleanDiseaseEntityName(sourceValue) : sourceValue;
    if (!name) continue;
    entities.push({
      type,
      slug: seoEntitySlug(name),
      name,
      sourceValue,
      records: Number(row.records || 0),
    });
  }

  entities.sort((a, b) => a.type.localeCompare(b.type) || Number(b.official || false) - Number(a.official || false) || b.records - a.records || a.name.localeCompare(b.name));
  return { generatedAt: new Date().toISOString(), entities };
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const context = supabaseContext();
  if (!context) console.warn("SEO generation: Supabase environment variables are unavailable; publishing static routes and an empty entity directory only.");

  const files = ["static.xml"];
  await writeFile(
    path.join(outputDir, "static.xml"),
    urlSet(staticRoutes.map((route) => `${baseUrl}${route}`)),
    "utf8",
  );

  const [productIds, entityDirectory] = await Promise.all([
    fetchCatalogIds(context),
    fetchEntityDirectory(context),
  ]);

  for (let offset = 0; offset < productIds.length; offset += sitemapPageSize) {
    const page = Math.floor(offset / sitemapPageSize) + 1;
    const filename = `catalog-${page}.xml`;
    const urls = productIds
      .slice(offset, offset + sitemapPageSize)
      .map((id) => `${baseUrl}/catalog/${id}`);
    await writeFile(path.join(outputDir, filename), urlSet(urls), "utf8");
    files.push(filename);
  }

  await writeFile(entityDirectoryPath, `${JSON.stringify(entityDirectory, null, 2)}\n`, "utf8");
  const entityUrls = entityDirectory.entities.map((entity) => `${baseUrl}${entityPath(entity.type, entity.slug)}`);
  if (entityUrls.length) {
    await writeFile(path.join(outputDir, "entities.xml"), urlSet(entityUrls), "utf8");
    files.push("entities.xml");
  }

  await writeFile(sitemapIndexPath, sitemapIndex(files), "utf8");
  console.log(`SEO generation: ${staticRoutes.length} static URLs, ${productIds.length} catalog URLs, and ${entityUrls.length} entity URLs across ${files.length} sitemap files.`);
}

await main();
