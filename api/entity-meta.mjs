const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const validTypes = new Set(["company", "generic", "disease"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function requestHeader(request, name) {
  const value = request.headers?.[name];
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : null;
}

function forwardedHeaders(request) {
  const headers = { "x-medicine-support-meta-render": "1" };
  for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) {
    const value = requestHeader(request, name);
    if (value) headers[name] = value;
  }
  return headers;
}

function requestOrigin(request) {
  const host = requestHeader(request, "x-forwarded-host") || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app";
  const protocol = requestHeader(request, "x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

async function fetchPublicAsset(request, pathname, json = false) {
  const response = await fetch(`${requestOrigin(request)}${pathname}`, {
    headers: forwardedHeaders(request),
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not load ${pathname}: HTTP ${response.status}`);
  return json ? response.json() : response.text();
}

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are unavailable.");
  return { url, key };
}

async function supabaseRequest(path) {
  const { url, key } = supabaseConfig();
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (response.ok) return response.json();
    lastStatus = response.status;
    if (response.status < 500 || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 125 * (attempt + 1)));
  }
  throw new Error(`Supabase request failed after retries: HTTP ${lastStatus}`);
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function cleanOrigin(value) {
  return String(value || "").replace(/^\*\s*Country of Origin:\s*/i, "").trim();
}

function humanize(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityPath(type, slug) {
  const prefix = type === "company" ? "companies" : type === "generic" ? "generics" : "diseases";
  return `/${prefix}/${encodeURIComponent(slug)}`;
}

function entityTitle(entity, officialProfile) {
  const name = officialProfile?.display_name || entity.name;
  if (entity.type === "company") return `${name} Medicines and Healthcare Profile | Medicine Support Hub`;
  if (entity.type === "generic") return `${name} Products and Source Evidence | Medicine Support Hub`;
  return `${name} Medicine Products | Medicine Support Hub`;
}

function entityDescription(entity, products, sourceProfile, officialProfile, contributions) {
  const recordCount = Number(entity.records ?? 0);
  if (entity.type === "company") {
    if (officialProfile?.description) return officialProfile.description;
    if (entity.description) return entity.description;
    const active = Number(sourceProfile?.active_product_count ?? entity.activeRecords ?? entity.records ?? 0);
    const generics = Number(sourceProfile?.generic_count ?? entity.genericCount ?? 0);
    const diseases = Number(sourceProfile?.disease_area_count ?? entity.diseaseCount ?? 0);
    const origin = cleanOrigin(sourceProfile?.origin || officialProfile?.country || entity.country || entity.origin);
    const official = officialProfile ? "verified official " : "";
    const contributionText = contributions.length ? ` and ${contributions.length.toLocaleString("en-US")} reviewed company contributions` : "";
    return `${official}${officialProfile?.display_name || entity.name} healthcare company profile${origin ? ` for ${origin}` : ""}, connecting ${active.toLocaleString("en-US")} active source-backed products, ${generics.toLocaleString("en-US")} generics, ${diseases.toLocaleString("en-US")} disease areas${contributionText}.`;
  }
  const companies = new Set(products.map((product) => product.company_name).filter(Boolean)).size;
  if (entity.type === "generic") return `${entity.name} generic medicine reference connecting ${recordCount.toLocaleString("en-US")} active source-backed product listings across ${companies.toLocaleString("en-US")} companies, disease areas, prescription signals, and observed source-market prices.`;
  const generics = new Set(products.map((product) => product.generic_name).filter(Boolean)).size;
  return `${entity.name} medicine product reference connecting ${recordCount.toLocaleString("en-US")} active source-backed listings, ${generics.toLocaleString("en-US")} generics, ${companies.toLocaleString("en-US")} companies, prescription signals, and observed source-market prices.`;
}

function firstImage(products, officialProfile, entity) {
  const officialImage = String(officialProfile?.logo_url || entity.logoUrl || "").trim();
  if (/^https?:\/\//i.test(officialImage)) return officialImage;
  for (const product of products) {
    const raw = String(product.image_urls || "").trim();
    if (!raw) continue;
    const match = raw.match(/https?:\/\/[^\s,|]+/i);
    if (match) return match[0];
  }
  return null;
}

function injectMeta(html, entity, products, sourceProfile, officialProfile, contributions) {
  const canonicalUrl = `${baseUrl}${entityPath(entity.type, entity.slug)}`;
  const title = entityTitle(entity, officialProfile);
  const description = entityDescription(entity, products, sourceProfile, officialProfile, contributions);
  const image = firstImage(products, officialProfile, entity);
  const sourceUrls = [...new Set(products.map((product) => product.product_url).filter(Boolean))].slice(0, 20);
  const contributionEvidenceUrls = [...new Set(contributions.flatMap((contribution) => Array.isArray(contribution.evidence_urls) ? contribution.evidence_urls : []).filter(Boolean))].slice(0, 20);

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${publicRobots}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="website" />`);
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  if (image) {
    html = replaceTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
    html = replaceTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }

  const itemList = products.slice(0, 20).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Product",
      name: product.product_name,
      ...(product.product_url ? { url: product.product_url } : {}),
      ...(product.company_name ? { brand: { "@type": "Organization", name: product.company_name } } : {}),
      ...(product.generic_name ? { category: product.generic_name } : {}),
      ...(product.final_price != null ? { offers: { "@type": "Offer", price: String(product.final_price), priceCurrency: product.price_currency || "INR", url: product.product_url || canonicalUrl } } : {}),
    },
  }));

  const origin = cleanOrigin(sourceProfile?.origin || officialProfile?.country || entity.country || entity.origin);
  const organizationName = officialProfile?.display_name || entity.name;
  const knowsAbout = [
    ...(Array.isArray(officialProfile?.therapeutic_areas) ? officialProfile.therapeutic_areas : entity.therapeuticAreas || []),
    ...(Array.isArray(officialProfile?.product_categories) ? officialProfile.product_categories : entity.productCategories || []),
    ...(Array.isArray(officialProfile?.capabilities) ? officialProfile.capabilities : entity.capabilities || []),
  ].filter(Boolean);
  const organization = entity.type === "company" ? {
    "@type": "Organization",
    "@id": `${canonicalUrl}#organization`,
    name: organizationName,
    url: officialProfile?.website_url || entity.website || canonicalUrl,
    description,
    ...(image ? { logo: { "@type": "ImageObject", url: image } } : {}),
    ...(origin ? { location: { "@type": "Place", name: [officialProfile?.city || entity.city, origin].filter(Boolean).join(", ") } } : {}),
    ...(officialProfile?.company_type || entity.companyType ? { additionalType: humanize(officialProfile?.company_type || entity.companyType) } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    ...(officialProfile?.website_url || entity.website ? { sameAs: [officialProfile?.website_url || entity.website] } : {}),
  } : null;

  const contributionParts = contributions.slice(0, 20).map((contribution) => ({
    "@type": "CreativeWork",
    "@id": `${canonicalUrl}#contribution-${contribution.id}`,
    name: contribution.title,
    description: contribution.summary,
    datePublished: contribution.published_at,
    genre: humanize(contribution.contribution_type),
    ...(organization ? { publisher: { "@id": `${canonicalUrl}#organization` } } : {}),
    ...(Array.isArray(contribution.evidence_urls) && contribution.evidence_urls.length ? { isBasedOn: contribution.evidence_urls } : {}),
  }));

  const graph = [
    {
      "@type": "CollectionPage",
      "@id": `${canonicalUrl}#page`,
      name: organizationName,
      url: canonicalUrl,
      description,
      ...(image ? { primaryImageOfPage: { "@type": "ImageObject", url: image } } : {}),
      ...([...sourceUrls, ...contributionEvidenceUrls].length ? { isBasedOn: [...sourceUrls, ...contributionEvidenceUrls] } : {}),
      mainEntity: entity.type === "company" && organization ? { "@id": `${canonicalUrl}#organization` } : { "@type": "ItemList", numberOfItems: Number(entity.records ?? 0), itemListElement: itemList },
      ...(itemList.length ? { hasPart: [{ "@type": "ItemList", name: "Verified source products", numberOfItems: Number(entity.records ?? itemList.length), itemListElement: itemList }, ...contributionParts] } : contributionParts.length ? { hasPart: contributionParts } : {}),
    },
    ...(organization ? [organization] : []),
    ...contributionParts,
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` },
        { "@type": "ListItem", position: 2, name: entity.type === "company" ? "Companies" : entity.type === "generic" ? "Generics" : "Disease areas", item: `${baseUrl}/${entity.type === "company" ? "companies" : entity.type === "generic" ? "generics" : "diseases"}` },
        { "@type": "ListItem", position: 3, name: organizationName, item: canonicalUrl },
      ],
    },
  ];

  html = html.replace("</head>", `    <script type="application/ld+json" data-server-seo="entity">${safeJson({ "@context": "https://schema.org", "@graph": graph })}</script>\n  </head>`);
  return html;
}

async function loadEntityData(request, type, slug) {
  const directory = await fetchPublicAsset(request, "/entity-directory.json", true);
  const entity = Array.isArray(directory?.entities) ? directory.entities.find((item) => item.type === type && item.slug === slug) : null;
  if (!entity) return { entity: null, products: [], sourceProfile: null, officialProfile: null, contributions: [] };

  const fields = "id,product_name,product_url,disease_name,final_price,price_currency,prescription_required,drug_variant,company_name,company_slug,generic_name,drug_content_summary,image_urls";
  const sourceValue = entity.sourceValue || entity.name;
  const filter = type === "company" ? `company_slug=eq.${encodeURIComponent(entity.slug)}` : type === "generic" ? `generic_name=eq.${encodeURIComponent(sourceValue)}` : `disease_name=eq.${encodeURIComponent(sourceValue)}`;
  const productsPromise = supabaseRequest(`/rest/v1/verified_medicine_source_products?select=${fields}&duplicate_status=eq.active&${filter}&order=final_price.desc.nullslast&limit=100`);

  let sourceProfilePromise = Promise.resolve([]);
  let officialProfilePromise = Promise.resolve([]);
  let contributionPromise = Promise.resolve([]);
  if (type === "company") {
    const sourceFields = "id,company_name,company_slug,origin,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price";
    sourceProfilePromise = supabaseRequest(`/rest/v1/medicine_company_profiles?select=${sourceFields}&company_slug=eq.${encodeURIComponent(entity.slug)}&limit=1`);
    const officialFields = "id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,verification_status";
    officialProfilePromise = supabaseRequest(`/rest/v1/industry_company_profiles?select=${officialFields}&company_slug=eq.${encodeURIComponent(entity.slug)}&verification_status=eq.verified&is_public=eq.true&limit=1`);
    contributionPromise = supabaseRequest(`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,payload,evidence_urls,published_at&company_slug=eq.${encodeURIComponent(entity.slug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`);
  }

  const [products, sourceProfiles, officialProfiles, contributions] = await Promise.all([
    productsPromise,
    sourceProfilePromise,
    officialProfilePromise,
    contributionPromise,
  ]);
  return {
    entity,
    products,
    sourceProfile: sourceProfiles[0] || null,
    officialProfile: officialProfiles[0] || null,
    contributions,
  };
}

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return ""; }
}

export default async function handler(request, response) {
  const type = String(Array.isArray(request.query?.type) ? request.query.type[0] : request.query?.type || "");
  const rawSlug = String(Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug || "");
  const slug = safeDecode(rawSlug);
  if (!validTypes.has(type) || !slug) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("X-Robots-Tag", "noindex,nofollow");
    response.end("Invalid public entity route.");
    return;
  }

  try {
    const [indexHtml, result] = await Promise.all([fetchPublicAsset(request, "/index.html"), loadEntityData(request, type, slug)]);
    if (!result.entity) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive");
      response.end(indexHtml.replace("</head>", '    <meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>'));
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-Robots-Tag", publicRobots);
    response.end(injectMeta(indexHtml, result.entity, result.products, result.sourceProfile, result.officialProfile, result.contributions));
  } catch (error) {
    console.error("entity-meta", error);
    try {
      const indexHtml = await fetchPublicAsset(request, "/index.html");
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
      response.setHeader("X-Robots-Tag", "noindex,follow,noarchive");
      response.end(indexHtml);
    } catch {
      response.statusCode = 503;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("X-Robots-Tag", "noindex,nofollow");
      response.end("Medicine Support Hub is temporarily unavailable.");
    }
  }
}
