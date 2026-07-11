import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Handshake,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Medicine = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  route: string | null;
  category: string | null;
  image_url: string | null;
  barcode: string | null;
  code: string | null;
  current_price_egp: number | null;
  price_currency: string | null;
  min_price_egp: number | null;
  max_price_egp: number | null;
  price_observation_count: number;
  distinct_price_count: number;
  has_price_history: boolean;
  source_record_count: number;
  source_count: number;
  source_systems: string[];
  has_verified_dataset: boolean;
  current_price_source: string | null;
  relevance: number;
  total_count: number;
};

type Metrics = {
  canonical_products: number;
  verified_dataset_products: number;
  operational_catalog_products: number;
  products_with_price_history: number;
  products_with_current_price: number;
  manufacturers: number;
  scientific_names: number;
  drug_classes: number;
  routes: number;
  source_records_merged: number;
};

type Facet = {
  facet_type: "manufacturer" | "drug_class" | "route";
  facet_value: string;
  product_count: number;
};

type Filters = {
  manufacturer: string;
  drugClass: string;
  route: string;
  scientificName: string;
  minPrice: string;
  maxPrice: string;
  historyOnly: boolean;
  verifiedOnly: boolean;
  sort: string;
};

const emptyFilters: Filters = {
  manufacturer: "",
  drugClass: "",
  route: "",
  scientificName: "",
  minPrice: "",
  maxPrice: "",
  historyOnly: false,
  verifiedOnly: false,
  sort: "relevance",
};

const PAGE_SIZE = 60;

function numberOrNull(value: string) {
  const number = Number(value);
  return value.trim() && Number.isFinite(number) ? number : null;
}

function formatPrice(value: number | null, currency = "EGP") {
  return value == null ? null : `${Number(value).toLocaleString()} ${currency}`;
}

function sourceLabel(source: string) {
  if (source === "medicines5") return "Verified dataset";
  if (source === "medicines2") return "Operational catalog";
  if (source === "medicines3") return "EgyptDwa";
  return source;
}

export default function MedicinesEncyclopedia() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  async function load(nextOffset = 0, nextQuery = query, nextFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<Medicine[]>("/rest/v1/rpc/search_medicine_canonical_v1", {
        method: "POST",
        body: JSON.stringify({
          p_query: nextQuery.trim(),
          p_manufacturer: nextFilters.manufacturer || null,
          p_drug_class: nextFilters.drugClass || null,
          p_route: nextFilters.route || null,
          p_scientific_name: nextFilters.scientificName.trim() || null,
          p_min_price: numberOrNull(nextFilters.minPrice),
          p_max_price: numberOrNull(nextFilters.maxPrice),
          p_has_price_history: nextFilters.historyOnly ? true : null,
          p_verified_only: nextFilters.verifiedOnly ? true : null,
          p_sort: nextFilters.sort,
          p_limit: PAGE_SIZE,
          p_offset: nextOffset,
        }),
      });
      setMedicines(rows);
      setOffset(nextOffset);
      setTotal(Number(rows[0]?.total_count || 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load medicines.", "تعذر تحميل الأدوية."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0, "", emptyFilters);
    void Promise.all([
      supabaseFetch<Metrics[]>("/rest/v1/medicine_canonical_metrics_v1?select=*"),
      supabaseFetch<Facet[]>("/rest/v1/medicine_search_facets_v1?select=facet_type,facet_value,product_count&order=facet_type.asc,product_count.desc&limit=5000"),
    ]).then(([metricRows, facetRows]) => {
      setMetrics(metricRows[0] || null);
      setFacets(facetRows);
    }).catch(() => {
      setMetrics(null);
      setFacets([]);
    });
  }, []);

  const manufacturers = useMemo(() => facets.filter((facet) => facet.facet_type === "manufacturer").slice(0, 700), [facets]);
  const drugClasses = useMemo(() => facets.filter((facet) => facet.facet_type === "drug_class").slice(0, 700), [facets]);
  const routes = useMemo(() => facets.filter((facet) => facet.facet_type === "route"), [facets]);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [filters.manufacturer, filters.drugClass, filters.route, filters.scientificName, filters.minPrice, filters.maxPrice]
    .filter(Boolean).length + Number(filters.historyOnly) + Number(filters.verifiedOnly);

  function reset() {
    setQuery("");
    setFilters(emptyFilters);
    void load(0, "", emptyFilters);
  }

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><BookOpen className="h-4 w-4" />{t("Medicine search and collaboration engine", "محرك بحث وتعاون للأدوية")}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{t("One merged medicine record, connected evidence, and visible price history", "سجل دواء موحد وأدلة مترابطة وتاريخ واضح للأسعار")}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("Search a deduplicated Egyptian medicines catalog enriched with verified commercial names, scientific ingredients, manufacturers, therapeutic classes, routes, source evidence, and collaboration workflows.", "ابحث في كتالوج أدوية مصري مدمج دون تكرار، ومُثرى بالأسماء التجارية والعلمية والشركات المصنعة والتصنيفات وطرق الاستخدام والأدلة ومسارات التعاون.")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ValueCard icon={ShieldCheck} title={t("Verified enrichment", "إثراء موثق")} text={t("Medicines5 is preferred for verified product metadata while every raw source remains preserved.", "تُفضّل بيانات medicines5 للبيانات الموثقة مع الحفاظ على كل سجل خام من مصادره.")} />
          <ValueCard icon={History} title={t("Price evidence timeline", "خط زمني للأسعار")} text={t("The highest observed EGP price is the current candidate; all other observations remain visible.", "أعلى سعر مرصود بالجنيه هو السعر الحالي المرشح، وتظل كل الأسعار الأخرى ظاهرة.")} />
          <ValueCard icon={Handshake} title={t("Moderated collaboration", "تعاون خاضع للمراجعة")} text={t("Contribute corrections, price observations, evidence, availability, resources, and support connections.", "ساهم بالتصحيحات والأسعار والأدلة والتوافر والموارد وروابط دعم المرضى.")} />
        </div>
      </div>
    </section>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label={t("Canonical products", "منتجات موحدة")} value={Number(metrics?.canonical_products || 0)} />
      <Metric label={t("Verified dataset products", "منتجات البيانات الموثقة")} value={Number(metrics?.verified_dataset_products || 0)} />
      <Metric label={t("With price history", "لها تاريخ أسعار")} value={Number(metrics?.products_with_price_history || 0)} />
      <Metric label={t("Manufacturers", "الشركات المصنعة")} value={Number(metrics?.manufacturers || 0)} />
      <Metric label={t("Source records merged", "سجلات مصادر مدمجة")} value={Number(metrics?.source_records_merged || 0)} />
    </section>

    <Alert className="mt-5"><AlertDescription>{t("Price rule: the main price is the highest positive EGP observation across connected records, following the requested latest-price assumption. Timeline dates describe source record or import dates and may not be the official effective date of a price change.", "قاعدة السعر: السعر الرئيسي هو أعلى سعر موجب بالجنيه بين السجلات المترابطة وفق افتراض أن الأعلى هو الأحدث. تواريخ الخط الزمني هي تواريخ السجل أو الاستيراد وقد لا تكون تاريخ السريان الرسمي لتغيير السعر.")}</AlertDescription></Alert>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search commercial or scientific name, manufacturer, barcode, class...", "ابحث بالاسم التجاري أو العلمي أو الشركة أو الباركود أو التصنيف...")} onKeyDown={(event) => { if (event.key === "Enter") void load(0); }} /></label>
        <Button onClick={() => void load(0)} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
        <Button variant="outline" onClick={reset} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Reset", "إعادة ضبط")}</Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal className="mr-2 h-4 w-4" />{t("Advanced filters", "فلاتر متقدمة")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Button>
        <div className="text-sm text-muted-foreground">{loading ? t("Searching...", "جاري البحث...") : `${total.toLocaleString()} ${t("matching medicines", "دواء مطابق")}`}</div>
      </div>

      {filtersOpen && <div className="mt-5 grid gap-4 rounded-xl border bg-muted/20 p-4 md:grid-cols-2 xl:grid-cols-4">
        <SelectField label={t("Manufacturer", "الشركة المصنعة")} value={filters.manufacturer} onChange={(value) => setFilters((current) => ({ ...current, manufacturer: value }))} options={manufacturers} emptyLabel={t("All manufacturers", "كل الشركات")} />
        <SelectField label={t("Drug class", "التصنيف الدوائي")} value={filters.drugClass} onChange={(value) => setFilters((current) => ({ ...current, drugClass: value }))} options={drugClasses} emptyLabel={t("All classes", "كل التصنيفات")} />
        <SelectField label={t("Route", "طريقة الاستخدام")} value={filters.route} onChange={(value) => setFilters((current) => ({ ...current, route: value }))} options={routes} emptyLabel={t("All routes", "كل طرق الاستخدام")} />
        <div><Label>{t("Scientific name contains", "الاسم العلمي يحتوي على")}</Label><Input className="mt-1" value={filters.scientificName} onChange={(event) => setFilters((current) => ({ ...current, scientificName: event.target.value }))} /></div>
        <div><Label>{t("Minimum price (EGP)", "أقل سعر (جنيه)")}</Label><Input className="mt-1" inputMode="decimal" value={filters.minPrice} onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))} /></div>
        <div><Label>{t("Maximum price (EGP)", "أعلى سعر (جنيه)")}</Label><Input className="mt-1" inputMode="decimal" value={filters.maxPrice} onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))} /></div>
        <div><Label>{t("Sort", "الترتيب")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}><option value="relevance">{t("Relevance", "الأكثر صلة")}</option><option value="name">{t("Name", "الاسم")}</option><option value="price_high">{t("Highest price", "أعلى سعر")}</option><option value="price_low">{t("Lowest price", "أقل سعر")}</option><option value="history">{t("Most price history", "أكثر تاريخ أسعار")}</option><option value="sources">{t("Most connected sources", "أكثر مصادر مترابطة")}</option></select></div>
        <div className="flex flex-col justify-end gap-3 pb-1"><CheckField label={t("Only products with price history", "فقط المنتجات ذات تاريخ أسعار")} checked={filters.historyOnly} onChange={(checked) => setFilters((current) => ({ ...current, historyOnly: checked }))} /><CheckField label={t("Only medicines5-verified products", "فقط المنتجات الموثقة في medicines5")} checked={filters.verifiedOnly} onChange={(checked) => setFilters((current) => ({ ...current, verifiedOnly: checked }))} /></div>
        <div className="md:col-span-2 xl:col-span-4"><Button onClick={() => void load(0)} disabled={loading}>{t("Apply filters", "تطبيق الفلاتر")}</Button></div>
      </div>}

      {error && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {medicines.map((medicine) => {
        const title = language === "ar" ? (medicine.name_ar || medicine.name_en || `#${medicine.canonical_id}`) : (medicine.name_en || medicine.name_ar || `#${medicine.canonical_id}`);
        const subtitle = language === "ar" ? medicine.name_en : medicine.name_ar;
        const currentPrice = formatPrice(medicine.current_price_egp, medicine.price_currency || "EGP");
        const range = medicine.min_price_egp != null && medicine.max_price_egp != null && medicine.min_price_egp !== medicine.max_price_egp
          ? `${Number(medicine.min_price_egp).toLocaleString()}–${Number(medicine.max_price_egp).toLocaleString()} EGP`
          : null;
        return <a key={medicine.canonical_id} href={`/catalog/${medicine.canonical_id}`} className="block transition hover:-translate-y-0.5 hover:shadow-md"><Card className="h-full overflow-hidden shadow-sm">
          {medicine.image_url && <img src={medicine.image_url} alt={title} className="h-40 w-full bg-muted/30 object-contain p-3" loading="lazy" />}
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg leading-7">{title}</CardTitle>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>{medicine.has_verified_dataset && <Badge className="gap-1"><ShieldCheck className="h-3 w-3" />{t("Verified", "موثق")}</Badge>}</div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">{currentPrice && <Badge>{currentPrice}</Badge>}{medicine.has_price_history && <Badge variant="secondary"><History className="mr-1 h-3 w-3" />{medicine.distinct_price_count} {t("prices", "أسعار")}</Badge>}{medicine.route && <Badge variant="outline">{medicine.route}</Badge>}</div>
            {range && <Info label={t("Observed price range", "نطاق الأسعار المرصودة")} value={range} />}
            <Info label={t("Scientific name", "الاسم العلمي")} value={medicine.scientific_name} />
            <Info label={t("Manufacturer", "الشركة المصنعة")} value={medicine.manufacturer} />
            <Info label={t("Drug class", "التصنيف الدوائي")} value={medicine.drug_class || medicine.category} />
            <div className="flex flex-wrap gap-2">{medicine.source_systems.map((source) => <Badge key={source} variant="outline">{sourceLabel(source)}</Badge>)}</div>
            <span className="inline-flex font-semibold text-primary">{t("Open merged product and price timeline →", "فتح المنتج الموحد والخط الزمني للأسعار ←")}</span>
          </CardContent>
        </Card></a>;
      })}
      {!loading && medicines.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{t("No medicines match the selected search and filters.", "لا توجد أدوية تطابق البحث والفلاتر المحددة.")}</CardContent></Card>}
    </section>

    {total > PAGE_SIZE && <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div className="text-sm text-muted-foreground">{t("Page", "صفحة")} {page.toLocaleString()} / {pages.toLocaleString()}</div><div className="flex gap-2"><Button variant="outline" disabled={loading || offset === 0} onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}>{t("Previous", "السابق")}</Button><Button variant="outline" disabled={loading || offset + PAGE_SIZE >= total} onClick={() => void load(offset + PAGE_SIZE)}>{t("Next", "التالي")}</Button></div></section>}

    <section className="mt-10 rounded-3xl border bg-muted/30 p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Collaboration layer", "طبقة التعاون")}</p><h2 className="mt-2 text-3xl font-bold">{t("Improve medicine knowledge with attributable, reviewed contributions", "طوّر معرفة الأدوية بمساهمات منسوبة وخاضعة للمراجعة")}</h2><p className="mt-3 max-w-3xl text-muted-foreground">{t("Open any product to submit a correction, a new price observation, availability evidence, product documentation, an educational resource, or a patient-support connection. Approved contributions remain distinct from verified source records.", "افتح أي منتج لإرسال تصحيح أو سعر جديد أو دليل توافر أو مستندات منتج أو مورد تعليمي أو رابط لدعم المرضى. تظل المساهمات المعتمدة منفصلة عن سجلات المصادر الموثقة.")}</p></div><div className="flex flex-col gap-2 sm:flex-row lg:flex-col"><a href="/companies" className="rounded-lg border bg-background px-5 py-3 text-center text-sm font-semibold"><Building2 className="mr-2 inline h-4 w-4" />{t("Explore companies", "استكشف الشركات")}</a><a href="/industry/opportunities" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground"><Handshake className="mr-2 inline h-4 w-4" />{t("Healthcare opportunities", "فرص الرعاية الصحية")}</a></div></div>
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) {
  return <Card className="border-primary/15"><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div><div className="font-semibold">{title}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></CardContent></Card>;
}

function SelectField({ label, value, onChange, options, emptyLabel }: { label: string; value: string; onChange: (value: string) => void; options: Facet[]; emptyLabel: string }) {
  return <div><Label>{label}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.facet_value} value={option.facet_value}>{option.facet_value} ({Number(option.product_count).toLocaleString()})</option>)}</select></div>;
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
