import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = "https://medicinesupport.app";
const outputDir = path.resolve("apps/web/public/sitemaps");
const sitemapIndexPath = path.resolve("apps/web/public/sitemap.xml");
const entityDirectoryPath = path.resolve(
  "apps/web/public/entity-directory.json",
);
const requestPageSize = 1000;
const sitemapPageSize = 45000;
const staticRoutes = [
  "/",
  "/search",
  "/notifications",
  "/learn",
  "/journey",
  "/medicines",
  "/marketplace",
  "/verified-products",
  "/network",
  "/companies",
  "/generics",
  "/diseases",
  "/therapeutic-categories",
  "/industry",
  "/industry/opportunities",
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
  "/disclosures",
  "/clinics",
  "/pharmacies",
  "/labs",
  "/radiology",
];

const xmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const urlSet = (urls) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
function sitemapIndex(files) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...files.map(
      (file) =>
        `  <sitemap><loc>${xmlEscape(`${baseUrl}/sitemaps/${file}`)}</loc><lastmod>${today}</lastmod></sitemap>`,
    ),
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
  const base =
    value
      .normalize("NFKD")
      .replace(/\p{Mark}+/gu, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 82) || "entity";
  return `${base}-${shortHash(value)}`;
}
const cleanDiseaseEntityName = (value) =>
  value
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
const cleanCompanyRouteSlug = (slugOrName) =>
  String(slugOrName || "")
    .toLowerCase()
    .replace(/-[a-z0-9]{7,8}$/i, "")
    .replace(/[^a-z0-9]/g, "");

function entityPath(type, slug) {
  const prefix =
    type === "company"
      ? "companies"
      : type === "generic"
        ? "generics"
        : "diseases";
  const cleanSlug = type === "company" ? cleanCompanyRouteSlug(slug) || slug : slug;
  return `/${prefix}/${encodeURIComponent(cleanSlug)}`;
}

async function fetchJsonWithRetry(url, headers, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok)
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts)
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
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
      select: "canonical_id",
      order: "canonical_id.asc",
      limit: String(requestPageSize),
    });
    if (lastId > 0) query.set("canonical_id", `gt.${lastId}`);
    const rows = await fetchJsonWithRetry(
      `${context.url}/rest/v1/medicine_canonical_products_v1?${query.toString()}`,
      context.headers,
    );
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      const id = Number(row?.canonical_id);
      if (Number.isSafeInteger(id) && id > 0) ids.push(id);
    }
    const nextLastId = Number(rows.at(-1)?.canonical_id);
    if (!Number.isSafeInteger(nextLastId) || nextLastId <= lastId)
      throw new Error("Canonical sitemap pagination did not advance.");
    lastId = nextLastId;
    if (rows.length < requestPageSize) break;
  }
  return [...new Set(ids)].sort((a, b) => a - b);
}

async function fetchAllPages(
  context,
  pathname,
  parameters,
  pageSize = requestPageSize,
) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams(parameters);
    query.set("limit", String(pageSize));
    query.set("offset", String(offset));
    const page = await fetchJsonWithRetry(
      `${context.url}${pathname}?${query.toString()}`,
      context.headers,
    );
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function fetchEntityDirectory(context) {
  if (!context)
    return { generatedAt: new Date().toISOString(), entities: [], sellers: [] };
  const companyQuery = {
    select:
      "company_name,company_slug,origin,product_count,active_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price",
    order: "product_count.desc,company_name.asc",
  };
  const facetQuery = {
    select: "facet_type,facet_value,records",
    facet_type: "in.(generic,disease)",
    order: "facet_type.asc,records.desc,facet_value.asc",
  };
  const officialCompanyQuery = new URLSearchParams({
    select:
      "company_slug,display_name,company_type,description,website_url,logo_url,country,city,therapeutic_areas,product_categories,capabilities,support_programs",
    verification_status: "eq.verified",
    is_public: "eq.true",
    order: "display_name.asc",
    limit: "1000",
  });
  const sellerQuery = new URLSearchParams({
    select:
      "seller_slug,display_name,seller_type,country,city,approved_offer_count,medicine_count",
    order: "approved_offer_count.desc,display_name.asc",
    limit: "1000",
  });
  const [companies, facets, officialCompanies, sellers] = await Promise.all([
    fetchAllPages(context, "/rest/v1/medicine_company_profiles", companyQuery),
    fetchAllPages(
      context,
      "/rest/v1/verified_medicine_product_filter_facets",
      facetQuery,
    ),
    fetchJsonWithRetry(
      `${context.url}/rest/v1/industry_company_profiles?${officialCompanyQuery.toString()}`,
      context.headers,
    ),
    fetchJsonWithRetry(
      `${context.url}/rest/v1/marketplace_public_sellers_v1?${sellerQuery.toString()}`,
      context.headers,
    ),
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
      therapeuticAreas: Array.isArray(row.therapeutic_areas)
        ? row.therapeutic_areas
        : [],
      productCategories: Array.isArray(row.product_categories)
        ? row.product_categories
        : [],
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
      supportPrograms: Array.isArray(row.support_programs)
        ? row.support_programs
        : [],
    });
  }
  const entities = [...companyEntities.values()];
  for (const row of Array.isArray(facets) ? facets : []) {
    const type =
      row.facet_type === "generic"
        ? "generic"
        : row.facet_type === "disease"
          ? "disease"
          : null;
    const sourceValue = String(row.facet_value || "").trim();
    if (!type || !sourceValue) continue;
    const name =
      type === "disease" ? cleanDiseaseEntityName(sourceValue) : sourceValue;
    if (name)
      entities.push({
        type,
        slug: seoEntitySlug(name),
        name,
        sourceValue,
        records: Number(row.records || 0),
      });
  }
  entities.sort(
    (a, b) =>
      a.type.localeCompare(b.type) ||
      Number(b.official || false) - Number(a.official || false) ||
      b.records - a.records ||
      a.name.localeCompare(b.name),
  );
  return {
    generatedAt: new Date().toISOString(),
    entities,
    sellers: Array.isArray(sellers) ? sellers : [],
  };
}

async function fetchTherapeuticCategories(context) {
  if (!context) return [];
  const rows = await fetchAllPages(
    context,
    "/rest/v1/medicine_encyclopedia_facets_v4",
    {
      select: "facet_value,product_count",
      facet_type: "eq.drug_class",
      order: "product_count.desc,facet_value.asc",
    },
  );
  return rows
    .map((row) => String(row.facet_value || "").trim())
    .filter(Boolean);
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const context = supabaseContext();
  if (!context)
    console.warn(
      "SEO generation: Supabase environment variables unavailable; publishing static routes only.",
    );
  const files = ["static.xml"];
  await writeFile(
    path.join(outputDir, "static.xml"),
    urlSet(staticRoutes.map((route) => `${baseUrl}${route}`)),
    "utf8",
  );
  const [productIds, directory, therapeuticCategories] = await Promise.all([
    fetchCatalogIds(context),
    fetchEntityDirectory(context),
    fetchTherapeuticCategories(context),
  ]);
  for (let offset = 0; offset < productIds.length; offset += sitemapPageSize) {
    const filename = `catalog-${Math.floor(offset / sitemapPageSize) + 1}.xml`;
    await writeFile(
      path.join(outputDir, filename),
      urlSet(
        productIds
          .slice(offset, offset + sitemapPageSize)
          .map((id) => `${baseUrl}/catalog/${id}`),
      ),
      "utf8",
    );
    files.push(filename);
  }
  await writeFile(
    entityDirectoryPath,
    `${JSON.stringify(directory, null, 2)}\n`,
    "utf8",
  );
  const entityUrls = directory.entities.map(
    (entity) => `${baseUrl}${entityPath(entity.type, entity.slug)}`,
  );
  if (entityUrls.length) {
    await writeFile(
      path.join(outputDir, "entities.xml"),
      urlSet(entityUrls),
      "utf8",
    );
    files.push("entities.xml");
  }
  const therapeuticUrls = therapeuticCategories.map(
    (name) =>
      `${baseUrl}/therapeutic-categories/${seoEntitySlug(name)}?name=${encodeURIComponent(name)}`,
  );
  if (therapeuticUrls.length) {
    await writeFile(
      path.join(outputDir, "therapeutic-categories.xml"),
      urlSet(therapeuticUrls),
      "utf8",
    );
    files.push("therapeutic-categories.xml");
  }
  const sellerUrls = directory.sellers.map(
    (seller) =>
      `${baseUrl}/marketplace/sellers/${encodeURIComponent(seller.seller_slug)}`,
  );
  if (sellerUrls.length) {
    await writeFile(
      path.join(outputDir, "marketplace-sellers.xml"),
      urlSet(sellerUrls),
      "utf8",
    );
    files.push("marketplace-sellers.xml");
  }
  await writeFile(sitemapIndexPath, sitemapIndex(files), "utf8");
  console.log(
    `SEO generation: ${staticRoutes.length} static URLs, ${productIds.length} encyclopedia URLs, ${entityUrls.length} entity URLs, ${therapeuticUrls.length} therapeutic profiles, and ${sellerUrls.length} verified seller URLs across ${files.length} sitemap files.`,
  );
}

await main();
