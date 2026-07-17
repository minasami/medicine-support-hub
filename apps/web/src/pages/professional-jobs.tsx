import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  headline: string | null;
  professional_type: string;
  summary: string | null;
  city: string | null;
  country: string | null;
  years_experience: number;
  skills: string[];
  open_to_work: boolean;
  visibility: string;
  verification_status: string;
};
type Company = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
  verification_status: string;
  is_public: boolean;
};
type Membership = { organization_id: string; role: string };
type Job = {
  id: string;
  organization_id: string;
  company_profile_id: string;
  company_name: string;
  company_slug: string;
  title: string;
  employment_type: string;
  workplace_type: string;
  city: string | null;
  country: string | null;
  description: string;
  requirements: string | null;
  skills: string[];
  status: string;
  published_at: string;
  closes_at: string | null;
};
type Employment = {
  id: string;
  profile_id: string;
  organization_id: string | null;
  company_name: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  verification_status: string;
  is_public: boolean;
};
type Application = {
  id: string;
  job_id: string;
  applicant_id: string;
  status: string;
  created_at: string;
  professional_job_posts: {
    title: string;
    company_name: string;
    city: string | null;
    country: string | null;
    organization_id: string;
  } | null;
  professional_profiles: {
    full_name: string;
    headline: string | null;
    professional_type: string;
  } | null;
};
type Verification = {
  id: string;
  organization_id: string;
  status: string;
  requester_note: string | null;
  professional_employment_records: {
    professional_name: string;
    title: string;
    company_name: string;
    start_date: string;
    end_date: string | null;
    is_current: boolean;
  } | null;
};

const professionalTypes = [
  "medical_representative",
  "sales_representative",
  "pharmacist",
  "pharmacy_assistant",
  "product_manager",
  "medical_scientific_liaison",
  "specialist",
  "other",
];
const employmentTypes = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
];
const workplaceTypes = ["on_site", "hybrid", "remote"];
const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const splitList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
const place = (city: string | null, country: string | null) =>
  [city, country].filter(Boolean).join(", ");
const month = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
      }).format(new Date(value))
    : "";

export default function ProfessionalJobs() {
  const { t } = useLanguage();
  const {
    session,
    profile: accountProfile,
    isAuthenticated,
    supabaseFetch,
  } = usePatientAuth();
  usePageSeo({
    title:
      "Pharma Jobs and Verified Professional Network | Medicine Support Hub",
    description:
      "Browse pharmaceutical and healthcare jobs, build a professional profile, publish vacancies through verified companies, and request consent-based employment verification.",
    keywords:
      "pharma jobs, medical representative jobs, pharmaceutical careers, healthcare recruitment Egypt",
    canonicalPath: "/jobs",
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employment, setEmployment] = useState<Employment[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [companyApplications, setCompanyApplications] = useState<Application[]>(
    [],
  );
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [query, setQuery] = useState("");
  const [workplace, setWorkplace] = useState("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [coverNote, setCoverNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    fullName: "",
    headline: "",
    professionalType: "medical_representative",
    summary: "",
    city: "",
    country: "Egypt",
    yearsExperience: "0",
    skills: "",
    openToWork: true,
    visibility: "public",
  });
  const [employmentDraft, setEmploymentDraft] = useState({
    organizationId: "",
    companyName: "",
    title: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
    requesterNote: "",
  });
  const [jobDraft, setJobDraft] = useState({
    organizationId: "",
    title: "",
    employmentType: "full_time",
    workplaceType: "on_site",
    city: "",
    country: "Egypt",
    description: "",
    requirements: "",
    skills: "",
    closesAt: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [publicJobs, publicCompanies] = await Promise.all([
        supabaseFetch<Job[]>(
          "/rest/v1/professional_job_posts?select=id,organization_id,company_profile_id,company_name,company_slug,title,employment_type,workplace_type,city,country,description,requirements,skills,status,published_at,closes_at&status=eq.published&order=published_at.desc&limit=100",
        ),
        supabaseFetch<Company[]>(
          "/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,verification_status,is_public&verification_status=eq.verified&is_public=eq.true&order=display_name.asc&limit=200",
        ),
      ]);
      setJobs(publicJobs);
      setCompanies(publicCompanies);
      if (!isAuthenticated || !session?.user?.id) {
        setMemberships([]);
        setProfile(null);
        setEmployment([]);
        setApplications([]);
        setCompanyApplications([]);
        setVerifications([]);
        return;
      }
      const userId = session.user.id;
      const [memberRows, profileRows, applicationRows, verificationRows] =
        await Promise.all([
          supabaseFetch<Membership[]>(
            `/rest/v1/organization_members?select=organization_id,role&user_id=eq.${userId}&is_active=eq.true&limit=100`,
          ),
          supabaseFetch<Profile[]>(
            `/rest/v1/professional_profiles?select=*&user_id=eq.${userId}&limit=1`,
          ),
          supabaseFetch<Application[]>(
            "/rest/v1/professional_job_applications?select=id,job_id,applicant_id,status,created_at,professional_job_posts(title,company_name,city,country,organization_id),professional_profiles(full_name,headline,professional_type)&order=created_at.desc&limit=200",
          ),
          supabaseFetch<Verification[]>(
            "/rest/v1/employment_verification_requests?select=id,organization_id,status,requester_note,professional_employment_records(professional_name,title,company_name,start_date,end_date,is_current)&order=created_at.desc&limit=100",
          ),
        ]);
      setMemberships(memberRows);
      setApplications(
        applicationRows.filter((item) => item.applicant_id === userId),
      );
      const memberOrganizationIds = new Set(
        memberRows.map((membership) => membership.organization_id),
      );
      setCompanyApplications(
        applicationRows.filter(
          (item) =>
            item.professional_job_posts?.organization_id &&
            memberOrganizationIds.has(
              item.professional_job_posts.organization_id,
            ),
        ),
      );
      setVerifications(verificationRows);
      const nextProfile = profileRows[0] || null;
      setProfile(nextProfile);
      if (nextProfile) {
        setProfileDraft({
          fullName: nextProfile.full_name,
          headline: nextProfile.headline || "",
          professionalType: nextProfile.professional_type,
          summary: nextProfile.summary || "",
          city: nextProfile.city || "",
          country: nextProfile.country || "Egypt",
          yearsExperience: String(nextProfile.years_experience || 0),
          skills: nextProfile.skills.join(", "),
          openToWork: nextProfile.open_to_work,
          visibility: nextProfile.visibility,
        });
        setEmployment(
          await supabaseFetch<Employment[]>(
            `/rest/v1/professional_employment_records?select=*&profile_id=eq.${nextProfile.id}&order=is_current.desc,start_date.desc&limit=100`,
          ),
        );
      } else {
        setEmployment([]);
        setProfileDraft((current) => ({
          ...current,
          fullName: accountProfile?.full_name || current.fullName,
          city: accountProfile?.city || current.city,
        }));
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load the jobs network.", "تعذر تحميل شبكة الوظائف."),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [isAuthenticated, session?.user?.id, session?.access_token]);

  const memberOrgIds = useMemo(
    () => new Set(memberships.map((m) => m.organization_id)),
    [memberships],
  );
  const managedCompanies = useMemo(
    () =>
      companies.filter((company) => memberOrgIds.has(company.organization_id)),
    [companies, memberOrgIds],
  );
  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter(
      (job) =>
        (workplace === "all" || job.workplace_type === workplace) &&
        (!needle ||
          `${job.title} ${job.company_name} ${job.city || ""} ${job.country || ""} ${job.skills.join(" ")}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [jobs, query, workplace]);
  const appliedJobIds = useMemo(
    () => new Set(applications.map((item) => item.job_id)),
    [applications],
  );
  const pendingCompanyVerifications = verifications.filter(
    (item) =>
      memberOrgIds.has(item.organization_id) && item.status === "pending",
  );

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const editable = {
      full_name: profileDraft.fullName.trim(),
      headline: profileDraft.headline.trim() || null,
      professional_type: profileDraft.professionalType,
      summary: profileDraft.summary.trim() || null,
      city: profileDraft.city.trim() || null,
      country: profileDraft.country.trim() || null,
      years_experience: Number(profileDraft.yearsExperience || 0),
      skills: splitList(profileDraft.skills),
      open_to_work: profileDraft.openToWork,
      visibility: profileDraft.visibility,
    };
    const body = profile ? editable : { ...editable, user_id: session.user.id };
    try {
      await supabaseFetch(
        profile
          ? `/rest/v1/professional_profiles?id=eq.${profile.id}`
          : "/rest/v1/professional_profiles",
        {
          method: profile ? "PATCH" : "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(body),
        },
      );
      setMessage(t("Professional profile saved.", "تم حفظ الملف المهني."));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not save the profile.", "تعذر حفظ الملف."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function addEmployment(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const company = companies.find(
      (item) => item.organization_id === employmentDraft.organizationId,
    );
    try {
      const rows = await supabaseFetch<Employment[]>(
        "/rest/v1/professional_employment_records?select=id",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            profile_id: profile.id,
            organization_id: company?.organization_id || null,
            professional_name: profile.full_name,
            company_name:
              company?.display_name || employmentDraft.companyName.trim(),
            title: employmentDraft.title.trim(),
            start_date: employmentDraft.startDate,
            end_date: employmentDraft.isCurrent
              ? null
              : employmentDraft.endDate || null,
            is_current: employmentDraft.isCurrent,
            description: employmentDraft.description.trim() || null,
            is_public: true,
          }),
        },
      );
      if (company && rows[0])
        await supabaseFetch("/rest/v1/employment_verification_requests", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            employment_record_id: rows[0].id,
            organization_id: company.organization_id,
            requested_by: session.user.id,
            requester_note: employmentDraft.requesterNote.trim() || null,
          }),
        });
      setEmploymentDraft({
        organizationId: "",
        companyName: "",
        title: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
        requesterNote: "",
      });
      setMessage(
        company
          ? t(
              "Employment added and verification requested.",
              "تمت إضافة الخبرة وإرسال طلب توثيق.",
            )
          : t(
              "Self-reported employment added.",
              "تمت إضافة الخبرة كخبرة مسجلة ذاتيًا.",
            ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not add employment.", "تعذر إضافة الخبرة."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function publishJob(event: React.FormEvent) {
    event.preventDefault();
    const organizationId =
      jobDraft.organizationId || managedCompanies[0]?.organization_id;
    const company = managedCompanies.find(
      (item) => item.organization_id === organizationId,
    );
    if (!company || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/professional_job_posts", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: company.organization_id,
          company_profile_id: company.id,
          company_name: company.display_name,
          company_slug: company.company_slug,
          posted_by: session.user.id,
          title: jobDraft.title.trim(),
          employment_type: jobDraft.employmentType,
          workplace_type: jobDraft.workplaceType,
          city: jobDraft.city.trim() || null,
          country: jobDraft.country.trim() || null,
          description: jobDraft.description.trim(),
          requirements: jobDraft.requirements.trim() || null,
          skills: splitList(jobDraft.skills),
          status: "published",
          published_at: new Date().toISOString(),
          closes_at: jobDraft.closesAt
            ? new Date(jobDraft.closesAt).toISOString()
            : null,
        }),
      });
      setJobDraft({
        organizationId: company.organization_id,
        title: "",
        employmentType: "full_time",
        workplaceType: "on_site",
        city: "",
        country: "Egypt",
        description: "",
        requirements: "",
        skills: "",
        closesAt: "",
      });
      setMessage(t("Vacancy published.", "تم نشر الوظيفة."));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not publish the vacancy.", "تعذر نشر الوظيفة."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedJob || !profile || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/professional_job_applications", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          job_id: selectedJob.id,
          applicant_profile_id: profile.id,
          applicant_id: session.user.id,
          cover_note: coverNote.trim() || null,
          status: "submitted",
        }),
      });
      setSelectedJob(null);
      setCoverNote("");
      setMessage(t("Application submitted.", "تم إرسال طلب التقديم."));
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the application.", "تعذر إرسال طلب التقديم."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewVerification(
    id: string,
    decision: "approved" | "declined",
  ) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_employment_verification", {
        method: "POST",
        body: JSON.stringify({
          target_request: id,
          decision,
          reviewer_note: null,
        }),
      });
      setMessage(
        decision === "approved"
          ? t("Employment verified.", "تم توثيق الخبرة.")
          : t("Request declined privately.", "تم رفض الطلب بشكل خاص."),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not review the request.", "تعذرت مراجعة الطلب."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function reviewApplication(
    applicationId: string,
    decision:
      | "reviewing"
      | "shortlisted"
      | "interview"
      | "accepted"
      | "declined"
      | "withdrawn"
      | "hired",
  ) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_professional_job_application", {
        method: "POST",
        body: JSON.stringify({
          target_application: applicationId,
          decision,
        }),
      });
      setMessage(
        decision === "withdrawn"
          ? t("Application withdrawn.", "تم سحب طلب التقديم.")
          : t("Application status updated.", "تم تحديث حالة طلب التقديم."),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not update the application.", "تعذر تحديث طلب التقديم."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary">
              <Sparkles className="h-4 w-4" />
              {t("Pharma professional network", "الشبكة المهنية لقطاع الدواء")}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              {t(
                "Verified careers without blacklists",
                "مسارات مهنية موثقة دون قوائم سوداء",
              )}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              {t(
                "Browse jobs as a guest. Sign in only when you want to build a profile, verify employment, apply, or recruit through a verified company.",
                "تصفح الوظائف كزائر، وسجل الدخول فقط عند إنشاء ملف مهني أو توثيق خبرة أو التقديم أو التوظيف من خلال شركة موثقة.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#open-jobs"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {t("Browse jobs", "تصفح الوظائف")}
              </a>
              <a
                href="#professional-profile"
                className="rounded-lg border px-5 py-3 text-sm font-semibold hover:bg-muted"
              >
                {t("Build your profile", "أنشئ ملفك")}
              </a>
            </div>
          </div>
          <div className="grid gap-3">
            <Value
              icon={Search}
              title={t("Guest-first discovery", "تصفح بلا تسجيل")}
              text={t(
                "Search roles immediately without an account.",
                "ابحث في الوظائف فورًا دون حساب.",
              )}
            />
            <Value
              icon={FileCheck2}
              title={t("Factual verification", "توثيق واقعي")}
              text={t(
                "Companies verify employer, title, and dates only.",
                "توثق الشركات جهة العمل والمسمى والفترة فقط.",
              )}
            />
            <Value
              icon={ShieldCheck}
              title={t("Consent-based trust", "ثقة قائمة على الموافقة")}
              text={t(
                "No secret scores, anonymous accusations, or public dismissal reasons.",
                "لا درجات سرية ولا اتهامات مجهولة ولا أسباب فصل علنية.",
              )}
            />
          </div>
        </div>
      </section>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("Open jobs", "وظائف متاحة")} value={jobs.length} />
        <Metric
          label={t("Verified companies", "شركات موثقة")}
          value={companies.length}
        />
        <Metric
          label={t("Your applications", "طلباتك")}
          value={
            isAuthenticated ? applications.length : t("Sign in", "سجل الدخول")
          }
        />
        <Metric
          label={t("Verified experience", "خبرة موثقة")}
          value={
            profile
              ? employment.filter(
                  (item) => item.verification_status === "verified",
                ).length
              : t("Create profile", "أنشئ ملفًا")
          }
        />
      </section>
      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mt-6">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <p className="mt-6 text-sm text-muted-foreground">
          {t("Loading jobs...", "جاري تحميل الوظائف...")}
        </p>
      )}

      <section id="open-jobs" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("Open vacancies", "الوظائف المتاحة")}
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {t(
                "Find your next healthcare role",
                "ابحث عن فرصتك التالية في الرعاية الصحية",
              )}
            </h2>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[18rem_10rem]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                "Search title, company, skill...",
                "ابحث بالمسمى أو الشركة أو المهارة...",
              )}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={workplace}
              onChange={(e) => setWorkplace(e.target.value)}
            >
              <option value="all">
                {t("All work modes", "كل أنماط العمل")}
              </option>
              {workplaceTypes.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>
                  <Badge variant="outline">
                    {humanize(job.workplace_type)}
                  </Badge>
                </div>
                <CardTitle className="mt-4 text-xl">{job.title}</CardTitle>
                <p className="text-sm font-medium text-primary">
                  {job.company_name}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {place(job.city, job.country) ||
                    t("Location not specified", "الموقع غير محدد")}
                </p>
                <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
                  {job.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {job.skills.slice(0, 5).map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => setSelectedJob(job)}
                  disabled={appliedJobIds.has(job.id)}
                >
                  {appliedJobIds.has(job.id)
                    ? t("Applied", "تم التقديم")
                    : t("View and apply", "عرض والتقديم")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {!loading && filteredJobs.length === 0 && (
          <Card className="mt-6 border-dashed">
            <CardContent className="p-8 text-center">
              <BriefcaseBusiness className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">
                {t("No matching vacancies yet", "لا توجد وظائف مطابقة حاليًا")}
              </h3>
            </CardContent>
          </Card>
        )}
      </section>

      {selectedJob && (
        <section className="mt-8">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>
                {selectedJob.title} — {selectedJob.company_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isAuthenticated ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-muted-foreground">
                    {t(
                      "Sign in only when you are ready to apply.",
                      "سجل الدخول فقط عندما تكون مستعدًا للتقديم.",
                    )}
                  </p>
                  <a
                    href="/account"
                    className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    {t("Sign in", "تسجيل الدخول")}
                  </a>
                </div>
              ) : !profile ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-muted-foreground">
                    {t(
                      "Create your professional profile before applying.",
                      "أنشئ ملفك المهني قبل التقديم.",
                    )}
                  </p>
                  <a
                    href="#professional-profile"
                    className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                  >
                    {t("Create profile", "إنشاء الملف")}
                  </a>
                </div>
              ) : (
                <form onSubmit={apply}>
                  <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {selectedJob.description}
                  </p>
                  {selectedJob.requirements && (
                    <p className="mt-4 whitespace-pre-line text-sm">
                      <strong>{t("Requirements", "المتطلبات")}:</strong>{" "}
                      {selectedJob.requirements}
                    </p>
                  )}
                  <Label className="mt-5 block">
                    {t("Cover note", "رسالة تقديم")}
                  </Label>
                  <Textarea
                    className="mt-1 min-h-28"
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                  />
                  <div className="mt-4 flex gap-2">
                    <Button type="submit" disabled={saving}>
                      <Send className="mr-2 h-4 w-4" />
                      {t("Submit application", "إرسال الطلب")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedJob(null)}
                    >
                      {t("Cancel", "إلغاء")}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <section id="professional-profile" className="mt-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("Professional workspace", "مساحة العمل المهنية")}
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            {t("Own your professional record", "امتلك سجلك المهني")}
          </h2>
        </div>
        {!isAuthenticated ? (
          <Card className="mt-5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div>
                <h3 className="font-semibold">
                  {t(
                    "Registration is optional until you need it",
                    "التسجيل اختياري حتى تحتاج إليه",
                  )}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "Create a profile, request verification, and apply after signing in.",
                    "أنشئ ملفًا واطلب التوثيق وقدم على الوظائف بعد تسجيل الدخول.",
                  )}
                </p>
              </div>
              <a
                href="/account"
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                {t("Open account", "فتح الحساب")}
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-primary" />
                  {t("Professional profile", "الملف المهني")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={saveProfile}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <Field
                    label={t("Full name", "الاسم الكامل")}
                    value={profileDraft.fullName}
                    onChange={(value) =>
                      setProfileDraft({ ...profileDraft, fullName: value })
                    }
                    required
                  />
                  <Field
                    label={t("Headline", "العنوان المهني")}
                    value={profileDraft.headline}
                    onChange={(value) =>
                      setProfileDraft({ ...profileDraft, headline: value })
                    }
                  />
                  <SelectField
                    label={t("Professional type", "التخصص المهني")}
                    value={profileDraft.professionalType}
                    values={professionalTypes}
                    onChange={(value) =>
                      setProfileDraft({
                        ...profileDraft,
                        professionalType: value,
                      })
                    }
                  />
                  <Field
                    label={t("Years of experience", "سنوات الخبرة")}
                    type="number"
                    min="0"
                    value={profileDraft.yearsExperience}
                    onChange={(value) =>
                      setProfileDraft({
                        ...profileDraft,
                        yearsExperience: value,
                      })
                    }
                  />
                  <Field
                    label={t("City", "المدينة")}
                    value={profileDraft.city}
                    onChange={(value) =>
                      setProfileDraft({ ...profileDraft, city: value })
                    }
                  />
                  <Field
                    label={t("Country", "الدولة")}
                    value={profileDraft.country}
                    onChange={(value) =>
                      setProfileDraft({ ...profileDraft, country: value })
                    }
                  />
                  <div className="md:col-span-2">
                    <Field
                      label={t(
                        "Skills, separated by commas",
                        "المهارات مفصولة بفواصل",
                      )}
                      value={profileDraft.skills}
                      onChange={(value) =>
                        setProfileDraft({ ...profileDraft, skills: value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t("Professional summary", "الملخص المهني")}</Label>
                    <Textarea
                      className="mt-1"
                      value={profileDraft.summary}
                      onChange={(e) =>
                        setProfileDraft({
                          ...profileDraft,
                          summary: e.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={profileDraft.openToWork}
                      onChange={(e) =>
                        setProfileDraft({
                          ...profileDraft,
                          openToWork: e.target.checked,
                        })
                      }
                    />
                    {t("Open to work", "متاح لفرص العمل")}
                  </label>
                  <SelectField
                    label={t("Profile visibility", "ظهور الملف")}
                    value={profileDraft.visibility}
                    values={["public", "private"]}
                    onChange={(value) =>
                      setProfileDraft({ ...profileDraft, visibility: value })
                    }
                  />
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={
                        saving || profileDraft.fullName.trim().length < 3
                      }
                    >
                      {profile
                        ? t("Update profile", "تحديث الملف")
                        : t("Create profile", "إنشاء الملف")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-primary" />
                  {t("Employment and verification", "الخبرات والتوثيق")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!profile ? (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "Save your professional profile first.",
                      "احفظ ملفك المهني أولًا.",
                    )}
                  </p>
                ) : (
                  <>
                    <form
                      onSubmit={addEmployment}
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <SelectField
                        label={t(
                          "Verified company (optional)",
                          "شركة موثقة (اختياري)",
                        )}
                        value={employmentDraft.organizationId}
                        values={[
                          "",
                          ...companies.map((c) => c.organization_id),
                        ]}
                        labels={Object.fromEntries([
                          ["", t("Self-reported company", "شركة مسجلة ذاتيًا")],
                          ...companies.map((c) => [
                            c.organization_id,
                            c.display_name,
                          ]),
                        ])}
                        onChange={(value) =>
                          setEmploymentDraft({
                            ...employmentDraft,
                            organizationId: value,
                          })
                        }
                      />
                      {!employmentDraft.organizationId && (
                        <Field
                          label={t("Company name", "اسم الشركة")}
                          value={employmentDraft.companyName}
                          onChange={(value) =>
                            setEmploymentDraft({
                              ...employmentDraft,
                              companyName: value,
                            })
                          }
                          required
                        />
                      )}
                      <Field
                        label={t("Job title", "المسمى الوظيفي")}
                        value={employmentDraft.title}
                        onChange={(value) =>
                          setEmploymentDraft({
                            ...employmentDraft,
                            title: value,
                          })
                        }
                        required
                      />
                      <Field
                        label={t("Start date", "تاريخ البداية")}
                        type="date"
                        value={employmentDraft.startDate}
                        onChange={(value) =>
                          setEmploymentDraft({
                            ...employmentDraft,
                            startDate: value,
                          })
                        }
                        required
                      />
                      <Field
                        label={t("End date", "تاريخ النهاية")}
                        type="date"
                        value={employmentDraft.endDate}
                        onChange={(value) =>
                          setEmploymentDraft({
                            ...employmentDraft,
                            endDate: value,
                          })
                        }
                        disabled={employmentDraft.isCurrent}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={employmentDraft.isCurrent}
                          onChange={(e) =>
                            setEmploymentDraft({
                              ...employmentDraft,
                              isCurrent: e.target.checked,
                              endDate: e.target.checked
                                ? ""
                                : employmentDraft.endDate,
                            })
                          }
                        />
                        {t("I currently work here", "أعمل هنا حاليًا")}
                      </label>
                      <div className="md:col-span-2">
                        <Field
                          label={t(
                            "Private note to verifier",
                            "ملاحظة خاصة للمراجع",
                          )}
                          value={employmentDraft.requesterNote}
                          onChange={(value) =>
                            setEmploymentDraft({
                              ...employmentDraft,
                              requesterNote: value,
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button
                          type="submit"
                          disabled={
                            saving ||
                            !employmentDraft.title ||
                            !employmentDraft.startDate
                          }
                        >
                          {employmentDraft.organizationId
                            ? t(
                                "Add and request verification",
                                "إضافة وطلب التوثيق",
                              )
                            : t("Add employment", "إضافة الخبرة")}
                        </Button>
                      </div>
                    </form>
                    <div className="mt-6 space-y-3">
                      {employment.map((item) => (
                        <div key={item.id} className="rounded-xl border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">{item.title}</h3>
                              <p className="text-sm text-primary">
                                {item.company_name}
                              </p>
                            </div>
                            <Status value={item.verification_status} />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {month(item.start_date)} –{" "}
                            {item.is_current
                              ? t("Present", "حتى الآن")
                              : month(item.end_date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BriefcaseBusiness className="h-5 w-5 text-primary" />
                  {t("Company application inbox", "طلبات التوظيف للشركة")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {companyApplications.map((application) => (
                  <div key={application.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {application.professional_profiles?.full_name ||
                            t("Applicant", "متقدم")}
                        </h3>
                        <p className="text-sm text-primary">
                          {application.professional_job_posts?.title}
                        </p>
                        {application.professional_profiles?.headline && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {application.professional_profiles.headline}
                          </p>
                        )}
                      </div>
                      <Status value={application.status} />
                    </div>
                    {!["declined", "withdrawn", "hired"].includes(
                      application.status,
                    ) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            reviewApplication(application.id, "reviewing")
                          }
                        >
                          {t("Reviewing", "قيد المراجعة")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            reviewApplication(application.id, "shortlisted")
                          }
                        >
                          {t("Shortlist", "القائمة المختصرة")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            reviewApplication(application.id, "interview")
                          }
                        >
                          {t("Interview", "مقابلة")}
                        </Button>
                        <Button
                          size="sm"
                          disabled={saving}
                          onClick={() =>
                            reviewApplication(application.id, "hired")
                          }
                        >
                          {t("Hired", "تم التعيين")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={saving}
                          onClick={() =>
                            reviewApplication(application.id, "declined")
                          }
                        >
                          {t("Decline privately", "رفض خاص")}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {companyApplications.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "No applications have reached your company yet.",
                      "لم تصل طلبات توظيف إلى شركتك بعد.",
                    )}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {isAuthenticated && managedCompanies.length > 0 && (
        <section className="mt-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("Verified company workspace", "مساحة الشركة الموثقة")}
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {t("Recruit and verify responsibly", "وظّف ووثّق بمسؤولية")}
            </h2>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {t("Publish a vacancy", "نشر وظيفة")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={publishJob}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <SelectField
                    label={t("Company", "الشركة")}
                    value={
                      jobDraft.organizationId ||
                      managedCompanies[0].organization_id
                    }
                    values={managedCompanies.map((c) => c.organization_id)}
                    labels={Object.fromEntries(
                      managedCompanies.map((c) => [
                        c.organization_id,
                        c.display_name,
                      ]),
                    )}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, organizationId: value })
                    }
                  />
                  <Field
                    label={t("Job title", "المسمى الوظيفي")}
                    value={jobDraft.title}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, title: value })
                    }
                    required
                  />
                  <SelectField
                    label={t("Employment type", "نوع التعاقد")}
                    value={jobDraft.employmentType}
                    values={employmentTypes}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, employmentType: value })
                    }
                  />
                  <SelectField
                    label={t("Work mode", "نمط العمل")}
                    value={jobDraft.workplaceType}
                    values={workplaceTypes}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, workplaceType: value })
                    }
                  />
                  <Field
                    label={t("City", "المدينة")}
                    value={jobDraft.city}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, city: value })
                    }
                  />
                  <Field
                    label={t("Country", "الدولة")}
                    value={jobDraft.country}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, country: value })
                    }
                  />
                  <div className="md:col-span-2">
                    <Label>{t("Description", "الوصف")}</Label>
                    <Textarea
                      className="mt-1 min-h-28"
                      value={jobDraft.description}
                      onChange={(e) =>
                        setJobDraft({
                          ...jobDraft,
                          description: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Field
                      label={t(
                        "Skills, separated by commas",
                        "المهارات مفصولة بفواصل",
                      )}
                      value={jobDraft.skills}
                      onChange={(value) =>
                        setJobDraft({ ...jobDraft, skills: value })
                      }
                    />
                  </div>
                  <Field
                    label={t("Closing time", "موعد الإغلاق")}
                    type="datetime-local"
                    value={jobDraft.closesAt}
                    onChange={(value) =>
                      setJobDraft({ ...jobDraft, closesAt: value })
                    }
                  />
                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      type="submit"
                      disabled={
                        saving ||
                        jobDraft.title.trim().length < 3 ||
                        jobDraft.description.trim().length < 20
                      }
                    >
                      {t("Publish vacancy", "نشر الوظيفة")}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  {t("Verification inbox", "طلبات التوثيق")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingCompanyVerifications.map((request) => {
                  const record = request.professional_employment_records;
                  return (
                    <div key={request.id} className="rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">
                            {record?.professional_name}
                          </h3>
                          <p className="text-sm text-primary">
                            {record?.title}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {month(record?.start_date || null)} –{" "}
                            {record?.is_current
                              ? t("Present", "حتى الآن")
                              : month(record?.end_date || null)}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {t("Pending", "قيد المراجعة")}
                        </Badge>
                      </div>
                      {request.requester_note && (
                        <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
                          {request.requester_note}
                        </p>
                      )}
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            reviewVerification(request.id, "approved")
                          }
                          disabled={saving}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {t("Verify", "توثيق")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            reviewVerification(request.id, "declined")
                          }
                          disabled={saving}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          {t("Decline privately", "رفض خاص")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {pendingCompanyVerifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("No pending requests.", "لا توجد طلبات معلقة.")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {isAuthenticated && applications.length > 0 && (
        <section className="mt-12">
          <h2 className="text-3xl font-bold">
            {t("Your applications", "طلبات التقديم")}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {applications.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">
                        {item.professional_job_posts?.title}
                      </h3>
                      <p className="text-sm text-primary">
                        {item.professional_job_posts?.company_name}
                      </p>
                    </div>
                    <Status value={item.status} />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {place(
                      item.professional_job_posts?.city || null,
                      item.professional_job_posts?.country || null,
                    ) || t("Location not specified", "الموقع غير محدد")}
                  </p>
                  {!["declined", "withdrawn", "hired"].includes(
                    item.status,
                  ) && (
                    <Button
                      className="mt-4"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => reviewApplication(item.id, "withdrawn")}
                    >
                      {t("Withdraw application", "سحب طلب التقديم")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 rounded-3xl border bg-muted/30 p-6 md:p-8">
        <h2 className="text-3xl font-bold">
          {t("Professional trust charter", "ميثاق الثقة المهنية")}
        </h2>
        <p className="mt-3 max-w-4xl leading-7 text-muted-foreground">
          {t(
            "Medicine Support Hub verifies factual employment records and attributable recommendations. It does not publish dismissal reasons, secret employer scores, anonymous accusations, or private rehire decisions.",
            "توثق منصة دعم الدواء حقائق الخبرة والتوصيات المنسوبة، ولا تنشر أسباب الفصل أو درجات أصحاب العمل السرية أو الاتهامات المجهولة أو قرارات إعادة التعيين الخاصة.",
          )}
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
function Value({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <Badge
      variant={
        ["verified", "approved", "accepted", "hired", "shortlisted"].includes(
          value,
        )
          ? "default"
          : "secondary"
      }
    >
      {humanize(value)}
    </Badge>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  disabled = false,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        min={min}
      />
    </div>
  );
}
function SelectField({
  label,
  value,
  values,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {values.map((option) => (
          <option key={option || "empty"} value={option}>
            {labels?.[option] || humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
