const baseUrl = "https://medicine-support-hub.vercel.app";
const canonicalUrl = `${baseUrl}/opportunities`;
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

function requestHeader(request, name) {
  const value = request.headers?.[name];
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : null;
}

function requestOrigin(request) {
  const host = requestHeader(request, "x-forwarded-host") || requestHeader(request, "host") || process.env.VERCEL_URL || "medicine-support-hub.vercel.app";
  const protocol = requestHeader(request, "x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

async function fetchIndex(request) {
  const headers = { "x-medicine-support-meta-render": "1" };
  for (const name of ["cookie", "authorization", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) {
    const value = requestHeader(request, name);
    if (value) headers[name] = value;
  }
  const response = await fetch(`${requestOrigin(request)}/index.html`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Could not load index.html: HTTP ${response.status}`);
  return response.text();
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace("</head>", `    ${replacement}\n  </head>`);
}

function injectMeta(html) {
  const title = "Healthcare Collaboration Opportunities | Medicine Support Hub";
  const description = "Discover reviewed healthcare collaboration opportunities from verified pharmaceutical and medical-product companies, including patient support, access, donations, procurement, education, research, distribution, and technology partnerships.";
  const keywords = "healthcare partnerships, pharmaceutical collaboration, patient support programs, medicine donations, healthcare procurement, medical education partnerships";

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${escapeHtml(keywords)}" />`);
  html = replaceTag(html, /<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${publicRobots}" />`);
  html = replaceTag(html, /<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonicalUrl}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="website" />`);
  html = replaceTag(html, /<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:card["'][^>]*>/i, `<meta name="twitter:card" content="summary" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:title["'][^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta\s+name=["']twitter:description["'][^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`);

  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#page`,
        name: "Healthcare Collaboration Opportunities",
        url: canonicalUrl,
        description,
        audience: [
          { "@type": "Audience", audienceType: "Pharmaceutical and medical-product companies" },
          { "@type": "Audience", audienceType: "NGOs, pharmacies, hospitals, clinicians, researchers, distributors, suppliers, and public-health organizations" },
        ],
        isPartOf: { "@id": `${baseUrl}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Medicine Support Hub", item: `${baseUrl}/` },
          { "@type": "ListItem", position: 2, name: "Healthcare Collaboration Opportunities", item: canonicalUrl },
        ],
      },
    ],
  };
  return html.replace("</head>", `    <script type="application/ld+json" data-server-seo="opportunities">${safeJson(structured)}</script>\n  </head>`);
}

export default async function handler(request, response) {
  try {
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    response.setHeader("X-Robots-Tag", publicRobots);
    response.end(injectMeta(await fetchIndex(request)));
  } catch (error) {
    console.error("opportunities-meta", error);
    response.statusCode = 503;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("X-Robots-Tag", "noindex,nofollow,noarchive");
    response.end("Medicine Support Hub is temporarily unavailable.");
  }
}
