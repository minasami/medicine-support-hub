import { useEffect, useMemo, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

 type Company = {
  id: string;
  company_name: string;
  company_slug: string;
  origin: string | null;
  product_count: number;
  active_product_count: number;
  archived_product_count: number;
  prescription_product_count: number;
  disease_area_count: number;
  generic_count: number;
  min_price: number | null;
  max_price: number | null;
};

function enc(value: string) { return encodeURIComponent(`*${value.trim()}*`); }

export default function CompanyProfiles() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);

  const totalProducts = useMemo(() => companies.reduce((sum, row) => sum + Number(row.product_count || 0), 0), [companies]);

  async function load() {
    setLoading(true);
    try {
      const select = "id,company_name,company_slug,origin,product_count,active_product_count,archived_product_count,prescription_product_count,disease_area_count,generic_count,min_price,max_price";
      const path = query.trim()
        ? `/rest/v1/medicine_company_profiles?select=${select}&company_name=ilike.${enc(query)}&order=product_count.desc&limit=80`
        : `/rest/v1/medicine_company_profiles?select=${select}&order=product_count.desc&limit=80`;
      const rows = await supabaseFetch<Company[]>(path);
      setCompanies(rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Building2 className="h-4 w-4" />{t("Company profiles", "ملفات الشركات")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Medicine company intelligence", "معلومات شركات الأدوية")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Company profiles are generated from the user-verified medicine CSV and summarize product count, active products, archived lower-price duplicates, prescription coverage, disease areas, generics, and observed source-market price ranges.", "ملفات الشركات مولدة من ملف CSV الموثق وتلخص عدد المنتجات والمنتجات النشطة والأسعار الأقل المؤرشفة وتغطية الروشتة والمجالات المرضية والمواد ونطاق الأسعار المرصود في سوق المصدر.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Metric label={t("Loaded companies", "الشركات المعروضة")} value={companies.length} />
      <Metric label={t("Represented products", "المنتجات الممثلة")} value={totalProducts} />
      <Metric label={t("Source", "المصدر")} value={t("User-verified CSV", "CSV موثق")} />
    </section>

    <div className="mt-6"><ConnectedNextActions contextType="module" contextKey="companies" /></div>

    <section className="mt-6 flex flex-wrap gap-2">
      <a href="/generics" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse generics", "تصفح المواد الفعالة")}</a>
      <a href="/diseases" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Browse disease areas", "تصفح المجالات المرضية")}</a>
      <a href="/verified-products" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Open verified products", "فتح المنتجات الموثقة")}</a>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search company...", "ابحث عن شركة...")} />
        <Button onClick={() => void load()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
        <Button variant="outline" onClick={() => { setQuery(""); void load(); }}><RefreshCw className="mr-2 h-4 w-4" />{t("Reset", "إعادة ضبط")}</Button>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {companies.map(company => <Card key={company.id} className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg leading-7">{company.company_name}</CardTitle>
          {company.origin && <p className="text-sm text-muted-foreground">{company.origin.replace(/^\*\s*Country of Origin:\s*/i, "")}</p>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{company.active_product_count.toLocaleString()} {t("active", "نشط")}</Badge>
            {company.archived_product_count > 0 && <Badge variant="secondary">{company.archived_product_count.toLocaleString()} {t("archived", "مؤرشف")}</Badge>}
            <Badge variant="outline">{company.generic_count.toLocaleString()} {t("generics", "مواد")}</Badge>
          </div>
          <Info label={t("Products", "المنتجات")} value={company.product_count.toLocaleString()} />
          <Info label={t("Prescription products", "منتجات بروشتة")} value={company.prescription_product_count.toLocaleString()} />
          <Info label={t("Disease areas", "المجالات المرضية")} value={company.disease_area_count.toLocaleString()} />
          <Info label={t("Observed price range", "نطاق السعر المرصود")} value={`${company.min_price ?? "—"} - ${company.max_price ?? "—"}`} />
          <a href={`/companies/${encodeURIComponent(company.company_slug)}`} className="inline-flex font-semibold text-primary">{t("Open canonical profile", "فتح الملف الأساسي")}</a>
        </CardContent>
      </Card>)}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
