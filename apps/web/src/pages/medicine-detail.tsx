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
  display_category: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  price: number | null;
  price_currency: string | null;
  code: string | null;
  custom_product_code: string | null;
  egyptdwa_category: string | null;
  egyptdwa_category_url: string | null;
  egyptdwa_image_url: string | null;
  egyptdwa_source_url: string | null;
  egyptdwa_product_views: number | null;
  egyptdwa_category_views: number | null;
  egyptdwa_observed_price: number | null;
  egyptdwa_observed_currency: string | null;
  egyptdwa_match_method: string | null;
  international_generic_name: string | null;
  international_disease_area: string | null;
  international_prescription_signal: string | null;
  international_manufacturer: string | null;
  international_manufacturer_origin: string | null;
  international_source_url: string | null;
  international_image_url: string | null;
  international_observed_price_text: string | null;
  international_observed_currency: string | null;
  enrichment_source_count: number;
};

type LegacyEnrichment = {
  id: string;
  manufacturer: string | null;
  active_ingredient: string | null;
  atc_code: string | null;
  barcode: string | null;
  medicine_family: string | null;
  medicine_genre: string | null;
  route: string | null;
  source_name: string;
  source_url: string;
  source_type: string;
};

const select = [
  "id", "legacy_medicine_id", "name_en", "name_ar", "dosage_form", "strength",
  "category", "display_category", "manufacturer", "active_ingredient", "atc_code",
  "barcode", "price", "price_currency", "code", "custom_product_code",
  "egyptdwa_category", "egyptdwa_category_url", "egyptdwa_image_url",
  "egyptdwa_source_url", "egyptdwa_product_views", "egyptdwa_category_views",
  "egyptdwa_observed_price", "egyptdwa_observed_currency", "egyptdwa_match_method",
  "international_generic_name", "international_disease_area",
  "international_prescription_signal", "international_manufacturer",
  "international_manufacturer_origin", "international_source_url",
  "international_image_url", "international_observed_price_text",
  "international_observed_currency", "enrichment_source_count",
].join(",");

function encoded(value: string) { return encodeURIComponent(value); }
function sourced(value: string | null | undefined): MedicineDisplayField | null { const text = String(value ?? "").trim(); return text ? { value: text, source: "provided" } : null; }
function firstText(rows: LegacyEnrichment[], key: keyof Pick<LegacyEnrichment, "manufacturer" | "active_ingredient" | "atc_code" | "barcode">) { return rows.map(row => row[key]).find(value => String(value ?? "").trim()); }
function firstSourceValue(rows: LegacyEnrichment[], key: keyof Pick<LegacyEnrichment, "medicine_family" | "medicine_genre" | "route">) { return rows.map(row => row[key]).find(value => String(value ?? "").trim()) ?? null; }

export default function MedicineDetail() {
  const [catalogRoute, catalogParams] = useRoute("/catalog/:id");
  const [, legacyParams] = useRoute("/medicines/:id");
  const id = catalogRoute ? catalogParams?.id : legacyParams?.id;
  const isLegacyUrl = !catalogRoute;
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [legacyEnrichments, setLegacyEnrichments] = useState<LegacyEnrichment[]>([]);
  const [related, setRelated] = useState<Medicine[]>([]);
  const [unmappedLegacy, setUnmappedLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true); setError(null); setUnmappedLegacy(false);
    try {
      let found: Medicine | null = null;
      if (catalogRoute) {
        const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog_enriched_v1?select=${select}&id=eq.${encodeURIComponent(id)}&limit=1`);
        found = rows[0] ?? null;
      } else {
        const mapped = await supabaseFetch<Medicine[]>("/rest/v1/rpc/resolve_legacy_medicine_catalog", {
          method: "POST",
          body: JSON.stringify({ p_legacy_medicine_id: Number(id) }),
        });
        found = mapped[0] ?? null;
        if (!found) {
          const legacySelect = "id,name_en,name_ar,dosage_form,strength,category,manufacturer,active_ingredient,atc_code,barcode";
          const legacyRows = await supabaseFetch<any[]>(`/rest/v1/medicines?select=${legacySelect}&id=eq.${encodeURIComponent(id)}&is_active=eq.true&limit=1`);
          if (legacyRows[0]) {
            const row = legacyRows[0];
            found = {
              ...row,
              legacy_medicine_id: row.id,
              display_category: row.category,
              price: null, price_currency: "EGP", code: null, custom_product_code: null,
              egyptdwa_category: null, egyptdwa_category_url: null,
              egyptdwa_image_url: null, egyptdwa_source_url: null,
              egyptdwa_product_views: null, egyptdwa_category_views: null,
              egyptdwa_observed_price: null, egyptdwa_observed_currency: null,
              egyptdwa_match_method: null, international_generic_name: null,
              international_disease_area: null, international_prescription_signal: null,
              international_manufacturer: null, international_manufacturer_origin: null,
              international_source_url: null, international_image_url: null,
              international_observed_price_text: null, international_observed_currency: null,
              enrichment_source_count: 0,
            };
            setUnmappedLegacy(true);
          }
        }
      }

      setMedicine(found);
      if (found?.legacy_medicine_id) {
        const fields = "id,manufacturer,active_ingredient,atc_code,barcode,medicine_family,medicine_genre,route,source_name,source_url,source_type";
        const rows = await supabaseFetch<LegacyEnrichment[]>(`/rest/v1/medicine_enrichments?select=${fields}&medicine_id=eq.${found.legacy_medicine_id}&confidence=eq.verified&order=updated_at.desc&limit=12`);
        setLegacyEnrichments(rows);
      } else setLegacyEnrichments([]);

      if (found?.display_category && !unmappedLegacy) {
        const rows = await supabaseFetch<Medicine[]>(`/rest/v1/medicines_catalog_enriched_v1?select=${select}&display_category=eq.${encoded(found.display_category)}&id=neq.${found.id}&order=name_en.asc&limit=9`);
        setRelated(rows);
      } else setRelated([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load product.", "تعذر تحميل المنتج."));
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [id, catalogRoute]);

  const title = medicine ? (language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.id}`)) : t("Product details", "تفاصيل المنتج");
  const subtitle = medicine ? (language === "ar" ? medicine.name_en : medicine.name_ar) : null;
  const strength = medicine ? displayStrength(medicine.strength, medicine.name_en, medicine.name_ar) : null;
  const manufacturer = medicine ? (sourced(firstText(legacyEnrichments, "manufacturer")) ?? displayKnownOrPlanned(medicine.manufacturer)) : null;
  const barcode = medicine ? (sourced(medicine.barcode) ?? sourced(firstText(legacyEnrichments, "barcode")) ?? displayKnownOrPlanned(null)) : null;
  const activeIngredient = medicine ? (sourced(firstText(legacyEnrichments, "active_ingredient")) ?? sourced(medicine.international_generic_name) ?? displayKnownOrPlanned(medicine.active_ingredient)) : null;
  const atc = medicine ? (sourced(firstText(legacyEnrichments, "atc_code")) ?? displayKnownOrPlanned(medicine.atc_code)) : null;
  const family = firstSourceValue(legacyEnrichments, "medicine_family");
  const genre = firstSourceValue(legacyEnrichments, "medicine_genre");
  const route = firstSourceValue(legacyEnrichments, "route");
  const price = medicine?.price ? `${Number(medicine.price).toLocaleString()} ${medicine.price_currency || "EGP"}` : null;

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><a href="/medicines" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to encyclopedia", "العودة إلى الموسوعة")}</a><Button asChild variant="outline"><a href="/medicines"><Search className="mr-2 h-4 w-4" />{t("Search products", "بحث في المنتجات")}</a></Button></div>
    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="text-muted-foreground">{t("Loading product details...", "جاري تحميل تفاصيل المنتج...")}</p>}
    {!loading && !medicine && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("Product not found.", "لم يتم العثور على المنتج.")}</CardContent></Card>}

    {medicine && strength && manufacturer && barcode && activeIngredient && atc && <>
      {isLegacyUrl && medicine.legacy_medicine_id && !unmappedLegacy && <Alert className="mb-4"><AlertDescription>{t("This legacy link was safely resolved to the corresponding current catalog product.", "تم تحويل الرابط القديم بأمان إلى المنتج المقابل في الكتالوج الحالي.")} <a className="font-semibold text-primary" href={`/catalog/${medicine.id}`}>{t("Open canonical link", "فتح الرابط الأساسي")}</a></AlertDescription></Alert>}
      {unmappedLegacy && <Alert className="mb-4"><AlertDescription>{t("This is a preserved legacy record. It has not been automatically linked to medicines2 because no verified one-to-one match exists.", "هذا سجل قديم محفوظ. لم يتم ربطه تلقائيًا بـ medicines2 لعدم وجود تطابق موثق وفريد.")}</AlertDescription></Alert>}

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {(medicine.egyptdwa_image_url || medicine.international_image_url) && <img src={medicine.egyptdwa_image_url || medicine.international_image_url || ""} alt={title} className="h-64 w-full bg-muted/30 object-contain p-4" />}
        <div className="p-6">
          <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><BookOpen className="h-4 w-4" />{t("Source-backed product record", "سجل منتج مدعوم بالمصادر")}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>}
          <div className="mt-4 flex flex-wrap gap-2">{medicine.dosage_form && <Badge variant="outline">{medicine.dosage_form}</Badge>}<FieldBadge field={strength} language={language} />{medicine.display_category && <Badge>{medicine.display_category}</Badge>}{family && <Badge variant="outline">{family}</Badge>}{genre && <Badge variant="outline">{genre}</Badge>}{price && <Badge variant="secondary">{price}</Badge>}{medicine.egyptdwa_source_url && <Badge variant="secondary">EgyptDwa</Badge>}{medicine.international_source_url && <Badge variant="secondary">Netmeds · international</Badge>}</div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Info title={t("Authoritative Egyptian catalog price", "سعر الكتالوج المصري المعتمد")} value={price} />
        <Info title={t("Barcode", "الباركود")} field={barcode} language={language} />
        <Info title={t("Product code", "كود المنتج")} value={medicine.code} />
        <Info title={t("Custom product code", "كود المنتج المخصص")} value={medicine.custom_product_code} />
        <Info title={t("Active ingredient / generic reference", "المادة الفعالة / المرجع العلمي")} field={activeIngredient} language={language} />
        <Info title={t("Manufacturer", "الشركة المصنعة")} field={manufacturer} language={language} />
        <Info title={t("Medicine family", "العائلة الدوائية")} value={family} />
        <Info title={t("Genre / class", "النوع / التصنيف")} value={genre} />
        <Info title={t("Route", "طريقة الاستخدام")} value={route} />
        <Info title={t("Dosage form", "الشكل الدوائي")} value={medicine.dosage_form} />
        <Info title={t("Strength", "التركيز")} field={strength} language={language} />
        <Info title="ATC" field={atc} language={language} />
      </section>

      {medicine.egyptdwa_source_url && <section className="mt-6"><h2 className="text-xl font-semibold">{t("EgyptDwa evidence", "بيانات EgyptDwa المرجعية")}</h2><Card className="mt-4"><CardContent className="grid gap-3 p-5 md:grid-cols-2"><InfoLine label={t("Category", "التصنيف")} value={medicine.egyptdwa_category} /><InfoLine label={t("Product views", "مشاهدات المنتج")} value={medicine.egyptdwa_product_views?.toLocaleString()} /><InfoLine label={t("Category views", "مشاهدات التصنيف")} value={medicine.egyptdwa_category_views?.toLocaleString()} /><InfoLine label={t("Observed price", "السعر المرصود")} value={medicine.egyptdwa_observed_price != null ? `${Number(medicine.egyptdwa_observed_price).toLocaleString()} ${medicine.egyptdwa_observed_currency || "EGP"}` : null} /><a href={medicine.egyptdwa_source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source record", "فتح سجل المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a></CardContent></Card></section>}

      {medicine.international_source_url && <section className="mt-6"><h2 className="text-xl font-semibold">{t("International reference", "مرجع دولي")}</h2><Card className="mt-4"><CardContent className="grid gap-3 p-5 md:grid-cols-2"><InfoLine label={t("Generic name", "الاسم العلمي")} value={medicine.international_generic_name} /><InfoLine label={t("Disease area", "المجال المرضي")} value={medicine.international_disease_area} /><InfoLine label={t("Prescription signal", "حالة الوصفة")} value={medicine.international_prescription_signal} /><InfoLine label={t("Manufacturer", "الشركة المصنعة")} value={medicine.international_manufacturer} /><InfoLine label={t("Market of origin", "سوق المنشأ")} value={medicine.international_manufacturer_origin} /><InfoLine label={t("Foreign observed price", "السعر المرصود بالخارج")} value={medicine.international_observed_price_text ? `${medicine.international_observed_price_text} (${medicine.international_observed_currency || "INR"})` : null} /><a href={medicine.international_source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open international source", "فتح المصدر الدولي")}<ExternalLink className="ml-2 h-4 w-4" /></a></CardContent></Card><Alert className="mt-3"><AlertDescription>{t("International evidence is contextual only. It does not establish Egyptian registration, availability, indication, or price.", "البيانات الدولية للسياق فقط ولا تثبت التسجيل أو التوافر أو الاستعمال أو السعر داخل مصر.")}</AlertDescription></Alert></section>}

      {legacyEnrichments.length > 0 && <section className="mt-6"><h2 className="text-xl font-semibold">{t("Previously verified sources", "المصادر الموثقة سابقًا")}</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{legacyEnrichments.map(row => <Card key={row.id}><CardHeader><CardTitle className="text-base">{row.source_name}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Open source record", "فتح سجل المصدر")}<ExternalLink className="ml-2 h-4 w-4" /></a><div>{t("Source type", "نوع المصدر")}: {row.source_type}</div>{row.medicine_genre && <div>{t("Class", "التصنيف")}: {row.medicine_genre}</div>}</CardContent></Card>)}</div></section>}

      <Alert className="mt-6"><AlertDescription>{t("medicines2 remains the product source of truth. Source evidence is additive, attributed, confidence-gated, and never exposes current inventory quantity.", "يظل medicines2 مصدر الحقيقة للمنتج. بيانات المصادر إضافية ومنسوبة لمصدرها ومقيدة بدرجة الثقة، ولا تعرض كمية المخزون الحالية مطلقًا.")}</AlertDescription></Alert>

      {related.length > 0 && <section className="mt-6"><h2 className="text-xl font-semibold">{t("Related products", "منتجات مرتبطة")}</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{related.map(item => <a key={item.id} href={`/catalog/${item.id}`} className="rounded-xl border bg-card p-4 hover:bg-muted"><div className="font-semibold">{language === "ar" ? item.name_ar || item.name_en : item.name_en || item.name_ar}</div><div className="mt-1 text-sm text-muted-foreground">{item.strength || item.barcode || "—"}</div></a>)}</div></section>}
    </>}
  </main>;
}

function FieldBadge({ field, language }: { field: MedicineDisplayField; language: "en" | "ar" }) { return <Badge variant="outline">{field.value}{field.source !== "provided" ? ` · ${sourceLabel(field.source, language)}` : ""}</Badge>; }
function Info({ title, value, field, language = "en" }: { title: string; value?: string | null; field?: MedicineDisplayField | null; language?: "en" | "ar" }) { const shown = field?.value || value || "—"; return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{title}</div><div className="mt-1 font-medium break-words">{shown}</div>{field && field.source !== "provided" && <div className="mt-1 text-xs text-muted-foreground">{sourceLabel(field.source, language)}</div>}</CardContent></Card>; }
function InfoLine({ label, value }: { label: string; value?: string | null }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>; }
