import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CircleDollarSign,
  FileCheck2,
  Flag,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  program_id: string;
  program_name: string;
  pilot_phase: string | null;
  program_status: string;
  currency: string;
  budget_amount: number | string;
  committed_amount: number | string;
  spent_amount: number | string;
  remaining_budget: number | string;
  target_beneficiaries: number;
  enrolled_beneficiaries: number;
  milestones_total: number;
  milestones_completed: number;
  deliverables_total: number;
  deliverables_approved: number;
  support_requests_total: number;
  support_requests_successful: number;
  sites_count: number;
  start_date: string | null;
  end_date: string | null;
  pilot_objective: string | null;
  success_criteria: string | null;
  risks: string | null;
  lessons_learned: string | null;
};

export default function PilotExecutiveSummaryPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/pilot-executive/:id");
  const id = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!id) throw new Error(t("Pilot ID is missing.", "معرّف البرنامج التجريبي مفقود."));
      if (!isAuthenticated || !session?.user?.id)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const rows = await supabaseFetch<Summary[]>(
        `/rest/v1/pilot_executive_summary?select=*&program_id=eq.${id}&limit=1`,
      );
      if (!rows[0])
        throw new Error(t("Executive summary not found.", "الملخص التنفيذي غير موجود."));
      setData(rows[0]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to load executive summary.", "تعذّر تحميل الملخص التنفيذي."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id, isAuthenticated, session?.access_token]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const enrollment = data.target_beneficiaries
      ? Math.round((data.enrolled_beneficiaries / data.target_beneficiaries) * 100)
      : 0;
    const milestones = data.milestones_total
      ? Math.round((data.milestones_completed / data.milestones_total) * 100)
      : 0;
    const deliverables = data.deliverables_total
      ? Math.round((data.deliverables_approved / data.deliverables_total) * 100)
      : 0;
    const requests = data.support_requests_total
      ? Math.round(
          (data.support_requests_successful / data.support_requests_total) * 100,
        )
      : 0;
    const budget =
      Number(data.budget_amount) > 0
        ? Math.round((Number(data.spent_amount) / Number(data.budget_amount)) * 100)
        : 0;
    return { enrollment, milestones, deliverables, requests, budget };
  }, [data]);

  const notSet = t("Not set", "غير محدد");
  const notDoc = t("Not documented yet.", "غير موثّق بعد.");

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href={id ? `/workspace/pilots/${id}` : "/workspace"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back to pilot", "العودة للبرنامج التجريبي")}
        </Link>
      </Button>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-indigo-100 text-indigo-700">
            {t("Executive Summary v4", "الملخص التنفيذي v4")}
          </Badge>
          <h1 className="text-3xl font-bold">
            {data?.program_name || t("Pilot executive summary", "الملخص التنفيذي للبرنامج")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              "A board-level view of reach, delivery, budget, and pilot progress.",
              "نظرة على المستوى القيادي للتغطية والتسليم والميزانية وتقدم البرنامج.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh", "تحديث")}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <p className="text-muted-foreground">
          {t("Loading executive summary...", "جاري تحميل الملخص التنفيذي...")}
        </p>
      )}
      {data && metrics && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Metric
              icon={Users}
              label={t("Enrollment", "التسجيل")}
              value={`${metrics.enrollment}%`}
              sub={`${data.enrolled_beneficiaries}/${data.target_beneficiaries || 0}`}
            />
            <Metric
              icon={Target}
              label={t("Milestones", "المعالم")}
              value={`${metrics.milestones}%`}
              sub={`${data.milestones_completed}/${data.milestones_total}`}
            />
            <Metric
              icon={FileCheck2}
              label={t("Deliverables", "المخرجات")}
              value={`${metrics.deliverables}%`}
              sub={`${data.deliverables_approved}/${data.deliverables_total}`}
            />
            <Metric
              icon={BriefcaseBusiness}
              label={t("Request success", "نجاح الطلبات")}
              value={`${metrics.requests}%`}
              sub={`${data.support_requests_successful}/${data.support_requests_total}`}
            />
            <Metric
              icon={CircleDollarSign}
              label={t("Budget used", "الميزانية المستخدمة")}
              value={`${metrics.budget}%`}
              sub={`${Number(data.spent_amount).toLocaleString()} ${data.currency}`}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  {t("Pilot position", "موقع البرنامج")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row
                  label={t("Phase", "المرحلة")}
                  value={(data.pilot_phase || notSet).replaceAll("_", " ")}
                />
                <Row label={t("Program status", "حالة البرنامج")} value={data.program_status} />
                <Row label={t("Sites", "المواقع")} value={String(data.sites_count || 0)} />
                <Row
                  label={t("Remaining budget", "الميزانية المتبقية")}
                  value={`${Number(data.remaining_budget).toLocaleString()} ${data.currency}`}
                />
                <Row
                  label={t("Timeline", "الجدول")}
                  value={`${data.start_date || notSet} → ${data.end_date || notSet}`}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("Strategic summary", "الملخص الاستراتيجي")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Block title={t("Objective", "الهدف")} text={data.pilot_objective} empty={notDoc} />
                <Block
                  title={t("Success criteria", "معايير النجاح")}
                  text={data.success_criteria}
                  empty={notDoc}
                />
                <Block title={t("Key risks", "المخاطر الرئيسية")} text={data.risks} empty={notDoc} />
                <Block
                  title={t("Lessons learned", "الدروس المستفادة")}
                  text={data.lessons_learned}
                  empty={notDoc}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right capitalize">{value}</strong>
    </div>
  );
}
function Block({
  title,
  text,
  empty,
}: {
  title: string;
  text: string | null;
  empty: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text || empty}</p>
    </div>
  );
}
