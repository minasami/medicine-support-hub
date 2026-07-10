import { useEffect } from "react";
import { useLocation } from "wouter";

const baseUrl = "https://medicine-support-hub.vercel.app";

const seoByPath: Record<string, { title: string; description: string; keywords: string }> = {
  "/": {
    title: "Medicine Support Hub | Connected Healthcare and Medicines Platform",
    description: "A connected healthcare platform for medicine discovery, verified product intelligence, company profiles, patient support, pharmacy operations, NGO programs, and impact reporting.",
    keywords: "medicine support platform, medicine encyclopedia, healthcare platform, NGO healthcare, pharmacy management",
  },
  "/medicines": {
    title: "Medicine Encyclopedia | Medicine Support Hub",
    description: "Search a source-backed medicine encyclopedia with verified prices, barcodes, dosage forms, strengths, and connected healthcare workflows.",
    keywords: "medicine encyclopedia, drug database, medicine prices, barcode medicines",
  },
  "/verified-products": {
    title: "Verified Medicine Products Database | Medicine Support Hub",
    description: "Search verified medicine products by name, generic, company, disease area, prescription status, specification, and highest verified price.",
    keywords: "verified medicine products, medicine prices, generic medicines, pharmaceutical companies",
  },
  "/companies": {
    title: "Pharmaceutical Company Profiles | Medicine Support Hub",
    description: "Explore pharmaceutical company profiles, product portfolios, generic coverage, disease areas, and verified price ranges.",
    keywords: "pharmaceutical company profiles, drug manufacturers, medicine companies",
  },
  "/search": {
    title: "Universal Healthcare Search | Medicine Support Hub",
    description: "Search medicines, verified products, companies, generics, disease areas, sources, pharmacy operations, programs, and healthcare workflows.",
    keywords: "healthcare search engine, medicine search, pharmaceutical search",
  },
  "/network": {
    title: "Healthcare Knowledge Graph | Medicine Support Hub",
    description: "Explore a live graph linking medicines, verified products, companies, generics, disease areas, sources, pharmacy operations, programs, and reports.",
    keywords: "healthcare knowledge graph, medicine graph, pharmaceutical data connections",
  },
  "/integrations": {
    title: "Healthcare Platform Integration Hub | Medicine Support Hub",
    description: "Navigate the command center connecting medicine discovery, product intelligence, pharmacy operations, healthcare programs, reporting, and staff workflows.",
    keywords: "healthcare integration platform, pharmacy integration, medicine platform",
  },
};

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? "property" : "name";
  let tag = document.head.querySelector(`meta[${attribute}='${name}']`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function RouteSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location.split("?")[0];
    const seo = seoByPath[path] || seoByPath["/"];
    const canonicalUrl = `${baseUrl}${path === "/" ? "/" : path}`;

    document.title = seo.title;
    setMeta("description", seo.description);
    setMeta("keywords", seo.keywords);
    setMeta("og:title", seo.title, true);
    setMeta("og:description", seo.description, true);
    setMeta("og:url", canonicalUrl, true);
    setMeta("twitter:title", seo.title);
    setMeta("twitter:description", seo.description);

    let canonical = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [location]);

  return null;
}
