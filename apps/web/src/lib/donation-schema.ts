/**
 * Zod schemas for the Medicine Donation Exchange.
 * Single source of truth for runtime validation of listings, lots, requests,
 * and CSV-derived rows before Appwrite / localStorage writes.
 */
import { z } from "zod";

export const ListingStatusSchema = z.enum([
  "draft",
  "published",
  "closed",
  "archived",
]);

export const ListingVisibilitySchema = z.enum([
  "network",
  "invite_only",
  "public",
]);

export const LotStatusSchema = z.enum([
  "available",
  "partial",
  "exhausted",
  "expired",
  "withdrawn",
]);

export const RequestStatusSchema = z.enum([
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "fulfilled",
  "cancelled",
]);

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v));

export const DonationListingSchema = z.object({
  $id: nonEmpty,
  org_id: nonEmpty.max(64),
  org_code: z.string().max(32).optional(),
  title: nonEmpty.max(256),
  description: z.string().max(2000).optional(),
  status: ListingStatusSchema,
  visibility: ListingVisibilitySchema,
  currency: z.string().min(1).max(8).default("EGP"),
  valid_from: z.string().datetime().optional().or(z.string().optional()),
  valid_until: z.string().datetime().optional().or(z.string().optional()),
  contact_name: z.string().max(128).optional(),
  contact_email: z.string().email().max(256).optional().or(z.literal("")).optional(),
  contact_phone: z.string().max(64).optional(),
  source_filename: z.string().max(256).optional(),
  lot_count: z.number().int().min(0),
  total_units: z.number().int().min(0),
  total_value_egp: z.number().min(0),
  created_by: z.string().max(64).optional(),
  published_at: z.string().optional(),
  closed_at: z.string().optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
});

export const DonationLotSchema = z.object({
  $id: nonEmpty,
  listing_id: nonEmpty.max(64),
  org_id: nonEmpty.max(64),
  org_code: z.string().max(32).optional(),
  item_code: nonEmpty.max(64),
  item_desc: nonEmpty.max(512),
  lot_no: nonEmpty.max(64),
  locator: z.string().max(128).optional(),
  near_expire: z.boolean(),
  quantity_available: z.number().int().min(0),
  quantity_reserved: z.number().int().min(0),
  quantity_fulfilled: z.number().int().min(0),
  quantity_initial: z.number().int().min(0),
  list_price_egp: z.number().min(0),
  expiry_date: nonEmpty,
  po_category: z.string().max(32).optional(),
  medicine_id: z.string().max(64).optional(),
  status: LotStatusSchema,
  unit_label: z.string().max(32).optional(),
  notes: z.string().max(1000).optional(),
  import_batch_id: z.string().max(64).optional(),
  lot_key: nonEmpty.max(160),
  created_by: z.string().max(64).optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
});

export const DonationRequestSchema = z.object({
  $id: nonEmpty,
  lot_id: nonEmpty.max(64),
  listing_id: nonEmpty.max(64),
  donor_org_id: nonEmpty.max(64),
  requester_org_id: nonEmpty.max(64),
  requested_by: nonEmpty.max(64),
  quantity_requested: z.number().int().positive(),
  quantity_approved: z.number().int().min(0),
  status: RequestStatusSchema,
  justification: z.string().max(2000).optional(),
  program_name: z.string().max(256).optional(),
  preferred_pickup_at: z.string().optional(),
  rejection_reason: z.string().max(1000).optional(),
  reviewed_by: z.string().max(64).optional(),
  reviewed_at: z.string().optional(),
  item_code: z.string().max(64).optional(),
  item_desc: z.string().max(512).optional(),
  lot_no: z.string().max(64).optional(),
  expiry_date: z.string().optional(),
  list_price_egp: z.number().min(0).optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
});

/** Parsed CSV row after header mapping (pre-persist). */
export const ParsedDonationCsvRowSchema = z.object({
  org_code: z.string().max(32),
  item_code: nonEmpty.max(64),
  item_desc: nonEmpty.max(512),
  lot_no: nonEmpty.max(64),
  locator: z.string().max(128),
  quantity_accept: z.number().int().positive(),
  list_price_egp: z.number().min(0),
  expiry_date: nonEmpty,
  po_category: z.string().max(32),
  near_expire: z.boolean(),
  row_index: z.number().int().positive(),
  error: z.string().optional(),
});

export const ImportDonationLotsInputSchema = z.object({
  orgId: nonEmpty.max(64),
  orgCode: z.string().max(32).optional(),
  title: nonEmpty.max(256),
  filename: z.string().max(256).optional(),
  createdBy: z.string().max(64).optional(),
  publish: z.boolean().optional(),
  rows: z.array(ParsedDonationCsvRowSchema).min(1),
});

export const CreateDonationRequestInputSchema = z.object({
  lotId: nonEmpty.max(64),
  listingId: nonEmpty.max(64),
  donorOrgId: nonEmpty.max(64),
  requesterOrgId: nonEmpty.max(64),
  requestedBy: nonEmpty.max(64),
  quantity: z.number().int().positive(),
  available: z.number().int().min(0),
  justification: z.string().max(2000).optional(),
  programName: z.string().max(256).optional(),
  item_code: z.string().max(64).optional(),
  item_desc: z.string().max(512).optional(),
  lot_no: z.string().max(64).optional(),
  expiry_date: z.string().optional(),
  list_price_egp: z.number().min(0).optional(),
}).refine((d) => d.quantity <= d.available, {
  message: "Requested quantity exceeds available",
  path: ["quantity"],
});

export const ReviewDonationRequestInputSchema = z.object({
  requestId: nonEmpty,
  approve: z.boolean(),
  quantityApproved: z.number().int().positive().optional(),
  reviewedBy: nonEmpty.max(64),
  rejectionReason: z.string().max(1000).optional(),
});

export type DonationListingParsed = z.infer<typeof DonationListingSchema>;
export type DonationLotParsed = z.infer<typeof DonationLotSchema>;
export type DonationRequestParsed = z.infer<typeof DonationRequestSchema>;
export type ParsedDonationCsvRowParsed = z.infer<
  typeof ParsedDonationCsvRowSchema
>;

/** Format Zod errors for UI / logs. */
export function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
    .join("; ");
}

export function safeParseRows(rows: unknown[]) {
  const valid: ParsedDonationCsvRowParsed[] = [];
  const errors: { index: number; message: string; raw: unknown }[] = [];
  rows.forEach((row, index) => {
    const result = ParsedDonationCsvRowSchema.safeParse(row);
    if (result.success && !result.data.error) {
      valid.push(result.data);
    } else if (!result.success) {
      errors.push({
        index,
        message: formatZodError(result.error),
        raw: row,
      });
    } else if (result.data.error) {
      errors.push({ index, message: result.data.error, raw: row });
    }
  });
  return { valid, errors };
}
