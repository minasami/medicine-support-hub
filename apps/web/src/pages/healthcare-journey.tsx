import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BookOpen, CheckCircle2, GraduationCap, LockKeyhole, Network, ShieldCheck, Stethoscope } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Stage = {
  stage_key: string;
  sort_order: number;
  title_en: string;
  title_ar: string;
  summary_en: string;
  summary_ar: string;
  primary_actor: string;
  lifecycle_status: "live" | "pilot" | "gated" | "planned";
  public_route: string | null;
  staff_route: string | null;
  learning_course_slug: string | null;
  learning_route: string | null;
  source_systems: string[];
  required_capabilities: string[];
  release_gate: string | null;
};

type Readiness = {
  total_stages: number;
  live_stages: number;
  pilot_stages: number;
  gated_stages: number;
  planned_stages: number;
  stages_with_training: number;
  certified_ehr: boolean;
  clinical_release_ready: boolean;
};

const statusCopy = {
  live: ["Live", "متاح"],
  pilot: ["Pilot", "تجريبي"],
  gated: ["Security-gated", "مقيد أمنيًا"],
  planned: ["Planned", "مخطط"],
} as const;

export default function HealthcareJourney() {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Medicine Support Hub connected healthcare journey",
    description: "A role-aware map of live, training, planned, and security-gated healthcare workflows.",
    itemListElement: stages.map((stage, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: stage.title_en,
      description: stage.summary_en,
      url: stage.public_route ? `https://medicinesupport.app${stage.public_route}` : `https://medicinesupport.app/journey#${stage.stage_key}`,
    })),
  }), [stages]);

  usePageSeo({
    title: "Connected Healthcare Journey | Medicine Support Hub",
    description: "Navigate the connected patient, physician, diagnostics, insurance, pharmacy, medicine-support, training, and governance journey with transparent release status.",
    canonicalPath: "/journey",
    keywords: "connected healthcare journey, patient journey platform, physician workflow, laboratory workflow, radiology workflow, insurance authorization, pharmacy dispensing, healthcare training",
    jsonLd,
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabaseFetch<Stage[]>("/rest/v1/healthcare_journey_public_v1?select=*&order=sort_order.asc"),
      supabaseFetch<Readiness[]>("/rest/v1/healthcare_journey_readiness_v1?select=*"),
    ]).then(([stageRows, readinessRows]) => {
      setStages(stageRows);
      setReadiness(readinessRows[0] || null);
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : t("Could not load the healthcare journey.", "تعذر تحميل الرحلة الصحية."));
    }).finally(() => setLoading(false));
  }, []);

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary"><Network className="h-4 w-4" />{t("Connected healthcare journey", "رحلة صحية مترابطة")}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{t("Your path through care — clear and honest", "مسارك في الرعاية — واضح وصادق")}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{t("Find medicines, request support, and follow live steps. We label what is still pilot or security-gated.", "اعثر على الأدوية واطلب الدعم واتبع الخطوات المتاحة. نوضح ما يزال تجريبيًا أو مقيدًا أمنيًا.")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <a href="/medicines">{t("Browse medicines", "تصفح الأدوية")}<ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl">
              <a href="/account">{t("Create profile", "إنشاء ملف")}</a>
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-xl">
              <a href="/learn"><GraduationCap className="mr-2 h-4 w-4" />{t("Training", "التدريب")}</a>
            </Button>
          </div>
        </div>
        <div className="rounded-2xl border bg-muted/40 p-5">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary" />{t("Release truth", "حقيقة الجاهزية")}</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("The platform is live for medicine intelligence, support operations, pharmacy operations, marketplace participation, learning, and governed automation. It is not presented as a certified EHR, and protected clinical workflows remain gated until their authorization model passes independent review.", "المنصة متاحة لذكاء الدواء وعمليات الدعم وتشغيل الصيدليات والسوق والتعلم والأتمتة المنضبطة. ولا يتم تقديمها كسجل صحي إلكتروني معتمد، وتظل المسارات السريرية المحمية مقيدة حتى يجتاز نموذج التفويض مراجعة مستقلة.")}</p>
        </div>
      </div>
    </section>

    {readiness && <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label={t("Journey stages", "مراحل الرحلة")} value={readiness.total_stages} />
      <Metric label={t("Live now", "متاح الآن")} value={readiness.live_stages} />
      <Metric label={t("Security-gated", "مقيد أمنيًا")} value={readiness.gated_stages} />
      <Metric label={t("Planned", "مخطط")} value={readiness.planned_stages} />
      <Metric label={t("With training", "بها تدريب")} value={readiness.stages_with_training} />
    </section>}

    {error && (
      <Alert className="mt-5 border-amber-500/30 bg-amber-50/80 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertDescription>
          {t(
            "We could not load the journey map right now. You can still browse medicines or open training.",
            "تعذر تحميل خريطة الرحلة الآن. ما زال بإمكانك تصفح الأدوية أو فتح التدريب.",
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" className="rounded-lg bg-emerald-600 hover:bg-emerald-700">
              <a href="/medicines">{t("Medicines", "الأدوية")}</a>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-lg">
              <a href="/learn">{t("Training", "التدريب")}</a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )}
    {loading && (
      <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true" aria-live="polite">
        <p className="sr-only">{t("Loading connected journey…", "جاري تحميل الرحلة المترابطة…")}</p>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/50" />
        ))}
      </div>
    )}

    <section className="mt-8 grid gap-5 lg:grid-cols-2">
      {stages.map((stage, index) => {
        const title = language === "ar" ? stage.title_ar : stage.title_en;
        const summary = language === "ar" ? stage.summary_ar : stage.summary_en;
        const status = statusCopy[stage.lifecycle_status];
        const isLive = stage.lifecycle_status === "live";
        return <Card id={stage.stage_key} key={stage.stage_key} className="scroll-mt-20 overflow-hidden border border-slate-100 dark:border-slate-800 bg-card/65 backdrop-blur-md shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/20">
          <CardHeader className="border-b bg-muted/25">
            <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</div><div><CardTitle className="text-xl">{title}</CardTitle><p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{stage.primary_actor.replaceAll("_", " ")}</p></div></div><Badge variant={isLive ? "default" : stage.lifecycle_status === "gated" ? "secondary" : "outline"}>{t(status[0], status[1])}</Badge></div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
            {stage.source_systems?.length ? (
              <div className="hidden sm:flex flex-wrap gap-2">
                {stage.source_systems.map((source) => (
                  <Badge key={source} variant="outline" className="text-[10px] font-normal text-muted-foreground">
                    {source}
                  </Badge>
                ))}
              </div>
            ) : null}
            {stage.required_capabilities?.length ? (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("What you need", "ما تحتاجه")}
                </div>
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {stage.required_capabilities.slice(0, 4).map((capability) => (
                    <li key={capability} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{capability}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {stage.release_gate && <Alert><LockKeyhole className="h-4 w-4" /><AlertDescription><strong>{t("Release gate:", "شرط الإطلاق:")}</strong> {stage.release_gate}</AlertDescription></Alert>}
            <div className="flex flex-wrap gap-2">
              {stage.public_route && <Button asChild size="sm"><a href={stage.public_route}><Activity className="mr-2 h-4 w-4" />{t("Open service", "فتح الخدمة")}</a></Button>}
              {stage.staff_route && <Button asChild size="sm" variant="outline"><a href={stage.staff_route}><Stethoscope className="mr-2 h-4 w-4" />{t("Staff workspace", "مساحة الفريق")}</a></Button>}
              {stage.learning_route && <Button asChild size="sm" variant="secondary"><a href={stage.learning_route}><BookOpen className="mr-2 h-4 w-4" />{t("Training", "التدريب")}</a></Button>}
            </div>
          </CardContent>
        </Card>;
      })}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{Number(value || 0).toLocaleString()}</div></CardContent></Card>;
}
