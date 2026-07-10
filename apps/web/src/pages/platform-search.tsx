import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type SearchRow = { entity_type: string; entity_key: string; title: string; subtitle: string | null; href: string | null; category: string; weight: number };
type Related = { context_type: string; context_key: string; related_title: string; related_href: string; reason: string; priority: number };
type Metrics = { graph_nodes: number; graph_edges: number; searchable_entities: number; active_verified_products: number; archived_duplicate_prices: number; company_profiles: number; generic_filters: number; disease_filters: number; verified_enrichment_records: number };
type CatalogMetrics = { total_active: number };

function enc(value: string) { return encodeURIComponent(`*${value.trim()}*`); }

export default function PlatformSearch() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const initialQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("query") || "" : "";
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [related, setRelated] = useState<Related[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.entity_type, (map.get(row.entity_type) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  async function loadMetrics() {
    const [platformRows, catalogRows] = await Promise.all([
      supabaseFetch<Metrics[]>("/rest/v1/platform_interconnection_metrics?select=*"),
      supabaseFetch<CatalogMetrics[]>("/rest/v1/medicines_catalog_metrics?select=total_active"),
    ]);
    setMetrics(platformRows[0] || null);
    setCatalogTotal(Number(catalogRows[0]?.total_active || 0));
  }

  async function loadRelated(searchRows: SearchRow[]) {
    const top = searchRows.filter(row => row.entity_type !== "catalog_product").slice(0, 8);
    if (top.length === 0) { setRelated([]); return; }
    const clauses = top.map(row => `and(context_type.eq.${encodeURIComponent(row.entity_type === "module" ? "module" : row.entity_type.replace("_area", ""))},context_key.eq.${encodeURIComponent(row.entity_key)})`);
    try {
      const data = await supabaseFetch<Related[]>(`/rest/v1/platform_related_navigation?select=context_type,context_key,related_title,related_href,reason,priority&or=(${clauses.join(",")})&order=priority.desc&limit=12`);
      setRelated(data);
    } catch { setRelated([]); }
  }

  async function search() {
    setLoading(true);
    try {
      const fields = "entity_type,entity_key,title,subtitle,href,category,weight";
      const platformParts = [`select=${fields}`, "order=weight.desc", "limit=60"];
      const catalogParts = [`select=${fields}`, "order=weight.desc", "limit=60"];
      if (query.trim()) {
        const filter = `or=(title.ilike.${enc(query)},subtitle.ilike.${enc(query)},category.ilike.${enc(query)},entity_type.ilike.${enc(query)})`;
        platformParts.push(filter); catalogParts.push(filter);
      } else catalogParts.push("limit=20");

      const [platformRows, catalogRows] = await Promise.all([
        supabaseFetch<SearchRow[]>(`/rest/v1/platform_universal_search_index?${platformParts.join("&")}`),
        supabaseFetch<SearchRow[]>(`/rest/v1/medicines_catalog_search_index?${catalogParts.join("&")}`),
      ]);
      const combined = [...catalogRows, ...platformRows]
        .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
        .slice(0, 100);
      setRows(combined);
      await loadRelated(platformRows);
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadMetrics(); void search(); }, []);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Sparkles className="h-4 w-4" />{t("Universal search", "بحث شامل")}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">{t("Search the connected platform", "ابحث في المنصة المترابطة")}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("Search the full medicines2 catalog together with verified products, companies, generics, disease areas, sources, modules, and recommended next actions.", "ابحث في كتالوج medicines2 الكامل مع المنتجات الموثقة والشركات والمواد والمجالات المرضية والمصادر والوحدات والخطوات التالية المقترحة.")}</p>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-5">
      <Metric label={t("Catalog products", "منتجات الكتالوج")} value={catalogTotal} />
      <Metric label={t("Connected entities", "كيانات مترابطة")} value={metrics?.searchable_entities || 0} />
      <Metric label={t("Graph nodes", "عقد الشبكة")} value={metrics?.graph_nodes || 0} />
      <Metric label={t("Graph edges", "روابط الشبكة")} value={metrics?.graph_edges || 0} />
      <Metric label={t("Verified records", "سجلات موثقة")} value={metrics?.verified_enrichment_records || 0} />
    </section>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Search product, barcode, company, generic, disease, source...", "ابحث عن منتج أو باركود أو شركة أو مادة أو مرض أو مصدر...")} onKeyDown={event => { if (event.key === "Enter") void search(); }} /><Button onClick={() => void search()} disabled={loading}><Search className="mr-2 h-4 w-4" />{t("Search", "بحث")}</Button></div>
      <div className="mt-4 flex flex-wrap gap-2">{grouped.map(([type, count]) => <Badge key={type} variant="secondary">{type}: {count}</Badge>)}</div>
    </section>

    {related.length > 0 && <section className="mt-6 rounded-2xl border bg-muted/40 p-5"><h2 className="text-lg font-semibold">{t("Recommended next actions", "الخطوات التالية المقترحة")}</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{related.map(item => <a key={`${item.context_type}-${item.context_key}-${item.related_href}`} href={item.related_href} className="rounded-xl border bg-background p-4 hover:bg-muted"><div className="font-semibold">{item.related_title}</div><p className="mt-2 text-sm text-muted-foreground">{item.reason}</p></a>)}</div></section>}

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(row => <a key={`${row.entity_type}-${row.entity_key}`} href={row.href || "#"} className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold leading-7">{row.title}</h2><Badge variant="outline">{row.entity_type}</Badge></div>{row.subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{row.subtitle}</p>}<div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{row.category}</span><span>{Number(row.weight || 0).toLocaleString()}</span></div></a>)}
      {!loading && rows.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("No connected results found.", "لا توجد نتائج مترابطة.")}</CardContent></Card>}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{Number(value || 0).toLocaleString()}</div></CardContent></Card>; }
