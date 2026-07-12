import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Database, Network, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { cleanCompanyOrigin, seoEntityPath } from "@/lib/seo-entities";

type DatasetCompany = {
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
};

type OfficialCompany = {
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  therapeutic_areas: string[] | null;
  product_categories: string[] | null;
  capabilities: string[] | null;
  verification_status: string;
};

function values(value: string[] | null | undefined) { return Array.isArray(value) ? value.filter(Boolean) : []; }
function humanize(value: string | null | undefined) { return String(value || "Healthcare company").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function CompanyProfiles() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<DatasetCompany[]>([]);
  const [official, setOfficial] = useState<Record<string, OfficialCompany>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const companySelect = "id,company_name,company_slug,origin,source_name,source_currency,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price,therapeutic_areas,leading_generics,portfolio_sample,dataset_metadata,latest_source_update";
      const officialSelect = "company_slug,display_name,company_type,description,logo_url,country,city,therapeutic_areas,product_categories,capabilities,verification_status";
      const [datasetRows, officialRows] = await Promise.all([
        supabaseFetch<DatasetCompany[]>(`/rest/v1/medicine_company_profiles?select=${companySelect}&order=active_product_count.desc,company_name.asc&limit=1000`),
        supabaseFetch<OfficialCompany[]>(`/rest/v1/industry_company_profiles?select=${officialSelect}&verification_status=eq.verified&is_public=eq.true&limit=1000`),
      ]);
      setCompanies(Array.isArray(datasetRows) ? datasetRows : []);
      setOfficial(Object.fromEntries((Array.isArray(officialRows) ? officialRows : []).map((profile) => [profile.company_slug, profile])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load company profiles.", "تعذر تحميل ملفات الشركات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return companies;
    return companies.filter((company) => {
      const profile = official[company.company_slug];
      return [
        company.company_name, company.origin, profile?.display_name, profile?.company_type,
        profile?.description, profile?.country, profile?.city,
        ...values(company.therapeutic_areas), ...values(company.leading_generics), ...values(company.portfolio_sample),
        ...values(profile?.therapeutic_areas), ...values(profile?.product_categories), ...values(profile?.capabilities),
      ].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized);
    });
  }, [companies, official, query]);

  const totals = useMemo(() => ({
    products: companies.reduce((sum, company) => sum + Number(company.active_product_count || 0), 0),
    official: companies.filter((company) => Boolean(official[company.company_slug])).length,
    generics: companies.reduce((sum, company) => sum + Number(company.generic_count || 0), 0),
  }), [companies, official]);

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Network className="h-4 w-4" />{t("Connected healthcare company network", "شبكة شركات الرعاية الصحية المترابطة")}</p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("Company profiles and medicine portfolios", "ملفات الشركات ومحافظ الأدوية")}</h1><p className="mt-3 max-w-4xl text-muted-foreground">{t("Explore company-level intelligence derived from the verified medicines dataset: portfolio size, active and archived source records, therapeutic areas, leading generics, prescription signals, observed source-market price ranges, and separately verified official company information.", "استكشف معلومات الشركات المشتقة من قاعدة الأدوية الموثقة: حجم المحفظة والسجلات النشطة والمؤرشفة والمجالات العلاجية والمواد الفعالة وإشارات الوصفات ونطاقات أسعار سوق المصدر، مع فصل المعلومات الرسمية الموثقة للشركات.")}</p></div>
        <a href="/industry" className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><Building2 className="mr-2 h-4 w-4" />{t("Create or claim a profile", "إنشاء أو المطالبة بملف")}</a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={t("Dataset companies", "شركات قاعدة البيانات")} value={companies.length} />
      <Metric label={t("Official verified profiles", "الملفات الرسمية الموثقة")} value={totals.official} />
      <Metric label={t("Active portfolio records", "سجلات المحفظة النشطة")} value={totals.products} />
      <Metric label={t("Company-generic connections", "روابط الشركات بالمواد الفعالة")} value={totals.generics} />
    </section>

    <div className="mt-6"><ConnectedNextActions contextType="module" contextKey="companies" /></div>

    <section className="mt-6 flex flex-wrap gap-2">
      <a href="/industry" className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">{t("Industry contribution network", "شبكة مساهمات الشركات")}</a>
      <a href="/generics" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse generics", "تصفح المواد الفعالة")}</a>
      <a href="/diseases" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse disease areas", "تصفح المجالات المرضية")}</a>
      <a href="/verified-products" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Open verified products", "فتح المنتجات الموثقة")}</a>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search company, product, generic, therapy, or capability...", "ابحث عن شركة أو منتج أو مادة فعالة أو مجال علاجي أو قدرة...")} /></label>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh", "تحديث")}</Button>
        <Button variant="outline" onClick={() => setQuery("")}>{t("Reset", "إعادة ضبط")}</Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{filtered.length.toLocaleString()} {t("company profiles", "ملف شركة")}</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((company) => {
        const profile = official[company.company_slug];
        const imported = company.dataset_metadata?.portfolioImported === true;
        return <Card key={company.company_slug} className={`shadow-sm ${profile ? "border-primary/30" : ""}`}>
          <CardHeader>
            <div className="flex items-start gap-3">{profile?.logo_url && <img src={profile.logo_url} alt="" className="h-12 w-12 rounded-lg border bg-background object-contain p-1" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg leading-7">{profile?.display_name || company.company_name}</CardTitle>{profile && <Badge className="gap-1"><BadgeCheck className="h-3 w-3" />{t("Official", "رسمي")}</Badge>}</div><p className="text-sm text-muted-foreground">{profile ? humanize(profile.company_type) : cleanCompanyOrigin(company.origin) || t("Dataset-derived company", "شركة مشتقة من قاعدة البيانات")}</p></div></div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {profile?.description && <p className="line-clamp-3 leading-6 text-muted-foreground">{profile.description}</p>}
            <div className="flex flex-wrap gap-2"><Badge variant="secondary">{Number(company.active_product_count).toLocaleString()} {t("active products", "منتج نشط")}</Badge>{company.archived_product_count > 0 && <Badge variant="outline">{company.archived_product_count.toLocaleString()} {t("archived observations", "ملاحظة مؤرشفة")}</Badge>}<Badge variant="outline">{company.generic_count.toLocaleString()} {t("generics", "مادة فعالة")}</Badge><Badge variant="outline">{company.disease_area_count.toLocaleString()} {t("therapy areas", "مجال علاجي")}</Badge></div>
            {values(company.therapeutic_areas).length > 0 && <Info label={t("Leading therapeutic areas", "أبرز المجالات العلاجية")} value={values(company.therapeutic_areas).slice(0, 5).join(", ")} />}
            {values(company.leading_generics).length > 0 && <Info label={t("Leading generics", "أبرز المواد الفعالة")} value={values(company.leading_generics).slice(0, 4).join(", ")} />}
            {values(company.portfolio_sample).length > 0 && <Info label={t("Portfolio sample", "عينة من المحفظة")} value={values(company.portfolio_sample).slice(0, 4).join(", ")} />}
            {company.min_price != null && company.max_price != null && <Info label={t("Observed source price range", "نطاق سعر المصدر المرصود")} value={`${Number(company.min_price).toLocaleString()}–${Number(company.max_price).toLocaleString()} ${company.source_currency}`} />}
            <div className="flex flex-wrap items-center gap-2 pt-1"><a href={seoEntityPath("company", company.company_slug)} className="inline-flex font-semibold text-primary">{t("Open company and portfolio", "فتح الشركة والمحفظة")}</a>{imported ? <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />{t("Portfolio loaded", "المحفظة محملة")}</Badge> : <Badge variant="outline">{t("Portfolio summary", "ملخص المحفظة")}</Badge>}</div>
          </CardContent>
        </Card>;
      })}
      {!loading && filtered.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No companies match this search.", "لا توجد شركات مطابقة للبحث.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>; }
