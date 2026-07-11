import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Network, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { cleanCompanyOrigin, fetchSeoEntityDirectory, seoEntityPath, type SeoEntity } from "@/lib/seo-entities";

function humanize(value: string | null | undefined) {
  return String(value || "Healthcare company").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CompanyProfiles() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<SeoEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const directory = await fetchSeoEntityDirectory();
      setCompanies(directory.entities.filter((entity) => entity.type === "company"));
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
    return companies.filter((company) => [company.name, company.companyType, company.description, company.origin, company.country, company.city, ...(company.therapeuticAreas || []), ...(company.productCategories || [])].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized));
  }, [companies, query]);

  const totals = useMemo(() => ({
    products: companies.reduce((sum, company) => sum + Number(company.activeRecords ?? company.records ?? 0), 0),
    official: companies.filter((company) => company.official).length,
  }), [companies]);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Network className="h-4 w-4" />{t("Connected healthcare company network", "شبكة شركات الرعاية الصحية المترابطة")}</p>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("Company profiles, products, capabilities, and contributions", "ملفات الشركات والمنتجات والقدرات والمساهمات")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("Explore source-backed pharmaceutical intelligence alongside verified official profiles from pharmaceutical, medical-product, device, diagnostics, biotech, supplier, distributor, and healthcare companies.", "استكشف معلومات شركات الأدوية المدعومة بالمصادر إلى جانب الملفات الرسمية الموثقة لشركات الأدوية والمنتجات والأجهزة الطبية والتشخيص والتكنولوجيا الحيوية والموردين والموزعين وشركات الرعاية الصحية.")}</p></div>
        <a href="/industry" className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><Building2 className="mr-2 h-4 w-4" />{t("Create or claim a profile", "إنشاء أو المطالبة بملف")}</a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Metric label={t("Connected companies", "الشركات المترابطة")} value={companies.length} />
      <Metric label={t("Official verified profiles", "الملفات الرسمية الموثقة")} value={totals.official} />
      <Metric label={t("Active source products", "منتجات المصدر النشطة")} value={totals.products} />
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
        <label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search company, therapy, category, or capability...", "ابحث عن شركة أو مجال علاجي أو فئة أو قدرة...")} /></label>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh", "تحديث")}</Button>
        <Button variant="outline" onClick={() => setQuery("")}>{t("Reset", "إعادة ضبط")}</Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{filtered.length.toLocaleString()} {t("company profiles", "ملف شركة")}</p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((company) => <Card key={company.slug} className={`shadow-sm ${company.official ? "border-primary/30" : ""}`}>
        <CardHeader>
          <div className="flex items-start gap-3">{company.logoUrl && <img src={company.logoUrl} alt="" className="h-12 w-12 rounded-lg border bg-background object-contain p-1" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg leading-7">{company.name}</CardTitle>{company.official && <Badge className="gap-1"><BadgeCheck className="h-3 w-3" />{t("Official", "رسمي")}</Badge>}</div><p className="text-sm text-muted-foreground">{company.official ? humanize(company.companyType) : cleanCompanyOrigin(company.origin)}</p></div></div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {company.description && <p className="line-clamp-3 leading-6 text-muted-foreground">{company.description}</p>}
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{Number(company.activeRecords ?? company.records).toLocaleString()} {t("source products", "منتج مصدر")}</Badge>{Number(company.genericCount || 0) > 0 && <Badge variant="outline">{Number(company.genericCount).toLocaleString()} {t("generics", "مادة")}</Badge>}{Number(company.diseaseCount || 0) > 0 && <Badge variant="outline">{Number(company.diseaseCount).toLocaleString()} {t("disease areas", "مجال مرضي")}</Badge>}</div>
          {company.therapeuticAreas && company.therapeuticAreas.length > 0 && <Info label={t("Therapeutic areas", "المجالات العلاجية")} value={company.therapeuticAreas.slice(0, 4).join(", ")} />}
          {company.capabilities && company.capabilities.length > 0 && <Info label={t("Capabilities", "القدرات")} value={company.capabilities.slice(0, 4).join(", ")} />}
          {company.minPrice != null && company.maxPrice != null && <Info label={t("Observed source price range", "نطاق سعر المصدر المرصود")} value={`${company.minPrice}–${company.maxPrice}`} />}
          <a href={seoEntityPath("company", company.slug)} className="inline-flex font-semibold text-primary">{t("Open connected profile", "فتح الملف المترابط")}</a>
        </CardContent>
      </Card>)}
      {!loading && filtered.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No companies match this search.", "لا توجد شركات مطابقة للبحث.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
