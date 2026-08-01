/**
 * Durable manufacturer stock import storage.
 * Appwrite first (parallel writes + retry); localStorage fallback.
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

/** Max concurrent Appwrite createDocument calls (lower = fewer 429s). */
export const WRITE_CONCURRENCY = 4;
/** Max retries per document on transient errors. */
const MAX_RETRIES = 5;
/** Soft cap for a single publish (rows beyond this are rejected with a clear error). */
export const MAX_IMPORT_ROWS = 8000;
/** Soft file size guidance (bytes) — enforced in UI. */
export const MAX_CSV_BYTES = 12 * 1024 * 1024;

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

function writeLsSafe<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e: any) {
    if (e?.name === "QuotaExceededError" || e?.code === 22) {
      const trimmed = value.slice(0, Math.floor(value.length / 2));
      try {
        localStorage.setItem(key, JSON.stringify(trimmed));
      } catch {
        throw new Error(
          "Browser storage is full. Publish fewer rows, clear site data, or enable Appwrite tables for durable multi-device storage.",
        );
      }
      return;
    }
    throw e;
  }
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  const code = Number((err as any)?.code || 0);
  return (
    code === 429 ||
    code === 503 ||
    code === 500 ||
    code === 0 ||
    msg.includes("rate") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch")
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryableError(err)) throw err;
      // Longer backoff for rate limits
      const code = Number((err as any)?.code || 0);
      const base = code === 429 ? 800 : 300;
      await sleep(base * Math.pow(2, attempt) + Math.random() * 200);
    }
  }
  throw lastErr;
}

/** Run async tasks with a fixed concurrency pool. */
export async function mapPool<
  T,
  R,
>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ results: (R | null)[]; errors: { index: number; error: string }[] }> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  const errors: { index: number; error: string }[] = [];
  let next = 0;
  let done = 0;

  async function runOne() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await worker(items[i], i);
      } catch (err: any) {
        errors.push({
          index: i,
          error: err?.message || String(err),
        });
      }
      done += 1;
      onProgress?.(done, items.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => runOne(),
  );
  await Promise.all(workers);
  return { results, errors };
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
  write_errors?: number;
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

export type PersistProgress = {
  phase: "preparing" | "writing" | "done" | "error";
  done: number;
  total: number;
  message?: string;
};

/** Build Appwrite payload omitting null/empty optionals (null often fails validation). */
function lotDocumentData(
  payload: Omit<StockLotRecord, "$id" | "$createdAt">,
  batchId: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    batch_id: String(batchId).slice(0, 64),
    company_slug: String(payload.company_slug || "").slice(0, 128),
    item_code: String(payload.item_code || "").slice(0, 128),
    item_desc: String(payload.item_desc || "")
      .replace(/\u0000/g, "")
      .slice(0, 512),
    match_method: String(payload.match_method || "unmatched").slice(0, 32),
    match_confidence: Number(payload.match_confidence) || 0,
    near_expire: Boolean(payload.near_expire),
    is_expired: Boolean(payload.is_expired),
  };

  const lot = String(payload.lot_no || "").slice(0, 64);
  if (lot) data.lot_no = lot;

  const exp = String(payload.expiry_date || "").slice(0, 64);
  if (exp) data.expiry_date = exp;

  const cat = String(payload.po_category || "").slice(0, 64);
  if (cat) data.po_category = cat;

  if (payload.list_price_egp != null && Number.isFinite(payload.list_price_egp)) {
    data.list_price_egp = Number(payload.list_price_egp);
  }
  if (payload.quantity != null && Number.isFinite(payload.quantity)) {
    data.quantity = Math.trunc(Number(payload.quantity));
  }
  if (payload.canonical_id != null && Number.isFinite(payload.canonical_id)) {
    data.canonical_id = Math.trunc(Number(payload.canonical_id));
  }

  return data;
}

export async function persistManufacturerStockImport(params: {
  companySlug: string;
  companyName: string;
  filename?: string;
  createdBy?: string;
  rows: ManufacturerStockRow[];
  matches: Map<string, SkuMatchResult>;
  onProgress?: (p: PersistProgress) => void;
  concurrency?: number;
}): Promise<{
  batch: StockBatch;
  lots: StockLotRecord[];
  writeErrors: number;
  sampleErrors: string[];
}> {
  const {
    companySlug,
    companyName,
    filename,
    createdBy,
    rows,
    matches,
    onProgress,
    concurrency = WRITE_CONCURRENCY,
  } = params;

  const valid = rows.filter((r) => !r.error);
  if (valid.length === 0) {
    throw new Error("No valid rows to persist.");
  }
  if (valid.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Import exceeds the ${MAX_IMPORT_ROWS.toLocaleString()}-row safety limit (${valid.length.toLocaleString()} valid rows). Split the CSV into smaller files.`,
    );
  }

  onProgress?.({ phase: "preparing", done: 0, total: valid.length });

  let matchedCount = 0;
  const lotPayloads: Omit<StockLotRecord, "$id" | "$createdAt">[] = valid.map(
    (r) => {
      const key = `${r.item_code}||${r.item_desc}`;
      const m = matches.get(key) || {
        canonical_id: null,
        match_method: "unmatched" as const,
        confidence: 0,
      };
      if (m.canonical_id) matchedCount += 1;
      return {
        batch_id: "",
        company_slug: companySlug,
        item_code: r.item_code.slice(0, 128),
        item_desc: r.item_desc.slice(0, 512),
        lot_no: (r.lot_no || "").slice(0, 64),
        list_price_egp: r.list_price_egp,
        expiry_date: (r.expiry_date || "").slice(0, 64),
        po_category: (r.po_category || "").slice(0, 64),
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
    const batchPayload: Record<string, unknown> = {
      company_slug: companySlug,
      company_name: companyName,
      row_count: valid.length,
      matched_count: matchedCount,
      unmatched_count: valid.length - matchedCount,
    };
    if (filename) batchPayload.source_filename = String(filename).slice(0, 256);
    if (createdBy) batchPayload.created_by = String(createdBy).slice(0, 64);

    const batchDoc = await withRetry(() =>
      databases!.createDocument(
        DATABASE_ID,
        STOCK_COLLECTIONS.BATCHES,
        ID.unique(),
        batchPayload,
      ),
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

    onProgress?.({
      phase: "writing",
      done: 0,
      total: lotPayloads.length,
      message: "Writing lots to Appwrite…",
    });

    const { results, errors } = await mapPool(
      lotPayloads,
      concurrency,
      async (payload) => {
        const data = lotDocumentData(payload, batch.$id);
        const doc = await withRetry(() =>
          databases!.createDocument(
            DATABASE_ID,
            STOCK_COLLECTIONS.LOTS,
            ID.unique(),
            data,
          ),
        );
        const lot: StockLotRecord = {
          $id: String(doc.$id),
          ...payload,
          batch_id: batch.$id,
          $createdAt: String(doc.$createdAt || nowIso),
        };
        return lot;
      },
      (done, total) => onProgress?.({ phase: "writing", done, total }),
    );

    const lots = results.filter(Boolean) as StockLotRecord[];
    batch.write_errors = errors.length;
    const sampleErrors = errors.slice(0, 5).map((e) => e.error);

    try {
      const allLots = readLs<StockLotRecord>(LS_LOTS);
      allLots.unshift(...lots);
      writeLsSafe(LS_LOTS, allLots.slice(0, 20000));
    } catch {
      /* mirror optional */
    }

    if (lots.length === 0 && errors.length > 0) {
      throw new Error(
        `Appwrite write failed for all ${errors.length} lots. First error: ${errors[0].error}`,
      );
    }

    onProgress?.({
      phase: "done",
      done: lots.length,
      total: lotPayloads.length,
      message:
        errors.length > 0
          ? `Saved ${lots.length}/${lotPayloads.length} lots (${errors.length} failed)`
          : `Saved ${lots.length} lots`,
    });

    return { batch, lots, writeErrors: errors.length, sampleErrors };
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

  try {
    const batches = readLs<StockBatch>(LS_BATCHES);
    batches.unshift(batch);
    writeLsSafe(LS_BATCHES, batches.slice(0, 50));

    const allLots = readLs<StockLotRecord>(LS_LOTS);
    allLots.unshift(...lots);
    writeLsSafe(LS_LOTS, allLots.slice(0, 20000));
  } catch (e: any) {
    throw new Error(
      e?.message ||
        "Could not save import to browser storage. Enable Appwrite stock tables for large multi-device imports.",
    );
  }

  onProgress?.({
    phase: "done",
    done: lots.length,
    total: lots.length,
    message: "Saved locally (Appwrite tables not available)",
  });

  return { batch, lots, writeErrors: 0, sampleErrors: [] };
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
