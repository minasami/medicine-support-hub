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
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  price: number | null;
  price_currency: string | null;
  code: string | null;
};

type Enrichment = {
  medicine_id: number;
  medicine_genre: string | null;
  price_amount: number | null;
  price_currency: string | null;
  source_name: string | null;
  updated_at: string | null;
};

type Metrics = {
  total_active: number;
  with_dosage_form: number;
  with_strength: number;
  with_barcode: number;
  with_price: number;
  with_legacy_compatibility: number;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const select = "id,legacy_medicine_id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode,price,price_currency,code";

function enc(value: string) { return encodeURIComponent(`*${value.trim()}*`); }
function starts(value: string) { return encodeURIComponent(`${value.trim()}*`); }
function suffix(derived: boolean, language: "en" | "ar") { return derived ? (language === "ar" ? " · مستنتج" : " · derived") : ""; }

export default function MedicinesEncyclopedia() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [activeBrowse, setActiveBrowse] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [enrichments, setEnrichments] = useState<Map<number, Enrichment>>(new Map());
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEnrichments(rows: Medicine[]) {
    const legacyIds = rows.map(row => row.legacy_medicine_id).filter((id): id is number => Boolean(id));
    if (!legacyIds.length) { setEnrichments(new Map()); return; }
    try {
      const fields = "medicine_id,medicine_genre,price_amount,price_currency,source_name,updated_at";
      const data = await supabaseFetch<Enrichment[]>(`/rest/v1/medicine_enrichments?select=${fields}&confidence=eq.verified&medicine_id=in.(${legacyIds.join(",")})&order=updated_at.desc`);
      const map = new Map<number, Enrichment>();
      for (const row of data) if (!map.has(row.medicine_id)) map.set(row.medicine_id, row);
      setEnrichments(map);
    } catch { setEnrichments(new Map()); }
  }

  async function load(search = query) {
    setLoading(true); setError(null); setActiveBrowse(null);
    try {
      const q = search.trim();
      const path = q.length >= 2
        ? `/rest/v1/medicines_catalog?select=${select}&or=(name_en.ilike.${enc(q)},name_ar.ilike.${enc(q)},active_ingredient.ilike.${enc(q)},manufacturer.ilike.${enc(q)},barcode.ilike.${enc(q)},atc_code.ilike.${enc(q)},code.ilike.${enc(q)})&order=name_en.asc&limit=80`
        : `/rest/v1/medicines_catalog?select=${select}&order=name_en.asc&limit=80`;
      const rows = await supabaseFetch<Medicine[]>(path);
      setMedicines(rows);
      await loadEnrichments(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load medicines.", "تعذر تحميل الأدوية."));
    } finally { setLoading(false); }
  }

  async function browseByLetter(letter: string) {
    setLoading(true); setError(null); setQuery(""); setActiveBrowse(letter);
    try {
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog?select=${select}&name_en=ilike.${starts(letter)}&order=name_en.asc&limit=80`);
      setMedicines(rows); await loadEnrichments(rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية.")); }
    finally { setLoading(false); }
  }

  async function browseByCategory(category: string) {
    setLoading(true); setError(null); setQuery(""); setActiveBrowse(category);
    try {
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog?select=${select}&category=eq.${encodeURIComponent(category)}&order=name_en.asc&limit=80`);
      setMedicines(rows); await loadEnrichments(rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not browse medicines.", "تعذر تصفح الأدوية.")); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void load("");
    supabaseFetch<Metrics[]>("/rest/v1/medicines_catalog_metrics?select=*").then(rows => setMetrics(rows[0] || null)).catch(() => setMetrics(null));
  }, []);

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
      <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight"><BookOpen className="h-8 w-8" />{t("Full Egyptian product catalog", "كتالوج المنتجات المصري الكامل")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Powered by the complete medicines2 product table, with price, barcode, product codes, and safe compatibility links to previously verified enrichment records.", "مدعوم بجدول medicines2 الكامل مع السعر والباركود وأكواد المنتجات وروابط توافق آمنة مع سجلات الإثراء الموثقة سابقًا.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label={t("Active products", "المنتجات النشطة")} value={Number(metrics?.total_active || 0)} />
      <Metric label={t("With price", "بها سعر")} value={Number(metrics?.with_price || 0)} />
      <Metric label={t("With barcode", "بها باركود")} value={Number(metrics?.with_barcode || 0)} />
      <Metric label={t("With dosage form", "بها شكل دوائي")} value={Number(metrics?.with_dosage_form || 0)} />
      <Metric label={t("With strength", "بها تركيز")} value={Number(metrics?.with_strength || 0)} />
      <Metric label={t("Legacy-linked", "مرتبطة بالقديم")} value={Number(metrics?.with_legacy_compatibility || 0)} />
    </section>

    <Alert className="mt-4"><AlertDescription>{t("The public catalog excludes current inventory quantity. Existing enrichment is shown only when a unique normalized-name compatibility match exists.", "الكتالوج العام لا يعرض كمية المخزون الحالية. يظهر الإثراء السابق فقط عند وجود تطابق آمن وفريد للاسم بعد التطبيع.")}</AlertDescription></Alert>

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
        const form = deriveDosageForm(medicine); const strength = deriveStrength(medicine); const category = deriveCategory(medicine); const pack = derivePackSize(medicine);
        const enrichment = medicine.legacy_medicine_id ? enrichments.get(medicine.legacy_medicine_id) : undefined;
        const price = medicine.price ? `${Number(medicine.price).toLocaleString()} ${medicine.price_currency || "EGP"}` : enrichment?.price_amount ? `${Number(enrichment.price_amount).toLocaleString()} ${enrichment.price_currency || "EGP"}` : null;
        return <a key={medicine.id} href={`/medicines/${medicine.id}`} className="block transition hover:-translate-y-0.5 hover:shadow-md"><Card className="h-full shadow-sm"><CardHeader><CardTitle className="text-lg leading-7">{title}</CardTitle>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</CardHeader><CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">{form.value && <Badge variant="outline">{form.value}{suffix(form.derived, language)}</Badge>}{strength.value && <Badge variant="outline">{strength.value}{suffix(strength.derived, language)}</Badge>}{category.value && <Badge>{category.value}{suffix(category.derived, language)}</Badge>}{price && <Badge variant="secondary">{price}</Badge>}{pack.value && <Badge variant="outline">{pack.value}{suffix(pack.derived, language)}</Badge>}</div>
          <Info label={t("Barcode", "الباركود")} value={medicine.barcode} /><Info label={t("Product code", "كود المنتج")} value={medicine.code} /><Info label={t("Active ingredient", "المادة الفعالة")} value={medicine.active_ingredient} />
          {enrichment?.source_name && <p className="text-xs text-muted-foreground">{t("Verified enrichment", "إثراء موثق")}: {enrichment.source_name}</p>}
          <span className="inline-flex text-sm font-semibold text-primary">{t("Open full product →", "فتح المنتج الكامل ←")}</span>
        </CardContent></Card></a>;
      })}
      {!loading && medicines.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No products found.", "لا توجد منتجات مطابقة.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value: unknown }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value ? String(value) : "—"}</div></div>; }
