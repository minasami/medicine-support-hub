import { useEffect, useMemo, useState } from "react";
import { Network, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectedNextActions } from "@/components/connected-next-actions";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Node = { node_type: string; node_key: string; label: string; href: string | null; parent_key: string | null; weight: number };
type Edge = { source_key: string; target_key: string; relation: string; weight: number };

export default function PlatformNetwork() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [nextNodes, nextEdges] = await Promise.all([
        supabaseFetch<Node[]>("/rest/v1/platform_connection_graph_nodes?select=node_type,node_key,label,href,parent_key,weight&order=node_type.asc,weight.desc&limit=250"),
        supabaseFetch<Edge[]>("/rest/v1/platform_connection_graph_edges?select=source_key,target_key,relation,weight&order=weight.desc&limit=400"),
      ]);
      setNodes(nextNodes);
      setEdges(nextEdges);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Node[]>();
    for (const node of nodes) map.set(node.node_type, [...(map.get(node.node_type) || []), node]);
    return Array.from(map.entries());
  }, [nodes]);

  const edgeSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) map.set(edge.relation, (map.get(edge.relation) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [edges]);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground"><Network className="h-4 w-4" />{t("Connection graph", "خريطة الترابط")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Platform network map", "خريطة شبكة المنصة")}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{t("A live map of how medicines, verified products, companies, generics, disease areas, data sources, pharmacy operations, programs, reports, and admin workflows connect together.", "خريطة حية توضح ترابط الأدوية والمنتجات الموثقة والشركات والمواد والمجالات المرضية ومصادر البيانات وعمليات الصيدلية والبرامج والتقارير وسير عمل الإدارة.")}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh", "تحديث")}</Button>
      </div>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-4">
      <Metric label={t("Nodes", "العقد")} value={nodes.length} />
      <Metric label={t("Connections", "الروابط")} value={edges.length} />
      <Metric label={t("Node types", "أنواع العقد")} value={grouped.length} />
      <Metric label={t("Relation types", "أنواع العلاقات")} value={edgeSummary.length} />
    </section>

    <div className="mt-6"><ConnectedNextActions contextType="module" contextKey="integrations" title={t("Best command-center next actions", "أفضل خطوات مركز القيادة التالية")} /></div>

    <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{t("Connection types", "أنواع الترابط")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {edgeSummary.map(([relation, count]) => <Badge key={relation} variant="secondary">{relation}: {count}</Badge>)}
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2">
      {grouped.map(([type, rows]) => <Card key={type} className="shadow-sm">
        <CardHeader><CardTitle className="flex items-center justify-between"><span>{type}</span><Badge>{rows.length}</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.slice(0, 25).map(node => <a key={`${type}-${node.node_key}`} href={node.href || "#"} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted">
            <span className="font-medium">{node.label}</span>
            <span className="text-xs text-muted-foreground">{node.weight?.toLocaleString?.() || node.weight}</span>
          </a>)}
        </CardContent>
      </Card>)}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}
