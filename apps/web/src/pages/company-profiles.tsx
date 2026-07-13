import { useEffect, useState } from "react";
import { BadgeCheck, Building2, Database, Loader2, Network, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { cleanCompanyOrigin, seoEntityPath } from "@/lib/seo-entities";

interface CompanyRow {
  id: string;
  company_name: string;
  company_slug: string;
  origin: string | null;
  source_name: string;
  source_currency: string;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
  therapeutic_areas: string[] | null;
  leading_generics: string[] | null;
  portfolio_sample: string[] | null;
  dataset_metadata: Record<string, unknown> | null;
  latest_source_update: string | null;
  official_display_name: string | null;
  official_company_type: string | null;
  official_description: string | null;
  official_logo_url: string | null;
  official_country: string | null;
  official_city: string | null;
  official_therapeutic_areas: string[] | null;
  official_product_categories: string[] | null;
  official_capabilities: string[] | null;
  official_verified: boolean;
  total_count: number;
}

const PAGE_SIZE = 60;
const values = (value: string[] | null | undefined) => Array.isArray(value) ? value.filter(Boolean) : [];
const humanize = (value: string | null | undefined) => String(value || "Healthcare company").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CompanyProfiles() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(search = appliedQuery, offset = 0, append = false) {
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<CompanyRow[]>("/rest/v1/rpc/company_profile_directory_page", {
        method: "POST",
        body: JSON.stringify({ p_query: search.trim() || null, p_limit: PAGE_SIZE, p_offset: offset }),
      });
      const safeRows = Array.isArray(rows) ? rows : [];
      setCompanies((current) => append ? [...current, ...safeRows] : safeRows);
      setTotal(Number(safeRows[0]?.total_count || (append ? offset + safeRows.length : safeRows.length)));
      setAppliedQuery(search.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load company profiles.", "تعذر تحميل ملفات الشركات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load("", 0, false); }, []);

  const officialCount = companies.filter((company) => company.official_verified).length;
  const visibleProducts = companies.reduce((sum, company) => sum + Number(company.active_product_count || 0), 0);
  const visibleGenerics = companies.reduce((sum, company) => sum + Number(company.generic_count || 0), 0);

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Network className="h-4 w-4" />{t("Connected healthcare company network", "شبكة شركات الرعاية الصحية المترابطة")}</p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("Company profiles and canonical medicine portfolios", "ملفات الشركات ومحافظ الأدوية الموحدة")}</h1><p className="mt-3 max-w-4xl text-muted-foreground">{t("Explore manufacturer profiles generated from the live medicine encyclopedia, with direct links between every listed manufacturer, its company profile, and its canonical medicine pages. Official company statements remain separately verified and attributed.", "استكشف ملفات الشركات المصنعة المولدة من موسوعة الأدوية الحية، مع روابط مباشرة بين كل شركة وملفها وصفحات أدويتها الموحدة. تظل بيانات الشركات الرسمية موثقة ومنسوبة بشكل منفصل.")}</p></div>
        <a href="/industry" className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><Building2 className="mr-2 h-4 w-4" />{t("Create or claim a profile", "إنشاء أو المطالبة بملف")}</a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={t("Matching company profiles", "ملفات الشركات المطابقة")} value={total} />
      <Metric label={t("Official profiles in this page", "الملفات الرسمية في هذه الصفحة")} value={officialCount} />
      <Metric label={t("Visible portfolio medicines", "أدوية المحافظ الظاهرة")} value={visibleProducts} />
      <Metric label={t("Visible company-generic links", "روابط الشركات بالمواد الفعالة الظاهرة")} value={visibleGenerics} />
    </section>

    <div className="mt-6"><ConnectedNextActions contextType="module" contextKey="companies" /></div>

    <section className="mt-6 flex flex-wrap gap-2">
      <a href="/industry" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">{t("Industry contribution network", "شبكة مساهمات الشركات")}</a>
      <a href="/generics" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse generics", "تصفح المواد الفعالة")}</a>
      <a href="/diseases" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse disease areas", "تصفح المجالات المرضية")}</a>
      <a href="/medicines" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Open medicine encyclopedia", "فتح موسوعة الأدوية")}</a>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" onSubmit={(event) => { event.preventDefault(); void load(query, 0, false); }}>
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search company, medicine, generic, therapy, origin, or capability...", "ابحث عن شركة أو دواء أو مادة فعالة أو مجال علاجي أو منشأ أو قدرة...")} /></label>
        <Button type="submit" disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
        <Button type="button" variant="outline" onClick={() => { setQuery(""); void load("", 0, false); }} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Reset", "إعادة ضبط")}</Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">{total.toLocaleString()} {t("company profiles match", "ملف شركة مطابق")}{appliedQuery ? ` · ${t("Search", "البحث")}: ${appliedQuery}` : ""}</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {companies.map((company) => {
        const imported = company.dataset_metadata?.portfolioImported === true;
        return <Card key={company.company_slug} className={`shadow-sm ${company.official_verified ? "border-primary/30" : ""}`}>
          <CardHeader><div className="flex items-start gap-3">{company.official_logo_url && <img src={company.official_logo_url} alt="" className="h-12 w-12 rounded-lg border bg-background object-contain p-1" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg leading-7">{company.official_display_name || company.company_name}</CardTitle>{company.official_verified && <Badge className="gap-1"><BadgeCheck className="h-3 w-3" />{t("Official", "رسمي")}</Badge>}</div><p className="text-sm text-muted-foreground">{company.official_verified ? humanize(company.official_company_type) : cleanCompanyOrigin(company.origin) || t("Encyclopedia-derived manufacturer", "شركة مصنعة مشتقة من الموسوعة")}</p></div></div></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {company.official_description && <p className="line-clamp-3 leading-6 text-muted-foreground">{company.official_description}</p>}
            <div className="flex flex-wrap gap-2"><Badge variant="secondary">{Number(company.active_product_count).toLocaleString()} {t("medicines", "دواء")}</Badge><Badge variant="outline">{company.generic_count.toLocaleString()} {t("generics", "مادة فعالة")}</Badge><Badge variant="outline">{company.disease_area_count.toLocaleString()} {t("therapy categories", "فئة علاجية")}</Badge></div>
            {values(company.therapeutic_areas).length > 0 && <Info label={t("Leading therapeutic categories", "أبرز الفئات العلاجية")} value={values(company.therapeutic_areas).slice(0, 5).join(", ")} />}
            {values(company.leading_generics).length > 0 && <Info label={t("Leading generics", "أبرز المواد الفعالة")} value={values(company.leading_generics).slice(0, 4).join(", ")} />}
            {values(company.portfolio_sample).length > 0 && <Info label={t("Portfolio sample", "عينة من المحفظة")} value={values(company.portfolio_sample).slice(0, 4).join(", ")} />}
            {company.min_price != null && company.max_price != null && <Info label={t("Observed source price range", "نطاق سعر المصدر المرصود")} value={`${Number(company.min_price).toLocaleString()}–${Number(company.max_price).toLocaleString()} ${company.source_currency}`} />}
            <div className="flex flex-wrap items-center gap-2 pt-1"><a href={seoEntityPath("company", company.company_slug)} className="inline-flex font-semibold text-primary">{t("Open company and medicine portfolio", "فتح الشركة ومحفظة الأدوية")}</a>{imported && <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />{t("Canonical portfolio", "محفظة موحدة")}</Badge>}</div>
          </CardContent>
        </Card>;
      })}
      {!loading && companies.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No companies match this search.", "لا توجد شركات مطابقة للبحث.")}</CardContent></Card>}
    </section>

    {companies.length < total && <div className="mt-6 flex justify-center"><Button variant="outline" disabled={loading} onClick={() => void load(appliedQuery, companies.length, true)}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("Load more companies", "تحميل المزيد من الشركات")}</Button></div>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>; }
