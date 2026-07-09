import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FlaskConical, RefreshCw, Search, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type EnrichmentResult = {
  medicine?: { id: number; name_en: string | null; name_ar: string | null };
  query?: string;
  source_url?: string;
  message?: string;
  inserted?: Record<string, unknown> | null;
  matches?: Array<Record<string, unknown>>;
};

type QueueRow = {
  id: string;
  medicine_id: number;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  medicine_family: string | null;
  medicine_genre: string | null;
  route: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_updated_at: string | null;
  source_name: string;
  source_url: string;
  source_type: string;
  confidence: string;
  notes: string | null;
  created_at: string;
};

type ImportQueueRow = {
  id: string;
  source_name: string;
  source_url: string | null;
  source_item_code: string | null;
  source_name_ar: string | null;
  source_name_en: string | null;
  source_barcode: string | null;
  source_price_amount: number | null;
  source_price_currency: string | null;
  match_status: string;
  review_notes: string | null;
  created_at: string;
};

type ImportQueueCoverageRow = {
  source_name: string;
  match_status: string;
  queue_records: number;
  records_with_price: number;
  records_with_barcode: number;
};

type CountRow = { confidence: string; count: number };
type Provider = "openfda" | "rxnorm";

function matchValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

export default function MedicineEnrichmentAdmin() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [medicineId, setMedicineId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [resultProvider, setResultProvider] = useState<Provider>("openfda");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [importQueue, setImportQueue] = useState<ImportQueueRow[]>([]);
  const [importCoverage, setImportCoverage] = useState<ImportQueueCoverageRow[]>([]);
  const [importMedicineIds, setImportMedicineIds] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [importActionId, setImportActionId] = useState<string | null>(null);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const map = new Map(counts.map(row => [row.confidence, Number(row.count)]));
    const pending = map.get("needs_review") ?? 0;
    const verified = map.get("verified") ?? 0;
    const rejected = map.get("rejected") ?? 0;
    return { pending, verified, rejected, total: pending + verified + rejected };
  }, [counts]);

  const importStats = useMemo(() => importCoverage.reduce((acc, row) => ({
    records: acc.records + Number(row.queue_records || 0),
    prices: acc.prices + Number(row.records_with_price || 0),
    barcodes: acc.barcodes + Number(row.records_with_barcode || 0),
  }), { records: 0, prices: 0, barcodes: 0 }), [importCoverage]);

  async function loadCounts() {
    const rows = await supabaseFetch<CountRow[]>("/rest/v1/medicine_enrichment_status_counts?select=confidence,count");
    setCounts(rows);
  }

  async function loadImportQueue() {
    const coverage = await supabaseFetch<ImportQueueCoverageRow[]>("/rest/v1/medicine_enrichment_import_queue_coverage?select=source_name,match_status,queue_records,records_with_price,records_with_barcode&order=queue_records.desc");
    setImportCoverage(coverage);
    const select = "id,source_name,source_url,source_item_code,source_name_ar,source_name_en,source_barcode,source_price_amount,source_price_currency,match_status,review_notes,created_at";
    const rows = await supabaseFetch<ImportQueueRow[]>(`/rest/v1/medicine_enrichment_import_queue?select=${select}&match_status=eq.unmatched&order=created_at.desc&limit=30`);
    setImportQueue(rows);
  }

  async function loadQueue() {
    setQueueLoading(true);
    try {
      await loadCounts();
      await loadImportQueue();
      const select = "id,medicine_id,manufacturer,active_ingredient,atc_code,barcode,medicine_family,medicine_genre,route,price_amount,price_currency,price_updated_at,source_name,source_url,source_type,confidence,notes,created_at";
      const rows = await supabaseFetch<QueueRow[]>(`/rest/v1/medicine_enrichments?select=${select}&confidence=eq.needs_review&order=created_at.desc&limit=50`);
      setQueue(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load review queue.", "تعذر تحميل قائمة المراجعة."));
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => { if (session?.access_token) void loadQueue(); }, [session?.access_token]);

  async function enrich(provider: Provider) {
    setLoadingProvider(provider);
    setError(null);
    setMessage(null);
    setResult(null);
    setResultProvider(provider);
    try {
      const id = Number(medicineId);
      if (!Number.isFinite(id)) throw new Error(t("Enter a valid medicine ID.", "أدخل رقم دواء صحيح."));
      const endpoint = provider === "rxnorm" ? "/functions/v1/medicine-rxnorm-enrich" : "/functions/v1/medicine-openfda-enrich";
      const data = await supabaseFetch<EnrichmentResult>(endpoint, {
        method: "POST",
        body: JSON.stringify({ medicine_id: id, query: query.trim() || undefined }),
      });
      setResult(data);
      setMessage(provider === "rxnorm" ? t("RxNorm enrichment search completed.", "تم إكمال بحث إثراء RxNorm.") : t("openFDA enrichment search completed.", "تم إكمال بحث إثراء openFDA."));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not run enrichment.", "تعذر تشغيل الإثراء."));
    } finally {
      setLoadingProvider(null);
    }
  }

  async function review(row: QueueRow, confidence: "verified" | "rejected") {
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/medicine_enrichments?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ confidence, reviewed_at: new Date().toISOString() }),
      });
      setMessage(confidence === "verified" ? t("Enrichment verified and now eligible for public display.", "تم توثيق الإثراء وأصبح مؤهلًا للظهور العام.") : t("Enrichment rejected.", "تم رفض الإثراء."));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update review status.", "تعذر تحديث حالة المراجعة."));
    }
  }

  function updateImportMedicineId(rowId: string, value: string) {
    setImportMedicineIds(current => ({ ...current, [rowId]: value }));
  }

  async function acceptImportRow(row: ImportQueueRow) {
    setError(null);
    setMessage(null);
    setImportActionId(row.id);
    try {
      const targetMedicineId = Number(importMedicineIds[row.id]);
      if (!Number.isFinite(targetMedicineId)) throw new Error(t("Enter the correct medicine ID before accepting.", "أدخل رقم الدواء الصحيح قبل القبول."));
      await supabaseFetch("/rest/v1/rpc/accept_medicine_import_queue_row", {
        method: "POST",
        body: JSON.stringify({ p_queue_id: row.id, p_medicine_id: targetMedicineId }),
      });
      setMessage(t("CSV row accepted and published as verified medicine enrichment.", "تم قبول صف CSV ونشره كإثراء دواء موثق."));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not accept import row.", "تعذر قبول صف الاستيراد."));
    } finally {
      setImportActionId(null);
    }
  }

  async function rejectImportRow(row: ImportQueueRow) {
    setError(null);
    setMessage(null);
    setImportActionId(row.id);
    try {
      await supabaseFetch("/rest/v1/rpc/reject_medicine_import_queue_row", {
        method: "POST",
        body: JSON.stringify({ p_queue_id: row.id, p_reason: "Rejected from medicine enrichment admin." }),
      });
      setMessage(t("CSV row rejected.", "تم رفض صف CSV."));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not reject import row.", "تعذر رفض صف الاستيراد."));
    } finally {
      setImportActionId(null);
    }
  }

  async function bulkAcceptExactMatches() {
    setError(null);
    setMessage(null);
    setBulkAccepting(true);
    try {
      const inserted = await supabaseFetch<number>("/rest/v1/rpc/bulk_accept_medicine_import_queue_exact_matches", { method: "POST", body: JSON.stringify({}) });
      setMessage(t(`Bulk accepted ${inserted || 0} exact CSV matches.`, `تم قبول ${inserted || 0} تطابقات CSV دقيقة دفعة واحدة.`));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not bulk accept exact CSV matches.", "تعذر قبول تطابقات CSV الدقيقة دفعة واحدة."));
    } finally {
      setBulkAccepting(false);
    }
  }

  if (!session?.access_token) return <main className="container mx-auto max-w-3xl px-4 py-8"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{t("Please sign in first from the staff portal.", "برجاء تسجيل الدخول أولًا من بوابة الفريق.")}</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-4 w-4" />{t("Medicine enrichment", "إثراء بيانات الأدوية")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Reliable API and verified CSV enrichment review", "مراجعة الإثراء من APIs وملف CSV موثق")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Search trusted public APIs, review imported datasets, and publish only verified medicine data to the public encyclopedia.", "ابحث في APIs عامة موثوقة وراجع ملفات البيانات المستوردة، ولا تنشر للعامة إلا بيانات الأدوية الموثقة.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label={t("Total enrichments", "إجمالي الإثراءات")} value={stats.total} />
      <Metric label={t("Pending review", "قيد المراجعة")} value={stats.pending} />
      <Metric label={t("Verified", "موثق")} value={stats.verified} />
      <Metric label={t("Rejected", "مرفوض")} value={stats.rejected} />
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Metric label={t("Unmatched import rows", "صفوف استيراد غير مطابقة")} value={importStats.records} />
      <Metric label={t("Unmatched with price", "غير مطابق وبها سعر")} value={importStats.prices} />
      <Metric label={t("Unmatched with barcode", "غير مطابق وبها باركود")} value={importStats.barcodes} />
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto]">
        <Input value={medicineId} onChange={event => setMedicineId(event.target.value)} placeholder={t("Medicine ID", "رقم الدواء")} />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Optional search override", "كلمة بحث اختيارية")} />
        <Button onClick={() => void enrich("openfda")} disabled={Boolean(loadingProvider)}><Search className="mr-2 h-4 w-4" />{loadingProvider === "openfda" ? t("Searching...", "جاري البحث...") : "openFDA"}</Button>
        <Button variant="outline" onClick={() => void enrich("rxnorm")} disabled={Boolean(loadingProvider)}><Search className="mr-2 h-4 w-4" />{loadingProvider === "rxnorm" ? t("Searching...", "جاري البحث...") : "RxNorm"}</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("openFDA is useful for label/manufacturer/NDC data. RxNorm is useful for normalized ingredients and drug concepts. The CSV was verified by you; exact matches can publish, while ambiguous rows need a medicine ID before accepting.", "openFDA مفيد لبيانات النشرة والشركة وNDC. وRxNorm مفيد لتوحيد المادة الفعالة ومفاهيم الأدوية. ملف CSV موثق منك؛ التطابقات الدقيقة يمكن نشرها، أما الصفوف الغامضة فتحتاج رقم الدواء قبل القبول.")}</p>
      {message && <Alert className="mt-4"><AlertDescription>{message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    {result && <section className="mt-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>{t("Result summary", "ملخص النتيجة")} · {resultProvider === "rxnorm" ? "RxNorm" : "openFDA"}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">{t("Medicine", "الدواء")}: </span>{result.medicine?.name_en || result.medicine?.name_ar || result.medicine?.id || "—"}</div>
          {result.medicine?.id && <a href={`/medicines/${result.medicine.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open medicine page", "فتح صفحة الدواء")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
          <div><span className="text-muted-foreground">{t("Query", "كلمة البحث")}: </span>{result.query || "—"}</div>
          {result.source_url && <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Source request", "طلب المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
          {result.message && <Alert><AlertDescription>{result.message}</AlertDescription></Alert>}
          {result.inserted && <Badge variant="secondary">{t("Saved as needs review", "تم الحفظ كإثراء يحتاج مراجعة")}</Badge>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(result.matches || []).map((match, index) => <Card key={String(match.id || match.rxcui || index)}>
          <CardHeader><CardTitle className="text-base">{t("API match", "نتيجة API")} #{index + 1}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(match).slice(0, 10).map(([key, value]) => <Info key={key} label={key} value={matchValue(value)} />)}
          </CardContent>
        </Card>)}
      </div>
    </section>}

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("Verified CSV import queue", "قائمة استيراد CSV الموثق")}</h2>
          <p className="text-sm text-muted-foreground">{t("Exact CSV matches can be bulk accepted. Ambiguous rows need the correct medicine ID before publishing.", "تطابقات CSV الدقيقة يمكن قبولها دفعة واحدة. الصفوف الغامضة تحتاج رقم الدواء الصحيح قبل النشر.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void bulkAcceptExactMatches()} disabled={bulkAccepting || queueLoading}><CheckCircle2 className="mr-2 h-4 w-4" />{bulkAccepting ? t("Publishing...", "جاري النشر...") : t("Bulk accept exact matches", "قبول التطابقات الدقيقة")}</Button>
          <Button variant="outline" onClick={() => void loadQueue()} disabled={queueLoading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh", "تحديث")}</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {importQueue.map(row => <Card key={row.id}>
          <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-base"><span>{row.source_name_en || row.source_name_ar || row.source_item_code}</span><Badge variant="outline">{row.match_status}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label={t("Arabic item", "اسم الصنف عربي")} value={row.source_name_ar || ""} />
            <Info label={t("English item", "اسم الصنف إنجليزي")} value={row.source_name_en || ""} />
            <Info label={t("Barcode", "الباركود")} value={row.source_barcode || ""} />
            <Info label={t("Price", "السعر")} value={row.source_price_amount ? `${row.source_price_amount} ${row.source_price_currency || "EGP"}` : ""} />
            <Info label={t("Item code", "كود الصنف")} value={row.source_item_code || ""} />
            {row.source_url && <a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source page", "فتح صفحة المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
            {row.review_notes && <p className="text-xs text-muted-foreground">{row.review_notes}</p>}
            <div className="grid gap-2 pt-2 md:grid-cols-[1fr_auto_auto]">
              <Input value={importMedicineIds[row.id] || ""} onChange={event => updateImportMedicineId(row.id, event.target.value)} placeholder={t("Correct medicine ID", "رقم الدواء الصحيح")} />
              <Button size="sm" onClick={() => void acceptImportRow(row)} disabled={importActionId === row.id}><CheckCircle2 className="mr-2 h-4 w-4" />{t("Accept", "قبول")}</Button>
              <Button size="sm" variant="outline" onClick={() => void rejectImportRow(row)} disabled={importActionId === row.id}><XCircle className="mr-2 h-4 w-4" />{t("Reject", "رفض")}</Button>
            </div>
          </CardContent>
        </Card>)}
        {!queueLoading && importQueue.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No unmatched import rows.", "لا توجد صفوف استيراد غير مطابقة.")}</CardContent></Card>}
      </div>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("Review queue", "قائمة المراجعة")}</h2>
          <p className="text-sm text-muted-foreground">{t("Only verified enrichments appear on public medicine pages.", "لا تظهر للعامة إلا بيانات الإثراء الموثقة.")}</p>
        </div>
        <Button variant="outline" onClick={() => void loadQueue()} disabled={queueLoading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh queue", "تحديث القائمة")}</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {queue.map(row => <Card key={row.id}>
          <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-base"><span>{t("Medicine ID", "رقم الدواء")} #{row.medicine_id}</span><Badge variant="secondary">{row.confidence}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <a href={`/medicines/${row.medicine_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open medicine page", "فتح صفحة الدواء")}<ExternalLink className="ml-2 h-4 w-4" /></a>
            <Info label={t("Manufacturer", "الشركة المصنعة")} value={row.manufacturer || ""} />
            <Info label={t("Active ingredient", "المادة الفعالة")} value={row.active_ingredient || ""} />
            <Info label={t("Medicine family", "العائلة الدوائية")} value={row.medicine_family || ""} />
            <Info label={t("Genre / class", "النوع / التصنيف")} value={row.medicine_genre || ""} />
            <Info label={t("Route", "طريقة الاستخدام")} value={row.route || ""} />
            <Info label="ATC" value={row.atc_code || ""} />
            <Info label={t("Barcode / NDC", "الباركود / NDC")} value={row.barcode || ""} />
            <Info label={t("Latest price", "آخر سعر")} value={row.price_amount ? `${row.price_amount} ${row.price_currency || ""}` : ""} />
            <a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{row.source_name}<ExternalLink className="ml-2 h-4 w-4" /></a>
            {row.notes && <p className="text-xs text-muted-foreground">{row.notes}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => void review(row, "verified")}><CheckCircle2 className="mr-2 h-4 w-4" />{t("Verify", "توثيق")}</Button>
              <Button size="sm" variant="outline" onClick={() => void review(row, "rejected")}><XCircle className="mr-2 h-4 w-4" />{t("Reject", "رفض")}</Button>
            </div>
          </CardContent>
        </Card>)}
        {!queueLoading && queue.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No pending enrichments.", "لا توجد بيانات إثراء قيد المراجعة.")}</CardContent></Card>}
      </div>
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
