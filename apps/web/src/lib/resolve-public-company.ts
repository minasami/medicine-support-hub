/**
 * Resolve public company source + official profiles with DB results + fallbacks.
 */
import {
  getFallbackOfficialProfile,
  getFallbackSourceProfile,
  isEvaPharmaSlug,
  preferredCompanySlug,
  type FallbackCompanyProfile,
  type FallbackOfficialProfile,
} from "./company-profile-fallbacks";

export type ResolvedPublicCompany = {
  source: FallbackCompanyProfile | null;
  official: FallbackOfficialProfile | null;
  routeSlug: string;
};

export function resolvePublicCompanyProfiles(params: {
  resolvedSlug: string;
  sourceFromDb: FallbackCompanyProfile | null | undefined;
  officialFromDb: FallbackOfficialProfile | null | undefined;
}): ResolvedPublicCompany {
  const routeSlug = preferredCompanySlug(params.resolvedSlug);
  let source = params.sourceFromDb ?? null;
  let official = params.officialFromDb ?? null;

  if (!source) {
    source = getFallbackSourceProfile(params.resolvedSlug) || getFallbackSourceProfile(routeSlug);
  }
  if (!official) {
    official =
      getFallbackOfficialProfile(params.resolvedSlug) ||
      getFallbackOfficialProfile(routeSlug);
  }

  // Prefer canonical slug on fallbacks
  if (source && isEvaPharmaSlug(params.resolvedSlug)) {
    source = { ...source, company_slug: "eva-pharma" };
  }
  if (official && isEvaPharmaSlug(params.resolvedSlug)) {
    official = { ...official, company_slug: "eva-pharma" };
  }

  return { source, official, routeSlug };
}

export function matchesCompanyInDataset(
  companySlug: string,
  m: {
    raw_manufacturer?: string;
    manufacturer?: string;
    trademark_owner?: string;
    toll_manufacturer?: string;
    canonical_id?: number;
  },
  normalizeCompanyName: (s: string) => string,
): boolean {
  const target = normalizeCompanyName(companySlug);
  const rawMfg = String(m.raw_manufacturer || m.manufacturer || "");
  const tm = String(m.trademark_owner || "");
  const toll = String(m.toll_manufacturer || "");
  const mfgKey = normalizeCompanyName(rawMfg);
  const tmKey = normalizeCompanyName(tm);
  const tollKey = normalizeCompanyName(toll);
  const cid = Number(m.canonical_id || 0);

  if (target === "soulpharma" || companySlug.includes("soul")) {
    return (
      mfgKey === "soulpharma" ||
      tmKey === "soulpharma" ||
      (cid >= 80001 && cid <= 80005)
    );
  }

  if (isEvaPharmaSlug(companySlug) || target === "evapharma" || target === "eva") {
    return (
      mfgKey.includes("eva") ||
      tmKey.includes("eva") ||
      tollKey.includes("eva") ||
      rawMfg.toLowerCase().includes("eva") ||
      tm.toLowerCase().includes("eva")
    );
  }

  if (target && target !== "pharma") {
    return (
      mfgKey.includes(target) ||
      tmKey.includes(target) ||
      tollKey.includes(target)
    );
  }

  return rawMfg.toLowerCase().includes(companySlug.toLowerCase());
}
