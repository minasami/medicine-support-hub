import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  parseManufacturerStockCsv,
  summarizeStockParse,
  type ManufacturerStockParseResult,
  type ManufacturerStockRow,
} from "@/lib/manufacturer-stock-csv";
import {
  ensureSkuCatalogIndex,
  matchManySkus,
  summarizeMatches,
  type SkuMatchResult,
} from "@/lib/sku-canonical-map";
import {
  persistManufacturerStockImport,
  stockStorageModeLabel,
  getStockDatabases,
  getStockDatabaseId,
} from "@/lib/manufacturer-stock-data";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

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
  const [matches, setMatches] = useState<Map<string, SkuMatchResult> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState(stockStorageModeLabel());

  const summary = useMemo(
    () => (result ? summarizeStockParse(result) : null),
    [result],
  );

  const matchSummary = useMemo(
    () => (matches ? summarizeMatches(matches.values()) : null),
    [matches],
  );

  async function onFile(file: File) {
    setError(null);
    setMessage(null);
    setFileName(file.name);
    setIndexing(true);
    try {
      const text = await file.text();
      const parsed = parseManufacturerStockCsv(text, {
        mode: "portfolio",
        defaultOrgCode: defaultOrgCode || companySlug.toUpperCase().slice(0, 8),
      });
      setResult(parsed);

      await ensureSkuCatalogIndex({
        databases: getStockDatabases(),
        databaseId: getStockDatabaseId(),
        medicinesCollectionId:
          import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines",
      });

      const m = matchManySkus(
        parsed.valid.map((r) => ({
          item_code: r.item_code,
          item_desc: r.item_desc,
        })),
      );
      setMatches(m);
      setStorageMode(stockStorageModeLabel());

      if (parsed.valid.length === 0) {
        setError(
          t(
            "No valid product rows found. Check Item Code and Item Desc columns.",
            "لم يتم العثور على صفوف منتجات صالحة. تحقق من أعمدة كود الصنف والوصف.",
          ),
        );
      }
    } catch (e: any) {
      setError(e?.message || "Failed to parse file");
    } finally {
      setIndexing(false);
    }
  }

  async function publishPortfolio() {
    if (!result?.valid.length || !matches) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { batch, lots } = await persistManufacturerStockImport({
        companySlug,
        companyName,
        filename: fileName || undefined,
        createdBy: session?.user?.id,
        rows: result.valid,
        matches,
      });

      // Provenance for matched encyclopedia products
      for (const lot of lots) {
        if (!lot.canonical_id) continue;
        recordCompanyProductProvenance({
          canonicalId: lot.canonical_id,
          isUpdate: true,
          companyName,
          companySlug,
          actorUserId: session?.user?.id,
          actorEmail: session?.user?.email,
          productPayload: {
            name_en: lot.item_desc,
            code: lot.item_code,
            current_price_egp: lot.list_price_egp,
            manufacturer: companyName,
          },
          notes: `Stock CSV ${fileName || "upload"} · ${lot.match_method} · batch ${batch.$id}`,
        });
      }

      // Client mirror for immediate encyclopedia merge (by canonical_id + code)
      if (typeof window !== "undefined") {
        const key = `company_portfolio_updates_${companySlug}`;
        let existing: any[] = [];
        try {
          const raw = localStorage.getItem(key);
          existing = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(existing)) existing = [];
        } catch {
          existing = [];
        }

        for (const lot of lots) {
          const cid =
            lot.canonical_id ||
            (Math.abs(
              Array.from(lot.item_code).reduce(
                (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
                0,
              ),
            ) %
              900000) +
              100000;
          const entry = {
            canonical_id: cid,
            name_en: lot.item_desc,
            code: lot.item_code,
            manufacturer: companyName,
            current_price_egp: lot.list_price_egp ?? 0,
            company_slug: companySlug,
            match_method: lot.match_method,
            source: "manufacturer_stock_csv",
            batch_id: batch.$id,
            updated_at: new Date().toISOString(),
          };
          const idx = existing.findIndex(
            (x) =>
              Number(x.canonical_id) === cid ||
              (x.code && x.code === lot.item_code),
          );
          if (idx >= 0) existing[idx] = { ...existing[idx], ...entry };
          else existing.unshift(entry);

          if (lot.canonical_id) {
            localStorage.setItem(
              `medicine_update_${lot.canonical_id}`,
              JSON.stringify(entry),
            );
          }
        }
        localStorage.setItem(key, JSON.stringify(existing.slice(0, 5000)));
      }

      setStorageMode(stockStorageModeLabel());
      setMessage(
        t(
          `Published ${batch.row_count} rows for ${companyName}: ${batch.matched_count} linked to encyclopedia IDs, ${batch.unmatched_count} unmatched. Storage: ${stockStorageModeLabel()}.`,
          `تم نشر ${batch.row_count} صفًا لـ ${companyName}: ${batch.matched_count} مربوط بمعرّفات الموسوعة، ${batch.unmatched_count} غير مطابق. التخزين: ${stockStorageModeLabel()}.`,
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
            "Upload Eva Pharma–style or ERP stock exports. Rows are matched to encyclopedia canonical IDs by item code and trade name, then stored durably (Appwrite when available).",
            "ارفع تصدير مخزون بصيغة إيفا فارما أو ERP. تُطابق الصفوف بمعرّفات الموسوعة عبر كود الصنف واسم المنتج ثم تُحفظ بشكل دائم (Appwrite عند التوفر).",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Storage: <strong>{storageMode}</strong>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-500/40 bg-teal-50/40 px-6 py-10 text-center transition hover:bg-teal-50 dark:bg-teal-950/20">
          <Upload className="h-8 w-8 text-teal-700" />
          <span className="text-sm font-semibold">
            {indexing
              ? t("Indexing catalog…", "جاري فهرسة الموسوعة…")
              : fileName
                ? fileName
                : t("Choose CSV file", "اختر ملف CSV")}
          </span>
          <span className="text-xs text-muted-foreground">
            .csv · Item Code + Item Desc required · Old Price List supported
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={indexing || busy}
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
            <Stat label={t("Valid rows", "صفوف صالحة")} value={summary.validRows} />
            <Stat label={t("Unique SKUs", "أصناف فريدة")} value={summary.uniqueItemCodes} />
            <Stat label={t("With price", "بسعر")} value={summary.withPrice} />
            <Stat
              label={t("Near / expired", "قريب / منتهي")}
              value={`${summary.nearExpire} / ${summary.expired}`}
            />
          </div>
        )}

        {matchSummary && (
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-600 text-white">
              {t("Matched to encyclopedia", "مطابق للموسوعة")}: {" "}
              {matchSummary.matched}
            </Badge>
            <Badge variant="secondary">
              {t("Unmatched", "غير مطابق")}: {matchSummary.unmatched}
            </Badge>
            {Object.entries(matchSummary.byMethod).map(([method, n]) => (
              <Badge key={method} variant="outline" className="text-[10px]">
                {method}: {n}
              </Badge>
            ))}
          </div>
        )}

        {result && result.valid.length > 0 && matches && (
          <>
            <div className="max-h-56 overflow-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="p-2">Code</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Canonical</th>
                    <th className="p-2">Match</th>
                    <th className="p-2">Price</th>
                    <th className="p-2">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {result.valid.slice(0, 40).map((row: ManufacturerStockRow) => {
                    const m =
                      matches.get(`${row.item_code}||${row.item_desc}`) || null;
                    return (
                      <tr
                        key={`${row.row_index}-${row.item_code}`}
                        className="border-t"
                      >
                        <td className="p-2 font-mono">{row.item_code}</td>
                        <td className="p-2 max-w-[200px] truncate">
                          {row.item_desc}
                        </td>
                        <td className="p-2 font-mono">
                          {m?.canonical_id ?? "—"}
                        </td>
                        <td className="p-2">
                          <Badge
                            variant={m?.canonical_id ? "default" : "outline"}
                            className="text-[9px]"
                          >
                            {m?.match_method || "unmatched"}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {row.list_price_egp != null
                            ? row.list_price_egp
                            : "—"}
                        </td>
                        <td className="p-2">
                          {row.expiry_date
                            ? row.expiry_date.slice(0, 10)
                            : row.expiry_raw || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button
              onClick={() => void publishPortfolio()}
              disabled={busy || indexing}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold"
            >
              {busy
                ? t("Publishing…", "جاري النشر…")
                : t(
                    `Publish ${result.valid.length} products (${matchSummary?.matched || 0} encyclopedia links)`,
                    `نشر ${result.valid.length} منتجًا (${matchSummary?.matched || 0} ربط بالموسوعة)`,
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
