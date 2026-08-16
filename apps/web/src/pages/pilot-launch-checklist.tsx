import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Rocket } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Readiness = {
  program_name: string;
  pilot_phase: string | null;
  sites_count: number;
  target_beneficiaries: number;
  enrolled_beneficiaries: number;
  milestones_total: number;
  milestones_completed: number;
  deliverables_total: number;
  deliverables_approved: number;
  budget_amount: number | string;
  spent_amount: number | string;
  start_date: string | null;
  end_date: string | null;
};

export default function PilotLaunchChecklistPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/pilot-launch/:id");
  const id = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [data, setData] = useState<Readiness | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error(t("Pilot ID is missing.", "معرّف البرنامج التجريبي مفقود."));
        if (!isAuthenticated || !session?.user?.id)
          throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
        const rows = await supabaseFetch<Readiness[]>(
          `/rest/v1/pilot_readiness_summary?select=*&program_id=eq.${id}&limit=1`,
        );
        if (!rows[0])
          throw new Error(
            t("Pilot readiness data not found.", "بيانات جاهزية البرنامج غير موجودة."),
          );
        setData(rows[0]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : t("Failed to load launch checklist.", "تعذّر تحميل قائمة الإطلاق."),
        );
      }
    })();
  }, [id, isAuthenticated, session?.access_token]);

  const checks = useMemo(
    () =>
      data
        ? ([
            [t("Pilot phase defined", "تم تحديد مرحلة البرنامج"), Boolean(data.pilot_phase)],
            [
              t("At least one implementation site", "موقع تنفيذ واحد على الأقل"),
              data.sites_count > 0,
            ],
            [
              t("Pilot dates confirmed", "تم تأكيد تواريخ البرنامج"),
              Boolean(data.start_date && data.end_date),
            ],
            [
              t("Target beneficiaries defined", "تم تحديد المستفيدين المستهدفين"),
              data.target_beneficiaries > 0,
            ],
            [
              t("Beneficiary enrollment started", "بدأ تسجيل المستفيدين"),
              data.enrolled_beneficiaries > 0,
            ],
            [t("Milestones configured", "تم إعداد المعالم"), data.milestones_total > 0],
            [
              t("All milestones completed", "اكتملت كل المعالم"),
              data.milestones_total > 0 &&
                data.milestones_completed === data.milestones_total,
            ],
            [t("Deliverables configured", "تم إعداد المخرجات"), data.deliverables_total > 0],
            [
              t("All deliverables approved", "اعتُمدت كل المخرجات"),
              data.deliverables_total > 0 &&
                data.deliverables_approved === data.deliverables_total,
            ],
            [t("Budget allocated", "تم تخصيص الميزانية"), Number(data.budget_amount) > 0],
          ] as const)
        : [],
    [data, t],
  );

  const ready = checks.filter((x) => x[1]).length;
  const total = checks.length;
  const score = total ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-4 -ml-3">
        <Link href={id ? `/workspace/pilot-command/${id}` : "/workspace"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back to command center", "العودة لمركز القيادة")}
        </Link>
      </Button>
      <div className="mb-8">
        <Badge className="mb-3 bg-emerald-100 text-emerald-800">
          {t("Launch Control", "التحكم بالإطلاق")}
        </Badge>
        <h1 className="text-3xl font-bold">
          {data?.program_name || t("Pilot launch checklist", "قائمة إطلاق البرنامج التجريبي")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "A final operational gate before the pilot moves into live delivery.",
            "بوابة تشغيلية نهائية قبل انتقال البرنامج إلى التسليم الحي.",
          )}
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {data && (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-muted-foreground">
                  {t("Launch readiness", "جاهزية الإطلاق")}
                </div>
                <div className="mt-1 text-4xl font-bold">{score}%</div>
                <div className="text-sm text-muted-foreground">
                  {ready} {t("of", "من")} {total} {t("checks passed", "فحوصات ناجحة")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Rocket className="h-6 w-6" />
                <span className="font-semibold">
                  {score === 100
                    ? t("Ready to launch", "جاهز للإطلاق")
                    : t("Resolve remaining launch gates", "حل بوابات الإطلاق المتبقية")}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Final launch gates", "بوابات الإطلاق النهائية")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {checks.map(([label, passed]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    {passed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span>{label}</span>
                  </div>
                  <Badge variant={passed ? "default" : "outline"}>
                    {passed ? t("Passed", "ناجح") : t("Pending", "معلّق")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
