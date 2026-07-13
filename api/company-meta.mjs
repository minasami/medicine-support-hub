const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
function requestHeader(request, name) { const value = request.headers?.[name]; return Array.isArray(value) ? value.join(", ") : value ? String(value) : null; }
function forwardedHeaders(request) { const headers = { "x-medicine-support-meta-render": "1" }; for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) { const value = requestHeader(request, name); if (value) headers[name] = value; } return headers; }
function requestOrigin(request) { const host = requestHeader(request, "x-forwarded-host") || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app"; const protocol = requestHeader(request, "x-forwarded-proto") || (host.includes("localhost") ? "http" : "https"); return `${protocol}://${host}`; }
async function fetchShell(request) { const response = await fetch(`${requestOrigin(request)}/index.html`, { headers: forwardedHeaders(request), signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`Could not load application shell: HTTP ${response.status}`); return response.text(); }
function config() { const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, ""); const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error("Supabase public environment variables are unavailable."); return { url, key }; }
async function rest(path) { const { url, key } = config(); const response = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) }); if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`); return response.json(); }
function replaceTag(html, pattern, replacement) { return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`); }
function safeDecode(value) { try { return decodeURIComponent(value); } catch { return ""; } }
function firstImage(products, official) { const logo = String(official?.logo_url || "").trim(); if (/^https?:\/\//i.test(logo)) return logo; for (const product of products) { const match = String(product.image_urls || "").match(/https?:\/\/[^\s,|]+/i); if (match) return match[0]; } return null; }

async function loadCompany(slug) {
  const generatedFields = "company_slug,company_name,product_count,generic_count,drug_class_count,route_count,products_with_images,products_with_price_history,products_with_marketplace_offers,min_price_egp,max_price_egp,leading_generics,leading_classes,leading_routes,portfolio_sample_names,source_name,generated_at";
  const officialFields = "id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,therapeutic_areas,product_categories,capabilities,support_programs";
  const [generatedRows, sourceRows, officialRows, contributions, products] = await Promise.all([
    rest(`/rest/v1/medicine_manufacturer_profiles_generated?select=${generatedFields}&company_slug=eq.${encodeURIComponent(slug)}&limit=1`),
    rest(`/rest/v1/medicine_company_profiles?select=company_slug,company_name,origin,source_name,source_currency,product_count,active_product_count,disease_area_count,generic_count,min_price,max_price,therapeutic_areas,leading_generics,portfolio_sample,latest_source_update&company_slug=eq.${encodeURIComponent(slug)}&limit=1`),
    rest(`/rest/v1/industry_company_profiles?select=${officialFields}&company_slug=eq.${encodeURIComponent(slug)}&verification_status=eq.verified&is_public=eq.true&limit=1`),
    rest(`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`),
    rest(`/rest/v1/rpc/company_medicine_portfolio_page?p_company_slug=${encodeURIComponent(slug)}&p_query=&p_limit=100&p_offset=0`),
  ]);
  return { generated: generatedRows[0] || null, source: sourceRows[0] || null, official: officialRows[0] || null, contributions: Array.isArray(contributions) ? contributions : [], products: Array.isArray(products) ? products : [] };
}

function inject(html, slug, data) {
  const canonicalUrl = `${baseUrl}/companies/${encodeURIComponent(slug)}`;
  const name = data.official?.display_name || data.generated?.company_name || data.source?.company_name;
  const productCount = Number(data.generated?.product_count ?? data.source?.active_product_count ?? data.source?.product_count ?? data.products[0]?.total_count ?? data.products.length);
  const genericCount = Number(data.generated?.generic_count ?? data.source?.generic_count ?? 0);
  const classCount = Number(data.generated?.drug_class_count ?? data.source?.disease_area_count ?? 0);
  const description = data.official?.description || `${data.official ? "Verified official and encyclopedia-derived" : "Encyclopedia-generated"} ${name} manufacturer profile connecting ${productCount.toLocaleString("en-US")} canonical medicine records, ${genericCount.toLocaleString("en-US")} scientific names, and ${classCount.toLocaleString("en-US")} drug or therapeutic classes.`;
  const title = `${name} Medicines, Portfolio and Company Profile | Medicine Support Hub`;
  const image = firstImage(data.products, data.official);

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${publicRobots}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="website" />');
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  if (image) { html = replaceTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`); html = replaceTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`); }

  const itemList = data.products.slice(0, 20).map((product, index) => {
    const url = product.product_url?.startsWith("/") ? `${baseUrl}${product.product_url}` : product.product_url || canonicalUrl;
    const productImage = String(product.image_urls || "").match(/https?:\/\/[^\s,|]+/i)?.[0];
    return { "@type": "ListItem", position: index + 1, item: { "@type": ["Drug", "Product"], name: product.product_name, url, ...(product.generic_name ? { activeIngredient: product.generic_name } : {}), manufacturer: { "@id": `${canonicalUrl}#organization` }, ...(productImage ? { image: productImage } : {}), ...(product.final_price != null ? { offers: { "@type": "Offer", price: String(product.final_price), priceCurrency: product.price_currency || "EGP", url } } : {}) } };
  });
  const knowledge = [...new Set([...(data.generated?.leading_generics || []), ...(data.generated?.leading_classes || []), ...(data.generated?.leading_routes || []), ...(data.official?.therapeutic_areas || []), ...(data.official?.product_categories || []), ...(data.official?.capabilities || [])].filter(Boolean))].slice(0, 50);
  const evidence = [...new Set(data.contributions.flatMap((entry) => Array.isArray(entry.evidence_urls) ? entry.evidence_urls : []).filter(Boolean))].slice(0, 30);
  const graph = [
    { "@type": "Organization", "@id": `${canonicalUrl}#organization`, name, url: data.official?.website_url || canonicalUrl, description, ...(image ? { logo: { "@type": "ImageObject", url: image } } : {}), ...(data.official?.country ? { location: { "@type": "Place", name: [data.official.city, data.official.country].filter(Boolean).join(", ") } } : {}), ...(knowledge.length ? { knowsAbout: knowledge } : {}), ...(data.official?.website_url ? { sameAs: [data.official.website_url] } : {}) },
    { "@type": "CollectionPage", "@id": `${canonicalUrl}#page`, name, url: canonicalUrl, description, mainEntity: { "@id": `${canonicalUrl}#organization` }, hasPart: [{ "@type": "ItemList", name: "Canonical medicine portfolio", numberOfItems: productCount, itemListElement: itemList }, ...data.contributions.slice(0, 20).map((entry) => ({ "@type": "CreativeWork", name: entry.title, description: entry.summary, datePublished: entry.published_at, isBasedOn: entry.evidence_urls }))], ...(evidence.length ? { isBasedOn: evidence } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Companies", item: `${baseUrl}/companies` }, { "@type": "ListItem", position: 3, name, item: canonicalUrl }] },
  ];
  return html.replace("</head>", `    <script type="application/ld+json" data-server-seo="company">${safeJson({ "@context": "https://schema.org", "@graph": graph })}</script>\n  </head>`);
}

export default async function handler(request, response) {
  const rawSlug = String(Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug || "");
  const slug = safeDecode(rawSlug);
  if (!slug) { response.statusCode = 400; response.setHeader("X-Robots-Tag", "noindex,nofollow"); response.end("Invalid company route."); return; }
  try {
    const [shell, data] = await Promise.all([fetchShell(request), loadCompany(slug)]);
    const name = data.official?.display_name || data.generated?.company_name || data.source?.company_name;
    if (!name) { response.statusCode = 404; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end(shell.replace("</head>", '    <meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>')); return; }
    response.statusCode = 200; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400"); response.setHeader("X-Robots-Tag", publicRobots); response.end(inject(shell, slug, data));
  } catch (error) {
    console.error("company-meta", error);
    response.statusCode = 503; response.setHeader("Content-Type", "text/plain; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end("Medicine Support Hub is temporarily unavailable.");
  }
}
