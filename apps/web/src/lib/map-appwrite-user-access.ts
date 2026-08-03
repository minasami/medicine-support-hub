/**
 * Unified Appwrite user → access snapshot.
 *
 * Merges:
 *  1. Staff / operational role (profiles.role / RoleProvider enums)
 *  2. Manufacturer company-rep claim (company_profile_claims + resolveCompanyRepMembership)
 *  3. Optional Appwrite Auth Labels / prefs (when provided by caller)
 *
 * Does not invent Eva/Soul for unrelated emails — that policy lives in resolve-company-rep.
 */

import {
  resolveCompanyRepMembership,
  type CompanyRepMembership,
} from "@/lib/resolve-company-rep";
import type { UserRole } from "@/lib/role";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/role";

export type StaffRole = NonNullable<UserRole>;

const STAFF_ROLES = new Set<string>([
  "REVIEWER",
  "PHARMACY_ASSISTANT",
  "PHARMACIST",
  "DELIVERY_MAN",
  "DATA_ENTRY",
  "PLATFORM_ADMIN",
  "PHYSICIAN",
  "BRANCH_MANAGER",
  "COSMETICIAN",
]);

export type AppwriteAccessLabels = {
  /** Raw Appwrite Account labels, e.g. ["platform_admin", "company:eva-pharma", "company_rep"] */
  labels?: string[] | null;
  /** Optional prefs bag from Account.getPrefs() */
  prefs?: Record<string, unknown> | null;
};

export type MapAppwriteUserToAccessArgs = {
  userId?: string | null;
  userEmail?: string | null;
  /** profiles.role or RoleProvider value */
  profileRole?: string | null;
  /** Compatibility fetch used by resolveCompanyRepMembership for legacy REST paths */
  supabaseFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
  /** Optional Appwrite Auth labels / prefs when already loaded */
  auth?: AppwriteAccessLabels;
};

export type AppwriteUserAccess = {
  userId: string;
  userEmail: string;

  /** Normalized staff role or null if consumer/unassigned */
  staffRole: StaffRole | null;
  staffRoleLabel: string | null;
  staffHomePath: string | null;

  isPlatformAdmin: boolean;
  isStaff: boolean;

  /** Manufacturer representative membership (null if not a company rep) */
  companyRep: CompanyRepMembership | null;

  /** Labels derived from Appwrite Auth (normalized lowercase) */
  labels: string[];

  /** Effective company slug for portfolio scoping (empty if none) */
  effectiveCompanySlug: string;
  effectiveCompanyName: string;

  // —— Permission helpers (pure, based on this snapshot) ——
  canReviewCompanyClaims: boolean;
  canAccessAdmin: boolean;
  /** Upload stock / draft new products for own company */
  canSubmitCompanyProducts: boolean;
  /** Edit products already in the encyclopedia for own company */
  canEditCompanyEncyclopedia: boolean;
  canEditCompanySlug: (slug: string) => boolean;
  canManagePortfolioFor: (slug: string) => boolean;
};

function normalizeSlug(slug: string | null | undefined): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseStaffRole(raw: string | null | undefined): StaffRole | null {
  if (!raw) return null;
  const upper = String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  if (STAFF_ROLES.has(upper)) return upper as StaffRole;
  // common aliases
  if (upper === "ADMIN" || upper === "PLATFORMADMIN") return "PLATFORM_ADMIN";
  if (upper === "PHARMA_REP" || upper === "COMPANY_REP") return null; // not staff
  return null;
}

function labelsFromAuth(auth?: AppwriteAccessLabels): string[] {
  const out = new Set<string>();
  for (const l of auth?.labels || []) {
    const v = String(l || "")
      .toLowerCase()
      .trim();
    if (v) out.add(v);
  }
  const prefs = auth?.prefs;
  if (prefs && typeof prefs === "object") {
    const prefLabels = prefs.labels;
    if (Array.isArray(prefLabels)) {
      for (const l of prefLabels) {
        const v = String(l || "")
          .toLowerCase()
          .trim();
        if (v) out.add(v);
      }
    }
    const rolePref = prefs.role || prefs.staff_role;
    if (rolePref) out.add(String(rolePref).toLowerCase());
    const companyPref = prefs.company_slug || prefs.companySlug;
    if (companyPref) out.add(`company:${normalizeSlug(String(companyPref))}`);
  }
  return [...out];
}

function staffFromLabels(labels: string[]): StaffRole | null {
  for (const l of labels) {
    if (l === "platform_admin" || l === "admin") return "PLATFORM_ADMIN";
    const asRole = parseStaffRole(l);
    if (asRole) return asRole;
  }
  return null;
}

function companySlugFromLabels(labels: string[]): string {
  for (const l of labels) {
    if (l.startsWith("company:")) return normalizeSlug(l.slice("company:".length));
  }
  return "";
}

/**
 * Build a single access snapshot for the signed-in Appwrite user.
 */
export async function mapAppwriteUserToAccess(
  args: MapAppwriteUserToAccessArgs,
): Promise<AppwriteUserAccess> {
  const userId = String(args.userId || "");
  const userEmail = String(args.userEmail || "")
    .toLowerCase()
    .trim();

  const labels = labelsFromAuth(args.auth);

  let staffRole =
    parseStaffRole(args.profileRole) || staffFromLabels(labels) || null;

  // Label platform_admin overrides weaker profile values
  if (labels.includes("platform_admin") || labels.includes("admin")) {
    staffRole = "PLATFORM_ADMIN";
  }

  const isPlatformAdmin = staffRole === "PLATFORM_ADMIN";
  const isStaff = staffRole != null;

  const companyRep = await resolveCompanyRepMembership({
    userId: args.userId,
    userEmail: args.userEmail,
    profileRole: args.profileRole,
    supabaseFetch: args.supabaseFetch,
  });

  // Prefer claim slug; fall back to Appwrite label company:{slug}
  const labelSlug = companySlugFromLabels(labels);
  const effectiveCompanySlug = normalizeSlug(
    companyRep?.companySlug || labelSlug || "",
  );
  const effectiveCompanyName =
    companyRep?.companyName ||
    (labelSlug
      ? labelSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "");

  const isApprovedRep = Boolean(companyRep?.isRep && companyRep.isApproved);
  const isAnyRep = Boolean(companyRep?.isRep);

  const canReviewCompanyClaims = isPlatformAdmin;
  const canAccessAdmin = isPlatformAdmin;
  // Pending reps may draft/upload for their claimed company only
  const canSubmitCompanyProducts = isPlatformAdmin || isAnyRep;
  // Encyclopedia edits of existing catalog products require approval
  const canEditCompanyEncyclopedia = isPlatformAdmin || isApprovedRep;

  const canEditCompanySlug = (slug: string): boolean => {
    const target = normalizeSlug(slug);
    if (!target) return false;
    if (isPlatformAdmin) return true;
    if (!isApprovedRep) return false;
    return target === effectiveCompanySlug;
  };

  const canManagePortfolioFor = (slug: string): boolean => {
    const target = normalizeSlug(slug);
    if (!target) return false;
    if (isPlatformAdmin) return true;
    if (!isAnyRep) return false;
    return target === effectiveCompanySlug;
  };

  return {
    userId,
    userEmail,
    staffRole,
    staffRoleLabel: staffRole ? ROLE_LABELS[staffRole] : null,
    staffHomePath: staffRole ? ROLE_HOME[staffRole] : null,
    isPlatformAdmin,
    isStaff,
    companyRep,
    labels,
    effectiveCompanySlug,
    effectiveCompanyName,
    canReviewCompanyClaims,
    canAccessAdmin,
    canSubmitCompanyProducts,
    canEditCompanyEncyclopedia,
    canEditCompanySlug,
    canManagePortfolioFor,
  };
}

/** Sync helper when company membership is already resolved (e.g. tests / cached). */
export function buildAccessFromParts(input: {
  userId?: string | null;
  userEmail?: string | null;
  staffRole?: StaffRole | null;
  companyRep?: CompanyRepMembership | null;
  labels?: string[];
}): AppwriteUserAccess {
  const userId = String(input.userId || "");
  const userEmail = String(input.userEmail || "")
    .toLowerCase()
    .trim();
  const staffRole = input.staffRole ?? null;
  const isPlatformAdmin = staffRole === "PLATFORM_ADMIN";
  const companyRep = input.companyRep ?? null;
  const labels = input.labels || [];
  const effectiveCompanySlug = normalizeSlug(
    companyRep?.companySlug || companySlugFromLabels(labels) || "",
  );
  const isApprovedRep = Boolean(companyRep?.isRep && companyRep.isApproved);
  const isAnyRep = Boolean(companyRep?.isRep);

  return {
    userId,
    userEmail,
    staffRole,
    staffRoleLabel: staffRole ? ROLE_LABELS[staffRole] : null,
    staffHomePath: staffRole ? ROLE_HOME[staffRole] : null,
    isPlatformAdmin,
    isStaff: staffRole != null,
    companyRep,
    labels,
    effectiveCompanySlug,
    effectiveCompanyName: companyRep?.companyName || "",
    canReviewCompanyClaims: isPlatformAdmin,
    canAccessAdmin: isPlatformAdmin,
    canSubmitCompanyProducts: isPlatformAdmin || isAnyRep,
    canEditCompanyEncyclopedia: isPlatformAdmin || isApprovedRep,
    canEditCompanySlug: (slug: string) => {
      const target = normalizeSlug(slug);
      if (!target) return false;
      if (isPlatformAdmin) return true;
      if (!isApprovedRep) return false;
      return target === effectiveCompanySlug;
    },
    canManagePortfolioFor: (slug: string) => {
      const target = normalizeSlug(slug);
      if (!target) return false;
      if (isPlatformAdmin) return true;
      if (!isAnyRep) return false;
      return target === effectiveCompanySlug;
    },
  };
}
