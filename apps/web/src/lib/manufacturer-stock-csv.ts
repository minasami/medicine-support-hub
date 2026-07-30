/**
 * Manufacturer / company stock & portfolio CSV parser.
 * Supports Eva Pharma–style dumps and related warehouse exports so verified
 * companies can periodically contribute up-to-date product data.
 *
 * Typical headers (Eva):
 *   Item Code, Item Desc, Lot No., Old Price List, Exp Date, Po Category
 *
 * Also accepts donation-style columns (Quantity Accept, Price List, Locator).
 */

export type ManufacturerStockRow = {
  item_code: string;
  item_desc: string;
  lot_no: string;
  list_price_egp: number | null;
  expiry_date: string;
  expiry_raw: string;
  po_category: string;
  quantity: number | null;
  locator: string;
  org_code: string;
  near_expire: boolean;
  is_expired: boolean;
  row_index: number;
  error?: string;
};

export type ManufacturerStockParseResult = {
  rows: ManufacturerStockRow[];
  valid: ManufacturerStockRow[];
  errors: ManufacturerStockRow[];
  warnings: string[];
  headers: string[];
  mappedColumns: string[];
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseStockExpiry(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  // Already ISO-like
  const isoTry = Date.parse(text);
  if (!Number.isNaN(isoTry) && /^\d{4}-/.test(text)) {
    return new Date(isoTry).toISOString();
  }

  // 31-Dec-26 / 31-Dec-2026
  const m = text.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon === undefined || day < 1 || day > 31) return null;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, mon, day, 23, 59, 59));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // 30/09/2026 or 30-09-2026
  const n = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (n) {
    let year = Number(n[3]);
    if (year < 100) year += 2000;
    const day = Number(n[1]);
    const mon = Number(n[2]) - 1;
    if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, mon, day, 23, 59, 59));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  return null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<string, string> = {
  "org code": "org_code",
  orgcode: "org_code",
  "item code": "item_code",
  itemcode: "item_code",
  sku: "item_code",
  "product code": "item_code",
  "item desc": "item_desc",
  "item description": "item_desc",
  description: "item_desc",
  "product name": "item_desc",
  "lot no": "lot_no",
  lotno: "lot_no",
  "lot number": "lot_no",
  lot: "lot_no",
  batch: "lot_no",
  "batch no": "lot_no",
  locator: "locator",
  "quantity accept": "quantity",
  quantity: "quantity",
  qty: "quantity",
  "qty available": "quantity",
  "price list": "list_price_egp",
  "old price list": "list_price_egp",
  "list price": "list_price_egp",
  price: "list_price_egp",
  "unit price": "list_price_egp",
  "exp date": "expiry_raw",
  expiry: "expiry_raw",
  "expiry date": "expiry_raw",
  "po category": "po_category",
  category: "po_category",
  market: "po_category",
};

export type ParseStockOptions = {
  /** Portfolio mode: lot, price, expiry optional. Stock/donation mode is stricter. */
  mode?: "portfolio" | "stock";
  /** Default org code when column absent (e.g. EVA). */
  defaultOrgCode?: string;
};

/**
 * Parse manufacturer stock / portfolio CSV text.
 */
export function parseManufacturerStockCsv(
  text: string,
  options: ParseStockOptions = {},
): ManufacturerStockParseResult {
  const mode = options.mode || "portfolio";
  const warnings: string[] = [];

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      valid: [],
      errors: [],
      warnings: ["CSV has no data rows"],
      headers: [],
      mappedColumns: [],
    };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const colMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colMap[i] = key;
  });

  const mappedColumns = [...new Set(Object.values(colMap))];
  if (!mappedColumns.includes("item_code")) {
    warnings.push('Missing required column "Item Code"');
  }
  if (!mappedColumns.includes("item_desc")) {
    warnings.push('Missing required column "Item Desc"');
  }

  const rows: ManufacturerStockRow[] = [];
  const now = Date.now();

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    const raw: Record<string, string> = {};
    cells.forEach((c, i) => {
      const key = colMap[i];
      if (key) raw[key] = c;
    });

    const priceRaw = String(raw.list_price_egp || "").replace(/,/g, "").trim();
    const priceNum = priceRaw === "" ? NaN : Number(priceRaw);
    const qtyRaw = String(raw.quantity || "").replace(/,/g, "").trim();
    const qtyNum = qtyRaw === "" ? NaN : Number(qtyRaw);
    const expiry = parseStockExpiry(raw.expiry_raw || "");
    const expiryMs = expiry ? new Date(expiry).getTime() : NaN;
    const is_expired = Number.isFinite(expiryMs) && expiryMs < now;
    const near_expire =
      /near\s*expire/i.test(raw.locator || "") ||
      (Number.isFinite(expiryMs) &&
        !is_expired &&
        (expiryMs - now) / (1000 * 60 * 60 * 24) <= 180);

    const row: ManufacturerStockRow = {
      item_code: (raw.item_code || "").trim(),
      item_desc: (raw.item_desc || "").trim(),
      lot_no: (raw.lot_no || "").trim(),
      list_price_egp: Number.isFinite(priceNum) ? priceNum : null,
      expiry_date: expiry || "",
      expiry_raw: (raw.expiry_raw || "").trim(),
      po_category: (raw.po_category || "").trim(),
      quantity: Number.isFinite(qtyNum) ? qtyNum : null,
      locator: (raw.locator || "").trim(),
      org_code: (raw.org_code || options.defaultOrgCode || "").trim(),
      near_expire,
      is_expired,
      row_index: li + 1,
    };

    const problems: string[] = [];
    if (!row.item_code) problems.push("missing item code");
    if (!row.item_desc) problems.push("missing item desc");

    if (mode === "stock") {
      if (!row.lot_no) problems.push("missing lot no");
      if (!row.expiry_date) problems.push("invalid exp date");
      if (row.quantity == null || row.quantity <= 0) {
        problems.push("quantity must be > 0");
      }
    }

    if (problems.length) row.error = problems.join("; ");
    rows.push(row);
  }

  return {
    rows,
    valid: rows.filter((r) => !r.error),
    errors: rows.filter((r) => r.error),
    warnings,
    headers,
    mappedColumns,
  };
}

export function summarizeStockParse(result: ManufacturerStockParseResult) {
  const withPrice = result.valid.filter((r) => r.list_price_egp != null).length;
  const withExpiry = result.valid.filter((r) => r.expiry_date).length;
  const expired = result.valid.filter((r) => r.is_expired).length;
  const near = result.valid.filter((r) => r.near_expire).length;
  const local = result.valid.filter((r) =>
    /local/i.test(r.po_category),
  ).length;
  const exportRows = result.valid.filter((r) =>
    /export/i.test(r.po_category),
  ).length;
  const uniqueCodes = new Set(result.valid.map((r) => r.item_code)).size;

  return {
    totalRows: result.rows.length,
    validRows: result.valid.length,
    errorRows: result.errors.length,
    uniqueItemCodes: uniqueCodes,
    withPrice,
    withExpiry,
    expired,
    nearExpire: near,
    localMarket: local,
    exportMarket: exportRows,
  };
}

/** Build a catalog-oriented payload from a stock row (for portfolio publish). */
export function stockRowToCatalogPayload(
  row: ManufacturerStockRow,
  company: { name: string; slug: string },
) {
  return {
    name_en: row.item_desc,
    code: row.item_code,
    manufacturer: company.name,
    company_slug: company.slug,
    current_price_egp: row.list_price_egp ?? undefined,
    lot_no: row.lot_no || undefined,
    expiry_date: row.expiry_date || undefined,
    po_category: row.po_category || undefined,
    quantity: row.quantity ?? undefined,
    near_expire: row.near_expire,
    is_expired: row.is_expired,
    source: "manufacturer_stock_csv",
    updated_at: new Date().toISOString(),
  };
}
