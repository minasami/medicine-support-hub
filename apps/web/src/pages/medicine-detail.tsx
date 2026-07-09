import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, ArrowLeft, BookOpen, ExternalLink, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { displayKnownOrPlanned, displayStrength, sourceLabel, type MedicineDisplayField } from "@/lib/medicine-display";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Medicine = {
  id: number;
  name_en: string | null;
  name_ar: string | null;
  dosage_form: string | null;
  strength: string | null;
  category: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
};

type Enrichment = {
  id: string;
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
  updated_at: string;
};

function encoded(value: string) {
  return encodeURIComponent(value);
}

function sourced(value: string | null | undefined): MedicineDisplayField | null {
  const text = String(value ?? "").trim();
  return text ? { value: text, source: "provided" } : null;
}

export default function MedicineDetail() {
  const [, params] = useRoute("/medicines/:id");
  const id = params?.id;
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [related, setRelated] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const select = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode";
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines?select=${select}&id=eq.${encodeURIComponent(id)}&is_active=eq.true&limit=1`);
      const found = rows[0] ?? null;
      setMedicine(found);
      if (found) {
        const enrichmentSelect = "id,manufacturer,active_ingredient,atc_code,barcode,medicine_family,medicine_genre,route,price_amount,price_currency,price_updated_at,source_name,source_url,source_type,confidence,updated_at";
        const enrichments = await supabaseFetch<Enrichment[]>(`/rest/v1/medicine_enrichments?select=${enrichmentSelect}&medicine_id=eq.${encodeURIComponent(id)}&confidence=eq.verified&order=updated_at.desc&limit=1`);
        setEnrichment(enrichments[0] ?? null);
      } else {
        setEnrichment(null);
      }
      const relatedIngredient = found?.active_ingredient;
      if (relatedIngredient) {
        const rel = await supabaseFetch<Medicine[]>(`/rest/v1/medicines?select=${select}&is_active=eq.true&active_ingredient=eq.${encoded(relatedIngredient)}&id=neq.${encodeURIComponent(id)}&order=name_en.asc&limit=12`);
        setRelated(rel);
      } else {
        setRelated([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load medicine.", "تعذر تحميل الدواء."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  const title = medicine ? (language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.id}`)) : t("Medicine details", "تفاصيل الدواء");
  const subtitle = medicine ? (language === "ar" ? medicine.name_en : medicine.name_ar) : null;
  const strength = medicine ? displayStrength(medicine.strength, medicine.name_en, medicine.name_ar) : null;
  const manufacturer = medicine ? (sourced(enrichment?.manufacturer) ?? displayKnownOrPlanned(medicine.manufacturer)) : null;
  const barcode = medicine ? (sourced(enrichment?.barcode) ?? displayKnownOrPlanned(medicine.barcode)) : null;
  const activeIngredient = medicine ? (sourced(enrichment?.active_ingredient) ?? displayKnownOrPlanned(medicine.active_ingredient)) : null;
  const atc = medicine ? (sourced(enrichment?.atc_code) ?? displayKnownOrPlanned(medicine.atc_code)) : null;
  const family = enrichment?.medicine_family;
  const genre = enrichment?.medicine_genre;
  const route = enrichment?.route;
  const price = enrichment?.price_amount ? `${enrichment.price_amount} ${enrichment.price_currency || ""}`.trim() : null;

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <a href="/medicines" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to encyclopedia", "العودة إلى الموسوعة")}</a>
      <Button asChild variant="outline"><a href="/medicines"><Search className="mr-2 h-4 w-4" />{t("Search medicines", "بحث في الأدوية")}</a></Button>
    </div>

    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="text-muted-foreground">{t("Loading medicine details...", "جاري تحميل تفاصيل الدواء...")}</p>}

    {!loading && !medicine && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("Medicine not found.", "لم يتم العثور على الدواء.")}</CardContent></Card>}

    {medicine && strength && manufacturer && barcode && activeIngredient && atc && <>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><BookOpen className="h-4 w-4" />{t("Medicine encyclopedia", "موسوعة الأدوية")}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {medicine.dosage_form && <Badge variant="outline">{medicine.dosage_form}</Badge>}
          <FieldBadge field={strength} language={language} />
          {medicine.category && <Badge>{medicine.category}</Badge>}
          {family && <Badge variant="outline">{family}</Badge>}
          {genre && <Badge variant="outline">{genre}</Badge>}
          {enrichment && <Badge variant="secondary">{t("Source-backed", "مدعوم بمصدر")}</Badge>}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Info title={t("Active ingredient", "المادة الفعالة")} field={activeIngredient} language={language} />
        <Info title={t("Manufacturer", "الشركة المصنعة")} field={manufacturer} language={language} />
        <Info title={t("Medicine family", "العائلة الدوائية")} value={family} />
        <Info title={t("Genre / class", "النوع / التصنيف")} value={genre} />
        <Info title={t("Route", "طريقة الاستخدام")} value={route} />
        <Info title={t("Latest price", "آخر سعر")} value={price} />
        <Info title={t("Dosage form", "الشكل الدوائي")} value={medicine.dosage_form} />
        <Info title={t("Strength", "التركيز")} field={strength} language={language} />
        <Info title={t("Category", "التصنيف")} value={medicine.category} />
        <Info title="ATC" field={atc} language={language} />
        <Info title={t("Barcode", "الباركود")} field={barcode} language={language} />
      </section>

      {enrichment && <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">{t("Verified external source", "مصدر خارجي موثق")}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <a href={enrichment.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{enrichment.source_name}<ExternalLink className="ml-2 h-4 w-4" /></a>
          <div className="mt-2">{t("Source type", "نوع المصدر")}: {enrichment.source_type}</div>
          {enrichment.price_updated_at && <div className="mt-2">{t("Price updated", "تحديث السعر")}: {new Date(enrichment.price_updated_at).toLocaleDateString()}</div>}
        </CardContent>
      </Card>}

      <Alert className="mt-6">
        <AlertDescription>{t("Missing display values are only filled when safely inferred from the existing medicine name and are clearly marked. Manufacturer, barcode, active ingredient, ATC, family, class, route, and price are not guessed when absent; they appear only when already present or verified from a stored source. This page is for medicine discovery and operational reference only. It does not replace advice from a licensed physician or pharmacist.", "يتم ملء القيم الناقصة فقط عندما يمكن استنتاجها بأمان من اسم الدواء وتظهر بعلامة واضحة. لا يتم تخمين الشركة المصنعة أو الباركود أو المادة الفعالة أو كود ATC أو العائلة أو التصنيف أو طريقة الاستخدام أو السعر عند غيابها؛ ولا تظهر إلا إذا كانت موجودة بالفعل أو موثقة من مصدر محفوظ. هذه الصفحة للاكتشاف والمرجعية التشغيلية فقط، ولا تغني عن استشارة طبيب أو صيدلي مرخص.")}</AlertDescription>
      </Alert>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">{t("Related medicines", "أدوية مرتبطة")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Shown when other records share the same active ingredient.", "تظهر عند وجود أدوية أخرى لها نفس المادة الفعالة.")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {related.map(item => {
            const relStrength = displayStrength(item.strength, item.name_en, item.name_ar);
            return <a key={item.id} href={`/medicines/${item.id}`} className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-muted">
              <div className="font-semibold">{language === "ar" ? (item.name_ar || item.name_en) : (item.name_en || item.name_ar)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{relStrength.value || item.dosage_form || item.manufacturer || "—"}</div>
            </a>;
          })}
          {!related.length && <Card><CardContent className="p-4 text-sm text-muted-foreground">{t("No related medicines found yet.", "لا توجد أدوية مرتبطة حاليًا.")}</CardContent></Card>}
        </div>
      </section>
    </>}
  </main>;
}

function FieldBadge({ field, language }: { field: MedicineDisplayField; language: "en" | "ar" }) {
  const label = sourceLabel(field.source, language);
  return <Badge variant={field.source === "provided" ? "outline" : "secondary"}>{field.value}{label ? ` · ${label}` : ""}</Badge>;
}

function Info({ title, value, field, language = "en" }: { title: string; value?: unknown; field?: MedicineDisplayField; language?: "en" | "ar" }) {
  const display = field?.value ?? value;
  const label = field ? sourceLabel(field.source, language) : "";
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}{label ? ` · ${label}` : ""}</CardTitle></CardHeader><CardContent className="pt-0 text-lg font-semibold">{display ? String(display) : "—"}</CardContent></Card>;
}
