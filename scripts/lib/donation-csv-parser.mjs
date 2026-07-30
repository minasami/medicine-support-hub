/**
 * Shared donation CSV parser (mirrors apps/web/src/lib/donation-csv.ts).
 * Keep in sync when the web parser changes.
 */

const MONTHS = {
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

export function parseDonationExpiry(raw) {
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

function splitCsvLine(line) {
  const cells = [];
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

/** Collapse punctuation so "Lot No." → "lot no". */
export function normalizeHeader(h) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_ALIASES = {
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
  quantity: "quantity_accept",
  qty: "quantity_accept",
  "price list": "list_price_egp",
  price: "list_price_egp",
  "exp date": "expiry_raw",
  expiry: "expiry_raw",
  "expiry date": "expiry_raw",
  "po category": "po_category",
  category: "po_category",
};

export function parseDonationCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], valid: [], errors: [], headers: [], colMap: {} };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const colMap = {};
  headers.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colMap[i] = key;
  });

  const rows = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    const raw = {};
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

    const row = {
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

    const problems = [];
    if (!row.item_code) problems.push("missing item code");
    if (!row.item_desc) problems.push("missing item desc");
    if (!row.lot_no) problems.push("missing lot no");
    if (!row.expiry_date) problems.push("invalid exp date");
    if (row.quantity_accept <= 0) problems.push("quantity must be > 0");
    if (problems.length) row.error = problems.join("; ");

    rows.push(row);
  }

  return {
    rows,
    valid: rows.filter((r) => !r.error),
    errors: rows.filter((r) => r.error),
    headers,
    colMap,
  };
}

export function summarizeParse(result) {
  const totalUnits = result.valid.reduce((s, r) => s + r.quantity_accept, 0);
  const totalValue = result.valid.reduce(
    (s, r) => s + r.quantity_accept * r.list_price_egp,
    0,
  );
  const nearExpireCount = result.valid.filter((r) => r.near_expire).length;
  const mappedCols = Object.values(result.colMap || {});
  return {
    totalRows: result.rows.length,
    validRows: result.valid.length,
    errorRows: result.errors.length,
    totalUnits,
    totalValueEgp: Math.round(totalValue * 100) / 100,
    nearExpireCount,
    mappedColumns: mappedCols,
    missingRequiredColumns: ["item_code", "item_desc", "lot_no", "expiry_raw", "quantity_accept"].filter(
      (c) => !mappedCols.includes(c),
    ),
  };
}
