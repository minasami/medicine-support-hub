import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  Circle,
  GraduationCap,
  HandHeart,
  Handshake,
  Megaphone,
  Network,
  PackageSearch,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { seoEntityPath } from "@/lib/seo-entities";

type IndustryProfile = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  contact_email: string | null;
  therapeutic_areas: string[];
  product_categories: string[];
  capabilities: string[];
  support_programs: string[];
  social_links: Record<string, string>;
  verification_status: string;
  is_public: boolean;
};

type Contribution = {
  id: string;
  profile_id: string;
  company_slug: string;
  contribution_type: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  evidence_urls: string[];
  status: string;
  published_at: string | null;
  created_at: string;
};

type SourceCompany = {
  company_slug: string;
  product_count: number;
  active_product_count: number;
  disease_area_count: number;
  generic_count: number;
};

const publicOpportunityTypes = new Set([
  "partnership_opportunity",
  "patient_support_program",
  "educational_resource",
]);

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function profileScore(profile: IndustryProfile, source?: SourceCompany) {
  const checks = [
    Boolean(profile.description?.trim()),
    Boolean(profile.website_url?.trim()),
    Boolean(profile.logo_url?.trim()),
    Boolean(profile.contact_email?.trim()),
    Boolean(profile.country?.trim()),
    profile.therapeutic_areas.length > 0,
    profile.product_categories.length > 0,
    profile.capabilities.length > 0,
    profile.support_programs.length > 0,
    Object.values(profile.social_links || {}).some(Boolean),
    Number(source?.active_product_count || 0) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function opportunityIcon(type: string) {
  if (type === "patient_support_program") return HandHeart;
  if (type === "educational_resource") return GraduationCap;
  return Handshake;
}

export default function IndustryOpportunityMarketplace() {
  const { t } = useLanguage();
  const { isAuthenticated, supabaseFetch } = usePatientAuth();
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [sourceCompanies, setSourceCompanies] = useState<SourceCompany[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [nextProfiles, nextContributions, nextSourceCompanies] = await Promise.all([
          supabaseFetch<IndustryProfile[]>("/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public&order=display_name.asc&limit=100"),
          supabaseFetch<Contribution[]>("/rest/v1/industry_company_contributions?select=id,profile_id,company_slug,contribution_type,title,summary,payload,evidence_urls,status,published_at,created_at&status=eq.approved&published_at=not.is.null&order=published_at.desc&limit=100"),
          supabaseFetch<SourceCompany[]>("/rest/v1/medicine_company_profiles?select=company_slug,product_count,active_product_count,disease_area_count,generic_count&order=product_count.desc&limit=200"),
        ]);
        if (cancelled) return;
        setProfiles(nextProfiles);
        setContributions(nextContributions);
        setSourceCompanies(nextSourceCompanies);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("Could not load the industry marketplace.", "تعذر تحميل سوق فرص القطاع."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const sourceBySlug = useMemo(() => new Map(sourceCompanies.map((company) => [company.company_slug, company])), [sourceCompanies]);
  const publicProfiles = useMemo(() => profiles.filter((profile) => profile.is_public && profile.verification_status === "verified"), [profiles]);
  const managedProfiles = useMemo(() => profiles.filter((profile) => !profile.is_public || profile.verification_status !== "verified" || isAuthenticated), [profiles, isAuthenticated]);
  const opportunities = useMemo(() => contributions.filter((item) => publicOpportunityTypes.has(item.contribution_type)), [contributions]);
  const filteredOpportunities = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return opportunities;
    return opportunities.filter((item) => `${item.title} ${item.summary} ${item.company_slug} ${item.contribution_type}`.toLocaleLowerCase().includes(normalized));
  }, [opportunities, query]);

  const totalProducts = publicProfiles.reduce((sum, profile) => sum + Number(sourceBySlug.get(profile.company_slug)?.active_product_count || 0), 0);
  const averageCompleteness = managedProfiles.length
    ? Math.round(managedProfiles.reduce((sum, profile) => sum + profileScore(profile, sourceBySlug.get(profile.company_slug)), 0) / managedProfiles.length)
    : 0;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><Sparkles className="h-4 w-4" />{t("Industry growth and opportunity marketplace", "سوق نمو وفرص قطاع الرعاية الصحية")}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">{t("Turn verified company participation into healthcare connections and measurable value", "حوّل مشاركة الشركات الموثقة إلى روابط صحية وقيمة قابلة للقياس")}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("A trusted marketplace where pharmaceutical and medical-product companies can strengthen official profiles, publish reviewed patient-support and partnership opportunities, connect evidence to products, and become discoverable across the healthcare cycle.", "سوق موثوق تستطيع فيه شركات الأدوية والمنتجات الطبية تقوية ملفاتها الرسمية، ونشر فرص دعم المرضى والشراكات بعد المراجعة، وربط الأدلة بالمنتجات، والظهور عبر دورة الرعاية الصحية.")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/industry#participate" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm">{t("Join as a founding industry partner", "انضم كشريك مؤسس من القطاع")}</a>
            <a href="#opportunities" className="rounded-lg border px-5 py-3 text-sm font-semibold hover:bg-muted">{t("Explore opportunities", "استكشف الفرص")}</a>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ValueCard icon={BadgeCheck} title={t("Verified market presence", "حضور سوقي موثق")} text={t("Official identity, capabilities, products, programs, and evidence in one connected profile.", "هوية رسمية وقدرات ومنتجات وبرامج وأدلة في ملف مترابط واحد.")} />
          <ValueCard icon={Network} title={t("Stakeholder connections", "روابط أصحاب المصلحة")} text={t("Connect companies with pharmacies, NGOs, clinicians, procurement, patients, programs, and impact reporting.", "ربط الشركات بالصيدليات والمؤسسات والأطباء والمشتريات والمرضى والبرامج وتقارير الأثر.")} />
          <ValueCard icon={BarChart3} title={t("Measurable readiness", "جاهزية قابلة للقياس")} text={t("Use profile-completeness and contribution signals to turn participation into a practical growth plan.", "استخدم اكتمال الملف وإشارات المساهمة لتحويل المشاركة إلى خطة نمو عملية.")} />
        </div>
      </div>
    </section>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={t("Verified companies", "الشركات الموثقة")} value={publicProfiles.length} />
      <Metric label={t("Connected active products", "المنتجات النشطة المترابطة")} value={totalProducts} />
      <Metric label={t("Published opportunities", "الفرص المنشورة")} value={opportunities.length} />
      <Metric label={t("Your average readiness", "متوسط جاهزيتك")} value={isAuthenticated ? `${averageCompleteness}%` : t("Sign in", "سجل الدخول")} />
    </section>

    {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading connected industry data...", "جاري تحميل بيانات القطاع المترابطة...")}</p>}

    {isAuthenticated && managedProfiles.length > 0 && <section className="mt-10">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Company success center", "مركز نجاح الشركة")}</p><h2 className="mt-2 text-3xl font-bold">{t("Make every verified profile commercially useful", "اجعل كل ملف موثق مفيدًا تجاريًا")}</h2><p className="mt-2 text-muted-foreground">{t("Complete the profile, connect products, publish reviewed value, and create clear next steps for healthcare stakeholders.", "أكمل الملف، واربط المنتجات، وانشر قيمة مراجعة، وأنشئ خطوات واضحة لأصحاب المصلحة في الرعاية الصحية.")}</p></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">{managedProfiles.map((profile) => {
        const source = sourceBySlug.get(profile.company_slug);
        const score = profileScore(profile, source);
        const companyContributions = contributions.filter((item) => item.company_slug === profile.company_slug);
        return <Card key={profile.id} className="border-primary/20">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{profile.display_name}{profile.verification_status === "verified" && <BadgeCheck className="h-5 w-5 text-primary" />}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(profile.company_type)}</p></div><Badge variant={score >= 80 ? "default" : "secondary"}>{score}% {t("ready", "جاهز")}</Badge></div></CardHeader>
          <CardContent className="space-y-5">
            <div><div className="mb-2 flex items-center justify-between text-sm"><span>{t("Profile completeness", "اكتمال الملف")}</span><strong>{score}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${score}%` }} /></div></div>
            <div className="grid gap-3 sm:grid-cols-3"><MiniMetric label={t("Active products", "منتجات نشطة")} value={source?.active_product_count || 0} /><MiniMetric label={t("Disease areas", "مجالات مرضية")} value={source?.disease_area_count || profile.therapeutic_areas.length} /><MiniMetric label={t("Published value", "قيمة منشورة")} value={companyContributions.length} /></div>
            <ReadinessChecklist profile={profile} source={source} t={t} />
            <div className="flex flex-wrap gap-2"><a href="/industry#participate" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{t("Improve official profile", "حسّن الملف الرسمي")}</a><a href={seoEntityPath("company", profile.company_slug)} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("View public profile", "عرض الملف العام")}</a></div>
          </CardContent>
        </Card>;
      })}</div>
    </section>}

    <section id="opportunities" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Reviewed public opportunities", "فرص عامة خاضعة للمراجعة")}</p><h2 className="mt-2 text-3xl font-bold">{t("Connect support, education, and partnerships to the people who can act", "اربط الدعم والتعليم والشراكات بمن يستطيعون التنفيذ")}</h2><p className="mt-2 max-w-3xl text-muted-foreground">{t("Approved company opportunities become discoverable to healthcare programs, NGOs, pharmacies, clinicians, procurement teams, and other partners.", "تصبح فرص الشركات المعتمدة قابلة للاكتشاف من البرامج الصحية والمؤسسات والصيدليات والأطباء وفرق المشتريات والشركاء الآخرين.")}</p></div>
        <div className="w-full sm:w-80"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search opportunities...", "ابحث في الفرص...")} /></div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredOpportunities.map((item) => {
        const Icon = opportunityIcon(item.contribution_type);
        const profile = publicProfiles.find((candidate) => candidate.company_slug === item.company_slug);
        return <Card key={item.id} className="h-full shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
          <CardHeader><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><Badge variant="outline">{humanize(item.contribution_type)}</Badge></div><CardTitle className="mt-4 text-xl leading-7">{item.title}</CardTitle><p className="text-sm font-medium text-primary">{profile?.display_name || item.company_slug}</p></CardHeader>
          <CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">{item.summary}</p><div className="flex flex-wrap gap-2">{item.evidence_urls.slice(0, 2).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted">{t("Evidence", "دليل")}</a>)}</div><a href={seoEntityPath("company", item.company_slug)} className="inline-flex items-center text-sm font-semibold text-primary">{t("Open connected company profile", "فتح ملف الشركة المترابط")}<ArrowRight className="ml-2 h-4 w-4" /></a></CardContent>
        </Card>;
      })}</div>

      {!loading && filteredOpportunities.length === 0 && <Card className="mt-6 border-dashed"><CardContent className="p-8 text-center"><Megaphone className="mx-auto h-10 w-10 text-primary" /><h3 className="mt-4 text-xl font-semibold">{t("Become one of the first published industry partners", "كن من أوائل الشركاء المنشورين من القطاع")}</h3><p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t("Claim a verified profile and submit a patient-support program, educational resource, or partnership opportunity. Publication happens only after evidence review.", "طالب بملف موثق وأرسل برنامج دعم مرضى أو موردًا تعليميًا أو فرصة شراكة. لا يتم النشر إلا بعد مراجعة الأدلة.")}</p><a href="/industry#participate" className="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{t("Start company verification", "ابدأ توثيق الشركة")}</a></CardContent></Card>}
    </section>

    <section className="mt-12 rounded-3xl border bg-muted/30 p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("Founding industry partner program", "برنامج الشركاء المؤسسين من القطاع")}</p><h2 className="mt-2 text-3xl font-bold">{t("Help shape the platform companies will actually use", "ساعد في تشكيل المنصة التي ستستخدمها الشركات فعليًا")}</h2><p className="mt-3 max-w-3xl text-muted-foreground">{t("Early verified partners can help define contribution standards, profile structures, evidence expectations, stakeholder connections, and practical healthcare use cases while the platform preserves independent review and public trust.", "يمكن للشركاء الأوائل الموثقين المساعدة في تحديد معايير المساهمة وهيكل الملفات ومتطلبات الأدلة وروابط أصحاب المصلحة وحالات الاستخدام الصحية العملية، مع حفاظ المنصة على المراجعة المستقلة والثقة العامة.")}</p></div><a href="/contact" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">{t("Discuss a founding partnership", "ناقش شراكة تأسيسية")}</a></div>
    </section>

    <Alert className="mt-8"><AlertDescription>{t("Company profiles and contributions are attributable and moderated. They never overwrite independent medicine, regulatory, clinical, availability, or pricing evidence. Public opportunities are informational and do not constitute medical advice or endorsement.", "ملفات الشركات ومساهماتها منسوبة وخاضعة للمراجعة، ولا تكتب فوق أدلة الأدوية أو التنظيم أو الممارسة السريرية أو التوافر أو الأسعار المستقلة. الفرص العامة معلوماتية ولا تمثل نصيحة طبية أو اعتمادًا.")}</AlertDescription></Alert>
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div></CardContent></Card>;
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-bold">{value.toLocaleString()}</div></div>;
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return <Card className="border-primary/15"><CardContent className="flex gap-3 p-4"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div><div className="font-semibold">{title}</div><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></CardContent></Card>;
}

function ReadinessChecklist({ profile, source, t }: { profile: IndustryProfile; source?: SourceCompany; t: (en: string, ar: string) => string }) {
  const items = [
    { done: Boolean(profile.description && profile.website_url && profile.logo_url), label: t("Complete identity, overview, website, and logo", "أكمل الهوية والنبذة والموقع والشعار") },
    { done: profile.therapeutic_areas.length > 0 && profile.product_categories.length > 0, label: t("Define therapeutic areas and product categories", "حدد المجالات العلاجية وفئات المنتجات") },
    { done: profile.capabilities.length > 0, label: t("Publish capabilities for partners and procurement", "انشر القدرات للشركاء والمشتريات") },
    { done: profile.support_programs.length > 0, label: t("Connect patient-support or access programs", "اربط برامج دعم المرضى أو الإتاحة") },
    { done: Number(source?.active_product_count || 0) > 0, label: t("Connect the official profile to source-backed products", "اربط الملف الرسمي بمنتجات مدعومة بالمصدر") },
  ];
  return <div className="space-y-2">{items.map((item) => <div key={item.label} className="flex items-start gap-2 text-sm">{item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span></div>)}</div>;
}
