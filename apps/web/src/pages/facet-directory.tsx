import { useEffect, useMemo, useState } from "react";
import { Activity, FlaskConical, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { fetchSeoEntityDirectory, seoEntityPath, type SeoEntity, type SeoEntityType } from "@/lib/seo-entities";

function FacetDirectory({ type }: { type: Extract<SeoEntityType, "generic" | "disease"> }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<SeoEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeoEntityDirectory()
      .then((directory) => {
        if (!cancelled) setEntities(directory.entities.filter((entity) => entity.type === type));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load the directory.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [type]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? entities.filter((entity) => entity.name.toLocaleLowerCase().includes(normalized)) : entities;
  }, [entities, query]);

  const isGeneric = type === "generic";
  const Icon = isGeneric ? FlaskConical : Activity;

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Icon className="h-4 w-4" />{isGeneric ? t("Generic medicine directory", "دليل المواد الفعالة") : t("Disease-area directory", "دليل المجالات المرضية")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{isGeneric ? t("Source-backed generic medicine pages", "صفحات مواد فعالة مدعومة بالمصدر") : t("Source-backed disease-area pages", "صفحات مجالات مرضية مدعومة بالمصدر")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{isGeneric
        ? t("Browse canonical pages that connect each generic or strength to verified source products, companies, disease areas, prescription signals, and observed source-market prices.", "تصفح صفحات أساسية تربط كل مادة أو تركيز بالمنتجات الموثقة والشركات والمجالات المرضية وإشارات الوصفة والأسعار المرصودة في سوق المصدر.")
        : t("Browse canonical pages that connect each disease area to verified source products, generics, companies, prescription signals, and observed source-market prices.", "تصفح صفحات أساسية تربط كل مجال مرضي بالمنتجات الموثقة والمواد الفعالة والشركات وإشارات الوصفة والأسعار المرصودة في سوق المصدر.")}</p>
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder={isGeneric ? t("Search generic or strength...", "ابحث عن مادة أو تركيز...") : t("Search disease area...", "ابحث عن مجال مرضي...")} />
      </label>
      <p className="mt-3 text-sm text-muted-foreground">{t(`${filtered.length.toLocaleString()} canonical pages`, `${filtered.length.toLocaleString()} صفحة أساسية`)}</p>
    </section>

    {error && <Card className="mt-6"><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card>}
    {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading directory...", "جاري تحميل الدليل...")}</p>}

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((entity) => <a key={entity.slug} href={seoEntityPath(entity.type, entity.slug)} className="block">
        <Card className="h-full shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <CardHeader><CardTitle className="text-lg leading-7">{entity.name}</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{entity.records.toLocaleString()} {t("verified active product listings", "منتج نشط موثق")}</CardContent>
        </Card>
      </a>)}
    </section>

    <section className="mt-8 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
      {t("These pages describe a verified source dataset and observed source-market listings. They do not establish Egyptian registration, local availability, indication, or price.", "تصف هذه الصفحات مجموعة بيانات مصدرية موثقة وقوائم مرصودة في سوق المصدر، ولا تثبت التسجيل أو التوافر أو دواعي الاستعمال أو السعر داخل مصر.")}
    </section>
  </main>;
}

export function GenericDirectory() {
  return <FacetDirectory type="generic" />;
}

export function DiseaseDirectory() {
  return <FacetDirectory type="disease" />;
}
