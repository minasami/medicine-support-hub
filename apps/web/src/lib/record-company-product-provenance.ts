import {
  extractAssertedFields,
  recordProvenanceEvent,
  type MedicineProvenanceEvent,
} from "./medicine-provenance";

/**
 * Call after a verified company representative saves a portfolio product.
 * Safe to call from CompanyMedicineAdditionForm handleSubmit.
 */
export function recordCompanyProductProvenance(params: {
  canonicalId: number;
  isUpdate: boolean;
  companyName?: string;
  companySlug?: string;
  actorUserId?: string;
  actorEmail?: string;
  actorRole?: string;
  productPayload: Record<string, unknown>;
  evidenceUrls?: string[];
  notes?: string;
}): MedicineProvenanceEvent {
  const asserted = extractAssertedFields(params.productPayload);
  return recordProvenanceEvent({
    canonical_id: params.canonicalId,
    event_type: params.isUpdate ? "product_updated" : "product_created",
    source_kind: "verified_company",
    company_name: params.companyName,
    company_slug: params.companySlug,
    actor_user_id: params.actorUserId,
    actor_email: params.actorEmail,
    actor_role: params.actorRole || "company_representative",
    fields_changed: asserted.fields_changed,
    field_values: asserted.field_values,
    evidence_urls: params.evidenceUrls,
    notes: params.notes,
  });
}
