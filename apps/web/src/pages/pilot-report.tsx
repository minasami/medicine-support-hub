import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Summary = {
  program_name: string;
  pilot_phase: string | null;
  program_status: string;
  currency: string;
  budget_amount: number | string;
  spent_amount: number | string;
  remaining_budget: number | string;
  target_beneficiaries: number;
  enrolled_beneficiaries: number;
  milestones_total: number;
  milestones_completed: number;
  deliverables_total: number;
  deliverables_approved: number;
  sites_count: number;
  start_date: string | null;
  end_date: string | null;
  pilot_objective: string | null;
  success_criteria: string | null;
  risks: string | null;
  lessons_learned: string | null;
};

export default function PilotReportPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/pilot-report/:id");
  const id = params?.id;
  const { supabaseFetch } = usePatientAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const rows = await supabaseFetch<Summary[]>(
          `/rest/v1/pilot_executive_summary?select=*&program_id=eq.${id}&limit=1`,
        );
        if (!rows[0])
          throw new Error(t("Pilot report not found.", "تقرير البرنامج التجريبي غير موجود."));
        setSummary(rows[0]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : t("Failed to load report.", "تعذّر تحميل التقرير."),
        );
      }
    })();
  }, [id]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button asChild variant="ghost">
          <Link href={id ? `/workspace/pilot-command/${id}` : "/workspace"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("Back", "رجوع")}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          {t("Print report", "طباعة التقرير")}
        </Button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {summary && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{summary.program_name}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("Pilot report generated", "تقرير تجريبي أُنشئ")}{" "}
              {new Date().toLocaleString()}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label={t("Enrollment", "التسجيل")}
              value={`${summary.enrolled_beneficiaries}/${summary.target_beneficiaries || 0}`}
            />
            <Metric
              label={t("Milestones", "المعالم")}
              value={`${summary.milestones_completed}/${summary.milestones_total}`}
            />
            <Metric
              label={t("Deliverables", "المخرجات")}
              value={`${summary.deliverables_approved}/${summary.deliverables_total}`}
            />
            <Metric
              label={t("Budget remaining", "الميزانية المتبقية")}
              value={`${Number(summary.remaining_budget).toLocaleString()} ${summary.currency}`}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t("Program overview", "نظرة على البرنامج")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Row
                label={t("Phase", "المرحلة")}
                value={(summary.pilot_phase || t("Not set", "غير محدد")).replaceAll(
                  "_",
                  " ",
                )}
              />
              <Row label={t("Status", "الحالة")} value={summary.program_status} />
              <Row
                label={t("Sites", "المواقع")}
                value={String(summary.sites_count || 0)}
              />
              <Row
                label={t("Timeline", "الجدول")}
                value={`${summary.start_date || t("Not set", "غير محدد")} → ${summary.end_date || t("Not set", "غير محدد")}`}
              />
              <Row
                label={t("Budget", "الميزانية")}
                value={`${Number(summary.budget_amount).toLocaleString()} ${summary.currency}`}
              />
              <Row
                label={t("Spent", "المنفق")}
                value={`${Number(summary.spent_amount).toLocaleString()} ${summary.currency}`}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Strategic narrative", "السرد الاستراتيجي")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Block
                title={t("Objective", "الهدف")}
                text={summary.pilot_objective}
                empty={t("Not documented yet.", "غير موثّق بعد.")}
              />
              <Block
                title={t("Success criteria", "معايير النجاح")}
                text={summary.success_criteria}
                empty={t("Not documented yet.", "غير موثّق بعد.")}
              />
              <Block
                title={t("Risks", "المخاطر")}
                text={summary.risks}
                empty={t("Not documented yet.", "غير موثّق بعد.")}
              />
              <Block
                title={t("Lessons learned", "الدروس المستفادة")}
                text={summary.lessons_learned}
                empty={t("Not documented yet.", "غير موثّق بعد.")}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg border p-3">
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
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text || empty}</p>
    </div>
  );
}
