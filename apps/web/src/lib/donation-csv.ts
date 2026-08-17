import type { CsvImportResult, ParsedDonationCsvRow } from "./donation-types";

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

/** Parse donor CSV dates like 31-Dec-26 or 31-Dec-2026 into ISO end-of-day UTC. */
export function parseDonationExpiry(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const isoTry = Date.parse(text);
  if (!Number.isNaN(isoTry) && /^\d{4}-/.test(text)) {
    return new Date(isoTry).toISOString();
  }

  const m = text.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS[m[2].toLowerCase()];
  if (mon === undefined || day < 1 || day > 31) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, mon, day, 23, 59, 59));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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

/** Collapse punctuation/whitespace so "Lot No." → "lot no". */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES: Record<
  string,
  | keyof Omit<
      ParsedDonationCsvRow,
      "row_index" | "error" | "near_expire" | "expiry_date"
    >
  | "expiry_raw"
> = {
  "org code": "org_code",
  orgcode: "org_code",
  "item code": "item_code",
  itemcode: "item_code",
  "item desc": "item_desc",
  "item description": "item_desc",
  description: "item_desc",
  "lot no": "lot_no",
  lotno: "lot_no",
  "lot number": "lot_no",
  lot: "lot_no",
  locator: "locator",
  "quantity accept": "quantity_accept",
  "quantity available": "quantity_accept",
  "qty available": "quantity_accept",
  "qty accept": "quantity_accept",
  quantity: "quantity_accept",
  qty: "quantity_accept",
  "price list": "list_price_egp",
  "old price list": "list_price_egp",
  "list price": "list_price_egp",
  price: "list_price_egp",
  "exp date": "expiry_raw",
  expiry: "expiry_raw",
  "expiry date": "expiry_raw",
  "po category": "po_category",
  category: "po_category",
};

/**
 * Parse the pharmaceutical near-expiry donation CSV format used by donor orgs.
 */
export function parseDonationCsv(text: string): CsvImportResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], valid: [], errors: [] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const colMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colMap[i] = String(key);
  });

  const rows: ParsedDonationCsvRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    const raw: Record<string, string> = {};
    cells.forEach((c, i) => {
      const key = colMap[i];
      if (key) raw[key] = c;
    });

    const quantity = Number(String(raw.quantity_accept || "").replace(/,/g, ""));
    const price = Number(String(raw.list_price_egp || "0").replace(/,/g, ""));
    const expiry = parseDonationExpiry(raw.expiry_raw || "");
    const locator = raw.locator || "";
    const near_expire =
      /near\s*expire/i.test(locator) ||
      (expiry
        ? (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 180
        : false);

    const row: ParsedDonationCsvRow = {
      org_code: (raw.org_code || "").trim(),
      item_code: (raw.item_code || "").trim(),
      item_desc: (raw.item_desc || "").trim(),
      lot_no: (raw.lot_no || "").trim(),
      locator,
      quantity_accept: Number.isFinite(quantity) ? quantity : 0,
      list_price_egp: Number.isFinite(price) ? price : 0,
      expiry_date: expiry || "",
      po_category: (raw.po_category || "").trim(),
      near_expire,
      row_index: li + 1,
    };

    if (!row.item_code || !row.item_desc || !row.lot_no) {
      row.error = "Missing item code, description, or lot number";
    } else if (!row.quantity_accept || row.quantity_accept <= 0) {
      row.error = "Quantity must be a positive number";
    } else if (!row.expiry_date) {
      row.error = "Could not parse expiry date";
    }

    rows.push(row);
  }

  const valid = rows.filter((r) => !r.error);
  const errors = rows.filter((r) => !!r.error);
  return { rows, valid, errors };
}
