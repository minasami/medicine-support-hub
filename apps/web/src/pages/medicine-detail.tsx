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
  custom_product_code: string | null;
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

const select = "id,legacy_medicine_id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode,price,price_currency,code,custom_product_code";
function encoded(value: string) { return encodeURIComponent(value); }
function sourced(value: string | null | undefined): MedicineDisplayField | null { const text = String(value ?? "").trim(); return text ? { value: text, source: "provided" } : null; }
function firstText(enrichments: Enrichment[], key: keyof Pick<Enrichment, "manufacturer" | "active_ingredient" | "atc_code" | "barcode">) { return enrichments.map(row => row[key]).find(value => String(value ?? "").trim()); }
function firstSourceValue(enrichments: Enrichment[], key: keyof Pick<Enrichment, "medicine_family" | "medicine_genre" | "route">) { return enrichments.map(row => row[key]).find(value => String(value ?? "").trim()) ?? null; }

export default function MedicineDetail() {
  const [, params] = useRoute("/medicines/:id");
  const id = params?.id;
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [enrichments, setEnrichments] = useState<Enrichment[]>([]);
  const [related, setRelated] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`);
      const found = rows[0] ?? null;
      setMedicine(found);
      if (found?.legacy_medicine_id) {
        const enrichmentSelect = "id,manufacturer,active_ingredient,atc_code,barcode,medicine_family,medicine_genre,route,price_amount,price_currency,price_updated_at,source_name,source_url,source_type,confidence,updated_at";
        const data = await supabaseFetch<Enrichment[]>(`/rest/v1/medicine_enrichments?select=${enrichmentSelect}&medicine_id=eq.${found.legacy_medicine_id}&confidence=eq.verified&order=updated_at.desc&limit=12`);
        setEnrichments(data);
      } else setEnrichments([]);

      if (found?.active_ingredient) {
        const rel = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog?select=${select}&active_ingredient=eq.${encoded(found.active_ingredient)}&id=neq.${encodeURIComponent(id)}&order=name_en.asc&limit=12`);
        setRelated(rel);
      } else setRelated([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load product.", "تعذر تحميل المنتج."));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [id]);

  const title = medicine ? (language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.id}`)) : t("Product details", "تفاصيل المنتج");
  const subtitle = medicine ? (language === "ar" ? medicine.name_en : medicine.name_ar) : null;
  const strength = medicine ? displayStrength(medicine.strength, medicine.name_en, medicine.name_ar) : null;
  const manufacturer = medicine ? (sourced(firstText(enrichments, "manufacturer")) ?? displayKnownOrPlanned(medicine.manufacturer)) : null;
  const barcode = medicine ? (sourced(medicine.barcode) ?? sourced(firstText(enrichments, "barcode")) ?? displayKnownOrPlanned(null)) : null;
  const activeIngredient = medicine ? (sourced(firstText(enrichments, "active_ingredient")) ?? displayKnownOrPlanned(medicine.active_ingredient)) : null;
  const atc = medicine ? (sourced(firstText(enrichments, "atc_code")) ?? displayKnownOrPlanned(medicine.atc_code)) : null;
  const family = firstSourceValue(enrichments, "medicine_family");
  const genre = firstSourceValue(enrichments, "medicine_genre");
  const route = firstSourceValue(enrichments, "route");
  const price = medicine?.price ? `${Number(medicine.price).toLocaleString()} ${medicine.price_currency || "EGP"}` : enrichments.find(row => row.price_amount)?.price_amount ? `${Number(enrichments.find(row => row.price_amount)?.price_amount).toLocaleString()} ${enrichments.find(row => row.price_amount)?.price_currency || "EGP"}` : null;

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><a href="/medicines" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to encyclopedia", "العودة إلى الموسوعة")}</a><Button asChild variant="outline"><a href="/medicines"><Search className="mr-2 h-4 w-4" />{t("Search products", "بحث في المنتجات")}</a></Button></div>
    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="text-muted-foreground">{t("Loading product details...", "جاري تحميل تفاصيل المنتج...")}</p>}
    {!loading && !medicine && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("Product not found.", "لم يتم العثور على المنتج.")}</CardContent></Card>}

    {medicine && strength && manufacturer && barcode && activeIngredient && atc && <>
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><BookOpen className="h-4 w-4" />{t("Full product catalog", "كتالوج المنتجات الكامل")}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
        <div className="mt-4 flex flex-wrap gap-2">{medicine.dosage_form && <Badge variant="outline">{medicine.dosage_form}</Badge>}<FieldBadge field={strength} language={language} />{medicine.category && <Badge>{medicine.category}</Badge>}{family && <Badge variant="outline">{family}</Badge>}{genre && <Badge variant="outline">{genre}</Badge>}{price && <Badge variant="secondary">{price}</Badge>}{medicine.legacy_medicine_id && <Badge variant="secondary">{t("Legacy enrichment linked", "مرتبط بالإثراء السابق")}</Badge>}</div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Info title={t("Current catalog price", "سعر الكتالوج الحالي")} value={price} />
        <Info title={t("Barcode", "الباركود")} field={barcode} language={language} />
        <Info title={t("Product code", "كود المنتج")} value={medicine.code} />
        <Info title={t("Custom product code", "كود المنتج المخصص")} value={medicine.custom_product_code} />
        <Info title={t("Active ingredient", "المادة الفعالة")} field={activeIngredient} language={language} />
        <Info title={t("Manufacturer", "الشركة المصنعة")} field={manufacturer} language={language} />
        <Info title={t("Medicine family", "العائلة الدوائية")} value={family} />
        <Info title={t("Genre / class", "النوع / التصنيف")} value={genre} />
        <Info title={t("Route", "طريقة الاستخدام")} value={route} />
        <Info title={t("Dosage form", "الشكل الدوائي")} value={medicine.dosage_form} />
        <Info title={t("Strength", "التركيز")} field={strength} language={language} />
        <Info title="ATC" field={atc} language={language} />
      </section>

      {enrichments.length > 0 && <section className="mt-6"><h2 className="text-xl font-semibold">{t("Verified enrichment sources", "مصادر الإثراء الموثقة")}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{enrichments.map(row => <Card key={row.id}><CardHeader><CardTitle className="text-base">{row.source_name}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source record", "فتح سجل المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a><div>{t("Source type", "نوع المصدر")}: {row.source_type}</div>{row.medicine_genre && <div>{t("Class", "التصنيف")}: {row.medicine_genre}</div>}</CardContent></Card>)}</div></section>}

      <Alert className="mt-6"><AlertDescription>{t("This page uses medicines2 as the product source. Existing clinical enrichment appears only through a verified one-to-one compatibility match. Current inventory quantity is never exposed publicly.", "تستخدم هذه الصفحة medicines2 كمصدر للمنتج. يظهر الإثراء السريري السابق فقط عبر تطابق توافق موثق وفريد. لا يتم عرض كمية المخزون الحالية للعامة.")}</AlertDescription></Alert>

      <section className="mt-6"><h2 className="text-xl font-semibold">{t("Related products", "منتجات مرتبطة")}</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{related.map(item => <a key={item.id} href={`/medicines/${item.id}`} className="rounded-xl border bg-card p-4 hover:bg-muted"><div className="font-semibold">{language === "ar" ? item.name_ar || item.name_en : item.name_en || item.name_ar}</div><div className="mt-1 text-sm text-muted-foreground">{item.strength || item.barcode || "—"}</div></a>)}</div></section>
    </>}
  </main>;
}

function FieldBadge({ field, language }: { field: MedicineDisplayField; language: "en" | "ar" }) { return <Badge variant="outline">{field.value}{field.source !== "provided" ? ` · ${sourceLabel(field.source, language)}` : ""}</Badge>; }
function Info({ title, value, field, language = "en" }: { title: string; value?: string | null; field?: MedicineDisplayField | null; language?: "en" | "ar" }) { const shown = field?.value || value || "—"; return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{title}</div><div className="mt-1 font-medium break-words">{shown}</div>{field && field.source !== "provided" && <div className="mt-1 text-xs text-muted-foreground">{sourceLabel(field.source, language)}</div>}</CardContent></Card>; }
