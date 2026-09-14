export type InvoiceLine = { description: string; amount?: number };

export type InvoiceDraft = {
  provider: string;
  invoice_no: string;
  date: string;
  patient: string;
  tpa: string;
  currency: string;
  total?: number;
  lines: InvoiceLine[];
  raw_text: string;
};

const EGP_RE = /(?:EGP|ج\.? م|LE|E£)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i;
const TOTAL_RE = /(?:total|الإجمالي|الاجمالى|الصافي|المبلغ)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i;
const DATE_RE = /\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b/;
const INV_RE = /(?:invoice|فاتورة|receipt|إيصال|#)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i;
const TPA_RE = /(allianz|axa|metlife|cigna|mednet|nextcare|globemed|bupa|misr insurance|weqaya|tpa|التأمين)/i;

export function parseInvoiceText(raw: string): InvoiceDraft {
  const text = raw.replace(/\r/g, "").trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const totalMatch = text.match(TOTAL_RE) || text.match(EGP_RE);
  const dateMatch = text.match(DATE_RE);
  const invMatch = text.match(INV_RE);
  const tpaMatch = text.match(TPA_RE);
  const moneyLines: InvoiceLine[] = [];
  for (const line of lines) {
    const m = line.match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:EGP|ج\.? م|LE)?$/i);
    if (m && line.length < 80) {
      moneyLines.push({ description: line.replace(m[0], "").trim() || line, amount: Number(String(m[1]).replace(",", ".")) });
    }
  }
  return {
    provider: lines[0]?.slice(0, 80) || "",
    invoice_no: invMatch?.[1] || "",
    date: dateMatch?.[1] || "",
    patient: "",
    tpa: tpaMatch?.[0] || "",
    currency: "EGP",
    total: totalMatch ? Number(String(totalMatch[1]).replace(",", ".")) : undefined,
    lines: moneyLines.slice(0, 20),
    raw_text: text,
  };
}

export function claimPacketText(d: InvoiceDraft): string {
  const items = d.lines.map((l) => `- ${l.description}${l.amount != null ? ` · ${l.amount} ${d.currency}` : ""}`).join("\n");
  return [
    "Medicine Support Hub — insurance / TPA claim draft",
    `Provider: ${d.provider || "—"}`,
    `Invoice: ${d.invoice_no || "—"}`,
    `Date: ${d.date || "—"}`,
    `Patient: ${d.patient || "—"}`,
    `TPA / insurer: ${d.tpa || "—"}`,
    `Total: ${d.total ?? "—"} ${d.currency}`,
    items ? `Items:\n${items}` : "",
    "Assistive OCR only. Verify against the original invoice before submitting a claim.",
  ].filter(Boolean).join("\n");
}
