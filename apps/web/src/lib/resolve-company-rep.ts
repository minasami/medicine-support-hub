/**
 * Resolve whether the signed-in user is a company representative.
 *
 * Source of truth: Appwrite table `company_profile_claims` (via company-claims-data).
 * Optional localStorage mirror for offline/dev. No Supabase dependency.
 * Never invents Eva Pharma / Soul Pharma for unrelated emails.
 */
import { listCompanyClaims } from "@/lib/company-claims-data";

export type CompanyRepMembership = {
  isRep: boolean;
  isApproved: boolean;
  companyName: string;
  companySlug: string;
  roleLabel: string;
};

type ResolveArgs = {
  userId?: string | null;
  userEmail?: string | null;
  profileRole?: string | null;
  /**
   * @deprecated Appwrite-only: unused. Kept optional so old call sites still compile.
   * Legacy PostgREST membership queries are not called.
   */
  supabaseFetch?: <T>(path: string, init?: RequestInit) => Promise<T>;
};

function matchesUser(
  item: Record<string, unknown> | null | undefined,
  userId: string,
  userEmail: string,
): boolean {
  if (!item) return false;
  const email = userEmail.toLowerCase();
  return Boolean(
    (userId && item.user_id === userId) ||
      (email &&
        item.user_email &&
        String(item.user_email).toLowerCase() === email) ||
      (email &&
        item.work_email &&
        String(item.work_email).toLowerCase() === email) ||
      (email && item.email && String(item.email).toLowerCase() === email) ||
      (email &&
        item.requested_by &&
        String(item.requested_by).toLowerCase() === email),
  );
}

function normalizeCompany(
  rawName: string | undefined,
  rawSlug: string | undefined,
  userEmail: string,
): { companyName: string; companySlug: string } {
  let name = String(rawName || "").trim();
  if (name.includes(">") || name.includes("/")) {
    const parts = name
      .split(/\s*(?:>|\/)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) name = parts[parts.length - 1];
  }

  if (/^(med\s*care|medcare|assigned\s*company|official\s*company)$/i.test(name)) {
    if (
      userEmail === "soulpharmasite@gmail.com" ||
      userEmail.includes("soulpharma")
    ) {
      name = "SOUL PHARMA";
    } else {
      name = "";
    }
  }

  if (
    !name &&
    (userEmail.includes("armanious") ||
      userEmail.includes("evapharma") ||
      userEmail.includes("eva-pharma"))
  ) {
    name = "Eva Pharma";
  }

  // Never default unknown users to Eva Pharma
  if (!name) return { companyName: "", companySlug: "" };

  const slug =
    (rawSlug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "";
  return { companyName: name, companySlug: slug };
}

export async function resolveCompanyRepMembership(
  args: ResolveArgs,
): Promise<CompanyRepMembership | null> {
  const userId = String(args.userId || "");
  const userEmail = String(args.userEmail || "")
    .toLowerCase()
    .trim();
  if (!userId && !userEmail) return null;

  // Known Soul Pharma CEO only
  if (
    userEmail === "soulpharmasite@gmail.com" ||
    userEmail.includes("soulpharma")
  ) {
    return {
      isRep: true,
      isApproved: true,
      companyName: "SOUL PHARMA",
      companySlug: "soulpharma",
      roleLabel: "Company CEO",
    };
  }

  // Appwrite claims table (primary path — no Supabase)
  if (userEmail) {
    try {
      const { claims } = await listCompanyClaims({ workEmail: userEmail });
      const found = claims.find((c) =>
        matchesUser(c as unknown as Record<string, unknown>, userId, userEmail),
      );
      if (found) {
        const { companyName, companySlug } = normalizeCompany(
          found.company_name || found.proposed_company_name,
          found.company_slug,
          userEmail,
        );
        if (companyName && companySlug) {
          return {
            isRep: true,
            isApproved:
              found.status === "approved" || found.is_approved === true,
            companyName,
            companySlug,
            roleLabel: found.role_title || "Company Representative",
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  // localStorage claim mirror (same-browser fallback)
  if (typeof window !== "undefined") {
    try {
      const keys = [
        "msh_company_claims_v1",
        "msh_representative_claims_v1",
        "msh_industry_claims_v1",
        "msh_organization_memberships_v1",
      ];
      for (const k of keys) {
        const cachedRaw = localStorage.getItem(k);
        if (!cachedRaw) continue;
        const parsed = JSON.parse(cachedRaw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const found = list.find((item: Record<string, unknown>) =>
          matchesUser(item, userId, userEmail),
        );
        if (found) {
          const { companyName, companySlug } = normalizeCompany(
            String(
              found.company_name ||
                found.proposed_company_name ||
                (found.organizations as { name?: string } | undefined)?.name ||
                "",
            ),
            String(found.company_slug || ""),
            userEmail,
          );
          if (companyName && companySlug) {
            const isApproved =
              found.status === "approved" || found.is_approved === true;
            return {
              isRep: true,
              isApproved: Boolean(isApproved),
              companyName,
              companySlug,
              roleLabel: "Company Representative",
            };
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Domain heuristic — only Eva-related emails (pending until claim exists)
  if (
    userEmail.includes("armanious") ||
    userEmail.includes("evapharma") ||
    userEmail.includes("eva-pharma")
  ) {
    return {
      isRep: true,
      isApproved: false,
      companyName: "Eva Pharma",
      companySlug: "eva-pharma",
      roleLabel: "Company Representative",
    };
  }

  // No Supabase / PostgREST membership lookups — Appwrite-only platform
  return null;
}
