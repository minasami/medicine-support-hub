/**
 * Data governance for manufacturer-contributed encyclopedia content.
 *
 * Lifecycle: draft → pending_review → published | rejected → archived
 * Provenance fields should be stored on medicine documents when companies update.
 */

export type ContentLifecycleStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "archived";

export type ContentSourceKind =
  | "company_verified"
  | "moh_eda_tariff"
  | "drugeye"
  | "egyptdwa"
  | "platform_import"
  | "unknown";

export type ContentProvenance = {
  lifecycle_status: ContentLifecycleStatus;
  source_kind: ContentSourceKind;
  contributed_by_email?: string | null;
  contributed_by_user_id?: string | null;
  company_slug?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  notes?: string | null;
};

export const LIFECYCLE_LABELS: Record<ContentLifecycleStatus, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

/** Fields companies may update on published monographs after approval. */
export const COMPANY_EDITABLE_FIELDS = [
  "name_en",
  "name_ar",
  "scientific_name",
  "drug_class",
  "route",
  "category",
  "dosage_form",
  "strength",
  "barcode",
  "code",
  "image_url",
  "current_price_egp",
  "line",
  "manufacturer",
  "description",
] as const;

export type CompanyEditableField = (typeof COMPANY_EDITABLE_FIELDS)[number];

/** Public catalog should only show published (or legacy rows without lifecycle). */
export function isPubliclyVisible(status: ContentLifecycleStatus | null | undefined): boolean {
  if (status == null || status === "") return true; // legacy rows
  return status === "published";
}

export function canTransition(
  from: ContentLifecycleStatus,
  to: ContentLifecycleStatus,
  actor: "contributor" | "company_publisher" | "platform_admin",
): boolean {
  const transitions: Record<
    ContentLifecycleStatus,
    Partial<Record<ContentLifecycleStatus, Array<typeof actor>>>
  > = {
    draft: {
      pending_review: ["contributor", "company_publisher", "platform_admin"],
      published: ["company_publisher", "platform_admin"],
      archived: ["contributor", "company_publisher", "platform_admin"],
    },
    pending_review: {
      published: ["company_publisher", "platform_admin"],
      rejected: ["company_publisher", "platform_admin"],
      draft: ["contributor", "company_publisher", "platform_admin"],
    },
    published: {
      draft: ["company_publisher", "platform_admin"],
      archived: ["company_publisher", "platform_admin"],
      pending_review: ["contributor", "company_publisher", "platform_admin"],
    },
    rejected: {
      draft: ["contributor", "company_publisher", "platform_admin"],
      archived: ["platform_admin"],
    },
    archived: {
      draft: ["platform_admin"],
      published: ["platform_admin"],
    },
  };
  const allowed = transitions[from]?.[to];
  return Boolean(allowed && allowed.includes(actor));
}

export function buildProvenancePatch(
  partial: Partial<ContentProvenance>,
): ContentProvenance {
  return {
    lifecycle_status: partial.lifecycle_status || "draft",
    source_kind: partial.source_kind || "company_verified",
    contributed_by_email: partial.contributed_by_email ?? null,
    contributed_by_user_id: partial.contributed_by_user_id ?? null,
    company_slug: partial.company_slug ?? null,
    reviewed_by: partial.reviewed_by ?? null,
    reviewed_at: partial.reviewed_at ?? null,
    published_at: partial.published_at ?? null,
    notes: partial.notes ?? null,
  };
}
