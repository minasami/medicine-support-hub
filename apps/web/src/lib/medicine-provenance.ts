/**
 * Medicine data provenance — who asserted what, when, and with what evidence.
 * Supports the manufacturer → verified catalog north star.
 *
 * Client store is localStorage-backed for immediate UX; server tables
 * (see docs/medicine-provenance-schema.md) are the durable authority.
 */

export type ProvenanceSourceKind =
  | "verified_company"
  | "platform_admin"
  | "community_contribution"
  | "dataset_import"
  | "price_observation"
  | "system";

export type ProvenanceEventType =
  | "product_created"
  | "product_updated"
  | "field_asserted"
  | "price_observed"
  | "image_attached"
  | "published_to_encyclopedia"
  | "verification_confirmed";

export type MedicineProvenanceEvent = {
  id: string;
  canonical_id: number;
  event_type: ProvenanceEventType;
  source_kind: ProvenanceSourceKind;
  /** Company display name when source is manufacturer */
  company_name?: string;
  company_slug?: string;
  /** User who performed the action */
  actor_user_id?: string;
  actor_email?: string;
  actor_role?: string;
  /** Fields touched in this event */
  fields_changed?: string[];
  /** Snapshot of values asserted (stringified scalars only) */
  field_values?: Record<string, string | number | boolean | null>;
  evidence_urls?: string[];
  notes?: string;
  created_at: string;
};

export type ProductProvenanceSummary = {
  canonical_id: number;
  last_verified_at: string | null;
  last_verified_by_company: string | null;
  last_verified_by_company_slug: string | null;
  last_source_kind: ProvenanceSourceKind | null;
  event_count: number;
  has_company_verification: boolean;
};

const LS_KEY = "msh_medicine_provenance_v1";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `prov_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(): MedicineProvenanceEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(events: MedicineProvenanceEvent[]) {
  if (typeof window === "undefined") return;
  // Cap at 2000 events to avoid unbounded growth in the browser
  const trimmed = events.slice(0, 2000);
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
}

export function recordProvenanceEvent(
  input: Omit<MedicineProvenanceEvent, "id" | "created_at"> & {
    id?: string;
    created_at?: string;
  },
): MedicineProvenanceEvent {
  const event: MedicineProvenanceEvent = {
    id: input.id || newId(),
    canonical_id: input.canonical_id,
    event_type: input.event_type,
    source_kind: input.source_kind,
    company_name: input.company_name,
    company_slug: input.company_slug,
    actor_user_id: input.actor_user_id,
    actor_email: input.actor_email,
    actor_role: input.actor_role,
    fields_changed: input.fields_changed,
    field_values: input.field_values,
    evidence_urls: input.evidence_urls,
    notes: input.notes,
    created_at: input.created_at || new Date().toISOString(),
  };

  const all = readAll();
  all.unshift(event);
  writeAll(all);
  return event;
}

export function listProvenanceForProduct(
  canonicalId: number,
  limit = 50,
): MedicineProvenanceEvent[] {
  return readAll()
    .filter((e) => Number(e.canonical_id) === Number(canonicalId))
    .slice(0, limit);
}

export function summarizeProvenance(
  canonicalId: number,
): ProductProvenanceSummary {
  const events = listProvenanceForProduct(canonicalId, 100);
  const companyEvents = events.filter(
    (e) =>
      e.source_kind === "verified_company" ||
      e.event_type === "verification_confirmed",
  );
  const latestCompany = companyEvents[0] || null;
  const latest = events[0] || null;

  return {
    canonical_id: canonicalId,
    last_verified_at: latestCompany?.created_at || latest?.created_at || null,
    last_verified_by_company: latestCompany?.company_name || null,
    last_verified_by_company_slug: latestCompany?.company_slug || null,
    last_source_kind: latestCompany?.source_kind || latest?.source_kind || null,
    event_count: events.length,
    has_company_verification: companyEvents.length > 0,
  };
}

/** Human-readable line for public UI. */
export function formatProvenanceLine(
  summary: ProductProvenanceSummary,
  opts?: { locale?: string },
): string | null {
  if (!summary.last_verified_at) return null;
  const date = new Date(summary.last_verified_at);
  const dateStr = Number.isNaN(date.getTime())
    ? summary.last_verified_at.slice(0, 10)
    : date.toLocaleDateString(opts?.locale || undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  if (summary.last_verified_by_company) {
    return `Last verified by ${summary.last_verified_by_company} on ${dateStr}`;
  }
  if (summary.last_source_kind === "dataset_import") {
    return `Catalog data observed on ${dateStr}`;
  }
  if (summary.last_source_kind === "community_contribution") {
    return `Community contribution reviewed on ${dateStr}`;
  }
  return `Last updated on ${dateStr}`;
}

export function formatProvenanceLineAr(
  summary: ProductProvenanceSummary,
): string | null {
  if (!summary.last_verified_at) return null;
  const date = new Date(summary.last_verified_at);
  const dateStr = Number.isNaN(date.getTime())
    ? summary.last_verified_at.slice(0, 10)
    : date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  if (summary.last_verified_by_company) {
    return `آخر تحقق بواسطة ${summary.last_verified_by_company} في ${dateStr}`;
  }
  return `آخر تحديث في ${dateStr}`;
}

/** Fields commonly asserted by manufacturer portfolio saves. */
export function extractAssertedFields(
  payload: Record<string, unknown>,
): { fields_changed: string[]; field_values: Record<string, string | number | boolean | null> } {
  const keys = [
    "name_en",
    "name_ar",
    "scientific_name",
    "manufacturer",
    "drug_class",
    "route",
    "category",
    "dosage_form",
    "strength",
    "barcode",
    "code",
    "current_price_egp",
    "image_url",
  ] as const;

  const fields_changed: string[] = [];
  const field_values: Record<string, string | number | boolean | null> = {};

  for (const key of keys) {
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== "") {
      fields_changed.push(key);
      const v = payload[key];
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean"
      ) {
        field_values[key] = v;
      } else {
        field_values[key] = String(v);
      }
    }
  }

  return { fields_changed, field_values };
}

/** Batch summaries for list cards. */
export function summarizeMany(
  canonicalIds: number[],
): Map<number, ProductProvenanceSummary> {
  const map = new Map<number, ProductProvenanceSummary>();
  for (const id of canonicalIds) {
    map.set(id, summarizeProvenance(id));
  }
  return map;
}
