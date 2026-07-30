/**
 * Durable manufacturer stock import storage.
 * Appwrite first; localStorage fallback for offline / pre-provisioning.
 * Multi-device durability requires Appwrite tables (see docs).
 */
import { Client, Databases, ID, Query } from "appwrite";
import type { ManufacturerStockRow } from "./manufacturer-stock-csv";
import type { SkuMatchResult } from "./sku-canonical-map";

const APPWRITE_ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";

export const STOCK_COLLECTIONS = {
  BATCHES:
    import.meta.env.VITE_APPWRITE_STOCK_BATCHES_ID || "manufacturer_stock_batches",
  LOTS: import.meta.env.VITE_APPWRITE_STOCK_LOTS_ID || "manufacturer_stock_lots",
};

const LS_BATCHES = "msh_manufacturer_stock_batches_v1";
const LS_LOTS = "msh_manufacturer_stock_lots_v1";

let databases: Databases | null = null;
let remoteAvailable: boolean | null = null;

if (APPWRITE_PROJECT_ID) {
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID);
    databases = new Databases(client);
  } catch (err) {
    console.warn("[manufacturer-stock-data] Appwrite init:", err);
  }
}

export function getStockDatabases() {
  return databases;
}

export function getStockDatabaseId() {
  return DATABASE_ID;
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

async function probeRemote(): Promise<boolean> {
  if (remoteAvailable !== null) return remoteAvailable;
  if (!databases) {
    remoteAvailable = false;
    return false;
  }
  try {
    await databases.listDocuments(DATABASE_ID, STOCK_COLLECTIONS.BATCHES, [
      Query.limit(1),
    ]);
    remoteAvailable = true;
  } catch {
    remoteAvailable = false;
  }
  return remoteAvailable;
}

export type StockBatch = {
  $id: string;
  company_slug: string;
  company_name: string;
  source_filename?: string;
  row_count: number;
  matched_count: number;
  unmatched_count: number;
  created_by?: string;
  $createdAt?: string;
};

export type StockLotRecord = {
  $id: string;
  batch_id: string;
  company_slug: string;
  item_code: string;
  item_desc: string;
  lot_no: string;
  list_price_egp: number | null;
  expiry_date: string;
  po_category: string;
  quantity: number | null;
  canonical_id: number | null;
  match_method: string;
  match_confidence: number;
  near_expire: boolean;
  is_expired: boolean;
  $createdAt?: string;
};

export async function persistManufacturerStockImport(params: {
  companySlug: string;
  companyName: string;
  filename?: string;
  createdBy?: string;
  rows: ManufacturerStockRow[];
  matches: Map<string, SkuMatchResult>;
}): Promise<{ batch: StockBatch; lots: StockLotRecord[] }> {
  const { companySlug, companyName, filename, createdBy, rows, matches } =
    params;
  const valid = rows.filter((r) => !r.error);
  if (valid.length === 0) throw new Error("No valid rows to persist.");

  let matchedCount = 0;
  const lotPayloads: Omit<StockLotRecord, "$id" | "$createdAt">[] = valid.map(
    (r) => {
      const key = `${r.item_code}||${r.item_desc}`;
      const m = matches.get(key) || {
        canonical_id: null,
        match_method: "unmatched",
        confidence: 0,
      };
      if (m.canonical_id) matchedCount += 1;
      return {
        batch_id: "",
        company_slug: companySlug,
        item_code: r.item_code,
        item_desc: r.item_desc,
        lot_no: r.lot_no,
        list_price_egp: r.list_price_egp,
        expiry_date: r.expiry_date,
        po_category: r.po_category,
        quantity: r.quantity,
        canonical_id: m.canonical_id,
        match_method: m.match_method,
        match_confidence: m.confidence,
        near_expire: r.near_expire,
        is_expired: r.is_expired,
      };
    },
  );

  const isRemote = await probeRemote();
  const nowIso = new Date().toISOString();

  if (isRemote && databases) {
    const batchDoc = await databases.createDocument(
      DATABASE_ID,
      STOCK_COLLECTIONS.BATCHES,
      ID.unique(),
      {
        company_slug: companySlug,
        company_name: companyName,
        source_filename: filename || null,
        row_count: valid.length,
        matched_count: matchedCount,
        unmatched_count: valid.length - matchedCount,
        created_by: createdBy || null,
      },
    );

    const batch: StockBatch = {
      $id: String(batchDoc.$id),
      company_slug: companySlug,
      company_name: companyName,
      source_filename: filename,
      row_count: valid.length,
      matched_count: matchedCount,
      unmatched_count: valid.length - matchedCount,
      created_by: createdBy,
      $createdAt: String(batchDoc.$createdAt || nowIso),
    };

    const lots: StockLotRecord[] = [];
    // Sequential writes keep rate limits predictable on large Eva dumps
    for (const payload of lotPayloads) {
      const doc = await databases.createDocument(
        DATABASE_ID,
        STOCK_COLLECTIONS.LOTS,
        ID.unique(),
        {
          ...payload,
          batch_id: batch.$id,
          list_price_egp: payload.list_price_egp ?? null,
          quantity: payload.quantity ?? null,
          canonical_id: payload.canonical_id ?? null,
        },
      );
      lots.push({
        $id: String(doc.$id),
        ...payload,
        batch_id: batch.$id,
        $createdAt: String(doc.$createdAt || nowIso),
      });
    }
    return { batch, lots };
  }

  // localStorage fallback
  const batchId = newId();
  const batch: StockBatch = {
    $id: batchId,
    company_slug: companySlug,
    company_name: companyName,
    source_filename: filename,
    row_count: valid.length,
    matched_count: matchedCount,
    unmatched_count: valid.length - matchedCount,
    created_by: createdBy,
    $createdAt: nowIso,
  };

  const lots: StockLotRecord[] = lotPayloads.map((p) => ({
    $id: newId(),
    ...p,
    batch_id: batchId,
    $createdAt: nowIso,
  }));

  const batches = readLs<StockBatch>(LS_BATCHES);
  batches.unshift(batch);
  writeLs(LS_BATCHES, batches.slice(0, 50));

  const allLots = readLs<StockLotRecord>(LS_LOTS);
  allLots.unshift(...lots);
  writeLs(LS_LOTS, allLots.slice(0, 20000));

  return { batch, lots };
}

export async function listStockLotsForCompany(
  companySlug: string,
  limit = 500,
): Promise<StockLotRecord[]> {
  const isRemote = await probeRemote();
  if (isRemote && databases) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      STOCK_COLLECTIONS.LOTS,
      [Query.equal("company_slug", companySlug), Query.limit(limit)],
    );
    return res.documents.map((doc: any) => ({
      $id: String(doc.$id),
      batch_id: String(doc.batch_id || ""),
      company_slug: String(doc.company_slug || ""),
      item_code: String(doc.item_code || ""),
      item_desc: String(doc.item_desc || ""),
      lot_no: String(doc.lot_no || ""),
      list_price_egp:
        doc.list_price_egp == null ? null : Number(doc.list_price_egp),
      expiry_date: String(doc.expiry_date || ""),
      po_category: String(doc.po_category || ""),
      quantity: doc.quantity == null ? null : Number(doc.quantity),
      canonical_id:
        doc.canonical_id == null ? null : Number(doc.canonical_id),
      match_method: String(doc.match_method || "unmatched"),
      match_confidence: Number(doc.match_confidence || 0),
      near_expire: Boolean(doc.near_expire),
      is_expired: Boolean(doc.is_expired),
      $createdAt: doc.$createdAt ? String(doc.$createdAt) : undefined,
    }));
  }
  return readLs<StockLotRecord>(LS_LOTS)
    .filter((l) => l.company_slug === companySlug)
    .slice(0, limit);
}

/** Latest price/code assertions keyed by canonical_id for encyclopedia merge. */
export function buildCanonicalOverridesFromLots(
  lots: StockLotRecord[],
): Map<
  number,
  { code?: string; name_en?: string; current_price_egp?: number; manufacturer?: string }
> {
  const map = new Map<
    number,
    { code?: string; name_en?: string; current_price_egp?: number; manufacturer?: string }
  >();
  for (const lot of lots) {
    if (!lot.canonical_id) continue;
    const prev = map.get(lot.canonical_id) || {};
    map.set(lot.canonical_id, {
      code: lot.item_code || prev.code,
      name_en: lot.item_desc || prev.name_en,
      current_price_egp:
        lot.list_price_egp != null
          ? lot.list_price_egp
          : prev.current_price_egp,
    });
  }
  return map;
}

export function stockStorageModeLabel(): string {
  if (remoteAvailable === true) return "Appwrite Cloud";
  if (remoteAvailable === false) return "LocalStorage (fallback)";
  return "Checking…";
}
