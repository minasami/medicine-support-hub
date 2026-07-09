import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type SearchRow = { entity_type: string; entity_key: string; title: string; subtitle: string | null; href: string | null; category: string; weight: number };
type Metrics = { graph_nodes: number; graph_edges: number; searchable_entities: number; active_verified_products: number; archived_duplicate_prices: number; company_profiles: number; generic_filters: number; disease_filters: number; verified_enrichment_records: number };

function enc(value: string) { return encodeURIComponent(`*${value.trim()}*`); }

export default function PlatformSearch() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.entity_type, (map.get(row.entity_type) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  async function loadMetrics() {
    const data = await supabaseFetch<Metrics[]>("/rest/v1/platform_interconnection_metrics?select=*");
    setMetrics(data[0] || null);
  }

  async function search() {
    setLoading(true);
    try {
      const select = "entity_type,entity_key,title,subtitle,href,category,weight";
      const parts = [`select=${select}`, "order=weight.desc", "limit=80"];
      if (query.trim()) parts.push(`or=(title.ilike.${enc(query)},subtitle.ilike.${enc(query)},category.ilike.${enc(query)},entity_type.ilike.${enc(query)})`);
      const data = await supabaseFetch<SearchRow[]>(`/rest/v1/platform_universal_search_index?${parts.join("&")}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMetrics(); void search(); }, []);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Sparkles className="h-4 w-4" />{t("Universal search", "بحث شامل")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Search the connected platform", "ابحث في المنصة المترابطة")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("One search layer across modules, medicines, verified products, companies, generics, disease areas, and source-backed enrichment data.", "طبقة بحث واحدة عبر الوحدات والأدوية والمنتجات الموثقة والشركات والمواد والمجالات المرضية وبيانات الإثراء المدعومة بالمصادر.")}</p>
    </section>

    {metrics && <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label={t("Searchable entities", "كيانات قابلة للبحث")} value={metrics.searchable_entities} />
      <Metric label={t("Graph nodes", "عقد الشبكة")} value={metrics.graph_nodes} />
      <Metric label={t("Graph edges", "روابط الشبكة")} value={metrics.graph_edges} />
      <Metric label={t("Verified records", "سجلات موثقة")} value={metrics.verified_enrichment_records} />
    </section>}

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search product, company, generic, disease, source, module...", "ابحث عن منتج، شركة، مادة، مرض، مصدر، وحدة...")} />
        <Button onClick={() => void search()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {grouped.map(([type, count]) => <Badge key={type} variant="secondary">{type}: {count}</Badge>)}
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => <a key={`${row.entity_type}-${row.entity_key}`} href={row.href || "#"} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-7">{row.title}</h2>
          <Badge variant="outline">{row.entity_type}</Badge>
        </div>
        {row.subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.subtitle}</p>}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{row.category}</span>
          <span>{Number(row.weight || 0).toLocaleString()}</span>
        </div>
      </a>)}
      {!loading && rows.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No connected results found.", "لا توجد نتائج مترابطة.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}
