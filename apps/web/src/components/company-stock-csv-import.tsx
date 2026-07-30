import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  parseManufacturerStockCsv,
  summarizeStockParse,
  stockRowToCatalogPayload,
  type ManufacturerStockParseResult,
  type ManufacturerStockRow,
} from "@/lib/manufacturer-stock-csv";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

const LS_PORTFOLIO = (slug: string) => `company_stock_import_${slug}`;

type Props = {
  companySlug: string;
  companyName: string;
  defaultOrgCode?: string;
};

export function CompanyStockCsvImport({
  companySlug,
  companyName,
  defaultOrgCode,
}: Props) {
  const { t } = useLanguage();
  const { session } = usePatientAuth();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ManufacturerStockParseResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(
    () => (result ? summarizeStockParse(result) : null),
    [result],
  );

  async function onFile(file: File) {
    setError(null);
    setMessage(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseManufacturerStockCsv(text, {
      mode: "portfolio",
      defaultOrgCode: defaultOrgCode || companySlug.toUpperCase().slice(0, 8),
    });
    setResult(parsed);
    if (parsed.valid.length === 0) {
      setError(
        t(
          "No valid product rows found. Check Item Code and Item Desc columns.",
          "لم يتم العثور على صفوف منتجات صالحة. تحقق من أعمدة كود الصنف والوصف.",
        ),
      );
    }
  }

  function publishPortfolio() {
    if (!result?.valid.length) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payloads = result.valid.map((row) =>
        stockRowToCatalogPayload(row, {
          name: companyName,
          slug: companySlug,
        }),
      );

      // Persist import batch for immediate client reflection
      if (typeof window !== "undefined") {
        localStorage.setItem(
          LS_PORTFOLIO(companySlug),
          JSON.stringify({
            company_slug: companySlug,
            company_name: companyName,
            source_filename: fileName,
            imported_at: new Date().toISOString(),
            row_count: payloads.length,
            rows: payloads,
          }),
        );

        // Also mirror into the generic portfolio updates key used by account forms
        const key = `company_portfolio_updates_${companySlug}`;
        const existingRaw = localStorage.getItem(key);
        let existing: any[] = [];
        try {
          existing = existingRaw ? JSON.parse(existingRaw) : [];
          if (!Array.isArray(existing)) existing = [];
        } catch {
          existing = [];
        }

        for (const p of payloads) {
          const syntheticId =
            Math.abs(
              Array.from(String(p.code))
                .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
            ) % 900000 +
            100000;
          const entry = {
            canonical_id: syntheticId,
            name_en: p.name_en,
            code: p.code,
            manufacturer: p.manufacturer,
            current_price_egp: p.current_price_egp ?? 0,
            company_slug: companySlug,
            updated_at: p.updated_at,
            source: "manufacturer_stock_csv",
          };
          const idx = existing.findIndex(
            (x) => x.code === p.code || x.name_en === p.name_en,
          );
          if (idx >= 0) existing[idx] = { ...existing[idx], ...entry };
          else existing.unshift(entry);

          recordCompanyProductProvenance({
            canonicalId: entry.canonical_id,
            isUpdate: idx >= 0,
            companyName,
            companySlug,
            actorUserId: session?.user?.id,
            actorEmail: session?.user?.email,
            productPayload: entry,
            notes: `Stock CSV import: ${fileName || "upload"}`,
          });
        }
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 5000)));
      }

      setMessage(
        t(
          `Published ${payloads.length} product rows from ${fileName || "CSV"} for ${companyName}. Users will see updated portfolio data with manufacturer provenance.`,
          `تم نشر ${payloads.length} صف منتج من ${fileName || "CSV"} لـ ${companyName}. سيظهر للمستخدمين بيانات المحفظة المحدثة مع إسناد الشركة.`,
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-8 border-teal-500/25 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-teal-700" />
          {t(
            "Upload company stock / product list (CSV)",
            "رفع قائمة مخزون / منتجات الشركة (CSV)",
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(
            "Periodically upload your warehouse or ERP export (e.g. Eva Pharma stock format) so patients and stakeholders see current product codes, descriptions, list prices, and expiry awareness. Required columns: Item Code, Item Desc. Optional: Lot No., Old Price List / Price List, Exp Date, Po Category.",
            "ارفع بشكل دوري تصدير المستودع أو نظام ERP (مثل صيغة مخزون إيفا فارما) ليطلع المرضى وأصحاب المصلحة على أكواد المنتجات والأوصاف والأسعار وتواريخ الصلاحية. الأعمدة المطلوبة: كود الصنف والوصف. اختياري: رقم اللوط والسعر وتاريخ الصلاحية والفئة.",
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-500/40 bg-teal-50/40 px-6 py-10 text-center transition hover:bg-teal-50 dark:bg-teal-950/20">
          <Upload className="h-8 w-8 text-teal-700" />
          <span className="text-sm font-semibold">
            {fileName
              ? fileName
              : t("Choose CSV file", "اختر ملف CSV")}
          </span>
          <span className="text-xs text-muted-foreground">
            .csv · UTF-8 · Eva / ERP stock exports supported
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={t("Valid rows", "صفوف صالحة")}
              value={summary.validRows}
            />
            <Stat
              label={t("Unique SKUs", "أصناف فريدة")}
              value={summary.uniqueItemCodes}
            />
            <Stat
              label={t("With price", "بسعر")}
              value={summary.withPrice}
            />
            <Stat
              label={t("Near / expired", "قريب / منتهي")}
              value={`${summary.nearExpire} / ${summary.expired}`}
            />
            <Stat label="Local" value={summary.localMarket} />
            <Stat label="Export" value={summary.exportMarket} />
            <Stat
              label={t("Skipped", "متجاوز")}
              value={summary.errorRows}
            />
          </div>
        )}

        {result && result.valid.length > 0 && (
          <>
            <div className="max-h-56 overflow-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="p-2">Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Lot</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">Expiry</th>
                    <th className="p-2">Market</th>
                  </tr>
                </thead>
                <tbody>
                  {result.valid.slice(0, 40).map((row: ManufacturerStockRow) => (
                    <tr key={`${row.row_index}-${row.item_code}`} className="border-t">
                      <td className="p-2 font-mono">{row.item_code}</td>
                      <td className="p-2 max-w-[220px] truncate">{row.item_desc}</td>
                      <td className="p-2">{row.lot_no || "—"}</td>
                      <td className="p-2">
                        {row.list_price_egp != null
                          ? row.list_price_egp
                          : "—"}
                      </td>
                      <td className="p-2">
                        {row.expiry_date
                          ? row.expiry_date.slice(0, 10)
                          : row.expiry_raw || "—"}
                        {row.is_expired && (
                          <Badge variant="destructive" className="ml-1 text-[9px]">
                            expired
                          </Badge>
                        )}
                        {row.near_expire && !row.is_expired && (
                          <Badge className="ml-1 bg-amber-500 text-[9px]">
                            near
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">{row.po_category || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.valid.length > 40 && (
                <p className="p-2 text-center text-[11px] text-muted-foreground">
                  Showing 40 of {result.valid.length} valid rows
                </p>
              )}
            </div>

            <Button
              onClick={publishPortfolio}
              disabled={busy}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              {busy
                ? t("Publishing…", "جاري النشر…")
                : t(
                    `Publish ${result.valid.length} products to ${companyName} portfolio`,
                    `نشر ${result.valid.length} منتجًا إلى محفظة ${companyName}`,
                  )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
