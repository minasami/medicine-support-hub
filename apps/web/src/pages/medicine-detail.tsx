import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, ArrowLeft, BookOpen, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { deriveCategory, deriveDosageForm, derivePackSize, deriveStrength } from "@/lib/medicine-derived";
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

type DisplayField = { value: string | null; derived: boolean };

function encoded(value: string) {
  return encodeURIComponent(value);
}

export default function MedicineDetail() {
  const [, params] = useRoute("/medicines/:id");
  const id = params?.id;
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
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
      if (found?.active_ingredient) {
        const rel = await supabaseFetch<Medicine[]>(`/rest/v1/medicines?select=${select}&is_active=eq.true&active_ingredient=eq.${encoded(found.active_ingredient)}&id=neq.${encodeURIComponent(id)}&order=name_en.asc&limit=12`);
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
  const display = medicine ? {
    form: deriveDosageForm(medicine),
    strength: deriveStrength(medicine),
    pack: derivePackSize(medicine),
    category: deriveCategory(medicine),
  } : null;

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <a href="/medicines" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to encyclopedia", "العودة إلى الموسوعة")}</a>
      <Button asChild variant="outline"><a href="/medicines"><Search className="mr-2 h-4 w-4" />{t("Search medicines", "بحث في الأدوية")}</a></Button>
    </div>

    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="text-muted-foreground">{t("Loading medicine details...", "جاري تحميل تفاصيل الدواء...")}</p>}

    {!loading && !medicine && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("Medicine not found.", "لم يتم العثور على الدواء.")}</CardContent></Card>}

    {medicine && display && <>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><BookOpen className="h-4 w-4" />{t("Medicine encyclopedia", "موسوعة الأدوية")}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {display.form.value && <FieldBadge field={display.form} />}
          {display.strength.value && <FieldBadge field={display.strength} />}
          {display.category.value && <FieldBadge field={display.category} solid />}
          {display.pack.value && <FieldBadge field={display.pack} />}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Info title={t("Active ingredient", "المادة الفعالة")} value={medicine.active_ingredient} />
        <Info title={t("Manufacturer", "الشركة المصنعة")} value={medicine.manufacturer} />
        <Info title={t("Dosage form", "الشكل الدوائي")} field={display.form} />
        <Info title={t("Strength", "التركيز")} field={display.strength} />
        <Info title={t("Pack hint", "بيان العبوة")} field={display.pack} />
        <Info title={t("Category", "التصنيف")} field={display.category} />
        <Info title="ATC" value={medicine.atc_code} />
        <Info title={t("Barcode", "الباركود")} value={medicine.barcode} />
      </section>

      <Alert className="mt-6">
        <AlertDescription>{t("Some missing display fields may be derived from the medicine name and are marked as derived. This page is for medicine discovery and operational reference only. It does not replace advice from a licensed physician or pharmacist.", "بعض الحقول الناقصة قد تكون مستنتجة من اسم الدواء وتظهر بعلامة مستنتج. هذه الصفحة للاكتشاف والمرجعية التشغيلية فقط، ولا تغني عن استشارة طبيب أو صيدلي مرخص.")}</AlertDescription>
      </Alert>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">{t("Related medicines", "أدوية مرتبطة")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("Shown when other records share the same active ingredient.", "تظهر عند وجود أدوية أخرى لها نفس المادة الفعالة.")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {related.map(item => <a key={item.id} href={`/medicines/${item.id}`} className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-muted">
            <div className="font-semibold">{language === "ar" ? (item.name_ar || item.name_en) : (item.name_en || item.name_ar)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.strength || item.dosage_form || item.manufacturer || "—"}</div>
          </a>)}
          {!related.length && <Card><CardContent className="p-4 text-sm text-muted-foreground">{t("No related medicines found yet.", "لا توجد أدوية مرتبطة حاليًا.")}</CardContent></Card>}
        </div>
      </section>
    </>}
  </main>;
}

function FieldBadge({ field, solid = false }: { field: DisplayField; solid?: boolean }) {
  return <Badge variant={solid ? "default" : "outline"}>{field.value}{field.derived ? " · derived" : ""}</Badge>;
}

function Info({ title, value, field }: { title: string; value?: unknown; field?: DisplayField }) {
  const display = field?.value ?? value;
  return <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">{title}{field?.derived ? " · derived" : ""}</CardTitle></CardHeader><CardContent className="pt-0 text-lg font-semibold">{display ? String(display) : "—"}</CardContent></Card>;
}
