/**
 * Manufacturer organization role hierarchy.
 *
 * CEO
 *  ├─ product_manager  (one or more product lines or SKU sets)
 *  ├─ line_manager      (specific product line(s))
 *  ├─ company_rep       (general contributor; often pending claim)
 *  └─ viewer            (read-only)
 *
 * Appwrite table (to provision): company_team_members
 * Access checks use membership + optional claim approval.
 */

export type CompanyOrgRole =
  | "company_ceo"
  | "product_manager"
  | "line_manager"
  | "company_rep"
  | "viewer";

export type CompanyTeamMemberStatus = "pending" | "active" | "revoked";

export type CompanyTeamMember = {
  id?: string;
  company_slug: string;
  company_name?: string;
  user_email: string;
  user_id?: string | null;
  role: CompanyOrgRole;
  /** Therapeutic / commercial lines this member may edit */
  product_lines?: string[];
  /** Explicit SKU allow-list (canonical encyclopedia IDs) */
  product_canonical_ids?: number[];
  status: CompanyTeamMemberStatus;
  invited_by?: string | null;
  invited_at?: string | null;
  notes?: string | null;
};

export const COMPANY_ORG_ROLE_LABELS: Record<CompanyOrgRole, string> = {
  company_ceo: "Company CEO",
  product_manager: "Product Manager",
  line_manager: "Line Manager",
  company_rep: "Company Representative",
  viewer: "Viewer",
};

export const COMPANY_ORG_ROLE_RANK: Record<CompanyOrgRole, number> = {
  company_ceo: 100,
  product_manager: 70,
  line_manager: 50,
  company_rep: 30,
  viewer: 10,
};

export function normalizeCompanySlug(slug: string | null | undefined): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeLineKey(line: string | null | undefined): string {
  return String(line || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** CEO and active product managers can invite lower roles. */
export function canInviteRole(
  actor: CompanyOrgRole,
  target: CompanyOrgRole,
): boolean {
  if (actor === "company_ceo") return target !== "company_ceo" || true; // CEO may add co-CEO if desired
  if (actor === "product_manager") {
    return target === "line_manager" || target === "viewer" || target === "company_rep";
  }
  return false;
}

export type ProductScopeInput = {
  company_slug: string;
  product_line?: string | null;
  canonical_id?: number | null;
};

/**
 * Whether a team member may edit a product under governance rules.
 * Does not replace platform-admin overrides.
 */
export function memberCanEditProduct(
  member: CompanyTeamMember | null | undefined,
  product: ProductScopeInput,
  opts?: { claimApproved?: boolean },
): boolean {
  if (!member || member.status !== "active") return false;
  if (normalizeCompanySlug(member.company_slug) !== normalizeCompanySlug(product.company_slug)) {
    return false;
  }

  // Pending company_rep cannot edit live encyclopedia rows
  if (member.role === "company_rep" && opts?.claimApproved === false) return false;
  if (member.role === "viewer") return false;

  if (member.role === "company_ceo") return true;

  const ids = (member.product_canonical_ids || []).map(Number).filter(Boolean);
  if (product.canonical_id && ids.length > 0 && ids.includes(Number(product.canonical_id))) {
    return true;
  }

  const lines = (member.product_lines || []).map(normalizeLineKey).filter(Boolean);
  if (lines.length === 0) {
    // product_manager with no lines = all lines for company (CEO-delegated full PM)
    return member.role === "product_manager";
  }

  const productLine = normalizeLineKey(product.product_line);
  if (!productLine) return false;
  return lines.some((l) => productLine === l || productLine.includes(l) || l.includes(productLine));
}

export function memberCanSubmitDrafts(member: CompanyTeamMember | null | undefined): boolean {
  if (!member || member.status !== "active") return false;
  return member.role !== "viewer";
}

export function memberCanPublish(
  member: CompanyTeamMember | null | undefined,
  opts?: { claimApproved?: boolean },
): boolean {
  if (!member || member.status !== "active") return false;
  if (member.role === "viewer") return false;
  if (member.role === "company_rep") return opts?.claimApproved === true;
  // CEO and managers may publish within their scope (server should still enforce review if configured)
  return (
    member.role === "company_ceo" ||
    member.role === "product_manager" ||
    member.role === "line_manager"
  );
}

export function memberCanManageTeam(member: CompanyTeamMember | null | undefined): boolean {
  if (!member || member.status !== "active") return false;
  return member.role === "company_ceo" || member.role === "product_manager";
}

/** Appwrite table attribute sketch for provisioning scripts. */
export const COMPANY_TEAM_MEMBERS_TABLE = {
  databaseId: "medicine_support_hub",
  tableId: "company_team_members",
  columns: [
    "company_slug",
    "company_name",
    "user_email",
    "user_id",
    "role",
    "product_lines", // string JSON array or comma-separated
    "product_canonical_ids", // string JSON array
    "status",
    "invited_by",
    "invited_at",
    "notes",
  ],
} as const;
