/**
 * Donation exchange data access.
 * Tries Appwrite collections first; falls back to localStorage so the UI works
 * before collections are provisioned in the cloud project.
 * Writes are validated with Zod schemas from donation-schema.ts.
 */
import { Client, Databases, ID, Query } from "appwrite";
import type {
  DonationListing,
  DonationLot,
  DonationRequest,
  ParsedDonationCsvRow,
} from "./donation-types";
import { quantityRequestable } from "./donation-types";
import {
  CreateDonationRequestInputSchema,
  DonationListingSchema,
  DonationLotSchema,
  DonationRequestSchema,
  ImportDonationLotsInputSchema,
  ParsedDonationCsvRowSchema,
  ReviewDonationRequestInputSchema,
  formatZodError,
  safeParseRows,
} from "./donation-schema";

const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";

export const DONATION_COLLECTIONS = {
  LISTINGS:
    import.meta.env.VITE_APPWRITE_DONATION_LISTINGS_ID || "donation_listings",
  LOTS: import.meta.env.VITE_APPWRITE_DONATION_LOTS_ID || "donation_lots",
  REQUESTS:
    import.meta.env.VITE_APPWRITE_DONATION_REQUESTS_ID || "donation_requests",
};

const LS_LISTINGS = "msh_donation_listings_v1";
const LS_LOTS = "msh_donation_lots_v1";
const LS_REQUESTS = "msh_donation_requests_v1";

let databases: Databases | null = null;
let remoteAvailable: boolean | null = null;

if (APPWRITE_PROJECT_ID) {
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);
    databases = new Databases(client);
  } catch (err) {
    console.warn("[donation-data] Appwrite init:", err);
  }
}

function readLs<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLs<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeLotKey(orgId: string, itemCode: string, lotNo: string) {
  return `${orgId}:${itemCode}:${lotNo}`;
}

async function probeRemote(): Promise<boolean> {
  if (remoteAvailable !== null) return remoteAvailable;
  if (!databases) {
    remoteAvailable = false;
    return false;
  }
  try {
    await databases.listDocuments(DATABASE_ID, DONATION_COLLECTIONS.LISTINGS, [
      Query.limit(1),
    ]);
    remoteAvailable = true;
  } catch {
    remoteAvailable = false;
  }
  return remoteAvailable;
}

function docToListing(doc: Record<string, unknown>): DonationListing {
  const candidate = {
    $id: String(doc.$id),
    org_id: String(doc.org_id || ""),
    org_code: doc.org_code ? String(doc.org_code) : undefined,
    title: String(doc.title || ""),
    description: doc.description ? String(doc.description) : undefined,
    status: (doc.status as DonationListing["status"]) || "draft",
    visibility: (doc.visibility as DonationListing["visibility"]) || "network",
    currency: String(doc.currency || "EGP"),
    source_filename: doc.source_filename
      ? String(doc.source_filename)
      : undefined,
    lot_count: Number(doc.lot_count || 0),
    total_units: Number(doc.total_units || 0),
    total_value_egp: Number(doc.total_value_egp || 0),
    created_by: doc.created_by ? String(doc.created_by) : undefined,
    published_at: doc.published_at ? String(doc.published_at) : undefined,
    $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
  };
  const parsed = DonationListingSchema.safeParse(candidate);
  return (parsed.success ? parsed.data : candidate) as DonationListing;
}

function docToLot(doc: Record<string, unknown>): DonationLot {
  const candidate = {
    $id: String(doc.$id),
    listing_id: String(doc.listing_id || ""),
    org_id: String(doc.org_id || ""),
    org_code: doc.org_code ? String(doc.org_code) : undefined,
    item_code: String(doc.item_code || ""),
    item_desc: String(doc.item_desc || ""),
    lot_no: String(doc.lot_no || ""),
    locator: doc.locator ? String(doc.locator) : undefined,
    near_expire: Boolean(doc.near_expire),
    quantity_available: Number(doc.quantity_available || 0),
    quantity_reserved: Number(doc.quantity_reserved || 0),
    quantity_fulfilled: Number(doc.quantity_fulfilled || 0),
    quantity_initial: Number(doc.quantity_initial || 0),
    list_price_egp: Number(doc.list_price_egp || 0),
    expiry_date: String(doc.expiry_date || ""),
    po_category: doc.po_category ? String(doc.po_category) : undefined,
    medicine_id: doc.medicine_id ? String(doc.medicine_id) : undefined,
    status: (doc.status as DonationLot["status"]) || "available",
    unit_label: doc.unit_label ? String(doc.unit_label) : undefined,
    notes: doc.notes ? String(doc.notes) : undefined,
    import_batch_id: doc.import_batch_id
      ? String(doc.import_batch_id)
      : undefined,
    lot_key: String(doc.lot_key || ""),
    created_by: doc.created_by ? String(doc.created_by) : undefined,
    $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
  };
  const parsed = DonationLotSchema.safeParse(candidate);
  return (parsed.success ? parsed.data : candidate) as DonationLot;
}

function docToRequest(doc: Record<string, unknown>): DonationRequest {
  const candidate = {
    $id: String(doc.$id),
    lot_id: String(doc.lot_id || ""),
    listing_id: String(doc.listing_id || ""),
    donor_org_id: String(doc.donor_org_id || ""),
    requester_org_id: String(doc.requester_org_id || ""),
    requested_by: String(doc.requested_by || ""),
    quantity_requested: Number(doc.quantity_requested || 0),
    quantity_approved: Number(doc.quantity_approved || 0),
    status: (doc.status as DonationRequest["status"]) || "submitted",
    justification: doc.justification ? String(doc.justification) : undefined,
    program_name: doc.program_name ? String(doc.program_name) : undefined,
    preferred_pickup_at: doc.preferred_pickup_at
      ? String(doc.preferred_pickup_at)
      : undefined,
    rejection_reason: doc.rejection_reason
      ? String(doc.rejection_reason)
      : undefined,
    reviewed_by: doc.reviewed_by ? String(doc.reviewed_by) : undefined,
    reviewed_at: doc.reviewed_at ? String(doc.reviewed_at) : undefined,
    item_code: doc.item_code ? String(doc.item_code) : undefined,
    item_desc: doc.item_desc ? String(doc.item_desc) : undefined,
    lot_no: doc.lot_no ? String(doc.lot_no) : undefined,
    expiry_date: doc.expiry_date ? String(doc.expiry_date) : undefined,
    list_price_egp: doc.list_price_egp
      ? Number(doc.list_price_egp)
      : undefined,
    $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
  };
  const parsed = DonationRequestSchema.safeParse(candidate);
  return (parsed.success ? parsed.data : candidate) as DonationRequest;
}

export async function importDonationLots(params: {
  orgId: string;
  orgCode?: string;
  title: string;
  filename?: string;
  createdBy?: string;
  publish?: boolean;
  rows: ParsedDonationCsvRow[];
}): Promise<{ listing: DonationListing; lots: DonationLot[] }> {
  const input = ImportDonationLotsInputSchema.safeParse(params);
  if (!input.success) {
    throw new Error(`Import validation failed: ${formatZodError(input.error)}`);
  }

  const { orgId, orgCode, title, filename, createdBy, publish } = input.data;
  const { valid: schemaValid, errors: schemaErrors } = safeParseRows(
    params.rows,
  );
  if (schemaValid.length === 0) {
    const first = schemaErrors[0]?.message || "No valid rows to import.";
    throw new Error(`No valid rows to import. ${first}`);
  }

  const isRemote = await probeRemote();
  const validRows = schemaValid;

  let totalUnits = 0;
  let totalValue = 0;
  validRows.forEach((r) => {
    totalUnits += r.quantity_accept;
    totalValue += r.quantity_accept * r.list_price_egp;
  });

  const nowIso = new Date().toISOString();
  const listingStatus = publish ? "published" : "draft";

  if (isRemote && databases) {
    const listingDoc = await databases.createDocument(
      DATABASE_ID,
      DONATION_COLLECTIONS.LISTINGS,
      ID.unique(),
      {
        org_id: orgId,
        org_code: orgCode || null,
        title: title.trim(),
        status: listingStatus,
        visibility: "network",
        currency: "EGP",
        source_filename: filename || null,
        lot_count: validRows.length,
        total_units: totalUnits,
        total_value_egp: totalValue,
        created_by: createdBy || null,
        published_at: publish ? nowIso : null,
      },
    );

    const listing = docToListing(listingDoc);
    const createdLots: DonationLot[] = [];

    for (const r of validRows) {
      const lotKey = makeLotKey(orgId, r.item_code, r.lot_no);
      const lotDoc = await databases.createDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.LOTS,
        ID.unique(),
        {
          listing_id: listing.$id,
          org_id: orgId,
          org_code: r.org_code || orgCode || null,
          item_code: r.item_code,
          item_desc: r.item_desc,
          lot_no: r.lot_no,
          locator: r.locator || null,
          near_expire: r.near_expire,
          quantity_available: r.quantity_accept,
          quantity_reserved: 0,
          quantity_fulfilled: 0,
          quantity_initial: r.quantity_accept,
          list_price_egp: r.list_price_egp,
          expiry_date: r.expiry_date,
          po_category: r.po_category || null,
          status: "available",
          lot_key: lotKey,
          created_by: createdBy || null,
        },
      );
      createdLots.push(docToLot(lotDoc));
    }

    return { listing, lots: createdLots };
  }

  const listingId = newId();
  const listing: DonationListing = {
    $id: listingId,
    org_id: orgId,
    org_code: orgCode,
    title: title.trim(),
    status: listingStatus,
    visibility: "network",
    currency: "EGP",
    source_filename: filename,
    lot_count: validRows.length,
    total_units: totalUnits,
    total_value_egp: totalValue,
    created_by: createdBy,
    published_at: publish ? nowIso : undefined,
    $createdAt: nowIso,
  };

  const createdLots: DonationLot[] = validRows.map((r) => ({
    $id: newId(),
    listing_id: listingId,
    org_id: orgId,
    org_code: r.org_code || orgCode,
    item_code: r.item_code,
    item_desc: r.item_desc,
    lot_no: r.lot_no,
    locator: r.locator,
    near_expire: r.near_expire,
    quantity_available: r.quantity_accept,
    quantity_reserved: 0,
    quantity_fulfilled: 0,
    quantity_initial: r.quantity_accept,
    list_price_egp: r.list_price_egp,
    expiry_date: r.expiry_date,
    po_category: r.po_category,
    status: "available" as const,
    lot_key: makeLotKey(orgId, r.item_code, r.lot_no),
    created_by: createdBy,
    $createdAt: nowIso,
  }));

  const listings = readLs<DonationListing>(LS_LISTINGS);
  listings.unshift(listing);
  writeLs(LS_LISTINGS, listings);

  const lots = readLs<DonationLot>(LS_LOTS);
  lots.unshift(...createdLots);
  writeLs(LS_LOTS, lots);

  return { listing, lots: createdLots };
}

export async function listPublishedLots(limit = 100): Promise<DonationLot[]> {
  const isRemote = await probeRemote();
  if (isRemote && databases) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      DONATION_COLLECTIONS.LOTS,
      [Query.equal("status", "available"), Query.limit(limit)],
    );
    return res.documents.map(docToLot);
  }

  const lots = readLs<DonationLot>(LS_LOTS);
  const listings = readLs<DonationListing>(LS_LISTINGS);
  const publishedListingIds = new Set(
    listings.filter((l) => l.status === "published").map((l) => l.$id),
  );

  const now = new Date();
  return lots.filter((l) => {
    if (l.status !== "available" && l.status !== "partial") return false;
    if (publishedListingIds.size > 0 && !publishedListingIds.has(l.listing_id)) {
      return false;
    }
    if (quantityRequestable(l) <= 0) return false;
    if (new Date(l.expiry_date) <= now) return false;
    return true;
  });
}

export async function createDonationRequest(params: {
  lot: DonationLot;
  requesterOrgId: string;
  requestedBy: string;
  quantity: number;
  justification?: string;
  programName?: string;
}): Promise<DonationRequest> {
  const {
    lot,
    requesterOrgId,
    requestedBy,
    quantity,
    justification,
    programName,
  } = params;

  const requestable = quantityRequestable(lot);
  const input = CreateDonationRequestInputSchema.safeParse({
    lotId: lot.$id,
    listingId: lot.listing_id,
    donorOrgId: lot.org_id,
    requesterOrgId,
    requestedBy,
    quantity,
    available: requestable,
    justification,
    programName,
    item_code: lot.item_code,
    item_desc: lot.item_desc,
    lot_no: lot.lot_no,
    expiry_date: lot.expiry_date,
    list_price_egp: lot.list_price_egp,
  });
  if (!input.success) {
    throw new Error(formatZodError(input.error));
  }

  const isRemote = await probeRemote();
  const nowIso = new Date().toISOString();

  if (isRemote && databases) {
    const reqDoc = await databases.createDocument(
      DATABASE_ID,
      DONATION_COLLECTIONS.REQUESTS,
      ID.unique(),
      {
        lot_id: lot.$id,
        listing_id: lot.listing_id,
        donor_org_id: lot.org_id,
        requester_org_id: requesterOrgId,
        requested_by: requestedBy,
        quantity_requested: quantity,
        quantity_approved: 0,
        status: "submitted",
        justification: justification || null,
        program_name: programName || null,
        item_code: lot.item_code,
        item_desc: lot.item_desc,
        lot_no: lot.lot_no,
        expiry_date: lot.expiry_date,
        list_price_egp: lot.list_price_egp,
      },
    );
    return docToRequest(reqDoc);
  }

  const req: DonationRequest = {
    $id: newId(),
    lot_id: lot.$id,
    listing_id: lot.listing_id,
    donor_org_id: lot.org_id,
    requester_org_id: requesterOrgId,
    requested_by: requestedBy,
    quantity_requested: quantity,
    quantity_approved: 0,
    status: "submitted",
    justification,
    program_name: programName,
    item_code: lot.item_code,
    item_desc: lot.item_desc,
    lot_no: lot.lot_no,
    expiry_date: lot.expiry_date,
    list_price_egp: lot.list_price_egp,
    $createdAt: nowIso,
  };

  const requests = readLs<DonationRequest>(LS_REQUESTS);
  requests.unshift(req);
  writeLs(LS_REQUESTS, requests);

  return req;
}

export async function listRequestsForOrg(
  orgId: string,
  role: "donor" | "requester",
): Promise<DonationRequest[]> {
  const isRemote = await probeRemote();
  const field = role === "donor" ? "donor_org_id" : "requester_org_id";

  if (isRemote && databases) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      DONATION_COLLECTIONS.REQUESTS,
      [Query.equal(field, orgId), Query.limit(100)],
    );
    return res.documents.map(docToRequest);
  }

  const requests = readLs<DonationRequest>(LS_REQUESTS);
  return requests.filter((r) =>
    role === "donor" ? r.donor_org_id === orgId : r.requester_org_id === orgId,
  );
}

export async function reviewDonationRequest(params: {
  requestId: string;
  approve: boolean;
  quantityApproved?: number;
  reviewedBy: string;
  rejectionReason?: string;
}): Promise<DonationRequest> {
  const checked = ReviewDonationRequestInputSchema.safeParse(params);
  if (!checked.success) {
    throw new Error(formatZodError(checked.error));
  }

  const { requestId, approve, quantityApproved, reviewedBy, rejectionReason } =
    checked.data;
  const isRemote = await probeRemote();
  const nowIso = new Date().toISOString();

  if (isRemote && databases) {
    const patch = approve
      ? {
          status: "approved",
          quantity_approved: quantityApproved || 0,
          reviewed_by: reviewedBy,
          reviewed_at: nowIso,
        }
      : {
          status: "rejected",
          rejection_reason: rejectionReason || "Rejected by donor",
          reviewed_by: reviewedBy,
          reviewed_at: nowIso,
        };
    const updated = await databases.updateDocument(
      DATABASE_ID,
      DONATION_COLLECTIONS.REQUESTS,
      requestId,
      patch,
    );
    return docToRequest(updated);
  }

  const requests = readLs<DonationRequest>(LS_REQUESTS);
  const idx = requests.findIndex((r) => r.$id === requestId);
  if (idx < 0) throw new Error("Request not found.");

  const req = requests[idx];
  if (approve) {
    const approvedQty = quantityApproved || req.quantity_requested;
    req.status = "approved";
    req.quantity_approved = approvedQty;
    req.reviewed_by = reviewedBy;
    req.reviewed_at = nowIso;

    const lots = readLs<DonationLot>(LS_LOTS);
    const lotIdx = lots.findIndex((l) => l.$id === req.lot_id);
    if (lotIdx >= 0) {
      const lot = lots[lotIdx];
      lot.quantity_available = Math.max(0, lot.quantity_available - approvedQty);
      lot.quantity_fulfilled += approvedQty;
      if (lot.quantity_available === 0) lot.status = "exhausted";
      else lot.status = "partial";
      writeLs(LS_LOTS, lots);
    }
  } else {
    req.status = "rejected";
    req.rejection_reason = rejectionReason || "Rejected by donor";
    req.reviewed_by = reviewedBy;
    req.reviewed_at = nowIso;
  }

  requests[idx] = req;
  writeLs(LS_REQUESTS, requests);
  return req;
}

export function storageModeLabel(): string {
  if (remoteAvailable === true) return "Appwrite Cloud";
  if (remoteAvailable === false) return "LocalStorage (fallback)";
  return "Checking…";
}

export { ParsedDonationCsvRowSchema, formatZodError };
