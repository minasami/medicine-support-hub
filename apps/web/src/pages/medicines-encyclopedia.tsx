import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COVERAGE = {
  totalActive: 70673,
  withDosageForm: 70673,
  withStrength: 35805,
};

function enc(value: string) {
  return encodeURIComponent(`*${value.trim()}*`);
}

function starts(value: string) {
  return encodeURIComponent(`${value.trim()}*`);
}

function suffix(derived: boolean, language: "en" | "ar") {
  if (!derived) return "";
  return language === "ar" ? " · مستنتج" : " · derived";
}

export default function MedicinesEncyclopedia() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [activeBrowse, setActiveBrowse] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(search = query) {
    setLoading(true);
    setError(null);
    setActiveBrowse(null);
    try {
      const q = search.trim();
      const select = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode";
      const path = q.length >= 2
        ? `/rest/v1/medicines?select=${select}&is_active=eq.true&or=(name_en.ilike.${enc(q)},name_ar.ilike.${enc(q)},active_ingredient.ilike.${enc(q)},manufacturer.ilike.${enc(q)},barcode.ilike.${enc(q)},atc_code.ilike.${enc(q)})&order=name_en.asc&limit=80`
        : `/rest/v1/medicines?select=${select}&is_active=eq.true&order=name_en.asc&limit=80`;
      const rows = await supabaseFetch<Medicine[]>(path);
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load medicines.", "تعذر تحميل الأدوية."));
    } finally {
      setLoading(false);
    }
  }

  async function browseByLetter(letter: string) {
    setLoading(true);
    setError(null);
    setQuery("");
    setActiveBrowse(letter);
    try {
      const select = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode";
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines?select=${select}&is_active=eq.true&name_en=ilike.${starts(letter)}&order=name_en.asc&limit=80`);
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية."));
    } finally {
      setLoading(false);
    }
  }

  async function browseByCategory(category: string) {
    setLoading(true);
    setError(null);
    setQuery("");
    setActiveBrowse(category);
    try {
      const select = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode";
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines?select=${select}&is_active=eq.true&category=eq.${encodeURIComponent(category)}&order=name_en.asc&limit=80`);
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const medicine of medicines) {
      const key = medicine.category || t("Uncategorized", "غير مصنف");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).slice(0, 8);
  }, [medicines, t]);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Medicine encyclopedia", "موسوعة الأدوية")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><BookOpen className="h-8 w-8" />{t("Egyptian medicines knowledge base", "قاعدة معرفة الأدوية المصرية")}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {t("Search or browse the medicine database by English name, Arabic name, active ingredient, manufacturer, barcode, ATC code, first letter, or category.", "ابحث أو تصفح قاعدة بيانات الأدوية بالاسم الإنجليزي أو العربي أو المادة الفعالة أو الشركة المصنعة أو الباركود أو كود ATC أو أول حرف أو التصنيف.")}
          </p>
        </div>
        <a href="/integrations" className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-muted">
          {t("Open integration hub", "فتح مركز التكامل")}
        </a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Metric label={t("Active medicine records", "سجلات أدوية نشطة")} value={COVERAGE.totalActive} />
      <Metric label={t("With dosage form", "بها شكل دوائي")} value={COVERAGE.withDosageForm} />
      <Metric label={t("With strength", "بها تركيز")} value={COVERAGE.withStrength} />
    </section>

    <Alert className="mt-4">
      <AlertDescription>{t("Coverage snapshot: dosage-form data is complete for the active catalog; strength data is available for a large portion of records. Missing display values are filled only when safely inferred from existing names; manufacturer and barcode enrichment are planned next.", "لقطة تغطية البيانات: بيانات الشكل الدوائي مكتملة للكتالوج النشط، وبيانات التركيز متاحة لجزء كبير من السجلات. يتم ملء القيم الناقصة في العرض فقط عندما يمكن استنتاجها بأمان من الاسم، وإثراء الشركة المصنعة والباركود مخطط له لاحقًا.")}</AlertDescription>
    </Alert>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search by name, ingredient, company, barcode...", "ابحث بالاسم أو المادة الفعالة أو الشركة أو الباركود...")} onKeyDown={event => { if (event.key === "Enter") void load(); }} />
        <Button onClick={() => void load()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
        <Button variant="outline" onClick={() => { setQuery(""); void load(""); }} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Reset", "إعادة ضبط")}</Button>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Browse A-Z", "تصفح بالحروف")}</div>
        <div className="flex flex-wrap gap-2">
          {LETTERS.map(letter => <Button key={letter} type="button" size="sm" variant={activeBrowse === letter ? "default" : "outline"} onClick={() => void browseByLetter(letter)} disabled={loading}>{letter}</Button>)}
        </div>
      </div>
      {categories.length > 0 && <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Browse current categories", "تصفح التصنيفات الحالية")}</div>
        <div className="flex flex-wrap gap-2">
          {categories.map(([category, count]) => <Button key={category} type="button" size="sm" variant={activeBrowse === category ? "default" : "outline"} onClick={() => void browseByCategory(category)} disabled={loading}>{category} ({count})</Button>)}
        </div>
      </div>}
      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label={activeBrowse ? t("Browse results", "نتائج التصفح") : t("Loaded medicines", "الأدوية المعروضة")} value={medicines.length} />
      {categories.slice(0, 3).map(([category, count]) => <Metric key={category} label={category} value={count} />)}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {medicines.map((medicine) => {
        const title = language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.id}`);
        const subtitle = language === "ar" ? medicine.name_en : medicine.name_ar;
        const form = deriveDosageForm(medicine);
        const strength = deriveStrength(medicine);
        const category = deriveCategory(medicine);
        const pack = derivePackSize(medicine);
        return <a key={medicine.id} href={`/medicines/${medicine.id}`} className="block transition hover:-translate-y-0.5 hover:shadow-md">
          <Card className="h-full shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg leading-7">{title}</CardTitle>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                {form.value && <Badge variant="outline">{form.value}{suffix(form.derived, language)}</Badge>}
                {strength.value && <Badge variant="outline">{strength.value}{suffix(strength.derived, language)}</Badge>}
                {category.value && <Badge>{category.value}{suffix(category.derived, language)}</Badge>}
                {pack.value && <Badge variant="outline">{pack.value}{suffix(pack.derived, language)}</Badge>}
              </div>
              <Info label={t("Active ingredient", "المادة الفعالة")} value={medicine.active_ingredient} />
              <Info label={t("Manufacturer", "الشركة المصنعة")} value={medicine.manufacturer || t("Planned enrichment", "إثراء لاحق")} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label="ATC" value={medicine.atc_code} />
                <Info label={t("Barcode", "الباركود")} value={medicine.barcode || t("Planned", "لاحقًا")} />
              </div>
              <span className="inline-flex text-sm font-semibold text-primary">{t("Open details →", "فتح التفاصيل ←")}</span>
            </CardContent>
          </Card>
        </a>;
      })}
      {!loading && !medicines.length && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No medicines found. Try another search term.", "لا توجد أدوية مطابقة. جرّب كلمة بحث أخرى.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value ? String(value) : "—"}</div></div>;
}
