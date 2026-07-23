import { promises as fs } from "node:fs";
import path from "node:path";

const baseUrl = "https://medicinesupport.app";
const robots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const jsonLd = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
function header(request, name) { const value = request.headers?.[name]; return Array.isArray(value) ? value.join(", ") : value ? String(value) : null; }
async function shell(request) {
  try {
    const candidates = [
      path.join(process.cwd(), "apps/web/dist/public/index.html"),
      path.join(process.cwd(), "dist/public/index.html"),
      path.join(process.cwd(), "public/index.html"),
      path.join(process.cwd(), "index.html"),
    ];
    for (const file of candidates) {
      try {
        return await fs.readFile(file, "utf8");
      } catch {}
    }
  } catch {}
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Medicine Support Hub</title></head><body><div id="root"></div></body></html>';
}
function config() {
  const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "") || "https://local.invalid";
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "dummy";
  return { url, key };
}
async function rest(path) {
  const { url, key } = config();
  if (url === "https://local.invalid") return [];
  try {
    const response = await fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: AbortSignal.timeout(3000) });
    if (response.ok) return await response.json();
  } catch {}
  return [];
}
function replace(html, pattern, tag) { return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`); }
function decode(value) { try { return decodeURIComponent(value); } catch { return ""; } }
function firstImage(products, official) { if (/^https?:\/\//i.test(String(official?.logo_url || ""))) return official.logo_url; return products.map((row) => row.image_url).find((value) => /^https?:\/\//i.test(String(value || ""))) || null; }

async function load(slug) {
  const [generatedRows, officialRows, contributions, products] = await Promise.all([
    rest(`/rest/v1/medicine_manufacturer_profiles_generated?select=*&company_slug=eq.${encodeURIComponent(slug)}&limit=1`),
    rest(`/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,therapeutic_areas,product_categories,capabilities,support_programs&company_slug=eq.${encodeURIComponent(slug)}&verification_status=eq.verified&is_public=eq.true&limit=1`),
    rest(`/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.${encodeURIComponent(slug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`),
    rest(`/rest/v1/rpc/manufacturer_medicine_portfolio_v1?p_company_slug=${encodeURIComponent(slug)}&p_query=&p_limit=100&p_offset=0`),
  ]);
  return { generated: generatedRows[0] || null, official: officialRows[0] || null, contributions: Array.isArray(contributions) ? contributions : [], products: Array.isArray(products) ? products : [] };
}

function render(html, slug, data) {
  const canonical = `${baseUrl}/companies/${encodeURIComponent(slug)}`;
  const name = data.official?.display_name || data.generated?.company_name;
  const total = Number(data.generated?.product_count ?? data.products[0]?.total_count ?? data.products.length);
  const generics = Number(data.generated?.generic_count ?? 0);
  const classes = Number(data.generated?.drug_class_count ?? 0);
  const description = data.official?.description || `Encyclopedia-generated ${name} manufacturer profile connecting ${total.toLocaleString("en-US")} canonical medicine records, ${generics.toLocaleString("en-US")} scientific names, and ${classes.toLocaleString("en-US")} drug or therapeutic classes.`;
  const title = `${name} Medicines, Portfolio and Company Profile | Medicine Support Hub`;
  const image = firstImage(data.products, data.official);
  for (const [pattern, tag] of [
    [/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`],
    [/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(description)}" />`],
    [/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`],
    [/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`],
    [/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${esc(title)}" />`],
    [/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${esc(description)}" />`],
    [/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${esc(canonical)}" />`],
    [/<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${esc(title)}" />`],
    [/<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${esc(description)}" />`],
  ]) html = replace(html, pattern, tag);
  if (image) { html = replace(html, /<meta\s+property=["']og:image["'][^>]*>/i, `<meta property="og:image" content="${esc(image)}" />`); html = replace(html, /<meta\s+name=["']twitter:image["'][^>]*>/i, `<meta name="twitter:image" content="${esc(image)}" />`); }

  const items = data.products.slice(0, 20).map((row, index) => {
    const url = `${baseUrl}/catalog/${row.canonical_id}`;
    return { "@type": "ListItem", position: index + 1, item: { "@type": ["Drug", "Product"], name: row.name_en || row.name_ar || `Medicine #${row.canonical_id}`, url, ...(row.name_ar && row.name_en ? { alternateName: row.name_ar } : {}), ...(row.scientific_name ? { activeIngredient: row.scientific_name } : {}), manufacturer: { "@id": `${canonical}#organization` }, ...(row.image_url ? { image: row.image_url } : {}), ...(row.current_price_egp != null ? { offers: { "@type": "Offer", price: String(row.current_price_egp), priceCurrency: row.price_currency || "EGP", url } } : {}) } };
  });
  const knowledge = [...new Set([...(data.generated?.leading_generics || []), ...(data.generated?.leading_classes || []), ...(data.generated?.leading_routes || []), ...(data.official?.therapeutic_areas || []), ...(data.official?.product_categories || []), ...(data.official?.capabilities || [])].filter(Boolean))].slice(0, 50);
  const contributions = data.contributions.slice(0, 20).map((entry) => ({ "@type": "CreativeWork", name: entry.title, description: entry.summary, datePublished: entry.published_at, genre: String(entry.contribution_type || "").replaceAll("_", " "), ...(entry.evidence_urls?.length ? { isBasedOn: entry.evidence_urls } : {}) }));
  const graph = [
    { "@type": "Organization", "@id": `${canonical}#organization`, name, url: data.official?.website_url || canonical, description, ...(image ? { logo: image } : {}), ...(data.official?.country ? { location: { "@type": "Place", name: [data.official.city, data.official.country].filter(Boolean).join(", ") } } : {}), ...(knowledge.length ? { knowsAbout: knowledge } : {}), ...(data.official?.website_url ? { sameAs: [data.official.website_url] } : {}) },
    { "@type": "CollectionPage", "@id": `${canonical}#page`, name, url: canonical, description, mainEntity: { "@id": `${canonical}#organization` }, hasPart: [{ "@type": "ItemList", name: "Canonical medicine portfolio", numberOfItems: total, itemListElement: items }, ...contributions] },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Companies", item: `${baseUrl}/companies` }, { "@type": "ListItem", position: 3, name, item: canonical }] },
  ];
  return html.replace("</head>", `    <script type="application/ld+json" data-server-seo="company">${jsonLd({ "@context": "https://schema.org", "@graph": graph })}</script>\n  </head>`);
}

export default async function handler(request, response) {
  const slug = decode(String(Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug || ""));
  if (!slug) { response.statusCode = 400; response.setHeader("X-Robots-Tag", "noindex,nofollow"); response.end("Invalid company route."); return; }
  try {
    const [html, data] = await Promise.all([shell(request), load(slug)]);
    if (!data.generated && !data.official) { response.statusCode = 404; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end(html.replace("</head>", '    <meta name="robots" content="noindex,nofollow,noarchive" />\n  </head>')); return; }
    response.statusCode = 200; response.setHeader("Content-Type", "text/html; charset=utf-8"); response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400"); response.setHeader("X-Robots-Tag", robots); response.end(render(html, slug, data));
  } catch (error) { console.error("company-meta-canonical", error); response.statusCode = 503; response.setHeader("Content-Type", "text/plain; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end("Medicine Support Hub is temporarily unavailable."); }
}
