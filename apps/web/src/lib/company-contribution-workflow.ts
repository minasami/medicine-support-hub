/**
 * Company encyclopedia contribution workflow (Phase A pilot).
 * Orchestrates role hierarchy, portfolio scope, lifecycle governance, and provenance.
 * Server must still enforce Appwrite permissions; this is the client policy layer.
 */

import {
  type CompanyOrgRole,
  type CompanyTeamMember,
  memberCanEditProduct,
  memberCanManageTeam,
  memberCanPublish,
  memberCanSubmitDrafts,
  normalizeCompanySlug,
  canInviteRole,
} from "./company-role-hierarchy";
import { productBelongsToCompany } from "./company-portfolio-scope";
import {
  type ContentLifecycleStatus,
  type ContentProvenance,
  COMPANY_EDITABLE_FIELDS,
  type CompanyEditableField,
  canTransition,
  buildProvenancePatch,
  isPubliclyVisible,
} from "./data-governance";
import { recordCompanyProductProvenance } from "./record-company-product-provenance";

export type ContributionActor = {
  email: string;
  userId?: string | null;
  member: CompanyTeamMember;
  claimApproved: boolean;
};

export type ContributionProductRef = {
  company_slug: string;
  company_name?: string | null;
  product_line?: string | null;
  canonical_id?: number | null;
  manufacturer?: string | null;
};

export type ContributionDecision = {
  allowed: boolean;
  reason?: string;
  actor_kind?: "contributor" | "company_publisher" | "platform_admin";
};

function actorKind(
  actor: ContributionActor,
  asAdmin?: boolean,
): "contributor" | "company_publisher" | "platform_admin" {
  if (asAdmin) return "platform_admin";
  if (memberCanPublish(actor.member, { claimApproved: actor.claimApproved })) {
    return "company_publisher";
  }
  return "contributor";
}

export function authorizeProductEdit(
  actor: ContributionActor,
  product: ContributionProductRef,
): ContributionDecision {
  if (!actor.member || actor.member.status !== "active") {
    return { allowed: false, reason: "Team membership is not active" };
  }
  if (
    normalizeCompanySlug(actor.member.company_slug) !==
    normalizeCompanySlug(product.company_slug)
  ) {
    return { allowed: false, reason: "Product is outside your company scope" };
  }
  if (
    product.manufacturer &&
    !productBelongsToCompany(
      { manufacturer: product.manufacturer, company_slug: product.company_slug },
      product.company_slug,
      product.company_name,
    )
  ) {
    /* soft manufacturer check */
  }
  if (
    !memberCanEditProduct(actor.member, product, {
      claimApproved: actor.claimApproved,
    })
  ) {
    return {
      allowed: false,
      reason: "Role or product-line scope does not permit editing this product",
    };
  }
  return { allowed: true, actor_kind: actorKind(actor) };
}

export function authorizeLifecycleTransition(
  actor: ContributionActor,
  from: ContentLifecycleStatus,
  to: ContentLifecycleStatus,
  opts?: { platformAdmin?: boolean },
): ContributionDecision {
  if (!memberCanSubmitDrafts(actor.member) && to !== "archived") {
    return { allowed: false, reason: "Viewers cannot change lifecycle" };
  }
  const kind = actorKind(actor, opts?.platformAdmin);
  if (!canTransition(from, to, kind)) {
    return {
      allowed: false,
      reason: `Transition ${from} \u2192 ${to} not allowed for ${kind}`,
      actor_kind: kind,
    };
  }
  if (to === "published" && kind === "contributor") {
    return {
      allowed: false,
      reason: "Only company publishers or platform admins can publish",
      actor_kind: kind,
    };
  }
  return { allowed: true, actor_kind: kind };
}

export function sanitizeCompanyPayload(
  payload: Record<string, unknown>,
): Partial<Record<CompanyEditableField, unknown>> {
  const out: Partial<Record<CompanyEditableField, unknown>> = {};
  for (const key of COMPANY_EDITABLE_FIELDS) {
    if (key in payload && payload[key] !== undefined) {
      out[key] = payload[key];
    }
  }
  return out;
}

export type SaveContributionInput = {
  actor: ContributionActor;
  product: ContributionProductRef;
  payload: Record<string, unknown>;
  currentStatus?: ContentLifecycleStatus | null;
  intent: "save_draft" | "submit_review" | "publish";
  isUpdate: boolean;
  evidenceUrls?: string[];
  notes?: string;
  platformAdmin?: boolean;
};

export type SaveContributionResult = {
  ok: boolean;
  error?: string;
  nextStatus?: ContentLifecycleStatus;
  provenance?: ContentProvenance;
  sanitizedPayload?: Partial<Record<CompanyEditableField, unknown>>;
  auditEventId?: string;
};

export function planContributionSave(
  input: SaveContributionInput,
): SaveContributionResult {
  const edit = authorizeProductEdit(input.actor, input.product);
  if (!edit.allowed) {
    return { ok: false, error: edit.reason };
  }

  const from: ContentLifecycleStatus = input.currentStatus || "draft";
  let to: ContentLifecycleStatus = from;
  if (input.intent === "save_draft") to = "draft";
  else if (input.intent === "submit_review") to = "pending_review";
  else if (input.intent === "publish") to = "published";

  if (from !== to) {
    const life = authorizeLifecycleTransition(input.actor, from, to, {
      platformAdmin: input.platformAdmin,
    });
    if (!life.allowed) {
      return { ok: false, error: life.reason };
    }
  }

  const sanitized = sanitizeCompanyPayload(input.payload);
  const now = new Date().toISOString();
  const provenance = buildProvenancePatch({
    lifecycle_status: to,
    source_kind: "company_verified",
    contributed_by_email: input.actor.email,
    contributed_by_user_id: input.actor.userId ?? null,
    company_slug: input.product.company_slug,
    published_at: to === "published" ? now : null,
    notes: input.notes ?? null,
  });

  let auditEventId: string | undefined;
  if (input.product.canonical_id) {
    const ev = recordCompanyProductProvenance({
      canonicalId: Number(input.product.canonical_id),
      isUpdate: input.isUpdate,
      companySlug: input.product.company_slug,
      companyName: input.product.company_name || undefined,
      actorUserId: input.actor.userId || undefined,
      actorEmail: input.actor.email,
      actorRole: input.actor.member.role,
      productPayload: sanitized as Record<string, unknown>,
      evidenceUrls: input.evidenceUrls,
      notes: input.notes,
    });
    auditEventId = ev.id;
  }

  return {
    ok: true,
    nextStatus: to,
    provenance,
    sanitizedPayload: sanitized,
    auditEventId,
  };
}

export function contributionCapabilities(actor: ContributionActor): {
  can_edit: boolean;
  can_submit: boolean;
  can_publish: boolean;
  can_manage_team: boolean;
  can_invite: CompanyOrgRole[];
  company_slug: string;
  role: CompanyOrgRole;
} {
  const m = actor.member;
  const inviteTargets: CompanyOrgRole[] = (
    ["product_manager", "line_manager", "company_rep", "viewer"] as CompanyOrgRole[]
  ).filter((r) => canInviteRole(m.role, r));

  return {
    can_edit: m.status === "active" && m.role !== "viewer",
    can_submit: memberCanSubmitDrafts(m),
    can_publish: memberCanPublish(m, { claimApproved: actor.claimApproved }),
    can_manage_team: memberCanManageTeam(m),
    can_invite: inviteTargets,
    company_slug: m.company_slug,
    role: m.role,
  };
}

export { isPubliclyVisible, COMPANY_EDITABLE_FIELDS };
export type { ContentLifecycleStatus, ContentProvenance, CompanyOrgRole };
