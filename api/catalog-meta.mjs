const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

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

function asAbsoluteUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `${baseUrl}${text.startsWith("/") ? text : `/${text}`}`;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function conciseDescription(product) {
  const name = firstNonEmpty(product.name_en, product.name_ar, `Medicine product ${product.id}`);
  const facts = [
    product.strength,
    product.dosage_form,
    product.manufacturer ? `manufacturer ${product.manufacturer}` : null,
    product.active_ingredient ? `active ingredient ${product.active_ingredient}` : null,
    product.price != null ? `catalog price ${Number(product.price).toLocaleString("en-US")} ${product.price_currency || "EGP"}` : null,
    product.barcode ? `barcode ${product.barcode}` : null,
  ].filter(Boolean);
  const description = `${name} medicine information in Egypt${facts.length ? `: ${facts.join(", ")}` : ""}. Source-backed record from Medicine Support Hub.`;
  return description.length <= 165 ? description : `${description.slice(0, 162).trimEnd()}…`;
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function injectMeta(html, product, canonicalUrl, legacyUnmapped = false) {
  const primaryName = firstNonEmpty(product.name_en, product.name_ar, `Medicine product ${product.id}`);
  const alternateName = primaryName === product.name_en ? firstNonEmpty(product.name_ar) : firstNonEmpty(product.name_en);
  const title = `${primaryName} | Medicine Information and Price | Medicine Support Hub`;
  const description = conciseDescription(product);
  const image = asAbsoluteUrl(product.egyptdwa_image_url || product.international_image_url);
  const robots = legacyUnmapped ? "noindex,follow,noarchive" : publicRobots;

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${escapeHtml(robots)}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="product" />`);
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);

  if (image) {
    html = replaceTag(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`);
    html = replaceTag(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Drug", "Product"],
        "@id": `${canonicalUrl}#medicine`,
        name: primaryName,
        ...(alternateName ? { alternateName } : {}),
        url: canonicalUrl,
        description,
        ...(image ? { image: [image] } : {}),
        ...(product.code ? { sku: String(product.code) } : {}),
        ...(product.barcode ? { identifier: String(product.barcode) } : {}),
        ...(product.display_category || product.category ? { category: product.display_category || product.category } : {}),
        ...(product.manufacturer ? { manufacturer: { "@type": "Organization", name: product.manufacturer } } : {}),
        ...(product.active_ingredient ? { activeIngredient: product.active_ingredient } : {}),
        ...(product.dosage_form ? { dosageForm: product.dosage_form } : {}),
        ...(product.strength ? { strength: product.strength } : {}),
        ...(product.price != null ? {
          offers: {
            "@type": "Offer",
            url: canonicalUrl,
            price: String(product.price),
            priceCurrency: product.price_currency || "EGP",
          },
        } : {}),
        ...((product.egyptdwa_source_url || product.international_source_url) ? {
          isBasedOn: [product.egyptdwa_source_url, product.international_source_url].filter(Boolean),
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` },
          { "@type": "ListItem", position: 2, name: "Medicine Encyclopedia", item: `${baseUrl}/medicines` },
          { "@type": "ListItem", position: 3, name: primaryName, item: canonicalUrl },
        ],
      },
    ],
  };

  html = html.replace(
    "</head>",
    `    <script type="application/ld+json" data-server-seo="true">${safeJson(productJsonLd)}</script>\n  </head>`,
  );
  return { html, robots };
}

function requestHeader(request, name) {
  const value = request.headers?.[name];
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : null;
}

async function fetchIndexHtml(request) {
  const forwardedHost = requestHeader(request, "x-forwarded-host");
  const host = forwardedHost || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app";
  const forwardedProto = requestHeader(request, "x-forwarded-proto");
  const protocol = forwardedProto || (host.includes("localhost") ? "http" : "https");
  const headers = { "x-medicine-support-meta-render": "1" };

  for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) {
    const value = requestHeader(request, name);
    if (value) headers[name] = value;
  }

  const response = await fetch(`${protocol}://${host}/index.html`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not load the application shell: HTTP ${response.status}`);
  return await response.text();
}

function supabaseConfig() {
  const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are unavailable.");
  return { url, key };
}

async function supabaseRequest(path, init = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Supabase request failed: HTTP ${response.status}`);
  return await response.json();
}

const catalogFields = [
  "id",
  "legacy_medicine_id",
  "name_en",
  "name_ar",
  "dosage_form",
  "strength",
  "category",
  "display_category",
  "manufacturer",
  "active_ingredient",
  "barcode",
  "price",
  "price_currency",
  "code",
  "egyptdwa_image_url",
  "egyptdwa_source_url",
  "international_image_url",
  "international_source_url",
].join(",");

async function loadProduct(id, legacy) {
  if (!legacy) {
    const rows = await supabaseRequest(`/rest/v1/medicines_catalog_enriched_v1?select=${catalogFields}&id=eq.${id}&limit=1`);
    return { product: rows[0] || null, legacyUnmapped: false };
  }

  const mapped = await supabaseRequest("/rest/v1/rpc/resolve_legacy_medicine_catalog", {
    method: "POST",
    body: JSON.stringify({ p_legacy_medicine_id: id }),
  });
  if (mapped[0]) return { product: mapped[0], legacyUnmapped: false };

  const legacyFields = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,barcode";
  const rows = await supabaseRequest(`/rest/v1/medicines?select=${legacyFields}&id=eq.${id}&is_active=eq.true&limit=1`);
  if (!rows[0]) return { product: null, legacyUnmapped: true };

  return {
    product: {
      ...rows[0],
      legacy_medicine_id: rows[0].id,
      display_category: rows[0].category,
      price: null,
      price_currency: "EGP",
      code: null,
      egyptdwa_image_url: null,
      egyptdwa_source_url: null,
      international_image_url: null,
      international_source_url: null,
    },
    legacyUnmapped: true,
  };
}

export default async function handler(request, response) {
  const rawId = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const id = Number(rawId);
  const legacy = String(Array.isArray(request.query?.legacy) ? request.query.legacy[0] : request.query?.legacy || "") === "1";

  if (!Number.isInteger(id) || id <= 0) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("X-Robots-Tag", "noindex,nofollow");
    response.end("Invalid medicine identifier.");
    return;
  }

  try {
    const [indexHtml, result] = await Promise.all([fetchIndexHtml(request), loadProduct(id, legacy)]);
    if (!result.product) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive");
      response.end(indexHtml.replace("</head>", '    <meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>'));
      return;
    }

    const canonicalUrl = result.legacyUnmapped
      ? `${baseUrl}/medicines/${id}`
      : `${baseUrl}/catalog/${result.product.id}`;
    const rendered = injectMeta(indexHtml, result.product, canonicalUrl, result.legacyUnmapped);

    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-Robots-Tag", rendered.robots);
    response.end(rendered.html);
  } catch (error) {
    console.error("catalog-meta", error);
    try {
      const indexHtml = await fetchIndexHtml(request);
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
