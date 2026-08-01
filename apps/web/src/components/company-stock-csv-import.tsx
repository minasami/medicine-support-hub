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
  MAX_CSV_BYTES,
  MAX_IMPORT_ROWS,
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
  const [warning, setWarning] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState(stockStorageModeLabel());
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    label: string;
  } | null>(null);

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
    setWarning(null);
    setMessage(null);
    setProgress(null);
    setFileName(file.name);
    setIndexing(true);

    try {
      if (file.size > MAX_CSV_BYTES) {
        throw new Error(
          t(
            `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${(MAX_CSV_BYTES / 1024 / 1024).toFixed(0)} MB. Split the export or remove unused columns.`,
            `الملف كبير جدًا (${(file.size / 1024 / 1024).toFixed(1)} ميجابايت). الحد الأقصى ${(MAX_CSV_BYTES / 1024 / 1024).toFixed(0)} ميجابايت.`,
          ),
        );
      }

      if (
        !file.name.toLowerCase().endsWith(".csv") &&
        file.type &&
        !file.type.includes("csv") &&
        !file.type.includes("text")
      ) {
        setWarning(
          t(
            "File does not look like a CSV. Parsing will still be attempted.",
            "الملف لا يبدو كملف CSV. سيتم محاولة التحليل على أي حال.",
          ),
        );
      }

      const text = await file.text();
      if (!text || text.trim().length < 10) {
        throw new Error(
          t("File is empty or unreadable.", "الملف فارغ أو غير قابل للقراءة."),
        );
      }

      const parsed = parseManufacturerStockCsv(text, {
        mode: "portfolio",
        defaultOrgCode: defaultOrgCode || companySlug.toUpperCase().slice(0, 8),
      });

      if (parsed.rows.length > MAX_IMPORT_ROWS) {
        setWarning(
          t(
            `CSV has ${parsed.rows.length.toLocaleString()} rows. Only the first ${MAX_IMPORT_ROWS.toLocaleString()} valid rows can be published in one batch — consider splitting the file.`,
            `يحتوي CSV على ${parsed.rows.length.toLocaleString()} صفًا. يمكن نشر أول ${MAX_IMPORT_ROWS.toLocaleString()} صف صالح فقط دفعة واحدة.`,
          ),
        );
      }

      if (parsed.valid.length > MAX_IMPORT_ROWS) {
        parsed.valid = parsed.valid.slice(0, MAX_IMPORT_ROWS);
      }

      setResult(parsed);

      setProgress({
        done: 0,
        total: 1,
        label: t("Building encyclopedia index…", "بناء فهرس الموسوعة…"),
      });
      await ensureSkuCatalogIndex({
        databases: getStockDatabases(),
        databaseId: getStockDatabaseId(),
        medicinesCollectionId:
          import.meta.env.VITE_APPWRITE_MEDICINES_COLLECTION_ID || "medicines",
        manufacturerHint: companyName || companySlug,
        forceReload: true,
      });

      setProgress({
        done: 0,
        total: parsed.valid.length,
        label: t("Matching SKUs…", "مطابقة الأكواد…"),
      });
      const m = matchManySkus(
        parsed.valid.map((r) => ({
          item_code: r.item_code,
          item_desc: r.item_desc,
        })),
      );
      setMatches(m);
      setStorageMode(stockStorageModeLabel());
      setProgress(null);

      if (parsed.valid.length === 0) {
        const first = parsed.errors[0]?.error;
        setError(
          t(
            `No valid product rows found. Check Item Code and Item Desc columns.${first ? ` First error: ${first}` : ""}`,
            `لم يتم العثور على صفوف منتجات صالحة.${first ? ` أول خطأ: ${first}` : ""}`,
          ),
        );
      } else if (parsed.warnings?.length) {
        setWarning(parsed.warnings.join(" · "));
      }
    } catch (e: any) {
      setResult(null);
      setMatches(null);
      setError(e?.message || "Failed to parse file");
    } finally {
      setIndexing(false);
      setProgress(null);
    }
  }

  async function publishPortfolio() {
    if (!result?.valid.length || !matches) return;
    setBusy(true);
    setError(null);
    setWarning(null);
    setMessage(null);
    try {
      const { batch, lots, writeErrors, sampleErrors } =
        await persistManufacturerStockImport({
          companySlug,
          companyName,
          filename: fileName || undefined,
          createdBy: session?.user?.id,
          rows: result.valid,
          matches,
          onProgress: (p) => {
            setProgress({
              done: p.done,
              total: p.total,
              label: p.message || p.phase,
            });
          },
        });

      const provenanced = lots.filter((l) => l.canonical_id).slice(0, 2000);
      for (const lot of provenanced) {
        try {
          recordCompanyProductProvenance({
            canonicalId: lot.canonical_id!,
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
        } catch {
          /* provenance best-effort */
        }
      }

      if (typeof window !== "undefined") {
        try {
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
              try {
                localStorage.setItem(
                  `medicine_update_${lot.canonical_id}`,
                  JSON.stringify(entry),
                );
              } catch {
                /* skip */
              }
            }
          }
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 5000)));
        } catch (e: any) {
          setWarning(
            e?.message ||
              t(
                "Published to server, but local encyclopedia mirror hit storage limits.",
                "تم النشر على الخادم، لكن المرآة المحلية للموسوعة وصلت لحد التخزين.",
              ),
          );
        }
      }

      setStorageMode(stockStorageModeLabel());
      let errNote = "";
      if (writeErrors > 0) {
        errNote = t(
          ` ${writeErrors} lot(s) failed to write and were skipped.`,
          ` فشل كتابة ${writeErrors} لوط وتم تخطيها.`,
        );
        if (sampleErrors?.length) {
          errNote += ` Sample: ${sampleErrors[0].slice(0, 160)}`;
        }
      }
      setMessage(
        t(
          `Published ${lots.length} of ${batch.row_count} rows for ${companyName}: ${batch.matched_count} encyclopedia links, ${batch.unmatched_count} unmatched. Storage: ${stockStorageModeLabel()}.${errNote}`,
          `تم نشر ${lots.length} من ${batch.row_count} صفًا لـ ${companyName}: ${batch.matched_count} ربط بالموسوعة، ${batch.unmatched_count} غير مطابق. التخزين: ${stockStorageModeLabel()}.${errNote}`,
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Import failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

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
            "Upload Eva Pharma–style or ERP stock exports. Rows are matched (exact + fuzzy) to encyclopedia IDs and written in parallel to Appwrite when available.",
            "ارفع تصدير مخزون بصيغة إيفا فارما أو ERP. تُطابق الصفوف (دقيق + تقريبي) بمعرّفات الموسوعة وتُكتب بالتوازي إلى Appwrite عند التوفر.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Storage: <strong>{storageMode}</strong>
          {" · "}
          Max {(MAX_CSV_BYTES / 1024 / 1024).toFixed(0)} MB /{" "}
          {MAX_IMPORT_ROWS.toLocaleString()} rows per batch
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-teal-500/40 bg-teal-50/40 px-6 py-10 text-center transition hover:bg-teal-50 dark:bg-teal-950/20">
          <Upload className="h-8 w-8 text-teal-700" />
          <span className="text-sm font-semibold">
            {indexing
              ? t("Parsing & matching…", "جاري التحليل والمطابقة…")
              : fileName
                ? fileName
                : t("Choose CSV file", "اختر ملف CSV")}
          </span>
          <span className="text-xs text-muted-foreground">
            .csv · Item Code + Item Desc required · Old Price List supported
          </span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            disabled={indexing || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.label}</span>
              <span>
                {progress.done}/{progress.total} ({progressPct}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-teal-600 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {warning && (
          <Alert className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <AlertDescription>{warning}</AlertDescription>
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
            <Stat
              label={t("Unique SKUs", "أصناف فريدة")}
              value={summary.uniqueItemCodes}
            />
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
              {t("Matched", "مطابق")}: {matchSummary.matched}
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
                            {m?.confidence
                              ? ` ${(m.confidence * 100).toFixed(0)}%`
                              : ""}
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
