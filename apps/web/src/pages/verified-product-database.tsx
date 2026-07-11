import { useEffect, useMemo, useState } from "react";
import { Database, ExternalLink, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { seoEntityPath, seoEntitySlug } from "@/lib/seo-entities";

type Product = {
  id: string;
  product_name: string;
  product_url: string | null;
  disease_name: string | null;
  final_price: number | null;
  price_currency: string;
  prescription_required: string | null;
  drug_variant: string | null;
  company_name: string | null;
  company_slug: string | null;
  generic_name: string | null;
  duplicate_status: string;
  archived_reason: string | null;
  active_price_kept: number | null;
};

type Facet = { facet_type: string; facet_value: string; records: number };

function enc(value: string) { return encodeURIComponent(`*${value.trim()}*`); }
function exact(value: string) { return encodeURIComponent(value); }

export default function VerifiedProductDatabase() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const initialParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [query, setQuery] = useState(initialParams.get("query") || "");
  const [company, setCompany] = useState("");
  const [companySlug, setCompanySlug] = useState(initialParams.get("company") || "");
  const [disease, setDisease] = useState("");
  const [generic, setGeneric] = useState("");
  const [prescription, setPrescription] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [loading, setLoading] = useState(false);

  const byType = useMemo(() => {
    const map = new Map<string, Facet[]>();
    for (const facet of facets) map.set(facet.facet_type, [...(map.get(facet.facet_type) || []), facet]);
    return map;
  }, [facets]);

  async function loadFacets() {
    const rows = await supabaseFetch<Facet[]>("/rest/v1/verified_medicine_product_filter_facets?select=facet_type,facet_value,records&order=records.desc&limit=120");
    setFacets(rows);
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const select = "id,product_name,product_url,disease_name,final_price,price_currency,prescription_required,drug_variant,company_name,company_slug,generic_name,duplicate_status,archived_reason,active_price_kept";
      const parts = [`select=${select}`, "duplicate_status=eq.active", "order=final_price.desc", "limit=80"];
      if (query.trim()) parts.push(`or=(product_name.ilike.${enc(query)},generic_name.ilike.${enc(query)},company_name.ilike.${enc(query)},disease_name.ilike.${enc(query)})`);
      if (companySlug) parts.push(`company_slug=eq.${exact(companySlug)}`);
      if (company) parts.push(`company_name=eq.${exact(company)}`);
      if (disease) parts.push(`disease_name=eq.${exact(disease)}`);
      if (generic) parts.push(`generic_name=eq.${exact(generic)}`);
      if (prescription) parts.push(`prescription_required=eq.${exact(prescription)}`);
      if (minPrice) parts.push(`final_price=gte.${encodeURIComponent(minPrice)}`);
      if (maxPrice) parts.push(`final_price=lte.${encodeURIComponent(maxPrice)}`);
      const rows = await supabaseFetch<Product[]>(`/rest/v1/verified_medicine_source_products?${parts.join("&")}`);
      setProducts(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadFacets(); void loadProducts(); }, []);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Database className="h-4 w-4" />{t("Verified CSV database", "قاعدة CSV موثقة")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Source-backed product encyclopedia", "موسوعة منتجات مدعومة بالمصدر")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Search and filter the user-verified medicine CSV by product, generic, company, disease area, prescription status, and observed source-market price. Lower-price duplicates are archived so active results keep the highest verified price for the same specification.", "ابحث وفلتر ملف CSV الموثق حسب المنتج والمادة والشركة والمجال المرضي وحالة الروشتة والسعر المرصود في سوق المصدر. يتم أرشفة الأسعار الأقل لنفس المواصفة حتى تعرض النتائج النشطة أعلى سعر موثق.")}</p>
    </section>

    <div className="mt-6"><ConnectedNextActions contextType="module" contextKey="verified-products" /></div>

    <section className="mt-6 flex flex-wrap gap-2">
      <a href="/companies" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Company profiles", "ملفات الشركات")}</a>
      <a href="/generics" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Generic directory", "دليل المواد الفعالة")}</a>
      <a href="/diseases" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Disease-area directory", "دليل المجالات المرضية")}</a>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Product, generic, company, disease...", "منتج، مادة، شركة، مرض...")} />
        <Input value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder={t("Min price", "أقل سعر")} />
        <Input value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder={t("Max price", "أعلى سعر")} />
        <Button onClick={() => void loadProducts()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
      </div>
      {companySlug && <div className="mt-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{t("Filtered by company profile", "تمت الفلترة حسب ملف الشركة")}: {companySlug}</div>}
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SelectFacet label={t("Company", "الشركة")} value={company} onChange={(value) => { setCompanySlug(""); setCompany(value); }} rows={byType.get("company") || []} />
        <SelectFacet label={t("Disease", "المجال المرضي")} value={disease} onChange={setDisease} rows={byType.get("disease") || []} />
        <SelectFacet label={t("Generic", "المادة")} value={generic} onChange={setGeneric} rows={byType.get("generic") || []} />
        <SelectFacet label={t("Prescription", "الروشتة")} value={prescription} onChange={setPrescription} rows={byType.get("prescription") || []} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => { setQuery(""); setCompany(""); setCompanySlug(""); setDisease(""); setGeneric(""); setPrescription(""); setMinPrice(""); setMaxPrice(""); void loadProducts(); }}><RefreshCw className="mr-2 h-4 w-4" />{t("Reset", "إعادة ضبط")}</Button>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {products.map(product => <Card key={product.id} className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg leading-7">{product.product_name}</CardTitle>
          {product.generic_name ? <a href={seoEntityPath("generic", seoEntitySlug(product.generic_name))} className="text-sm font-medium text-primary hover:underline">{product.generic_name}</a> : <p className="text-sm text-muted-foreground">—</p>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {product.disease_name && <a href={seoEntityPath("disease", seoEntitySlug(product.disease_name))}><Badge>{product.disease_name}</Badge></a>}
            {product.prescription_required && <Badge variant="outline">{product.prescription_required}</Badge>}
            <Badge variant="secondary">{product.final_price ? `${product.final_price.toLocaleString()} ${product.price_currency}` : t("No price", "لا يوجد سعر")}</Badge>
          </div>
          <Info label={t("Company", "الشركة")} value={product.company_name || ""} />
          <Info label={t("Variant", "المواصفة")} value={product.drug_variant || ""} />
          <Info label={t("Status", "الحالة")} value={product.duplicate_status} />
          <div className="flex flex-wrap gap-3">
            {product.company_slug && <a href={seoEntityPath("company", product.company_slug)} className="inline-flex items-center font-semibold text-primary">{t("Company profile", "ملف الشركة")}</a>}
            {product.product_url && <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center font-semibold text-primary">{t("Source listing", "قائمة المصدر")}<ExternalLink className="ml-1 h-4 w-4" /></a>}
          </div>
        </CardContent>
      </Card>)}
      {!loading && products.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No active products found.", "لا توجد منتجات نشطة مطابقة.")}</CardContent></Card>}
    </section>

    <section className="mt-8 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">{t("Source-market records do not establish Egyptian registration, local availability, indication, clinical suitability, or Egyptian price.", "سجلات سوق المصدر لا تثبت التسجيل أو التوافر أو دواعي الاستعمال أو الملاءمة العلاجية أو السعر داخل مصر.")}</section>
  </main>;
}

function SelectFacet({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: Facet[] }) {
  return <label className="text-sm"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">All</option>{rows.slice(0, 30).map(row => <option key={`${row.facet_type}-${row.facet_value}`} value={row.facet_value}>{row.facet_value} ({row.records})</option>)}</select></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
