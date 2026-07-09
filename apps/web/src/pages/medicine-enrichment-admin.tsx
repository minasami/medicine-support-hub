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
  matches?: Array<{
    id?: string;
    brand_name: string[];
    generic_name: string[];
    manufacturer_name: string[];
    substance_name: string[];
    product_ndc: string[];
    package_ndc: string[];
    route: string[];
  }>;
};

type QueueRow = {
  id: string;
  medicine_id: number;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  source_name: string;
  source_url: string;
  source_type: string;
  confidence: string;
  notes: string | null;
  created_at: string;
};

type CountRow = { confidence: string; count: number };

export default function MedicineEnrichmentAdmin() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [medicineId, setMedicineId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const map = new Map(counts.map(row => [row.confidence, Number(row.count)]));
    const pending = map.get("needs_review") ?? 0;
    const verified = map.get("verified") ?? 0;
    const rejected = map.get("rejected") ?? 0;
    return { pending, verified, rejected, total: pending + verified + rejected };
  }, [counts]);

  async function loadCounts() {
    const rows = await supabaseFetch<CountRow[]>("/rest/v1/medicine_enrichment_status_counts?select=confidence,count");
    setCounts(rows);
  }

  async function loadQueue() {
    setQueueLoading(true);
    try {
      await loadCounts();
      const rows = await supabaseFetch<QueueRow[]>("/rest/v1/medicine_enrichments?select=id,medicine_id,manufacturer,active_ingredient,atc_code,barcode,source_name,source_url,source_type,confidence,notes,created_at&confidence=eq.needs_review&order=created_at.desc&limit=50");
      setQueue(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load review queue.", "تعذر تحميل قائمة المراجعة."));
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => { if (session?.access_token) void loadQueue(); }, [session?.access_token]);

  async function enrich() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);
    try {
      const id = Number(medicineId);
      if (!Number.isFinite(id)) throw new Error(t("Enter a valid medicine ID.", "أدخل رقم دواء صحيح."));
      const data = await supabaseFetch<EnrichmentResult>("/functions/v1/medicine-openfda-enrich", {
        method: "POST",
        body: JSON.stringify({ medicine_id: id, query: query.trim() || undefined }),
      });
      setResult(data);
      setMessage(t("Enrichment search completed.", "تم إكمال بحث الإثراء."));
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not run enrichment.", "تعذر تشغيل الإثراء."));
    } finally {
      setLoading(false);
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

  if (!session?.access_token) return <main className="container mx-auto max-w-3xl px-4 py-8"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{t("Please sign in first from the staff portal.", "برجاء تسجيل الدخول أولًا من بوابة الفريق.")}</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-4 w-4" />{t("Medicine enrichment", "إثراء بيانات الأدوية")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("openFDA enrichment review", "مراجعة إثراء openFDA")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Search openFDA for a medicine, save the result as needs-review enrichment, then verify it before it appears publicly on medicine pages.", "ابحث في openFDA عن دواء واحفظ النتيجة كإثراء يحتاج مراجعة، ثم وثّقها قبل ظهورها للعامة في صفحات الأدوية.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label={t("Total enrichments", "إجمالي الإثراءات")} value={stats.total} />
      <Metric label={t("Pending review", "قيد المراجعة")} value={stats.pending} />
      <Metric label={t("Verified", "موثق")} value={stats.verified} />
      <Metric label={t("Rejected", "مرفوض")} value={stats.rejected} />
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <Input value={medicineId} onChange={event => setMedicineId(event.target.value)} placeholder={t("Medicine ID", "رقم الدواء")} />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Optional search override", "كلمة بحث اختيارية")} />
        <Button onClick={() => void enrich()} disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? t("Searching...", "جاري البحث...") : t("Run openFDA", "تشغيل openFDA")}</Button>
      </div>
      {message && <Alert className="mt-4"><AlertDescription>{message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    {result && <section className="mt-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>{t("Result summary", "ملخص النتيجة")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">{t("Medicine", "الدواء")}: </span>{result.medicine?.name_en || result.medicine?.name_ar || result.medicine?.id || "—"}</div>
          {result.medicine?.id && <a href={`/medicines/${result.medicine.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open medicine page", "فتح صفحة الدواء")}<ExternalLink className="ml-2 h-4 w-4" /></a>}
          <div><span className="text-muted-foreground">{t("Query", "كلمة البحث")}: </span>{result.query || "—"}</div>
          {result.source_url && <a href={result.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">openFDA source request<ExternalLink className="ml-2 h-4 w-4" /></a>}
          {result.message && <Alert><AlertDescription>{result.message}</AlertDescription></Alert>}
          {result.inserted && <Badge variant="secondary">{t("Saved as needs review", "تم الحفظ كإثراء يحتاج مراجعة")}</Badge>}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(result.matches || []).map((match, index) => <Card key={match.id || index}>
          <CardHeader><CardTitle className="text-base">{t("openFDA match", "نتيجة openFDA")} #{index + 1}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Brand" value={match.brand_name.join(", ")} />
            <Info label="Generic" value={match.generic_name.join(", ")} />
            <Info label="Manufacturer" value={match.manufacturer_name.join(", ")} />
            <Info label="Substance" value={match.substance_name.join(", ")} />
            <Info label="Product NDC" value={match.product_ndc.join(", ")} />
            <Info label="Package NDC" value={match.package_ndc.join(", ")} />
            <Info label="Route" value={match.route.join(", ")} />
          </CardContent>
        </Card>)}
      </div>
    </section>}

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
            <Info label="ATC" value={row.atc_code || ""} />
            <Info label={t("Barcode / NDC", "الباركود / NDC")} value={row.barcode || ""} />
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
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value || "—"}</div></div>;
}
