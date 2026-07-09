import { useState } from "react";
import { AlertCircle, ExternalLink, FlaskConical, Search } from "lucide-react";
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

export default function MedicineEnrichmentAdmin() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [medicineId, setMedicineId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enrich() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const id = Number(medicineId);
      if (!Number.isFinite(id)) throw new Error(t("Enter a valid medicine ID.", "أدخل رقم دواء صحيح."));
      const data = await supabaseFetch<EnrichmentResult>("/functions/v1/medicine-openfda-enrich", {
        method: "POST",
        body: JSON.stringify({ medicine_id: id, query: query.trim() || undefined }),
      });
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not run enrichment.", "تعذر تشغيل الإثراء."));
    } finally {
      setLoading(false);
    }
  }

  if (!session?.access_token) return <main className="container mx-auto max-w-3xl px-4 py-8"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{t("Please sign in first from the staff portal.", "برجاء تسجيل الدخول أولًا من بوابة الفريق.")}</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><FlaskConical className="h-4 w-4" />{t("Medicine enrichment", "إثراء بيانات الأدوية")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("openFDA enrichment review", "مراجعة إثراء openFDA")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Search openFDA for a medicine, save the result as needs-review enrichment, then verify it before it appears publicly on medicine pages.", "ابحث في openFDA عن دواء واحفظ النتيجة كإثراء يحتاج مراجعة، ثم وثّقها قبل ظهورها للعامة في صفحات الأدوية.")}</p>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
        <Input value={medicineId} onChange={event => setMedicineId(event.target.value)} placeholder={t("Medicine ID", "رقم الدواء")} />
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Optional search override", "كلمة بحث اختيارية")} />
        <Button onClick={() => void enrich()} disabled={loading}><Search className="mr-2 h-4 w-4" />{loading ? t("Searching...", "جاري البحث...") : t("Run openFDA", "تشغيل openFDA")}</Button>
      </div>
      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    {result && <section className="mt-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>{t("Result summary", "ملخص النتيجة")}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">{t("Medicine", "الدواء")}: </span>{result.medicine?.name_en || result.medicine?.name_ar || result.medicine?.id || "—"}</div>
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
  </main>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value || "—"}</div></div>;
}
