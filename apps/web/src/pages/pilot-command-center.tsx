import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  FileText,
  Gavel,
  LayoutDashboard,
  Rocket,
  Target,
} from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Program = {
  id: string;
  name: string;
  pilot_phase: string | null;
  status: string;
};

export default function PilotCommandCenterPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/pilot-command/:id");
  const id = params?.id;
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!id) throw new Error(t("Pilot ID is missing.", "معرّف البرنامج التجريبي مفقود."));
        if (!isAuthenticated || !session?.user?.id)
          throw new Error(t("Sign in first.", "سجّل الدخول أولًا."));
        const rows = await supabaseFetch<Program[]>(
          `/rest/v1/programs?select=id,name,pilot_phase,status&id=eq.${id}&limit=1`,
        );
        if (!rows[0]) throw new Error(t("Pilot not found.", "البرنامج التجريبي غير موجود."));
        setProgram(rows[0]);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : t("Failed to load pilot.", "تعذّر تحميل البرنامج التجريبي."),
        );
      }
    })();
  }, [id, isAuthenticated, session?.access_token]);

  const modules = useMemo(
    () => [
      {
        title: t("Pilot Workspace", "مساحة البرنامج التجريبي"),
        description: t(
          "Objectives, dates, milestones, deliverables, evidence, risks, and lessons learned.",
          "الأهداف والتواريخ والمعالم والمخرجات والأدلة والمخاطر والدروس المستفادة.",
        ),
        href: `/workspace/pilots/${id}`,
        icon: Rocket,
      },
      {
        title: t("Readiness Assessment", "تقييم الجاهزية"),
        description: t(
          "100-point launch readiness score, checklist, gaps, and recommended next actions.",
          "درجة جاهزية الإطلاق من ١٠٠، وقائمة التحقق والفجوات والإجراءات المقترحة.",
        ),
        href: `/workspace/pilot-readiness/${id}`,
        icon: ClipboardCheck,
      },
      {
        title: t("Launch Checklist", "قائمة الإطلاق"),
        description: t(
          "Run the final operational gates before moving the pilot into live delivery.",
          "نفّذ البوابات التشغيلية النهائية قبل انتقال البرنامج للتسليم الحي.",
        ),
        href: `/workspace/pilot-launch/${id}`,
        icon: Rocket,
      },
      {
        title: t("Executive Summary", "الملخص التنفيذي"),
        description: t(
          "Board-level reach, delivery, budget, timeline, and strategic performance view.",
          "نظرة على المستوى القيادي للتغطية والتسليم والميزانية والجدول والأداء.",
        ),
        href: `/workspace/pilot-executive/${id}`,
        icon: BarChart3,
      },
      {
        title: t("Governance", "الحوكمة"),
        description: t(
          "Decision register, governance meetings, accountable owners, and action logs.",
          "سجل القرارات واجتماعات الحوكمة والمسؤولين وسجلات الإجراءات.",
        ),
        href: `/workspace/pilot-governance/${id}`,
        icon: Gavel,
      },
      {
        title: t("Printable Pilot Report", "تقرير تجريبي للطباعة"),
        description: t(
          "Generate a clean report for partners, funders, and governance review.",
          "أنشئ تقريرًا واضحًا للشركاء والممولين ومراجعة الحوكمة.",
        ),
        href: `/workspace/pilot-report/${id}`,
        icon: FileText,
      },
      {
        title: t("Program Record", "سجل البرنامج"),
        description: t(
          "Return to the full program management record and operational data.",
          "العودة لسجل إدارة البرنامج الكامل والبيانات التشغيلية.",
        ),
        href: `/workspace/programs/${id}`,
        icon: LayoutDashboard,
      },
      {
        title: t("Impact Reporting", "تقارير الأثر"),
        description: t(
          "Review organization-wide medicine access and impact performance.",
          "راجع أداء الوصول للأدوية والأثر على مستوى المنظمة.",
        ),
        href: "/impact",
        icon: Target,
      },
    ],
    [t, id],
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <Button asChild variant="ghost" className="mb-4 -ml-3">
        <Link href="/workspace">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("Back to workspace", "العودة لمساحة العمل")}
        </Link>
      </Button>
      <div className="mb-8">
        <Badge className="mb-3 bg-sky-100 text-sky-800">
          {t("Pilot Command Center", "مركز قيادة البرنامج التجريبي")}
        </Badge>
        <h1 className="text-3xl font-bold">
          {program?.name || t("Pilot program", "برنامج تجريبي")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t(
            "One place to manage pilot operations, governance, readiness, evidence, reporting, and executive oversight.",
            "مكان واحد لإدارة تشغيل البرنامج التجريبي والحوكمة والجاهزية والأدلة والتقارير والإشراف التنفيذي.",
          )}
        </p>
        {program && (
          <div className="mt-4 flex gap-2">
            <Badge variant="outline" className="capitalize">
              {(program.pilot_phase || "discovery").replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {program.status}
            </Badge>
          </div>
        )}
      </div>
      {error && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ title, description, href, icon: Icon }) => (
          <Card key={title} className="transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 min-h-16 text-sm text-muted-foreground">{description}</p>
              <Button asChild className="mt-5 w-full">
                <Link href={href}>{t("Open module", "فتح الوحدة")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
