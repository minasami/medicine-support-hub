import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Readiness = {
  program_id: string;
  program_name: string;
  pilot_phase: string | null;
  sites_count: number;
  target_beneficiaries: number;
  budget_amount: number | string;
  spent_amount: number | string;
  start_date: string | null;
  end_date: string | null;
  enrolled_beneficiaries: number;
  milestones_total: number;
  milestones_completed: number;
  deliverables_total: number;
  deliverables_approved: number;
};
type ProgramDetail = { pilot_objective: string | null; success_criteria: string | null; risks: string | null };
type ReadinessCheck = readonly [label: string, done: boolean];

export default function PilotReadinessPage() {
  const [, params] = useRoute("/workspace/pilot-readiness/:id");
  const id = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [data, setData] = useState<Readiness | null>(null);
  const [detail, setDetail] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!id) throw new Error("Pilot ID is missing.");
      if (!isAuthenticated || !session?.user?.id) throw new Error("Sign in first.");
      const [rows, details] = await Promise.all([
        supabaseFetch<Readiness[]>(`/rest/v1/pilot_readiness_summary?select=*&program_id=eq.${id}&limit=1`),
        supabaseFetch<ProgramDetail[]>(`/rest/v1/programs?select=pilot_objective,success_criteria,risks&id=eq.${id}&limit=1`),
      ]);
      if (!rows[0]) throw new Error("Pilot readiness data was not found.");
      setData(rows[0]);
      setDetail(details[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load pilot readiness.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id, isAuthenticated, session?.access_token]);

  const checks: readonly ReadinessCheck[] = data ? [
    ["Pilot objective defined", Boolean(detail?.pilot_objective?.trim())],
    ["Success criteria defined", Boolean(detail?.success_criteria?.trim())],
    ["Start and end dates set", Boolean(data.start_date && data.end_date)],
    ["At least one site configured", data.sites_count > 0],
    ["Budget established", Number(data.budget_amount) > 0],
    ["Milestones created", data.milestones_total > 0],
    ["Deliverables created", data.deliverables_total > 0],
    ["At least one deliverable approved", data.deliverables_approved > 0],
    ["Risks documented", Boolean(detail?.risks?.trim())],
  ] : [];

  const score = useMemo(() => {
    if (!checks.length) return 0;
    return Math.round((checks.filter(([, done]) => done).length / checks.length) * 100);
  }, [checks]);

  return <div className="container mx-auto max-w-5xl px-4 py-8">
    <Button asChild variant="ghost" className="mb-4 -ml-3">
      <Link href={id ? `/workspace/pilots/${id}` : "/workspace"}><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
    </Button>
    <div className="mb-6 flex items-start justify-between gap-4">
      <div><Badge>Pilot readiness</Badge><h1 className="mt-3 text-3xl font-bold">{data?.program_name ?? "Pilot readiness"}</h1><p className="text-muted-foreground">Evidence-based readiness across governance, scope, budget, delivery, and risk.</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="text-muted-foreground">Loading readiness assessment...</p>}
    {data && <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <Card><CardContent className="flex h-full flex-col items-center justify-center p-8"><div className="text-6xl font-bold">{score}</div><div className="text-sm text-muted-foreground">readiness score</div><Badge className="mt-4">{score >= 80 ? "Pilot ready" : score >= 50 ? "In preparation" : "Foundation incomplete"}</Badge></CardContent></Card>
      <Card><CardHeader><CardTitle>Readiness checks</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{checks.map(([label, done]) => <div key={label} className="flex items-center gap-3 rounded-lg border p-3"><CheckCircle2 className={done ? "h-5 w-5 text-emerald-600" : "h-5 w-5 text-slate-300"} /><span className={done ? "font-medium" : "text-muted-foreground"}>{label}</span></div>)}</CardContent></Card>
    </div>}
  </div>;
}
