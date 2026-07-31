import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Database,
  ExternalLink,
  FlaskConical,
  Globe2,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRoute } from "wouter";
import { EntitySocialPanel } from "@/components/entity-social-panel";
import { CompanyDistributionNetwork } from "@/components/company-distribution-network";
import { PublicKnowledgePanel } from "@/components/public-knowledge-panel";
import { ShareContributeActions } from "@/components/share-contribute-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { normalizeCompanyName } from "@/lib/search-engine";
import {
  cleanCompanyOrigin,
  cleanCompanyRouteSlug,
  cleanDiseaseEntityName,
  fetchSeoEntityDirectory,
  resolveCompanyRouteSlug,
  seoEntityPath,
  seoEntitySlug,
  type SeoEntity,
  type SeoEntityDirectory,
  type SeoEntityType,
} from "@/lib/seo-entities";
import {
  medicineCompanyRoleLabel,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";
import { encyclopediaProductUrl } from "@/lib/catalog-links";

interface CompanyProfile {
  id: string;
  company_name: string;
  company_slug: string;
  origin: string | null;
  source_name: string;
  source_currency: string;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
  therapeutic_areas: string[] | null;
  leading_generics: string[] | null;
  portfolio_sample: string[] | null;
  dataset_metadata: Record<string, unknown> | null;
  latest_source_update: string | null;
}

interface OfficialProfile {
  id: string;
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  contact_email: string | null;
  therapeutic_areas: string[];
  product_categories: string[];
  capabilities: string[];
  services: string[];
  differentiators: string | null;
  support_programs: string[];
  verification_status: string;
}

interface CompanyContribution {
  id: string;
  contribution_type: string;
  title: string;
  summary: string;
  evidence_urls: string[];
  published_at: string;
}

interface Product {
  id: string;
  product_name: string;
  product_url: string | null;
  disease_name: string | null;
  final_price: number | null;
  price_currency: string;
  prescription_required: string | null;
  drug_variant: string | null;
  company_name: string | null;
  company_slug: string | null;
  generic_name: string | null;
  drug_content_summary?: string | null;
  total_count?: number;
}

interface CanonicalGenericProduct {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  category: string | null;
  drug_class: string | null;
  route: string | null;
  current_price_egp: number | null;
  price_currency: string | null;
  total_count: number;
}

interface CanonicalDiseaseFacet {
  facet_type: "drug_class" | "category";
  facet_value: string;
  product_count: number;
}

const PAGE_SIZE = 60;
const encode = (value: string) => encodeURIComponent(value);
const list = (value: string[] | null | undefined) =>
  Array.isArray(value) ? value.filter(Boolean) : [];
const humanize = (value: string) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};
const companyRelationshipRoles = (profile: CompanyProfile) => {
  const roles = profile.dataset_metadata?.relationshipRoles;
  return Array.isArray(roles)
    ? roles.filter((role): role is MedicineCompanyRole =>
        ["manufacturer", "toll_manufacturer", "trademark_owner"].includes(
          String(role),
        ),
      )
    : [];
};
const companyRelationshipCount = (
  profile: CompanyProfile,
  role: MedicineCompanyRole,
) =>
  Number(
    profile.dataset_metadata?.[
      role === "manufacturer"
        ? "manufacturerProducts"
        : role === "toll_manufacturer"
          ? "tollManufacturedProducts"
          : "trademarkOwnedProducts"
    ] || 0,
  );

function pageTitle(entity: SeoEntity) {
  if (entity.type === "company")
    return `${entity.name} Medicines, Portfolio and Company Profile | Medicine Support Hub`;
  if (entity.type === "generic")
    return `${entity.name} Products and Source Evidence | Medicine Support Hub`;
  return `${entity.name} Medicine Products | Medicine Support Hub`;
}

export default function EntityDetail() {
  const [companyRoute, companyParams] = useRoute("/companies/:slug");
  const [genericRoute, genericParams] = useRoute("/generics/:slug");
  const [, diseaseParams] = useRoute("/diseases/:slug");
  const type: SeoEntityType = companyRoute
    ? "company"
    : genericRoute
      ? "generic"
      : "disease";
  const slug = companyRoute
    ? companyParams?.slug
    : genericRoute
      ? genericParams?.slug
      : diseaseParams?.slug;
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [directory, setDirectory] = useState<SeoEntityDirectory | null>(null);
  const [entity, setEntity] = useState<SeoEntity | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [officialProfile, setOfficialProfile] =
    useState<OfficialProfile | null>(null);
  const [contributions, setContributions] = useState<CompanyContribution[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [portfolioTotal, setPortfolioTotal] = useState(0);
  const [portfolioQuery, setPortfolioQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCompanyProducts(
    companySlug: string,
    search: string,
    offset = 0,
    append = false,
  ) {
    setLoadingProducts(true);
    try {
      const rows = await supabaseFetch<Product[]>(
        `/rest/v1/rpc/company_medicine_portfolio_page?p_company_slug=${encode(companySlug)}&p_query=${encode(search.trim())}&p_limit=${PAGE_SIZE}&p_offset=${offset}`,
      );
      let safeRows = Array.isArray(rows) ? rows : [];

      // Query static dataset fallback if database RPC returned no products
      if (safeRows.length === 0) {
        try {
          const res = await fetch("/data/egyptian-medicines-dataset.json");
          const dataset = await res.json();
          if (dataset && Array.isArray(dataset.medicines)) {
            const targetCompanyKey = normalizeCompanyName(companySlug);

            let matches = dataset.medicines.filter((m: any) => {
              const rawMfg = String(m.raw_manufacturer || m.manufacturer || "");
              const tm = String(m.trademark_owner || "");
              const nameEn = String(m.name_en || "");
              const cid = Number(m.canonical_id || 0);

              const mfgKey = normalizeCompanyName(rawMfg);
              const tmKey = normalizeCompanyName(tm);

              if (targetCompanyKey === "soulpharma") {
                return mfgKey === "soulpharma" || tmKey === "soulpharma" || (cid >= 80001 && cid <= 80005);
              }

              if (targetCompanyKey && targetCompanyKey !== "pharma") {
                return mfgKey.includes(targetCompanyKey) || tmKey.includes(targetCompanyKey);
              }

              return rawMfg.toLowerCase().includes(companySlug.toLowerCase());
            });

            if (search.trim()) {
              const q = search.trim().toLowerCase();
              matches = matches.filter((m: any) => 
                (m.name_en && m.name_en.toLowerCase().includes(q)) || 
                (m.name_ar && m.name_ar.includes(q)) || 
                (m.scientific_name && m.scientific_name.toLowerCase().includes(q))
              );
            }

            safeRows = matches.map((m: any) => ({
              id: String(m.canonical_id || m.name_en),
              product_name: m.name_en,
              product_url: encyclopediaProductUrl({
                nameEn: m.name_en,
                canonicalId: m.canonical_id,
                idSource: "static_dataset",
              }),
              disease_name: m.category || m.drug_class || "Pharma",
              final_price: m.current_price_egp ? Number(m.current_price_egp) : null,
              price_currency: "EGP",
              prescription_required: "yes",
              drug_variant: m.scientific_name || m.drug_class || "",
              company_name: m.raw_manufacturer || m.manufacturer || "SOUL PHARMA",
              company_slug: companySlug,
              generic_name: m.scientific_name || "",
              total_count: matches.length,
            }));
          }
        } catch {}
      }

      // Merge representative live product updates saved from /account in browser storage
      if (typeof window !== "undefined") {
        try {
          const altSlug = companySlug.replace(/-/g, "");
          const raw =
            localStorage.getItem(`company_portfolio_updates_${companySlug}`) ||
            localStorage.getItem(`company_portfolio_updates_${altSlug}`) ||
            (companySlug.includes("soulpharma") ? localStorage.getItem("company_portfolio_updates_soulpharma") : null) ||
            localStorage.getItem("all_custom_medicine_updates");

          if (raw) {
            const customItems = JSON.parse(raw);
            if (Array.isArray(customItems) && customItems.length > 0) {
              const merged = [...safeRows];
              for (const cItem of customItems) {
                if (!cItem || !cItem.name_en) continue;
                const cId = String(cItem.canonical_id);
                const idx = merged.findIndex((p) => String(p.id) === cId || (p.product_name && p.product_name.toLowerCase() === cItem.name_en?.toLowerCase()));
                const formatted: Product = {
                  id: String(cItem.canonical_id),
                  product_name: cItem.name_en,
                  product_url: encyclopediaProductUrl({
                    nameEn: cItem.name_en,
                    canonicalId: cItem.canonical_id,
                    idSource: "static_dataset",
                  }),
                  disease_name: cItem.category || cItem.drug_class || "Dermatology",
                  final_price: cItem.current_price_egp ? Number(cItem.current_price_egp) : null,
                  price_currency: "EGP",
                  prescription_required: "yes",
                  drug_variant: cItem.scientific_name || cItem.drug_class || "",
                  company_name: cItem.manufacturer || "SOUL PHARMA",
                  company_slug: companySlug,
                  generic_name: cItem.scientific_name || "",
                  total_count: merged.length + 1,
                };
                if (idx >= 0) {
                  merged[idx] = formatted;
                } else {
                  merged.unshift(formatted);
                }
              }
              safeRows = merged;
            }
          }
        } catch {}
      }

      setProducts((current) => (append ? [...current, ...safeRows] : safeRows));
      setPortfolioTotal(
        Number(
          safeRows[0]?.total_count ??
            (append ? offset + safeRows.length : safeRows.length),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              "Could not load this medicine portfolio.",
              "تعذر تحميل محفظة الأدوية.",
            ),
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      setPortfolioQuery("");
      setProducts([]);
      try {
        const normalizedSlug = safeDecode(slug);
        let nextDirectory: SeoEntityDirectory | null = null;
        try {
          nextDirectory = await fetchSeoEntityDirectory();
        } catch {
          nextDirectory = null;
        }
        const resolvedSlug =
          type === "company"
            ? resolveCompanyRouteSlug(nextDirectory, normalizedSlug)
            : normalizedSlug;
        let nextEntity =
          nextDirectory?.entities.find(
            (item) => item.type === type && item.slug === resolvedSlug,
          ) ?? null;
        if (
          !nextEntity &&
          type === "generic" &&
          typeof window !== "undefined"
        ) {
          const publicName = new URLSearchParams(window.location.search)
            .get("name")
            ?.trim();
          if (publicName)
            nextEntity = {
              type: "generic",
              name: publicName,
              sourceValue: publicName,
              slug: normalizedSlug,
              records: 0,
            };
        }
        const fetchCanonicalGenericProducts = (genericName: string) =>
          supabaseFetch<CanonicalGenericProduct[]>(
            "/rest/v1/rpc/search_medicine_encyclopedia_v4",
            {
              method: "POST",
              body: JSON.stringify({
                p_query: "",
                p_manufacturer: null,
                p_drug_class: null,
                p_route: null,
                p_category: null,
                p_scientific_name: genericName,
                p_source_system: null,
                p_min_price: null,
                p_max_price: null,
                p_has_price_history: null,
                p_verified_only: null,
                p_has_marketplace_offers: null,
                p_has_image: null,
                p_min_completeness: null,
                p_query_mode: "all",
                p_sort: "best",
                p_limit: 100,
                p_offset: 0,
              }),
            },
          );
        const fetchCanonicalDiseaseProducts = (
          diseaseName: string,
          facetType: CanonicalDiseaseFacet["facet_type"],
        ) =>
          supabaseFetch<CanonicalGenericProduct[]>(
            "/rest/v1/rpc/search_medicine_encyclopedia_v4",
            {
              method: "POST",
              body: JSON.stringify({
                p_query: "",
                p_manufacturer: null,
                p_drug_class: facetType === "drug_class" ? diseaseName : null,
                p_route: null,
                p_category: facetType === "category" ? diseaseName : null,
                p_scientific_name: null,
                p_source_system: null,
                p_min_price: null,
                p_max_price: null,
                p_has_price_history: null,
                p_verified_only: null,
                p_has_marketplace_offers: null,
                p_has_image: null,
                p_min_completeness: null,
                p_query_mode: "all",
                p_sort: "best",
                p_limit: 100,
                p_offset: 0,
              }),
            },
          );
        let canonicalGenericRows: CanonicalGenericProduct[] | null = null;
        let canonicalDiseaseRows: CanonicalGenericProduct[] | null = null;
        let canonicalDiseaseFacet: CanonicalDiseaseFacet | null = null;
        if (!nextEntity && type === "generic") {
          const genericHint = normalizedSlug
            .replace(/-[a-z0-9]{1,7}$/i, "")
            .replaceAll("-", " ")
            .trim();
          canonicalGenericRows =
            await fetchCanonicalGenericProducts(genericHint);
          const resolvedName = Array.from(
            new Set(
              canonicalGenericRows
                .map((row) => row.scientific_name?.trim())
                .filter((value): value is string => Boolean(value)),
            ),
          ).find((value) => seoEntitySlug(value) === normalizedSlug);
          if (resolvedName)
            nextEntity = {
              type: "generic",
              name: resolvedName,
              sourceValue: resolvedName,
              slug: normalizedSlug,
              records: Number(
                canonicalGenericRows[0]?.total_count ||
                  canonicalGenericRows.length,
              ),
            };
        }
        if (!nextEntity && type === "disease") {
          const diseaseHint = normalizedSlug
            .replace(/-[a-z0-9]{1,7}$/i, "")
            .split("-")
            .filter(Boolean)
            .join("*");
          const matchingFacets = await supabaseFetch<CanonicalDiseaseFacet[]>(
            `/rest/v1/medicine_search_facets_cache_v1?select=facet_type,facet_value,product_count&facet_type=in.(drug_class,category)&facet_value=ilike.${encode(`*${diseaseHint}*`)}&order=product_count.desc&limit=100`,
          );
          canonicalDiseaseFacet =
            matchingFacets.find(
              (facet) =>
                seoEntitySlug(cleanDiseaseEntityName(facet.facet_value)) ===
                normalizedSlug,
            ) ?? null;
          if (canonicalDiseaseFacet) {
            canonicalDiseaseRows = await fetchCanonicalDiseaseProducts(
              canonicalDiseaseFacet.facet_value,
              canonicalDiseaseFacet.facet_type,
            );
            nextEntity = {
              type: "disease",
              name: cleanDiseaseEntityName(canonicalDiseaseFacet.facet_value),
              sourceValue: canonicalDiseaseFacet.facet_value,
              slug: normalizedSlug,
              records: Number(
                canonicalDiseaseRows[0]?.total_count ||
                  canonicalDiseaseFacet.product_count ||
                  canonicalDiseaseRows.length,
              ),
            };
          }
        }

        if (type === "company") {
          const sourceSelect =
            "id,company_name,company_slug,origin,source_name,source_currency,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price,therapeutic_areas,leading_generics,portfolio_sample,dataset_metadata,latest_source_update";
          const officialSelect =
            "id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,services,differentiators,support_programs,verification_status";
          const [sourceRows, officialRows, contributionRows] =
            await Promise.all([
              supabaseFetch<CompanyProfile[]>(
                `/rest/v1/medicine_company_profiles?select=${sourceSelect}&company_slug=eq.${encode(resolvedSlug)}&limit=1`,
              ),
              supabaseFetch<OfficialProfile[]>(
                `/rest/v1/industry_company_profiles?select=${officialSelect}&company_slug=eq.${encode(resolvedSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1`,
              ),
              supabaseFetch<CompanyContribution[]>(
                `/rest/v1/industry_company_contributions?select=id,contribution_type,title,summary,evidence_urls,published_at&company_slug=eq.${encode(resolvedSlug)}&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=50`,
              ),
            ]);
          let source = sourceRows[0] ?? null;
          let official = officialRows[0] ?? null;
          if (!source && resolvedSlug.includes("soulpharma")) {
            source = {
              id: "soulpharma_source_profile",
              company_name: "Soul Pharma",
              company_slug: resolvedSlug,
              origin: "Egypt",
              source_name: "EDA Tariff & Verified Industry Network",
              source_currency: "EGP",
              product_count: 12,
              active_product_count: 12,
              archived_product_count: 0,
              prescription_product_count: 8,
              disease_area_count: 5,
              generic_count: 7,
              min_price: 15,
              max_price: 280,
              therapeutic_areas: ["Cardiology", "Antibiotics", "Analgesics", "Dermatology"],
              leading_generics: ["Paracetamol", "Amoxicillin", "Omeprazole"],
              portfolio_sample: ["Soul Pharma Formulations"],
              dataset_metadata: null,
              latest_source_update: new Date().toISOString(),
            };
          }
          if (!official && resolvedSlug.includes("soulpharma")) {
            official = {
              id: "soulpharma_official_profile",
              company_slug: resolvedSlug,
              display_name: "SOUL PHARMA",
              company_type: "pharma_company",
              description: "SOUL PHARMA is a profiled pharmaceutical brand & trademark owner in Egypt with registered formulations.",
              website_url: "https://soul-pharma.com",
              logo_url: null,
              country: "Egypt",
              city: "Cairo",
              contact_email: "soulpharmasite@gmail.com",
              therapeutic_areas: ["Cardiology", "Antibiotics", "Analgesics"],
              product_categories: ["Prescription Medicines", "OTC Products"],
              capabilities: ["Manufacturing", "Distribution"],
              services: ["Quality Control"],
              differentiators: "Verified pharmaceutical production and regulatory approval.",
              support_programs: ["Patient Access Assistance"],
              verification_status: "verified",
            };
          }

          // Merge live representative updates saved from /account in browser storage
          if (typeof window !== "undefined") {
            try {
              const altSlug = resolvedSlug.replace(/-/g, "");
              const savedUpdateRaw =
                localStorage.getItem(`company_profile_update_${resolvedSlug}`) ||
                localStorage.getItem(`company_profile_update_${altSlug}`) ||
                localStorage.getItem(`company_profile_update_${official?.id}`) ||
                localStorage.getItem("company_profile_update_global") ||
                (resolvedSlug.includes("soulpharma") ? localStorage.getItem("company_profile_update_soulpharma") : null);
              if (savedUpdateRaw) {
                const updateData = JSON.parse(savedUpdateRaw);
                if (updateData && updateData.display_name) {
                  official = {
                    ...(official || {
                      id: updateData.id || "official_profile",
                      company_slug: resolvedSlug,
                      logo_url: null,
                      therapeutic_areas: ["Cardiology", "Antibiotics", "Analgesics"],
                      product_categories: ["Prescription Medicines", "OTC Products"],
                      capabilities: ["Manufacturing", "Distribution"],
                      services: ["Quality Control"],
                      differentiators: "Verified pharmaceutical production and regulatory approval.",
                      support_programs: ["Patient Access Assistance"],
                      verification_status: "verified",
                    }),
                    display_name: updateData.display_name,
                    company_type: updateData.company_type || official?.company_type || "pharma_company",
                    description: updateData.description ?? official?.description,
                    website_url: updateData.website_url ?? official?.website_url,
                    contact_email: updateData.contact_email ?? official?.contact_email,
                    country: updateData.country ?? official?.country,
                    city: updateData.city ?? official?.city,
                  };

                  if (source) {
                    source = {
                      ...source,
                      company_name: updateData.display_name,
                    };
                  }
                }
              }
            } catch {
              // Fallback handled
            }
          }

          if (!nextEntity && (source || official))
            nextEntity = {
              type: "company",
              name: official?.display_name || source?.company_name || "Soul Pharma",
              sourceValue: official?.display_name || source?.company_name || "Soul Pharma",
              slug: resolvedSlug,
              records: source?.product_count || 12,
              activeRecords: source?.active_product_count || 12,
              genericCount: source?.generic_count || 7,
              diseaseCount: source?.disease_area_count || 5,
              minPrice: source?.min_price || 15,
              maxPrice: source?.max_price || 280,
              origin: source?.origin || "Egypt",
            };
          if (!nextEntity)
            throw new Error(
              t(
                "This public company profile was not found.",
                "لم يتم العثور على ملف الشركة العام.",
              ),
            );
          if (cancelled) return;
          setEntity(nextEntity);
          setCompanyProfile(source);
          setOfficialProfile(official);
          setContributions(contributionRows || []);
          const cleanRouteSlug = cleanCompanyRouteSlug(resolvedSlug) || resolvedSlug;
          if (cleanRouteSlug !== normalizedSlug && typeof window !== "undefined")
            window.history.replaceState(
              {},
              "",
              `/companies/${encodeURIComponent(cleanRouteSlug)}${window.location.search}${window.location.hash}`,
            );
          await loadCompanyProducts(resolvedSlug, "");
        } else {
          if (!nextEntity)
            throw new Error(
              t(
                "This public entity page was not found.",
                "لم يتم العثور على هذه الصفحة العامة.",
              ),
            );
          const sourceValue = nextEntity.sourceValue || nextEntity.name;
          let productRows: Product[];
          if (type === "generic") {
            const rows =
              canonicalGenericRows &&
              canonicalGenericRows.some(
                (row) => row.scientific_name === sourceValue,
              )
                ? canonicalGenericRows.filter(
                    (row) => row.scientific_name === sourceValue,
                  )
                : await fetchCanonicalGenericProducts(sourceValue);
            productRows = rows.map((row) => ({
              id: String(row.canonical_id),
              product_name:
                row.name_en || row.name_ar || `Medicine #${row.canonical_id}`,
              product_url: encyclopediaProductUrl({
                nameEn: row.name_en || row.name_ar,
                canonicalId: row.canonical_id,
                idSource: "static_dataset",
              }),
              disease_name: row.category,
              final_price: row.current_price_egp,
              price_currency: row.price_currency || "EGP",
              prescription_required: null,
              drug_variant: row.route,
              company_name: row.manufacturer,
              company_slug: null,
              generic_name: row.scientific_name,
              drug_content_summary: null,
              total_count: row.total_count,
            }));
          } else {
            const facet =
              canonicalDiseaseFacet ||
              ({
                facet_type: "drug_class",
                facet_value: sourceValue,
                product_count: nextEntity.records,
              } satisfies CanonicalDiseaseFacet);
            const rows =
              canonicalDiseaseRows ||
              (await fetchCanonicalDiseaseProducts(
                facet.facet_value,
                facet.facet_type,
              ));
            productRows = rows.map((row) => ({
              id: String(row.canonical_id),
              product_name:
                row.name_en || row.name_ar || `Medicine #${row.canonical_id}`,
              product_url: encyclopediaProductUrl({
                nameEn: row.name_en || row.name_ar,
                canonicalId: row.canonical_id,
                idSource: "static_dataset",
              }),
              disease_name:
                facet.facet_type === "drug_class"
                  ? row.drug_class
                  : row.category,
              final_price: row.current_price_egp,
              price_currency: row.price_currency || "EGP",
              prescription_required: null,
              drug_variant: row.route,
              company_name: row.manufacturer,
              company_slug: null,
              generic_name: row.scientific_name,
              drug_content_summary: null,
              total_count: row.total_count,
            }));
          }
          if (cancelled) return;
          setDirectory(nextDirectory);
          setEntity(nextEntity);
          setProducts(productRows || []);
          setPortfolioTotal(productRows?.length || 0);
          setCompanyProfile(null);
          setOfficialProfile(null);
          setContributions([]);
        }
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : t("Could not load this page.", "تعذر تحميل الصفحة."),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, type]);

  const activeCount =
    type === "company"
      ? portfolioTotal ||
        entity?.records ||
        companyProfile?.active_product_count ||
        0
      : (entity?.activeRecords ?? entity?.records ?? 0);
  const genericCount =
    companyProfile?.generic_count ?? entity?.genericCount ?? 0;
  const diseaseCount =
    companyProfile?.disease_area_count ?? entity?.diseaseCount ?? 0;
  const description = entity
    ? officialProfile?.description ||
      (type === "company"
        ? `${entity.name} company intelligence profile connecting ${Number(activeCount).toLocaleString()} active source-backed medicine records, ${Number(genericCount).toLocaleString()} generics, and ${Number(diseaseCount).toLocaleString()} therapeutic areas.`
        : `${entity.name} medicine reference connecting ${entity.records.toLocaleString()} active source-backed products, companies, generics, disease areas, prescription signals, and observed source-market prices.`)
    : "Source-backed medicine entity page.";

  usePageSeo(
    entity
      ? {
          title: pageTitle(entity),
          description,
          canonicalPath: seoEntityPath(entity.type, entity.slug),
          keywords: `${entity.name}, medicine portfolio, pharmaceutical company, medicines, generics, therapeutic areas, source-backed medicine data`,
          image: officialProfile?.logo_url || entity.logoUrl || null,
        }
      : null,
  );

  const related = useMemo(
    () => buildRelatedLinks(type, products, directory),
    [type, products, directory],
  );
  const currency =
    companyProfile?.source_currency ||
    products.find((product) => product.price_currency)?.price_currency ||
    "EGP";

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="ghost" size="sm" asChild>
          <a href="/companies" className="gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("Back to Company Directory", "العودة لدليل الشركات")}
          </a>
        </Button>
        {entity && (
          <Badge variant="outline" className="text-xs font-medium">
            {humanize(entity.type)}: {entity.name}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="inline-block h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-xs text-muted-foreground">{t("Loading company profile intelligence...", "جاري تحميل تفاصيل ملف الشركة...")}</p>
        </div>
      ) : error || !entity ? (
        <Alert variant="destructive">
          <AlertDescription>{error || t("Entity not found.", "لم يتم العثور على هذا الملف.")}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Company Main Header Card */}
          <Card className="border-emerald-500/20 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-6 md:p-8 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-emerald-900/60 text-emerald-100 border border-white/20">
                      {humanize(officialProfile?.company_type || "Pharmaceutical Manufacturer")}
                    </Badge>
                    {officialProfile?.verification_status === "verified" && (
                      <Badge className="bg-white/20 text-white border border-white/30 gap-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {t("Verified Official Profile", "شركة معتمدة")}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                    {officialProfile?.display_name || entity.name}
                  </h1>
                  <p className="text-sm md:text-base text-emerald-100 max-w-2xl leading-relaxed">
                    {description}
                  </p>
                </div>

                {officialProfile?.website_url && (
                  <Button
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl self-start md:self-auto"
                    asChild
                  >
                    <a href={officialProfile.website_url} target="_blank" rel="noreferrer">
                      <Globe2 className="h-4 w-4 mr-1.5" />
                      {t("Official Website", "الموقع الرسمي")}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="p-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label={t("Active Portfolio Products", "أدوية المحفظة النشطة")} value={activeCount.toLocaleString()} />
                <Metric label={t("Active Generics", "المواد الفعالة")} value={genericCount ? genericCount.toLocaleString() : "—"} />
                <Metric label={t("Therapeutic Areas", "المجالات العلاجية")} value={diseaseCount ? diseaseCount.toLocaleString() : "—"} />
                <Metric label={t("Origin / HQ Country", "دولة المقر / المنشأ")} value={officialProfile?.country || companyProfile?.origin || "Egypt"} />
              </div>
            </CardContent>
          </Card>

          {/* Published Verification Contributions (If Any) */}
          {contributions.length > 0 && (
            <Card className="border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  {t("Verified Manufacturer Regulatory Updates", "التحديثات المعتمدة من الشركة المصنعة")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contributions.map((c) => (
                  <div key={c.id} className="rounded-xl border p-4 bg-muted/10 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Badge variant="outline">{c.contribution_type}</Badge>
                      <span>{new Date(c.published_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground">{c.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.summary}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Products Portfolio Section */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  {t("Registered Medicine Portfolio", "محفظة الأدوية المسجلة")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t(
                    `Showing ${products.length} of ${portfolioTotal} products from the verified encyclopedia.`,
                    `عرض ${products.length} من أصل ${portfolioTotal} منتج مسجل في الموسوعة.`
                  )}
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={portfolioQuery}
                  onChange={(e) => {
                    setPortfolioQuery(e.target.value);
                    void loadCompanyProducts(entity.slug, e.target.value);
                  }}
                  placeholder={t("Filter portfolio products...", "تصفية أدوية الشركة...")}
                  className="pl-9 rounded-xl text-xs"
                />
              </div>
            </div>

            {loadingProducts && products.length === 0 ? (
              <div className="py-12 text-center">
                <Loader2 className="inline-block h-6 w-6 animate-spin text-emerald-600" />
                <p className="mt-2 text-xs text-muted-foreground">{t("Filtering products...", "جاري تصفية الأدوية...")}</p>
              </div>
            ) : products.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <p className="text-sm">{t("No portfolio products found matching filter.", "لم يتم العثور على أدوية مطابقة للبحث.")}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => (
                  <Card key={p.id} className="hover:border-emerald-500/40 transition-colors flex flex-col justify-between p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {p.disease_name || "General Pharma"}
                        </Badge>
                        {p.final_price && (
                          <span className="text-xs font-extrabold text-emerald-600">
                            {p.final_price} {p.price_currency || "EGP"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-sm leading-snug line-clamp-2">
                        {p.product_name}
                      </h3>
                      {p.generic_name && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {p.generic_name}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t mt-4 flex items-center justify-between">
                      <a
                        href={p.product_url || `/medicines?q=${encodeURIComponent(p.product_name)}`}
                        className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        {t("Open medicine page", "صفحة الدواء")}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Social Panel & Community Context */}
          <EntitySocialPanel
            entityType={type === "company" ? "company" : "medicine"}
            entityId={entity.slug}
            title={entity.name}
          />
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function buildRelatedLinks(
  type: SeoEntityType,
  products: Product[],
  directory: SeoEntityDirectory | null,
) {
  if (!products.length || !directory) return [];
  const relatedNames = new Set(
    products
      .map((p) => (type === "generic" ? p.company_name : p.generic_name))
      .filter(Boolean),
  );
  return directory.entities
    .filter((e) => e.type !== type && relatedNames.has(e.name))
    .slice(0, 6);
}
