export type SeoEntityType = "company" | "generic" | "disease";

export type SeoEntity = {
  type: SeoEntityType;
  slug: string;
  name: string;
  sourceValue?: string;
  records: number;
  origin?: string | null;
  activeRecords?: number;
  genericCount?: number;
  diseaseCount?: number;
  prescriptionRecords?: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  official?: boolean;
  companyType?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  country?: string | null;
  city?: string | null;
  fullAddress?: string | null;
  contactEmail?: string | null;
  mobilePhone?: string | null;
  whatsappSameAsMobile?: boolean;
  whatsappPhone?: string | null;
  aliases?: string[];
  aliasSlugs?: string[];
  therapeuticAreas?: string[];
  productCategories?: string[];
  capabilities?: string[];
  supportPrograms?: string[];
};

export type SeoEntityDirectory = {
  generatedAt: string;
  entities: SeoEntity[];
  companyAliasTargets?: Record<string, string>;
};

type CompanyDirectoryResolution = {
  source_company_slug: string;
  canonical_company_slug: string;
  display_name: string | null;
  company_type: string | null;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  full_address: string | null;
  contact_email: string | null;
  mobile_phone: string | null;
  whatsapp_same_as_mobile: boolean | null;
  whatsapp_phone: string | null;
  is_hidden: boolean | null;
  canonical_product_count: number | null;
  alias_slugs: string[] | null;
  portfolio_slugs: string[] | null;
  official_verified: boolean | null;
  source_is_alias: boolean | null;
};

function shortHash(value: string) {
  let hash = 2166136261;
  for (const character of value.normalize("NFKC")) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

export function cleanDiseaseEntityName(value: string) {
  return value
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function seoEntitySlug(value: string) {
  const base =
    value
      .normalize("NFKD")
      .replace(/\p{Mark}+/gu, "")
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 82) || "entity";
  return `${base}-${shortHash(value)}`;
}

export function seoEntityPath(type: SeoEntityType, slug: string) {
  const prefix =
    type === "company"
      ? "companies"
      : type === "generic"
        ? "generics"
        : "diseases";
  return `/${prefix}/${encodeURIComponent(slug)}`;
}

export function cleanCompanyOrigin(value: string | null | undefined) {
  return String(value || "")
    .replace(/^\*\s*Country of Origin:\s*/i, "")
    .trim();
}

export function resolveCompanySlug(
  directory: SeoEntityDirectory | null | undefined,
  slug: string,
) {
  let current = slug;
  const seen = new Set<string>();
  while (directory?.companyAliasTargets?.[current] && !seen.has(current)) {
    seen.add(current);
    current = directory.companyAliasTargets[current];
  }
  return current;
}

export function resolveCompanyRouteSlug(
  directory: SeoEntityDirectory | null | undefined,
  routeSlug: string,
) {
  const resolvedAlias = resolveCompanySlug(directory, routeSlug);
  if (resolvedAlias !== routeSlug) return resolvedAlias;

  const matchingCompany = directory?.entities
    .filter((entity) => entity.type === "company")
    .find(
      (entity) =>
        entity.slug === routeSlug ||
        entity.aliasSlugs?.includes(routeSlug) ||
        seoEntitySlug(entity.name) === routeSlug ||
        (entity.sourceValue
          ? seoEntitySlug(entity.sourceValue) === routeSlug
          : false) ||
        entity.aliases?.some((alias) => seoEntitySlug(alias) === routeSlug),
    );
  return matchingCompany?.slug || resolvedAlias;
}

function publicSupabaseContext() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").replace(
    /\/+$/,
    "",
  );
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  if (!url || !key) return null;
  return {
    url,
    headers: {
      Accept: "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  };
}

async function fetchCompanyResolutions(): Promise<
  CompanyDirectoryResolution[]
> {
  const context = publicSupabaseContext();
  if (!context) return [];
  const select = [
    "source_company_slug",
    "canonical_company_slug",
    "display_name",
    "company_type",
    "description",
    "website_url",
    "logo_url",
    "country",
    "city",
    "full_address",
    "contact_email",
    "mobile_phone",
    "whatsapp_same_as_mobile",
    "whatsapp_phone",
    "is_hidden",
    "canonical_product_count",
    "alias_slugs",
    "portfolio_slugs",
    "official_verified",
    "source_is_alias",
  ].join(",");
  try {
    const response = await fetch(
      `${context.url}/rest/v1/company_directory_resolutions_v1?select=${encodeURIComponent(select)}&limit=5000`,
      { headers: context.headers },
    );
    if (!response.ok) return [];
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function unique(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ];
}

function applyCompanyResolutions(
  directory: SeoEntityDirectory,
  resolutions: CompanyDirectoryResolution[],
): SeoEntityDirectory {
  if (!resolutions.length) return directory;

  const aliasTargets: Record<string, string> = {};
  const resolutionsByCanonical = new Map<
    string,
    CompanyDirectoryResolution[]
  >();
  for (const row of resolutions) {
    const source = String(row.source_company_slug || "").trim();
    const canonical = String(row.canonical_company_slug || source).trim();
    if (!source || !canonical) continue;
    if (source !== canonical) aliasTargets[source] = canonical;
    const group = resolutionsByCanonical.get(canonical) || [];
    group.push(row);
    resolutionsByCanonical.set(canonical, group);
  }

  const companyBySlug = new Map(
    directory.entities
      .filter((entity) => entity.type === "company")
      .map((entity) => [entity.slug, entity] as const),
  );
  const canonicalCompanies = new Map<string, SeoEntity>();

  for (const company of companyBySlug.values()) {
    const canonical = resolveCompanySlug(
      { ...directory, companyAliasTargets: aliasTargets },
      company.slug,
    );
    const current = canonicalCompanies.get(canonical);
    if (!current) {
      canonicalCompanies.set(canonical, { ...company, slug: canonical });
      continue;
    }
    canonicalCompanies.set(canonical, {
      ...current,
      records: Math.max(
        Number(current.records || 0),
        Number(company.records || 0),
      ),
      activeRecords: Math.max(
        Number(current.activeRecords || 0),
        Number(company.activeRecords || 0),
      ),
      genericCount: Math.max(
        Number(current.genericCount || 0),
        Number(company.genericCount || 0),
      ),
      diseaseCount: Math.max(
        Number(current.diseaseCount || 0),
        Number(company.diseaseCount || 0),
      ),
      aliases: unique([
        ...(current.aliases || []),
        company.name,
        company.sourceValue,
        company.slug,
      ]),
      aliasSlugs: unique([...(current.aliasSlugs || []), company.slug]),
    });
  }

  for (const [canonical, rows] of resolutionsByCanonical) {
    const preferred =
      rows.find((row) => row.source_company_slug === canonical) ||
      rows.find((row) => row.official_verified) ||
      rows[0];
    if (!preferred || preferred.is_hidden) {
      canonicalCompanies.delete(canonical);
      continue;
    }
    const existing = canonicalCompanies.get(canonical) || {
      type: "company" as const,
      slug: canonical,
      name: preferred.display_name || canonical,
      records: Number(preferred.canonical_product_count || 0),
    };
    const sourceEntities = unique([
      canonical,
      ...(preferred.alias_slugs || []),
      ...(preferred.portfolio_slugs || []),
      ...rows.map((row) => row.source_company_slug),
    ]).map((slug) => companyBySlug.get(slug));
    canonicalCompanies.set(canonical, {
      ...existing,
      slug: canonical,
      name: preferred.display_name || existing.name,
      records: Math.max(
        Number(existing.records || 0),
        Number(preferred.canonical_product_count || 0),
      ),
      activeRecords: Math.max(
        Number(existing.activeRecords || 0),
        Number(preferred.canonical_product_count || 0),
      ),
      official: Boolean(preferred.official_verified || existing.official),
      companyType: preferred.company_type || existing.companyType || null,
      description: preferred.description || existing.description || null,
      website: preferred.website_url || existing.website || null,
      logoUrl: preferred.logo_url || existing.logoUrl || null,
      country: preferred.country || existing.country || null,
      city: preferred.city || existing.city || null,
      fullAddress: preferred.full_address || existing.fullAddress || null,
      contactEmail: preferred.contact_email || existing.contactEmail || null,
      mobilePhone: preferred.mobile_phone || existing.mobilePhone || null,
      whatsappSameAsMobile:
        preferred.whatsapp_same_as_mobile ??
        existing.whatsappSameAsMobile ??
        true,
      whatsappPhone: preferred.whatsapp_phone || existing.whatsappPhone || null,
      aliases: unique([
        ...(existing.aliases || []),
        ...sourceEntities.flatMap((entity) =>
          entity ? [entity.name, entity.sourceValue, entity.slug] : [],
        ),
      ]).filter((value) => value !== (preferred.display_name || existing.name)),
      aliasSlugs: unique([
        ...(existing.aliasSlugs || []),
        ...(preferred.alias_slugs || []),
        ...(preferred.portfolio_slugs || []),
        ...rows.map((row) => row.source_company_slug),
      ]).filter((value) => value !== canonical),
    });
  }

  return {
    ...directory,
    companyAliasTargets: aliasTargets,
    entities: [
      ...directory.entities.filter((entity) => entity.type !== "company"),
      ...canonicalCompanies.values(),
    ].sort(
      (left, right) =>
        left.type.localeCompare(right.type) ||
        Number(right.official || false) - Number(left.official || false) ||
        right.records - left.records ||
        left.name.localeCompare(right.name),
    ),
  };
}

export async function fetchSeoEntityDirectory(): Promise<SeoEntityDirectory> {
  const [response, resolutions] = await Promise.all([
    fetch("/entity-directory.json", {
      headers: { Accept: "application/json" },
    }),
    fetchCompanyResolutions(),
  ]);
  if (!response.ok) {
    throw new Error(
      `Could not load the public entity directory: HTTP ${response.status}`,
    );
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.entities)) {
    throw new Error("The public entity directory is invalid.");
  }
  return applyCompanyResolutions(data as SeoEntityDirectory, resolutions);
}
