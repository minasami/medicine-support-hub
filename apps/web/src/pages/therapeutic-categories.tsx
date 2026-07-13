import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Search } from "lucide-react";
import { useRoute } from "wouter";
import { PublicKnowledgePanel } from "@/components/public-knowledge-panel";
import { ShareContributeActions } from "@/components/share-contribute-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { seoEntitySlug } from "@/lib/seo-entities";

type Facet = { facet_value: string; product_count: number };

export default function TherapeuticCategories() {
  const [detailRoute, params] = useRoute("/therapeutic-categories/:slug");
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [facets, setFacets] = useState<Facet[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestedName = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("name")?.trim() || "";

  useEffect(() => {
    supabaseFetch<Facet[]>("/rest/v1/medicine_encyclopedia_facets_v4?select=facet_value,product_count&facet_type=eq.drug_class&order=product_count.desc&limit=5000")
      .then(setFacets)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load therapeutic categories."));
  }, []);

  const selected = detailRoute ? facets.find((item) => seoEntitySlug(item.facet_value) === params?.slug) || (requestedName ? { facet_value: requestedName, product_count: 0 } : null) : null;
  const filtered = useMemo(() => { const normalized = query.trim().toLocaleLowerCase(); return normalized ? facets.filter((item) => item.facet_value.toLocaleLowerCase().includes(normalized)) : facets; }, [facets, query]);

  if (detailRoute) return <main className="container mx-auto max-w-6xl px-4 py-8">
    <a href="/therapeutic-categories" className="inline-flex items-center text-sm font-semibold text-primary"><ArrowLeft className="mr-2 h-4 w-4" />{t("Back to therapeutic categories", "العودة إلى الفئات العلاجية")}</a>
    {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
    {selected && <><section className="mt-6 rounded-2xl border bg-card p-6 shadow-sm"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><Activity className="h-4 w-4" />{t("Therapeutic category profile", "ملف الفئة العلاجية")}</p><h1 className="mt-3 text-4xl font-bold">{selected.facet_value}</h1><p className="mt-3 text-muted-foreground">{selected.product_count.toLocaleString()} {t("connected canonical medicine products", "منتج دوائي موحد مرتبط")}</p><div className="mt-5 flex flex-wrap gap-2"><ShareContributeActions title={selected.facet_value} contributionUrl={`/industry?therapeutic_category=${encodeURIComponent(selected.facet_value)}#participate`} /><a href={`/medicines?class=${encodeURIComponent(selected.facet_value)}`} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{t("Browse medicines in this category", "تصفح أدوية هذه الفئة")}</a></div></section><PublicKnowledgePanel type="therapeutic-category" name={selected.facet_value} /></>}
  </main>;

  return <main className="container mx-auto max-w-6xl px-4 py-8"><section className="rounded-2xl border bg-card p-6 shadow-sm"><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><Activity className="h-4 w-4" />{t("Therapeutic category directory", "دليل الفئات العلاجية")}</p><h1 className="mt-3 text-4xl font-bold">{t("Explore medicine classes and therapeutic categories", "استكشف تصنيفات الأدوية والفئات العلاجية")}</h1><p className="mt-3 text-muted-foreground">{t("Each profile connects the canonical medicine catalog with attributed public encyclopedia context and contribution workflows.", "يربط كل ملف موسوعة الأدوية الموحدة بالسياق الموسوعي العام المنسوب ومسارات المساهمة.")}</p></section><section className="mt-6 rounded-2xl border bg-card p-5"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search therapeutic categories...", "ابحث في الفئات العلاجية...")} /></label></section>{error && <p className="mt-6 text-sm text-destructive">{error}</p>}<section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => <a key={item.facet_value} href={`/therapeutic-categories/${seoEntitySlug(item.facet_value)}?name=${encodeURIComponent(item.facet_value)}`}><Card className="h-full transition hover:border-primary/40"><CardHeader><CardTitle className="text-lg">{item.facet_value}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{item.product_count.toLocaleString()} {t("canonical medicines", "دواء موحد")}</CardContent></Card></a>)}</section></main>;
}
