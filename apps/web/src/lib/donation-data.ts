/**
 * Donation exchange data access.
 * Tries Appwrite collections first; falls back to localStorage so the UI works
 * before collections are provisioned in the cloud project.
 */
import { Client, Databases, ID, Query } from "appwrite";
import type {
  DonationListing,
  DonationLot,
  DonationRequest,
  ParsedDonationCsvRow,
} from "./donation-types";
import { quantityRequestable } from "./donation-types";

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
  return {
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
}

function docToLot(doc: Record<string, unknown>): DonationLot {
  return {
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
    status: (doc.status as DonationLot["status"]) || "available",
    lot_key: String(doc.lot_key || ""),
    import_batch_id: doc.import_batch_id
      ? String(doc.import_batch_id)
      : undefined,
    $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
  };
}

function docToRequest(doc: Record<string, unknown>): DonationRequest {
  return {
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
    rejection_reason: doc.rejection_reason
      ? String(doc.rejection_reason)
      : undefined,
    item_code: doc.item_code ? String(doc.item_code) : undefined,
    item_desc: doc.item_desc ? String(doc.item_desc) : undefined,
    lot_no: doc.lot_no ? String(doc.lot_no) : undefined,
    expiry_date: doc.expiry_date ? String(doc.expiry_date) : undefined,
    list_price_egp:
      doc.list_price_egp !== undefined
        ? Number(doc.list_price_egp)
        : undefined,
    $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
  };
}

export async function listPublishedLots(limit = 200): Promise<DonationLot[]> {
  if (await probeRemote()) {
    try {
      const res = await databases!.listDocuments(
        DATABASE_ID,
        DONATION_COLLECTIONS.LOTS,
        [
          Query.equal("status", ["available", "partial"]),
          Query.orderAsc("expiry_date"),
          Query.limit(limit),
        ],
      );
      return res.documents.map((d) => docToLot(d as Record<string, unknown>));
    } catch (err) {
      console.warn("[donation-data] listPublishedLots remote:", err);
    }
  }
  const lots = readLs<DonationLot>(LS_LOTS).filter((l) =>
    ["available", "partial"].includes(l.status),
  );
  return lots.sort(
    (a, b) =>
      new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
  );
}

export async function listListingsForOrg(
  orgId: string,
): Promise<DonationListing[]> {
  if (await probeRemote()) {
    try {
      const res = await databases!.listDocuments(
        DATABASE_ID,
        DONATION_COLLECTIONS.LISTINGS,
        [Query.equal("org_id", orgId), Query.limit(100)],
      );
      return res.documents.map((d) =>
        docToListing(d as Record<string, unknown>),
      );
    } catch (err) {
      console.warn("[donation-data] listListingsForOrg remote:", err);
    }
  }
  return readLs<DonationListing>(LS_LISTINGS).filter((l) => l.org_id === orgId);
}

export async function listLotsForListing(
  listingId: string,
): Promise<DonationLot[]> {
  if (await probeRemote()) {
    try {
      const res = await databases!.listDocuments(
        DATABASE_ID,
        DONATION_COLLECTIONS.LOTS,
        [
          Query.equal("listing_id", listingId),
          Query.orderAsc("expiry_date"),
          Query.limit(500),
        ],
      );
      return res.documents.map((d) => docToLot(d as Record<string, unknown>));
    } catch (err) {
      console.warn("[donation-data] listLotsForListing remote:", err);
    }
  }
  return readLs<DonationLot>(LS_LOTS).filter((l) => l.listing_id === listingId);
}

export async function listRequestsForOrg(
  orgId: string,
  role: "donor" | "requester",
): Promise<DonationRequest[]> {
  const field = role === "donor" ? "donor_org_id" : "requester_org_id";
  if (await probeRemote()) {
    try {
      const res = await databases!.listDocuments(
        DATABASE_ID,
        DONATION_COLLECTIONS.REQUESTS,
        [Query.equal(field, orgId), Query.limit(200)],
      );
      return res.documents.map((d) =>
        docToRequest(d as Record<string, unknown>),
      );
    } catch (err) {
      console.warn("[donation-data] listRequestsForOrg remote:", err);
    }
  }
  return readLs<DonationRequest>(LS_REQUESTS).filter((r) =>
    role === "donor" ? r.donor_org_id === orgId : r.requester_org_id === orgId,
  );
}

export type ImportLotsInput = {
  orgId: string;
  orgCode?: string;
  title: string;
  filename?: string;
  createdBy?: string;
  publish: boolean;
  rows: ParsedDonationCsvRow[];
};

export async function importDonationLots(
  input: ImportLotsInput,
): Promise<{ listing: DonationListing; lots: DonationLot[] }> {
  const now = new Date().toISOString();
  const batchId = newId();
  const totalUnits = input.rows.reduce((s, r) => s + r.quantity_accept, 0);
  const totalValue = input.rows.reduce(
    (s, r) => s + r.quantity_accept * r.list_price_egp,
    0,
  );

  const listingPayload = {
    org_id: input.orgId,
    org_code: input.orgCode || input.rows[0]?.org_code || "",
    title: input.title,
    status: input.publish ? "published" : "draft",
    visibility: "network",
    currency: "EGP",
    source_filename: input.filename || "",
    lot_count: input.rows.length,
    total_units: totalUnits,
    total_value_egp: totalValue,
    created_by: input.createdBy || "",
    published_at: input.publish ? now : "",
  };

  let listing: DonationListing;
  const lots: DonationLot[] = [];

  if (await probeRemote()) {
    try {
      const listingDoc = await databases!.createDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.LISTINGS,
        ID.unique(),
        listingPayload,
      );
      listing = docToListing(listingDoc as Record<string, unknown>);

      for (const row of input.rows) {
        const lotData = {
          listing_id: listing.$id,
          org_id: input.orgId,
          org_code: row.org_code,
          item_code: row.item_code,
          item_desc: row.item_desc,
          lot_no: row.lot_no,
          locator: row.locator,
          near_expire: row.near_expire,
          quantity_available: row.quantity_accept,
          quantity_reserved: 0,
          quantity_fulfilled: 0,
          quantity_initial: row.quantity_accept,
          list_price_egp: row.list_price_egp,
          expiry_date: row.expiry_date,
          po_category: row.po_category,
          status: "available",
          import_batch_id: batchId,
          lot_key: makeLotKey(input.orgId, row.item_code, row.lot_no),
          created_by: input.createdBy || "",
        };
        const lotDoc = await databases!.createDocument(
          DATABASE_ID,
          DONATION_COLLECTIONS.LOTS,
          ID.unique(),
          lotData,
        );
        lots.push(docToLot(lotDoc as Record<string, unknown>));
      }
      return { listing, lots };
    } catch (err) {
      console.warn("[donation-data] import remote failed, using local:", err);
      remoteAvailable = false;
    }
  }

  listing = {
    $id: newId(),
    ...listingPayload,
    status: listingPayload.status as DonationListing["status"],
    visibility: "network",
    $createdAt: now,
  };
  const allListings = readLs<DonationListing>(LS_LISTINGS);
  allListings.unshift(listing);
  writeLs(LS_LISTINGS, allListings);

  const allLots = readLs<DonationLot>(LS_LOTS);
  for (const row of input.rows) {
    const lot: DonationLot = {
      $id: newId(),
      listing_id: listing.$id,
      org_id: input.orgId,
      org_code: row.org_code,
      item_code: row.item_code,
      item_desc: row.item_desc,
      lot_no: row.lot_no,
      locator: row.locator,
      near_expire: row.near_expire,
      quantity_available: row.quantity_accept,
      quantity_reserved: 0,
      quantity_fulfilled: 0,
      quantity_initial: row.quantity_accept,
      list_price_egp: row.list_price_egp,
      expiry_date: row.expiry_date,
      po_category: row.po_category,
      status: "available",
      import_batch_id: batchId,
      lot_key: makeLotKey(input.orgId, row.item_code, row.lot_no),
      created_by: input.createdBy,
      $createdAt: now,
    };
    lots.push(lot);
    allLots.unshift(lot);
  }
  writeLs(LS_LOTS, allLots);
  return { listing, lots };
}

export async function createDonationRequest(input: {
  lot: DonationLot;
  requesterOrgId: string;
  requestedBy: string;
  quantity: number;
  justification?: string;
  programName?: string;
}): Promise<DonationRequest> {
  const qty = Math.floor(input.quantity);
  if (qty <= 0) throw new Error("Quantity must be greater than zero.");
  if (qty > quantityRequestable(input.lot)) {
    throw new Error("Requested quantity exceeds available stock.");
  }

  const payload = {
    lot_id: input.lot.$id,
    listing_id: input.lot.listing_id,
    donor_org_id: input.lot.org_id,
    requester_org_id: input.requesterOrgId,
    requested_by: input.requestedBy,
    quantity_requested: qty,
    quantity_approved: 0,
    status: "submitted",
    justification: input.justification || "",
    program_name: input.programName || "",
    item_code: input.lot.item_code,
    item_desc: input.lot.item_desc,
    lot_no: input.lot.lot_no,
    expiry_date: input.lot.expiry_date,
    list_price_egp: input.lot.list_price_egp,
  };

  if (await probeRemote()) {
    try {
      const doc = await databases!.createDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.REQUESTS,
        ID.unique(),
        payload,
      );
      return docToRequest(doc as Record<string, unknown>);
    } catch (err) {
      console.warn("[donation-data] create request remote:", err);
      remoteAvailable = false;
    }
  }

  const req: DonationRequest = {
    $id: newId(),
    ...payload,
    status: "submitted",
    $createdAt: new Date().toISOString(),
  };
  const all = readLs<DonationRequest>(LS_REQUESTS);
  all.unshift(req);
  writeLs(LS_REQUESTS, all);
  return req;
}

export async function reviewDonationRequest(input: {
  requestId: string;
  approve: boolean;
  quantityApproved?: number;
  reviewedBy: string;
  rejectionReason?: string;
}): Promise<DonationRequest> {
  const now = new Date().toISOString();

  // Local path (also used when remote fails)
  const applyLocal = () => {
    const requests = readLs<DonationRequest>(LS_REQUESTS);
    const idx = requests.findIndex((r) => r.$id === input.requestId);
    if (idx < 0) throw new Error("Request not found.");
    const req = { ...requests[idx] };
    if (!input.approve) {
      req.status = "rejected";
      req.rejection_reason = input.rejectionReason || "Rejected by donor";
      req.reviewed_by = input.reviewedBy;
      req.reviewed_at = now;
      requests[idx] = req;
      writeLs(LS_REQUESTS, requests);
      return req;
    }

    const lots = readLs<DonationLot>(LS_LOTS);
    const lotIdx = lots.findIndex((l) => l.$id === req.lot_id);
    if (lotIdx < 0) throw new Error("Lot not found.");
    const lot = { ...lots[lotIdx] };
    const approved = Math.min(
      input.quantityApproved ?? req.quantity_requested,
      quantityRequestable(lot),
    );
    if (approved <= 0) throw new Error("No remaining quantity to approve.");

    lot.quantity_reserved += approved;
    const left = quantityRequestable(lot);
    lot.status =
      left <= 0 ? "exhausted" : lot.quantity_reserved > 0 ? "partial" : "available";
    lots[lotIdx] = lot;
    writeLs(LS_LOTS, lots);

    req.status = "approved";
    req.quantity_approved = approved;
    req.reviewed_by = input.reviewedBy;
    req.reviewed_at = now;
    requests[idx] = req;
    writeLs(LS_REQUESTS, requests);
    return req;
  };

  if (await probeRemote()) {
    try {
      // Simplified client-side update; production should use an Appwrite Function.
      const existing = await databases!.getDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.REQUESTS,
        input.requestId,
      );
      const req = docToRequest(existing as Record<string, unknown>);
      if (!input.approve) {
        const updated = await databases!.updateDocument(
          DATABASE_ID,
          DONATION_COLLECTIONS.REQUESTS,
          input.requestId,
          {
            status: "rejected",
            rejection_reason: input.rejectionReason || "Rejected by donor",
            reviewed_by: input.reviewedBy,
            reviewed_at: now,
          },
        );
        return docToRequest(updated as Record<string, unknown>);
      }

      const lotDoc = await databases!.getDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.LOTS,
        req.lot_id,
      );
      const lot = docToLot(lotDoc as Record<string, unknown>);
      const approved = Math.min(
        input.quantityApproved ?? req.quantity_requested,
        quantityRequestable(lot),
      );
      if (approved <= 0) throw new Error("No remaining quantity to approve.");

      const newReserved = lot.quantity_reserved + approved;
      const left = lot.quantity_available - newReserved;
      await databases!.updateDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.LOTS,
        lot.$id,
        {
          quantity_reserved: newReserved,
          status: left <= 0 ? "exhausted" : newReserved > 0 ? "partial" : "available",
        },
      );
      const updated = await databases!.updateDocument(
        DATABASE_ID,
        DONATION_COLLECTIONS.REQUESTS,
        input.requestId,
        {
          status: "approved",
          quantity_approved: approved,
          reviewed_by: input.reviewedBy,
          reviewed_at: now,
        },
      );
      return docToRequest(updated as Record<string, unknown>);
    } catch (err) {
      console.warn("[donation-data] review remote, falling back local:", err);
      remoteAvailable = false;
    }
  }

  return applyLocal();
}

export function storageModeLabel(): string {
  if (remoteAvailable === true) return "Appwrite";
  if (remoteAvailable === false) return "Local (browser)";
  return "Detecting…";
}
