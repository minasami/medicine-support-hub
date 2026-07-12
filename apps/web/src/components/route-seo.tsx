import { useEffect } from "react";
import { useLocation } from "wouter";

const baseUrl = "https://medicine-support-hub.vercel.app";
const publicRobots = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const privateRobots = "noindex,follow,noarchive";

type SeoDefinition = {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  robots?: string;
  type?: "website" | "article" | "product";
  image?: string | null;
  jsonLd?: Record<string, unknown> | null;
};

const seoByPath: Record<string, SeoDefinition> = {
  "/": {
    title: "Medicine Support Hub | Connected Healthcare and Medicines Platform",
    description: "A connected healthcare platform for medicine discovery, verified product intelligence, company profiles, patient support, pharmacy operations, NGO programs, and impact reporting.",
    keywords: "medicine support platform, medicine encyclopedia, healthcare platform, NGO healthcare, pharmacy management",
  },
  "/manifesto": {
    title: "Medicine Support Hub Manifesto | Connected Healthcare by Design",
    description: "Read the principles behind a connected, evidence-led platform for medicines, patient support, pharmacies, NGOs, and healthcare programs.",
    keywords: "healthcare platform manifesto, connected healthcare, medicine support",
    type: "article",
  },
  "/vision": { title: "Vision | Medicine Support Hub", description: "See the vision for an interconnected healthcare platform joining medicines, patients, pharmacies, NGOs, programs, evidence, and impact." },
  "/platform": { title: "Connected Healthcare Platform | Medicine Support Hub", description: "Explore the platform connecting medicine intelligence, patient support, pharmacy operations, NGO programs, procurement, and reporting." },
  "/solutions": { title: "Healthcare Solutions | Medicine Support Hub", description: "Discover connected solutions for medicine search, patient assistance, pharmacy operations, NGO delivery, procurement, and impact reporting." },
  "/security": { title: "Security and Data Protection | Medicine Support Hub", description: "Review the security, privacy, authorization, source attribution, and data-protection principles used by Medicine Support Hub." },
  "/research": { title: "Healthcare Research and Evidence | Medicine Support Hub", description: "Explore the evidence, source methodology, medicine data quality, and research foundations behind Medicine Support Hub.", type: "article" },
  "/contact": { title: "Contact Medicine Support Hub", description: "Contact Medicine Support Hub about healthcare partnerships, medicine data, NGO programs, pharmacy operations, and platform collaboration." },
  "/brand": { title: "Medicine Support Hub Brand", description: "Learn about the Medicine Support Hub identity, mission, positioning, and connected healthcare platform brand." },
  "/learn": {
    title: "Healthcare Learning Center | Medicine Support Hub",
    description: "Role-based bilingual onboarding for patients, physicians, pharmacies, laboratories, radiology centers, payers, institutions, and platform administrators.",
    keywords: "healthcare training, physician workflow training, pharmacy training, patient portal training, laboratory workflow, insurance authorization training",
  },
  "/journey": {
    title: "Connected Healthcare Journey | Medicine Support Hub",
    description: "Navigate the patient, physician, diagnostics, insurance, pharmacy, medicine-support, training, and governance journey with transparent release status and direct access paths.",
    keywords: "connected healthcare journey, patient journey platform, physician workflow, laboratory workflow, radiology workflow, insurance authorization, pharmacy dispensing, healthcare training",
  },
  "/medicines": {
    title: "Medicine Search, Price Evidence, and Marketplace | Medicine Support Hub",
    description: "Search the deduplicated medicine encyclopedia, inspect source-backed price history, compare reviewed B2B offers, and contribute attributable medicine knowledge.",
    keywords: "medicine encyclopedia, medicine search engine, medicine prices, pharmacy marketplace, medicine suppliers",
  },
  "/marketplace": {
    title: "Verified B2B Medicine Marketplace | Medicine Support Hub",
    description: "Compare approved medicine offers from verified pharmacies, warehouses, and distribution companies, then request accountable B2B quotations linked to canonical medicine evidence.",
    keywords: "medicine marketplace, pharmacy suppliers, medicine warehouses, medicine distributors, B2B medicine quotes",
  },
  "/verified-products": { title: "Verified Medicine Products Database | Medicine Support Hub", description: "Search verified medicine products by name, generic, company, disease area, prescription status, specification, and highest verified price.", keywords: "verified medicine products, medicine prices, generic medicines, pharmaceutical companies" },
  "/companies": { title: "Pharmaceutical and Healthcare Company Profiles | Medicine Support Hub", description: "Explore connected pharmaceutical and healthcare company profiles, official capabilities, product portfolios, generics, disease areas, support programs, and reviewed contributions.", keywords: "pharmaceutical company profiles, medical product companies, healthcare companies, drug manufacturers" },
  "/industry": { title: "Healthcare Industry Contribution Network | Medicine Support Hub", description: "Pharmaceutical, medical-product, device, diagnostics, biotech, supplier, distributor, and healthcare companies can claim verified profiles and contribute reviewed evidence, products, resources, and patient-support programs.", keywords: "pharmaceutical company profile, medical device company profile, medicine data contribution, healthcare industry platform, patient support programs" },
  "/industry/opportunities": { title: "Healthcare Industry Opportunities and Company Growth | Medicine Support Hub", description: "Explore reviewed patient-support, education, and partnership opportunities from verified healthcare companies, while company teams strengthen profile readiness, product connections, and stakeholder visibility.", keywords: "healthcare partnerships, pharmaceutical company opportunities, patient support programs, medical education partnerships, industry marketplace" },
  "/generics": { title: "Generic Medicine Directory | Medicine Support Hub", description: "Browse canonical generic medicine pages connecting verified source products, pharmaceutical companies, disease areas, prescription signals, and observed source-market prices.", keywords: "generic medicine directory, active ingredients, generic drug products" },
  "/diseases": { title: "Medicine Disease-Area Directory | Medicine Support Hub", description: "Browse canonical disease-area pages connecting verified source products, generics, pharmaceutical companies, prescription signals, and observed source-market prices.", keywords: "medicine disease areas, therapeutic areas, disease medicine products" },
  "/search": { title: "Universal Healthcare Search | Medicine Support Hub", description: "Search medicines, verified products, companies, generics, disease areas, sources, pharmacy operations, programs, and healthcare workflows." },
  "/network": { title: "Healthcare Knowledge Graph | Medicine Support Hub", description: "Explore a live graph linking medicines, verified products, companies, generics, disease areas, sources, pharmacy operations, programs, and reports." },
  "/integrations": { title: "Healthcare Platform Integration Hub | Medicine Support Hub", description: "Navigate the command center connecting medicine discovery, product intelligence, industry contributions, pharmacy operations, healthcare programs, reporting, and staff workflows." },
  "/data-sources/item-export-20260501": { title: "Medicine Data Source Record | Medicine Support Hub", description: "Review the provenance, verification rules, and public-safe fields for a medicine source dataset used by Medicine Support Hub.", type: "article" },
  "/impact": { title: "Healthcare Impact Reporting | Medicine Support Hub", description: "Connect medicine support, beneficiary outcomes, program delivery, partnerships, and evidence into clear healthcare impact reporting." },
  "/request": { title: "Request Medicine Support | Medicine Support Hub", description: "Submit a medicine-support request using the connected Medicine Support Hub patient assistance workflow." },
  "/clinical-assistant": { title: "Clinical Assistant | Medicine Support Hub", description: "Use a source-aware clinical support workspace connected to medicine records, evidence, and healthcare workflows." },
  "/ngo": { title: "NGO Healthcare Operations | Medicine Support Hub", description: "Coordinate beneficiaries, medicine requests, budgets, procurement, partners, alternatives, and impact through one connected NGO healthcare platform." },
};

const privatePrefixes = [
  "/workspace", "/admin", "/platform-admin", "/admin-users", "/dashboard",
  "/employee", "/reviewer", "/physician", "/pharmacist", "/pharmacy",
  "/branch-manager", "/cosmetician", "/data-entry", "/delivery", "/account",
  "/portal", "/login", "/track", "/ngo/", "/marketplace/manage",
];
const searchPaths = new Set(["/search", "/medicines", "/marketplace", "/verified-products", "/companies"]);
const serverRenderedPath = /^\/(catalog|medicines)\/\d+\/?$|^\/(companies|generics|diseases)\/[^/]+\/?$|^\/marketplace\/sellers\/[^/]+\/?$/;

function absoluteUrl(value: string) { if (/^https?:\/\//i.test(value)) return value; return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`; }
function setMeta(name: string, content: string, property = false) { const attribute = property ? "property" : "name"; let tag = document.head.querySelector(`meta[${attribute}='${name}']`) as HTMLMetaElement | null; if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, name); document.head.appendChild(tag); } tag.content = content; }
function removeMeta(name: string, property = false) { document.head.querySelector(`meta[${property ? "property" : "name"}='${name}']`)?.remove(); }
function setCanonical(url: string) { let canonical = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null; if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); } canonical.href = url; }
function setManagedJsonLd(value: Record<string, unknown> | null | undefined) { const selector = "script[type='application/ld+json'][data-route-seo='true']"; let script = document.head.querySelector(selector) as HTMLScriptElement | null; if (!value) { script?.remove(); return; } if (!script) { script = document.createElement("script"); script.type = "application/ld+json"; script.dataset.routeSeo = "true"; document.head.appendChild(script); } script.textContent = JSON.stringify(value).replace(/</g, "\\u003c"); }

export function applySeo(definition: SeoDefinition) {
  const canonicalUrl = absoluteUrl(definition.canonicalPath || "/");
  const robots = definition.robots || publicRobots;
  document.title = definition.title;
  setMeta("description", definition.description);
  setMeta("keywords", definition.keywords || "Medicine Support Hub, healthcare platform, medicine information");
  setMeta("robots", robots);
  setMeta("og:title", definition.title, true);
  setMeta("og:description", definition.description, true);
  setMeta("og:type", definition.type || "website", true);
  setMeta("og:url", canonicalUrl, true);
  setMeta("og:site_name", "Medicine Support Hub", true);
  setMeta("twitter:card", definition.image ? "summary_large_image" : "summary");
  setMeta("twitter:title", definition.title);
  setMeta("twitter:description", definition.description);
  setCanonical(canonicalUrl);
  if (definition.image) { const image = absoluteUrl(definition.image); setMeta("og:image", image, true); setMeta("twitter:image", image); } else { removeMeta("og:image", true); removeMeta("twitter:image"); }
  setManagedJsonLd(definition.jsonLd);
}

export function usePageSeo(definition: SeoDefinition | null) { const signature = definition ? JSON.stringify(definition) : ""; useEffect(() => { if (definition) applySeo(definition); }, [signature]); }
function isPrivatePath(path: string) { return privatePrefixes.some((prefix) => prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`)); }

export function RouteSeo() {
  const [location] = useLocation();
  useEffect(() => {
    const [pathAndQuery] = location.split("#");
    const [path, query = ""] = pathAndQuery.split("?");
    if (serverRenderedPath.test(path)) return;
    if (isPrivatePath(path)) { applySeo({ title: "Secure Workspace | Medicine Support Hub", description: "Authenticated Medicine Support Hub workspace.", canonicalPath: path, robots: privateRobots }); return; }
    const definition = seoByPath[path];
    if (!definition) { applySeo({ title: "Page Not Found | Medicine Support Hub", description: "The requested Medicine Support Hub page could not be found.", canonicalPath: path, robots: "noindex,nofollow,noarchive" }); return; }
    const hasSearchParameters = searchPaths.has(path) && new URLSearchParams(query).toString().length > 0;
    applySeo({ ...definition, canonicalPath: definition.canonicalPath || path, robots: hasSearchParameters ? privateRobots : definition.robots || publicRobots });
  }, [location]);
  return null;
}
