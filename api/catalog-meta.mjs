const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const asAbsoluteUrl = (value) => { const text = String(value ?? "").trim(); return !text ? null : /^https?:\/\//i.test(text) ? text : `${baseUrl}${text.startsWith("/") ? text : `/${text}`}`; };
const firstNonEmpty = (...values) => values.map((value) => String(value ?? "").trim()).find(Boolean) || null;

function conciseDescription(product) {
  const name = firstNonEmpty(product.name_en, product.name_ar, `Medicine product ${product.id}`);
  const facts = [
    product.active_ingredient,
    product.manufacturer ? `manufacturer ${product.manufacturer}` : null,
    product.category,
    product.route,
    product.price != null ? `highest observed evidence price ${Number(product.price).toLocaleString("en-US")} ${product.price_currency || "EGP"}` : null,
    Number(product.marketplace_offer_count || 0) > 0 ? `${product.marketplace_offer_count} approved marketplace offers from ${product.marketplace_seller_count} verified sellers` : null,
    Number(product.distinct_price_count || 0) > 1 ? `${product.distinct_price_count} observed price points` : null,
  ].filter(Boolean);
  const description = `${name}${facts.length ? ` — ${facts.join(", ")}` : ""}. Merged medicine record with source-backed evidence, reviewed company contributions, and verified B2B supply connections.`;
  return description.length <= 180 ? description : `${description.slice(0, 177).trimEnd()}…`;
}

function replaceTag(html, pattern, replacement) { return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`); }

function injectMeta(html, product, canonicalUrl, noindex = false) {
  const primaryName = firstNonEmpty(product.name_en, product.name_ar, `Medicine product ${product.id}`);
  const alternateName = primaryName === product.name_en ? firstNonEmpty(product.name_ar) : firstNonEmpty(product.name_en);
  const title = `${primaryName} | Prices, Offers, and Medicine Evidence | Medicine Support Hub`;
  const description = conciseDescription(product);
  const image = asAbsoluteUrl(product.image_url);
  const robots = noindex ? "noindex,follow,noarchive" : publicRobots;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, '<meta property="og:type" content="product" />');
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  if (image) { html = replaceTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`); html = replaceTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`); }
  const offer = product.lowest_marketplace_price_egp != null ? { "@type": "AggregateOffer", url: `${baseUrl}/marketplace?q=${encodeURIComponent(primaryName)}`, priceCurrency: "EGP", lowPrice: String(product.lowest_marketplace_price_egp), offerCount: Number(product.marketplace_offer_count || 0) } : product.price != null ? { "@type": "Offer", url: canonicalUrl, price: String(product.price), priceCurrency: product.price_currency || "EGP" } : null;
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": ["Drug", "Product"], "@id": `${canonicalUrl}#medicine`, name: primaryName, ...(alternateName ? { alternateName } : {}), url: canonicalUrl, description, ...(image ? { image: [image] } : {}), ...(product.code ? { sku: String(product.code) } : {}), ...(product.barcode ? { identifier: String(product.barcode) } : {}), ...(product.category ? { category: product.category } : {}), ...(product.manufacturer ? { manufacturer: { "@type": "Organization", name: product.manufacturer } } : {}), ...(product.active_ingredient ? { activeIngredient: product.active_ingredient } : {}), ...(offer ? { offers: offer } : {}), ...(product.source_url ? { isBasedOn: [product.source_url] } : {}) },
    { "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Medicine Search", item: `${baseUrl}/medicines` }, { "@type": "ListItem", position: 3, name: primaryName, item: canonicalUrl } ] },
  ] };
  html = html.replace("</head>", `    <script type="application/ld+json" data-server-seo="true">${safeJson(jsonLd)}</script>\n  </head>`);
  return { html, robots };
}

function requestHeader(request, name) { const value = request.headers?.[name]; return Array.isArray(value) ? value.join(", ") : value ? String(value) : null; }
async function fetchIndexHtml(request) { const host = requestHeader(request, "x-forwarded-host") || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app"; const protocol = requestHeader(request, "x-forwarded-proto") || (host.includes("localhost") ? "http" : "https"); const headers = { "x-medicine-support-meta-render": "1" }; for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) { const value = requestHeader(request, name); if (value) headers[name] = value; } const response = await fetch(`${protocol}://${host}/index.html`, { headers, redirect: "follow", signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`Could not load application shell: HTTP ${response.status}`); return response.text(); }
function supabaseConfig() { const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, ""); const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error("Supabase public environment variables are unavailable."); return { url, key }; }
async function supabaseRequest(path, init = {}) { const { url, key } = supabaseConfig(); let lastStatus = 0; for (let attempt = 0; attempt < 3; attempt += 1) { const response = await fetch(`${url}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) }, signal: AbortSignal.timeout(10000) }); if (response.ok) return response.json(); lastStatus = response.status; if (response.status < 500 || attempt === 2) break; await new Promise((resolve) => setTimeout(resolve, 125 * (attempt + 1))); } throw new Error(`Supabase request failed after retries: HTTP ${lastStatus}`); }

const canonicalFields = ["canonical_id","name_en","name_ar","scientific_name","manufacturer","drug_class","route","category","image_url","egyptdwa_source_url","barcode","code","current_price_egp","price_currency","distinct_price_count","source_count","has_verified_dataset","has_company_verified_source","marketplace_offer_count","marketplace_seller_count","lowest_marketplace_price_egp"].join(",");
function adaptCanonical(row) { return { id: row.canonical_id, name_en: row.name_en, name_ar: row.name_ar, active_ingredient: row.scientific_name, manufacturer: row.manufacturer, category: row.drug_class || row.category, route: row.route, image_url: row.image_url, source_url: row.egyptdwa_source_url, barcode: row.barcode, code: row.code, price: row.current_price_egp, price_currency: row.price_currency || "EGP", distinct_price_count: row.distinct_price_count, source_count: row.source_count, has_verified_dataset: row.has_verified_dataset, has_company_verified_source: row.has_company_verified_source, marketplace_offer_count: row.marketplace_offer_count, marketplace_seller_count: row.marketplace_seller_count, lowest_marketplace_price_egp: row.lowest_marketplace_price_egp }; }
async function canonicalById(id) { const rows = await supabaseRequest(`/rest/v1/medicine_encyclopedia_products_v2?select=${canonicalFields}&canonical_id=eq.${id}&limit=1`); return rows[0] ? adaptCanonical(rows[0]) : null; }
async function mapMedicines2Id(id) { const rows = await supabaseRequest(`/rest/v1/medicine_catalog_id_map_v1?select=canonical_id&source_system=eq.medicines2&source_record_key=eq.${id}&limit=1`); return rows[0]?.canonical_id || null; }
async function loadProduct(id, legacy) {
  if (!legacy) { const direct = await canonicalById(id); if (direct) return { product: direct, noindex: false }; const canonicalId = await mapMedicines2Id(id); return canonicalId ? { product: await canonicalById(canonicalId), noindex: false } : { product: null, noindex: false }; }
  const mappedLegacy = await supabaseRequest("/rest/v1/rpc/resolve_legacy_medicine_catalog", { method: "POST", body: JSON.stringify({ p_legacy_medicine_id: id }) });
  const medicines2Id = mappedLegacy[0]?.id || id;
  const canonicalId = await mapMedicines2Id(medicines2Id);
  if (canonicalId) return { product: await canonicalById(canonicalId), noindex: false };
  const rows = await supabaseRequest(`/rest/v1/medicines?select=id,name_en,name_ar,category,manufacturer,active_ingredient,barcode&id=eq.${id}&is_active=eq.true&limit=1`);
  return rows[0] ? { product: { ...rows[0], price: null, price_currency: "EGP", image_url: null, source_url: null }, noindex: true } : { product: null, noindex: true };
}

export default async function handler(request, response) {
  const rawId = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const id = Number(rawId);
  const legacy = String(Array.isArray(request.query?.legacy) ? request.query.legacy[0] : request.query?.legacy || "") === "1";
  if (!Number.isSafeInteger(id) || id <= 0) { response.statusCode = 400; response.setHeader("Content-Type", "text/plain; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow"); response.end("Invalid medicine identifier."); return; }
  try {
    const [indexHtml, result] = await Promise.all([fetchIndexHtml(request), loadProduct(id, legacy)]);
    if (!result.product) { response.statusCode = 404; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end(indexHtml.replace("</head>", '    <meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>')); return; }
    const canonicalUrl = result.noindex ? `${baseUrl}/medicines/${id}` : `${baseUrl}/catalog/${result.product.id}`;
    const rendered = injectMeta(indexHtml, result.product, canonicalUrl, result.noindex);
    response.statusCode = 200; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400"); response.setHeader("X-Robots-Tag", rendered.robots); response.end(rendered.html);
  } catch (error) {
    console.error("catalog-meta", error);
    try { const indexHtml = await fetchIndexHtml(request); response.statusCode = 200; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600"); response.setHeader("X-Robots-Tag", "noindex,follow,noarchive"); response.end(indexHtml); }
    catch { response.statusCode = 503; response.setHeader("Content-Type", "text/plain; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow"); response.end("Medicine Support Hub is temporarily unavailable."); }
  }
}
