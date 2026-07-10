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
  legacy_medicine_id: number | null;
  name_en: string | null;
  name_ar: string | null;
  dosage_form: string | null;
  strength: string | null;
  category: string | null;
  display_category: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  price: number | null;
  price_currency: string | null;
  code: string | null;
  egyptdwa_image_url: string | null;
  egyptdwa_source_url: string | null;
  egyptdwa_product_views: number | null;
  international_generic_name: string | null;
  international_source_url: string | null;
  enrichment_source_count: number;
};

type Metrics = {
  total_active: number;
  with_dosage_form: number;
  with_strength: number;
  with_barcode: number;
  with_price: number;
  with_legacy_compatibility: number;
  with_egyptdwa_evidence: number;
  with_international_product_evidence: number;
  international_ingredient_references: number;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const select = [
  "id", "legacy_medicine_id", "name_en", "name_ar", "dosage_form", "strength",
  "category", "display_category", "manufacturer", "active_ingredient", "atc_code",
  "barcode", "price", "price_currency", "code", "egyptdwa_image_url",
  "egyptdwa_source_url", "egyptdwa_product_views", "international_generic_name",
  "international_source_url", "enrichment_source_count",
].join(",");

function starts(value: string) { return encodeURIComponent(`${value.trim()}*`); }
function suffix(derived: boolean, language: "en" | "ar") { return derived ? (language === "ar" ? " · مستنتج" : " · derived") : ""; }

export default function MedicinesEncyclopedia() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [activeBrowse, setActiveBrowse] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(search = query) {
    setLoading(true); setError(null); setActiveBrowse(null);
    try {
      const rows = await supabaseFetch<Medicine[]>("/rest/v1/rpc/search_medicines_catalog", {
        method: "POST",
        body: JSON.stringify({ p_query: search.trim(), p_limit: 80 }),
      });
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load medicines.", "تعذر تحميل الأدوية."));
    } finally { setLoading(false); }
  }

  async function browseByLetter(letter: string) {
    setLoading(true); setError(null); setQuery(""); setActiveBrowse(letter);
    try {
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog_enriched_v1?select=${select}&name_en=ilike.${starts(letter)}&order=name_en.asc&limit=80`);
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية."));
    } finally { setLoading(false); }
  }

  async function browseByCategory(category: string) {
    setLoading(true); setError(null); setQuery(""); setActiveBrowse(category);
    try {
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog_enriched_v1?select=${select}&display_category=eq.${encodeURIComponent(category)}&order=name_en.asc&limit=80`);
      setMedicines(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية."));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    void load("");
    supabaseFetch<Metrics[]>("/rest/v1/medicines_catalog_metrics?select=*")
      .then(rows => setMetrics(rows[0] || null)).catch(() => setMetrics(null));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const medicine of medicines) {
      const key = medicine.display_category || t("Uncategorized", "غير مصنف");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).slice(0, 8);
  }, [medicines, t]);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Medicine encyclopedia", "موسوعة الأدوية")}</p>
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight"><BookOpen className="h-8 w-8" />{t("Connected Egyptian medicine catalog", "كتالوج الأدوية المصري المترابط")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("The complete medicines2 catalog, enriched only through verified source links. Egyptian catalog prices stay authoritative; international evidence is clearly labeled and never overwrites local data.", "كتالوج medicines2 الكامل مع إثراء قائم فقط على روابط مصادر موثقة. تظل أسعار الكتالوج المصري هي المرجع، وتظهر البيانات الدولية بوضوح دون استبدال البيانات المحلية.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label={t("Active products", "المنتجات النشطة")} value={Number(metrics?.total_active || 0)} />
      <Metric label={t("EgyptDwa-linked", "مرتبطة بـ EgyptDwa")} value={Number(metrics?.with_egyptdwa_evidence || 0)} />
      <Metric label={t("International references", "مراجع دولية")} value={Number(metrics?.international_ingredient_references || 0)} />
      <Metric label={t("With price", "بها سعر")} value={Number(metrics?.with_price || 0)} />
      <Metric label={t("With barcode", "بها باركود")} value={Number(metrics?.with_barcode || 0)} />
      <Metric label={t("Legacy-linked", "مرتبطة بالنظام السابق")} value={Number(metrics?.with_legacy_compatibility || 0)} />
    </section>

    <Alert className="mt-4"><AlertDescription>{t("Current inventory quantity is never exposed. Source-observed prices are evidence only and do not replace the Egyptian catalog price.", "لا يتم عرض كمية المخزون الحالية مطلقًا. أسعار المصادر هي أدلة مرجعية فقط ولا تستبدل سعر الكتالوج المصري.")}</AlertDescription></Alert>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search name, barcode, product code...", "ابحث بالاسم أو الباركود أو كود المنتج...")} onKeyDown={event => { if (event.key === "Enter") void load(); }} />
        <Button onClick={() => void load()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
        <Button variant="outline" onClick={() => { setQuery(""); void load(""); }} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Reset", "إعادة ضبط")}</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{LETTERS.map(letter => <Button key={letter} size="sm" variant={activeBrowse === letter ? "default" : "outline"} onClick={() => void browseByLetter(letter)} disabled={loading}>{letter}</Button>)}</div>
      {categories.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{categories.map(([category, count]) => <Button key={category} size="sm" variant={activeBrowse === category ? "default" : "outline"} onClick={() => void browseByCategory(category)} disabled={loading}>{category} ({count})</Button>)}</div>}
      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {medicines.map(medicine => {
        const title = language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.id}`);
        const subtitle = language === "ar" ? medicine.name_en : medicine.name_ar;
        const derivedInput = { ...medicine, category: medicine.display_category || medicine.category };
        const form = deriveDosageForm(derivedInput); const strength = deriveStrength(derivedInput); const category = deriveCategory(derivedInput); const pack = derivePackSize(derivedInput);
        const price = medicine.price ? `${Number(medicine.price).toLocaleString()} ${medicine.price_currency || "EGP"}` : null;
        return <a key={medicine.id} href={`/catalog/${medicine.id}`} className="block transition hover:-translate-y-0.5 hover:shadow-md"><Card className="h-full overflow-hidden shadow-sm">
          {medicine.egyptdwa_image_url && <img src={medicine.egyptdwa_image_url} alt={title} className="h-40 w-full object-contain bg-muted/30 p-3" loading="lazy" />}
          <CardHeader><CardTitle className="text-lg leading-7">{title}</CardTitle>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">{form.value && <Badge variant="outline">{form.value}{suffix(form.derived, language)}</Badge>}{strength.value && <Badge variant="outline">{strength.value}{suffix(strength.derived, language)}</Badge>}{category.value && <Badge>{category.value}{suffix(category.derived, language)}</Badge>}{price && <Badge variant="secondary">{price}</Badge>}{pack.value && <Badge variant="outline">{pack.value}{suffix(pack.derived, language)}</Badge>}{medicine.enrichment_source_count > 0 && <Badge variant="secondary">{t("Source-backed", "مدعوم بمصدر")}</Badge>}</div>
            <Info label={t("Barcode", "الباركود")} value={medicine.barcode} /><Info label={t("Product code", "كود المنتج")} value={medicine.code} /><Info label={t("Generic reference", "مرجع المادة الفعالة")} value={medicine.international_generic_name || medicine.active_ingredient} />
            {medicine.egyptdwa_product_views != null && <p className="text-xs text-muted-foreground">EgyptDwa: {Number(medicine.egyptdwa_product_views).toLocaleString()} {t("views", "مشاهدة")}</p>}
            <span className="inline-flex text-sm font-semibold text-primary">{t("Open sourced product →", "فتح المنتج ومصادره ←")}</span>
          </CardContent>
        </Card></a>;
      })}
      {!loading && medicines.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No products found.", "لا توجد منتجات مطابقة.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value: unknown }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value ? String(value) : "—"}</div></div>; }
