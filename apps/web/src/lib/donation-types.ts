/** Medicine Donation Exchange domain types (Appwrite + local fallback). */

export type ListingStatus = "draft" | "published" | "closed" | "archived";
export type ListingVisibility = "network" | "invite_only" | "public";
export type LotStatus = "available" | "partial" | "exhausted" | "expired" | "withdrawn";
export type RequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "fulfilled"
  | "cancelled";

export type DonationListing = {
  $id: string;
  org_id: string;
  org_code?: string;
  title: string;
  description?: string;
  status: ListingStatus;
  visibility: ListingVisibility;
  currency: string;
  valid_from?: string;
  valid_until?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  source_filename?: string;
  lot_count: number;
  total_units: number;
  total_value_egp: number;
  created_by?: string;
  published_at?: string;
  closed_at?: string;
  $createdAt?: string;
  $updatedAt?: string;
};

export type DonationLot = {
  $id: string;
  listing_id: string;
  org_id: string;
  org_code?: string;
  item_code: string;
  item_desc: string;
  lot_no: string;
  locator?: string;
  near_expire: boolean;
  quantity_available: number;
  quantity_reserved: number;
  quantity_fulfilled: number;
  quantity_initial: number;
  list_price_egp: number;
  expiry_date: string;
  po_category?: string;
  medicine_id?: string;
  status: LotStatus;
  unit_label?: string;
  notes?: string;
  import_batch_id?: string;
  lot_key: string;
  created_by?: string;
  $createdAt?: string;
  $updatedAt?: string;
};

export type DonationRequest = {
  $id: string;
  lot_id: string;
  listing_id: string;
  donor_org_id: string;
  requester_org_id: string;
  requested_by: string;
  quantity_requested: number;
  quantity_approved: number;
  status: RequestStatus;
  justification?: string;
  program_name?: string;
  preferred_pickup_at?: string;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  item_code?: string;
  item_desc?: string;
  lot_no?: string;
  expiry_date?: string;
  list_price_egp?: number;
  $createdAt?: string;
  $updatedAt?: string;
};

export type ParsedDonationCsvRow = {
  org_code: string;
  item_code: string;
  item_desc: string;
  lot_no: string;
  locator: string;
  quantity_accept: number;
  list_price_egp: number;
  expiry_date: string;
  po_category: string;
  near_expire: boolean;
  row_index: number;
  error?: string;
};

export type CsvImportResult = {
  rows: ParsedDonationCsvRow[];
  valid: ParsedDonationCsvRow[];
  errors: ParsedDonationCsvRow[];
};

export function quantityRequestable(lot: DonationLot): number {
  return Math.max(0, lot.quantity_available - lot.quantity_reserved);
}

export function daysToExpiry(expiryIso: string, now = new Date()): number {
  const exp = new Date(expiryIso);
  if (Number.isNaN(exp.getTime())) return 0;
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
