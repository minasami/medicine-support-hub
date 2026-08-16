import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
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
type ProgramDetail = {
  pilot_objective: string | null;
  success_criteria: string | null;
  risks: string | null;
};
type ReadinessCheck = readonly [label: string, done: boolean];

export default function PilotReadinessPage() {
  const { t } = useLanguage();
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
      if (!id) throw new Error(t("Pilot ID is missing.", "معرّف البرنامج التجريبي مفقود."));
      if (!isAuthenticated || !session?.user?.id)
        throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
      const [rows, details] = await Promise.all([
        supabaseFetch<Readiness[]>(
          `/rest/v1/pilot_readiness_summary?select=*&program_id=eq.${id}&limit=1`,
        ),
        supabaseFetch<ProgramDetail[]>(
          `/rest/v1/programs?select=pilot_objective,success_criteria,risks&id=eq.${id}&limit=1`,
        ),
      ]);
      if (!rows[0])
        throw new Error(
          t("Pilot readiness data was not found.", "لم تُعثر على بيانات جاهزية البرنامج."),
        );
      setData(rows[0]);
      setDetail(details[0] ?? null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Failed to load pilot readiness.", "تعذّر تحميل جاهزية البرنامج."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, isAuthenticated, session?.access_token]);

  const checks: readonly ReadinessCheck[] = data
    ? [
        [
          t("Pilot objective defined", "تم تحديد هدف البرنامج"),
          Boolean(detail?.pilot_objective?.trim()),
        ],
        [
          t("Success criteria defined", "تم تحديد معايير النجاح"),
          Boolean(detail?.success_criteria?.trim()),
        ],
        [
          t("Start and end dates set", "تم تحديد تاريخي البدء والانتهاء"),
          Boolean(data.start_date && data.end_date),
        ],
        [
          t("At least one site configured", "تم إعداد موقع واحد على الأقل"),
          data.sites_count > 0,
        ],
        [t("Budget established", "تم وضع الميزانية"), Number(data.budget_amount) > 0],
        [t("Milestones created", "تم إنشاء المعالم"), data.milestones_total > 0],
        [t("Deliverables created", "تم إنشاء المخرجات"), data.deliverables_total > 0],
        [
          t("At least one deliverable approved", "اعتُمد مخرج واحد على الأقل"),
          data.deliverables_approved > 0,
        ],
        [t("Risks documented", "وُثّقت المخاطر"), Boolean(detail?.risks?.trim())],
      ]
    : [];

  const score = useMemo(() => {
    if (!checks.length) return 0;
    return Math.round(
      (checks.filter(([, done]) => done).length / checks.length) * 100,
    );
  }, [checks]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-4 -ml-3">
        <Link href={id ? `/workspace/pilots/${id}` : "/workspace"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back", "رجوع")}
        </Link>
      </Button>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Badge>{t("Pilot readiness", "جاهزية البرنامج التجريبي")}</Badge>
          <h1 className="mt-3 text-3xl font-bold">
            {data?.program_name ?? t("Pilot readiness", "جاهزية البرنامج التجريبي")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Evidence-based readiness across governance, scope, budget, delivery, and risk.",
              "جاهزية مبنية على الأدلة عبر الحوكمة والنطاق والميزانية والتسليم والمخاطر.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
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
          {t("Loading readiness assessment...", "جاري تحميل تقييم الجاهزية...")}
        </p>
      )}
      {data && (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Card>
            <CardContent className="flex h-full flex-col items-center justify-center p-8">
              <div className="text-6xl font-bold">{score}</div>
              <div className="text-sm text-muted-foreground">
                {t("readiness score", "درجة الجاهزية")}
              </div>
              <Badge className="mt-4">
                {score >= 80
                  ? t("Pilot ready", "جاهز للتجريب")
                  : score >= 50
                    ? t("In preparation", "قيد الإعداد")
                    : t("Foundation incomplete", "الأساس غير مكتمل")}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Readiness checks", "فحوصات الجاهزية")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {checks.map(([label, done]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <CheckCircle2
                    className={
                      done ? "h-5 w-5 text-emerald-600" : "h-5 w-5 text-slate-300"
                    }
                  />
                  <span className={done ? "font-medium" : "text-muted-foreground"}>
                    {label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
