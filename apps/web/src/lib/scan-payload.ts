/**
 * Normalize camera / QR / barcode raw values into a catalog lookup.
 * Pharma packs may carry EAN-13, GS1 QR, Data Matrix, or a product URL.
 */

export type ScanKind = "barcode" | "gtin" | "url" | "name" | "unknown";

export type ParsedScan = {
  kind: ScanKind;
  raw: string;
  barcode?: string;
  name?: string;
  catalogId?: string;
};

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

function extractGtinFromGs1(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "");
  const ai01 = compact.match(/(?:^|[^0-9])01(\d{14})/);
  if (ai01) return ai01[1];
  const gtin13 = compact.match(/\b(\d{13})\b/);
  if (gtin13) return gtin13[1];
  return null;
}

function extractFromUrl(raw: string): ParsedScan | null {
  try {
    const url = new URL(raw);
    const path = url.pathname;
    const catalog = path.match(/\/(?:catalog|medicines|medicine)\/([^/?#]+)/i);
    if (catalog?.[1]) {
      return { kind: "url", raw, catalogId: decodeURIComponent(catalog[1]) };
    }
    const gtin =
      url.searchParams.get("gtin") ||
      url.searchParams.get("barcode") ||
      url.searchParams.get("ean") ||
      url.searchParams.get("code");
    if (gtin && digitsOnly(gtin).length >= 8) {
      return { kind: "barcode", raw, barcode: digitsOnly(gtin) };
    }
    const q = url.searchParams.get("q") || url.searchParams.get("query");
    if (q && q.trim().length >= 2) {
      return { kind: "name", raw, name: q.trim() };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseScanPayload(rawValue: string): ParsedScan {
  const raw = String(rawValue || "").trim();
  if (!raw) return { kind: "unknown", raw };

  if (/^https?:\/\//i.test(raw)) {
    return extractFromUrl(raw) || { kind: "url", raw, name: raw };
  }

  const digits = digitsOnly(raw);
  if (/^[\d\s-]+$/.test(raw) && digits.length >= 8 && digits.length <= 14) {
    return { kind: "barcode", raw, barcode: digits };
  }

  const gtin = extractGtinFromGs1(raw);
  if (gtin) {
    return {
      kind: "gtin",
      raw,
      barcode: gtin.replace(/^0/, "").length === 13 ? gtin.slice(-13) : gtin,
    };
  }

  if (raw.length >= 2) {
    return { kind: "name", raw, name: raw.slice(0, 180) };
  }

  return { kind: "unknown", raw };
}
