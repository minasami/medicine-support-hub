/**
 * Resolve a scanned product barcode to encyclopedia candidates.
 */
import { Client, Databases, Query } from "appwrite";

const ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_ID =
  import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines";

export type BarcodeHit = {
  canonical_id: number;
  name_en: string;
  name_ar?: string;
  manufacturer?: string;
  barcode?: string;
  code?: string;
  current_price_egp?: number | null;
  product_type?: string;
  source: "appwrite" | "static";
};

function normalizeBarcode(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^0+/, (m) => (m.length > 1 ? m.slice(-1) === "0" ? "" : m : m));
}

/** Digits only for comparison (EAN-13 / UPCA variants). */
export function digitsBarcode(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

function barcodesMatch(a: string, b: string): boolean {
  const da = digitsBarcode(a);
  const db = digitsBarcode(b);
  if (!da || !db) return false;
  if (da === db) return true;
  // UPC-A vs EAN-13 leading zero
  if (da.length === 12 && db.length === 13 && db === `0${da}`) return true;
  if (db.length === 12 && da.length === 13 && da === `0${db}`) return true;
  return false;
}

async function lookupAppwrite(barcode: string): Promise<BarcodeHit[]> {
  if (!PROJECT) return [];
  try {
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    const db = new Databases(client);
    const dig = digitsBarcode(barcode);
    if (dig.length < 8) return [];

    // Prefer equality on full string; also try digit form
    const queries = [
      Query.equal("barcode", barcode),
      Query.limit(10),
    ];
    let res = await db.listDocuments(DATABASE_ID, MEDICINES_ID, queries);
    let docs = res.documents || [];

    if (!docs.length && dig !== barcode) {
      res = await db.listDocuments(DATABASE_ID, MEDICINES_ID, [
        Query.equal("barcode", dig),
        Query.limit(10),
      ]);
      docs = res.documents || [];
    }

    // Fallback: search contains if attribute search available — skip if empty
    if (!docs.length) {
      // Limited scan is too expensive; rely on pharmacy enrichment filling barcodes
      return [];
    }

    return docs
      .map((d: any) => ({
        canonical_id: Number(d.canonical_id || 0),
        name_en: String(d.name_en || ""),
        name_ar: d.name_ar ? String(d.name_ar) : undefined,
        manufacturer: d.manufacturer ? String(d.manufacturer) : undefined,
        barcode: d.barcode ? String(d.barcode) : undefined,
        code: d.code ? String(d.code) : undefined,
        current_price_egp:
          d.current_price_egp == null ? null : Number(d.current_price_egp),
        product_type: d.product_type ? String(d.product_type) : undefined,
        source: "appwrite" as const,
      }))
      .filter((h) => h.canonical_id > 0);
  } catch (err) {
    console.warn("[barcode-lookup] Appwrite", err);
    return [];
  }
}

async function lookupStatic(barcode: string): Promise<BarcodeHit[]> {
  try {
    const res = await fetch("/data/egyptian-medicines-dataset.json");
    const data = await res.json();
    const list = Array.isArray(data?.medicines)
      ? data.medicines
      : Array.isArray(data)
        ? data
        : [];
    const hits: BarcodeHit[] = [];
    for (const m of list) {
      const bc = String(m.barcode || "");
      if (!bc || !barcodesMatch(bc, barcode)) continue;
      hits.push({
        canonical_id: Number(m.canonical_id || m.id || 0),
        name_en: String(m.name_en || m.name || ""),
        name_ar: m.name_ar ? String(m.name_ar) : undefined,
        manufacturer: m.manufacturer ? String(m.manufacturer) : undefined,
        barcode: bc,
        code: m.code ? String(m.code) : undefined,
        current_price_egp:
          m.current_price_egp == null ? null : Number(m.current_price_egp),
        product_type: m.product_type ? String(m.product_type) : undefined,
        source: "static",
      });
      if (hits.length >= 10) break;
    }
    return hits.filter((h) => h.canonical_id > 0);
  } catch {
    return [];
  }
}

export async function lookupBarcode(raw: string): Promise<{
  barcode: string;
  hits: BarcodeHit[];
}> {
  const barcode = normalizeBarcode(raw);
  const dig = digitsBarcode(barcode);
  if (dig.length < 8) {
    return { barcode, hits: [] };
  }

  const [remote, local] = await Promise.all([
    lookupAppwrite(barcode),
    lookupStatic(barcode),
  ]);

  const byId = new Map<number, BarcodeHit>();
  for (const h of [...remote, ...local]) {
    if (!byId.has(h.canonical_id) || h.source === "appwrite") {
      byId.set(h.canonical_id, h);
    }
  }
  return { barcode: dig, hits: [...byId.values()] };
}

export function medicineUrlForHit(hit: BarcodeHit): string {
  // Live Appwrite ids use /catalog/:id
  if (hit.source === "appwrite") {
    return `/catalog/${hit.canonical_id}`;
  }
  // Static ids are a different space — name search is safer
  const q = encodeURIComponent(hit.name_en || String(hit.canonical_id));
  return `/medicines#q=${q}`;
}
