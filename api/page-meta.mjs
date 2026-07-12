const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const routes = {
  home: { path: "/", title: "Medicine Support Hub | Connected Healthcare and Medicines Platform", description: "A connected healthcare platform for medicine discovery, verified product intelligence, company profiles, patient support, pharmacy operations, NGO programs, and impact reporting.", keywords: "medicine support platform, medicine encyclopedia, healthcare platform, NGO healthcare, pharmacy management" },
  search: { path: "/search", title: "Universal Healthcare Search | Medicine Support Hub", description: "Search medicines, verified products, companies, generics, disease areas, sources, pharmacy operations, programs, and healthcare workflows.", filtered: true },
  medicines: { path: "/medicines", title: "Medicine Search, Price Evidence, and Marketplace | Medicine Support Hub", description: "Search the deduplicated medicine encyclopedia, inspect source-backed price history, compare reviewed B2B offers, and contribute attributable medicine knowledge.", keywords: "medicine encyclopedia, medicine search engine, medicine prices, pharmacy marketplace, medicine suppliers", filtered: true },
  marketplace: { path: "/marketplace", title: "Verified B2B Medicine Marketplace | Medicine Support Hub", description: "Compare approved medicine offers from verified pharmacies, warehouses, and distribution companies, then request accountable B2B quotations linked to canonical medicine evidence.", keywords: "medicine marketplace, pharmacy suppliers, medicine warehouses, medicine distributors, B2B medicine quotes", filtered: true },
  verifiedProducts: { path: "/verified-products", title: "Verified Medicine Products Database | Medicine Support Hub", description: "Search verified medicine products by name, generic, company, disease area, prescription status, specification, and highest verified price.", keywords: "verified medicine products, medicine prices, generic medicines, pharmaceutical companies", filtered: true },
  network: { path: "/network", title: "Healthcare Knowledge Graph | Medicine Support Hub", description: "Explore a live graph linking medicines, verified products, official company profiles, reviewed contributions, disease areas, pharmacies, healthcare programs, procurement, and impact reporting." },
  companies: { path: "/companies", title: "Pharmaceutical and Healthcare Company Profiles | Medicine Support Hub", description: "Explore connected pharmaceutical and healthcare company profiles, official capabilities, product portfolios, generics, disease areas, support programs, and reviewed contributions.", keywords: "pharmaceutical company profiles, medical product companies, healthcare companies, drug manufacturers", filtered: true },
  generics: { path: "/generics", title: "Generic Medicine Directory | Medicine Support Hub", description: "Browse canonical generic medicine pages connecting verified source products, pharmaceutical companies, disease areas, prescription signals, and observed source-market prices.", keywords: "generic medicine directory, active ingredients, generic drug products" },
  diseases: { path: "/diseases", title: "Medicine Disease-Area Directory | Medicine Support Hub", description: "Browse canonical disease-area pages connecting verified source products, generics, pharmaceutical companies, prescription signals, and observed source-market prices.", keywords: "medicine disease areas, therapeutic areas, disease medicine products" },
  industry: { path: "/industry", title: "Healthcare Industry Contribution Network | Medicine Support Hub", description: "Pharmaceutical, medical-product, device, diagnostics, biotech, supplier, distributor, and healthcare companies can claim verified profiles and contribute reviewed evidence, products, resources, and patient-support programs.", keywords: "pharmaceutical company profile, medical device company profile, medicine data contribution, healthcare industry platform, patient support programs", filtered: true },
  industryOpportunities: { path: "/industry/opportunities", title: "Healthcare Industry Opportunities and Company Growth | Medicine Support Hub", description: "Explore reviewed patient-support, education, and partnership opportunities from verified healthcare companies, while company teams strengthen profile readiness, product connections, and stakeholder visibility.", keywords: "healthcare partnerships, pharmaceutical company opportunities, patient support programs, medical education partnerships, industry marketplace" },
  integrations: { path: "/integrations", title: "Healthcare Platform Integration Hub | Medicine Support Hub", description: "Navigate the command center connecting medicine discovery, product intelligence, industry contributions, marketplace supply, pharmacy operations, healthcare programs, reporting, and staff workflows." },
  dataSource: { path: "/data-sources/item-export-20260501", title: "Medicine Data Source Record | Medicine Support Hub", description: "Review the provenance, verification rules, and public-safe fields for a medicine source dataset used by Medicine Support Hub.", type: "article" },
  manifesto: { path: "/manifesto", title: "Medicine Support Hub Manifesto | Connected Healthcare by Design", description: "Read the principles behind a connected, evidence-led platform for medicines, patient support, pharmacies, NGOs, companies, and healthcare programs.", type: "article" },
  vision: { path: "/vision", title: "Vision | Medicine Support Hub", description: "See the vision for an interconnected healthcare platform joining medicines, patients, companies, pharmacies, NGOs, programs, evidence, and impact." },
  platform: { path: "/platform", title: "Connected Healthcare Platform | Medicine Support Hub", description: "Explore the platform connecting medicine intelligence, company participation, marketplace supply, patient support, pharmacy operations, NGO programs, procurement, and reporting." },
  solutions: { path: "/solutions", title: "Healthcare Solutions | Medicine Support Hub", description: "Discover connected solutions for medicine search, company participation, verified supply offers, patient assistance, pharmacy operations, NGO delivery, procurement, and impact reporting." },
  security: { path: "/security", title: "Security and Data Protection | Medicine Support Hub", description: "Review the security, privacy, authorization, source attribution, moderation, and data-protection principles used by Medicine Support Hub." },
  research: { path: "/research", title: "Healthcare Research and Evidence | Medicine Support Hub", description: "Explore the evidence, source methodology, medicine data quality, and research foundations behind Medicine Support Hub.", type: "article" },
  contact: { path: "/contact", title: "Contact Medicine Support Hub", description: "Contact Medicine Support Hub about healthcare partnerships, medicine data, company participation, verified sellers, NGO programs, pharmacy operations, and platform collaboration." },
  brand: { path: "/brand", title: "Medicine Support Hub Brand", description: "Learn about the Medicine Support Hub identity, mission, positioning, and connected healthcare platform brand." },
  ngo: { path: "/ngo", title: "NGO Healthcare Operations | Medicine Support Hub", description: "Coordinate beneficiaries, medicine requests, budgets, procurement, partners, alternatives, and impact through one connected NGO healthcare platform." },
  clinicalAssistant: { path: "/clinical-assistant", title: "Clinical Assistant | Medicine Support Hub", description: "Use a source-aware clinical support workspace connected to medicine records, evidence, and healthcare workflows." },
  request: { path: "/request", title: "Request Medicine Support | Medicine Support Hub", description: "Submit a medicine-support request using the connected Medicine Support Hub patient assistance workflow." },
  impact: { path: "/impact", title: "Healthcare Impact Reporting | Medicine Support Hub", description: "Connect medicine support, company partnerships, beneficiary outcomes, program delivery, and evidence into clear healthcare impact reporting." },
};

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function safeJson(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }
function requestHeader(request, name) { const value = request.headers?.[name]; if (Array.isArray(value)) return value.join(", "); return value ? String(value) : null; }
function forwardedHeaders(request) { const headers = { "x-medicine-support-meta-render": "1" }; for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) { const value = requestHeader(request, name); if (value) headers[name] = value; } return headers; }
function requestOrigin(request) { const host = requestHeader(request, "x-forwarded-host") || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app"; const protocol = requestHeader(request, "x-forwarded-proto") || (host.includes("localhost") ? "http" : "https"); return `${protocol}://${host}`; }
async function fetchIndex(request) { const response = await fetch(`${requestOrigin(request)}/index.html`, { headers: forwardedHeaders(request), redirect: "follow", signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`Could not load index.html: HTTP ${response.status}`); return response.text(); }
function replaceTag(html, pattern, replacement) { return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`); }

function injectMeta(html, definition, robots) {
  const canonicalUrl = `${baseUrl}${definition.path}`;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(definition.title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(definition.description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${escapeHtml(definition.keywords || "Medicine Support Hub, connected healthcare, medicine information")}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(definition.title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(definition.description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${definition.type || "website"}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(definition.title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(definition.description)}" />`);
  const structured = { "@context": "https://schema.org", "@graph": [
    { "@type": definition.type === "article" ? "Article" : "WebPage", "@id": `${canonicalUrl}#page`, name: definition.title.replace(/ \| Medicine Support Hub$/, ""), url: canonicalUrl, description: definition.description, isPartOf: { "@id": `${baseUrl}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [ { "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` }, ...(definition.path === "/" ? [] : [{ "@type": "ListItem", position: 2, name: definition.title.replace(/ \| Medicine Support Hub$/, ""), item: canonicalUrl }]) ] },
  ] };
  html = html.replace("</head>", `    <script type="application/ld+json" data-server-seo="page">${safeJson(structured)}</script>\n  </head>`);
  return html;
}

export default async function handler(request, response) {
  const routeKey = String(Array.isArray(request.query?.route) ? request.query.route[0] : request.query?.route || "");
  const definition = routes[routeKey];
  if (!definition) { response.statusCode = 404; response.setHeader("Content-Type", "text/plain; charset=utf-8"); response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive"); response.end("Unknown public route."); return; }
  try {
    // Vercel rewrite query objects are not a reliable representation of the visitor's
    // original URL. Keep canonical route responses indexable here; RouteSeo marks
    // actual browser filter URLs noindex after hydration.
    const robots = publicRobots;
    const html = injectMeta(await fetchIndex(request), definition, robots);
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-Robots-Tag", robots);
    response.end(html);
  } catch (error) {
    console.error("page-meta", error);
    response.statusCode = 503;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive");
    response.end("Medicine Support Hub is temporarily unavailable.");
  }
}
