/**
 * Company Workspace — thin shell that unifies existing company surfaces.
 *
 * Integrity rules:
 * - Reuses CompanyProfileUpdateForm, CompanyTeamInvite, MedicineDataContributionHub,
 *   CompanyDistributionManager, and the live /jobs network.
 * - Does not invent new tables or dual publish paths for vacancies.
 * - Membership gate mirrors professional-jobs.tsx (organization_members +
 *   verified industry_company_profiles).
 * - Hierarchy uses company-role-hierarchy + company-team-data as already defined.
 */
import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Database,
  MapPin,
  Users,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { CompanyProfileUpdateForm } from "@/components/company-profile-update-form";
import { CompanyTeamInvite } from "@/components/company-team-invite";
import { MedicineDataContributionHub } from "@/components/medicine-data-contribution-hub";
import { CompanyDistributionManager } from "@/components/company-distribution-manager";
import type { CompanyOrgRole } from "@/lib/company-role-hierarchy";
import {
  findTeamMembershipForEmail,
  listCompanyTeamMembers,
} from "@/lib/company-team-data";

type Membership = { organization_id: string; role: string };
type Company = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
  verification_status: string;
  is_public: boolean;
};

type TabId = "profile" | "team" | "medicines" | "distribution" | "jobs";

const TABS: { id: TabId; labelEn: string; labelAr: string; icon: React.ElementType }[] = [
  { id: "profile", labelEn: "Profile", labelAr: "الملف", icon: Building2 },
  { id: "team", labelEn: "Team", labelAr: "الفريق", icon: Users },
  { id: "medicines", labelEn: "Medicines", labelAr: "الأدوية", icon: Database },
  { id: "distribution", labelEn: "Distribution", labelAr: "التوزيع", icon: MapPin },
  { id: "jobs", labelEn: "Jobs", labelAr: "الوظائف", icon: BriefcaseBusiness },
];

function mapOrgRoleToCompanyRole(role: string | undefined): CompanyOrgRole {
  const r = (role || "").toLowerCase();
  if (r.includes("ceo") || r === "owner" || r === "admin") return "company_ceo";
  if (r.includes("product")) return "product_manager";
  if (r.includes("line")) return "line_manager";
  if (r.includes("rep") || r.includes("member")) return "company_rep";
  return "company_rep";
}

export default function CompanyWorkspace() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [tab, setTab] = useState<TabId>("profile");
  const [actorRole, setActorRole] = useState<CompanyOrgRole>("company_rep");
  const [teamCount, setTeamCount] = useState(0);
  const [openJobsCount, setOpenJobsCount] = useState(0);

  usePageSeo({
    title: "Company Workspace | Medicine Support Hub",
    description:
      "Manage verified company profile, organization hierarchy, medicine contributions, distribution availability, and vacancies in one place.",
    keywords:
      "pharma company workspace, medicine contributions, recruitment hierarchy Egypt",
    canonicalPath: "/company-workspace",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!isAuthenticated || !session?.user?.id) {
          setMemberships([]);
          setCompanies([]);
          return;
        }
        const userId = session.user.id;
        const email = (session.user.email || "").toLowerCase();

        const [memberRows, publicCompanies] = await Promise.all([
          supabaseFetch<Membership[]>(
            `/rest/v1/organization_members?select=organization_id,role&user_id=eq.${userId}&is_active=eq.true&limit=50`,
          ),
          supabaseFetch<Company[]>(
            "/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,verification_status,is_public&verification_status=eq.verified&is_public=eq.true&order=display_name.asc&limit=200",
          ),
        ]);

        setMemberships(memberRows);
        const memberOrgIds = new Set(memberRows.map((m) => m.organization_id));
        const managed = publicCompanies.filter((c) =>
          memberOrgIds.has(c.organization_id),
        );
        setCompanies(managed);

        const first = managed[0];
        const orgId = first?.organization_id || "";
        setSelectedOrgId((prev) => prev || orgId);

        const activeCompany =
          managed.find((c) => c.organization_id === (orgId || first?.organization_id)) ||
          first;

        if (activeCompany) {
          const membership = memberRows.find(
            (m) => m.organization_id === activeCompany.organization_id,
          );
          let role = mapOrgRoleToCompanyRole(membership?.role);

          // Prefer Appwrite / local hierarchy membership when present
          if (email) {
            const teamMember = await findTeamMembershipForEmail(
              email,
              activeCompany.company_slug,
            );
            if (teamMember?.role) role = teamMember.role;
          }
          setActorRole(role);

          const { members } = await listCompanyTeamMembers({
            companySlug: activeCompany.company_slug,
            limit: 100,
          });
          setTeamCount(members.filter((m) => m.status === "active").length);

          try {
            const jobs = await supabaseFetch<{ id: string }[]>(
              `/rest/v1/professional_job_posts?select=id&organization_id=eq.${activeCompany.organization_id}&status=eq.published&limit=100`,
            );
            setOpenJobsCount(jobs.length);
          } catch {
            setOpenJobsCount(0);
          }
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : t("Could not load company workspace.", "تعذر تحميل مساحة عمل الشركة."),
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [isAuthenticated, session?.user?.id, session?.access_token]);

  const selectedCompany = useMemo(
    () =>
      companies.find((c) => c.organization_id === selectedOrgId) || companies[0] || null,
    [companies, selectedOrgId],
  );

  const managedForHub = useMemo(
    () =>
      companies.map((c) => ({
        id: c.id,
        organization_id: c.organization_id,
        display_name: c.display_name,
      })),
    [companies],
  );

  if (!isAuthenticated) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t("Company Workspace", "مساحة عمل الشركة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t(
                "Sign in with a verified company account to manage profile, team hierarchy, medicines, distribution, and vacancies.",
                "سجل الدخول بحساب شركة موثق لإدارة الملف والهيكل والأدوية والتوزيع والوظائف.",
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/account?next=%2Fcompany-workspace">
                  {t("Sign in", "تسجيل الدخول")}
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/industry">
                  {t("Register as company representative", "التسجيل كممثل شركة")}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-12">
        <p className="text-sm text-muted-foreground">
          {t("Loading company workspace…", "جاري تحميل مساحة عمل الشركة…")}
        </p>
      </main>
    );
  }

  if (!selectedCompany) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>
              {t("No verified company membership yet", "لا توجد عضوية شركة موثقة بعد")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t(
                "Claim your company on the industry portal. After admin approval and organization membership, this workspace unlocks profile, team hierarchy, medicine contributions, distribution, and vacancy posting — using the same systems already live on the platform.",
                "اطلب المطالبة بشركتك من بوابة الصناعة. بعد موافقة الإدارة وعضوية المنظمة، تُفتح هذه المساحة للملف والهيكل والمساهمات والتوزيع ونشر الوظائف — بنفس الأنظمة الحالية على المنصة.",
              )}
            </p>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/industry">
                  {t("Go to industry registration", "الذهاب لتسجيل الصناعة")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/jobs">{t("Browse jobs network", "تصفح شبكة الوظائف")}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const actorEmail = (session?.user?.email || "").toLowerCase();

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t("Verified company workspace", "مساحة عمل الشركة الموثقة")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {selectedCompany.display_name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t(
                "One place to update your official profile, invite line managers, contribute medicines, publish availability, and post vacancies. All actions use the governed systems already running on Medicine Support Hub.",
                "مكان واحد لتحديث الملف الرسمي ودعوة مديري الخطوط والمساهمة بالأدوية ونشر التوافر والوظائف. كل الإجراءات تستخدم الأنظمة المنضبطة القائمة على منصة دعم الدواء.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{selectedCompany.company_slug}</Badge>
            <Badge>{t("Verified", "موثقة")}</Badge>
            <Badge variant="secondary">{actorRole.replaceAll("_", " ")}</Badge>
          </div>
        </div>

        {companies.length > 1 && (
          <div className="max-w-sm">
            <label className="text-xs font-semibold text-muted-foreground">
              {t("Active company", "الشركة النشطة")}
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedCompany.organization_id}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.organization_id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label={t("Team members", "أعضاء الفريق")}
            value={teamCount}
          />
          <Metric
            label={t("Open vacancies", "وظائف مفتوحة")}
            value={openJobsCount}
          />
          <Metric
            label={t("Memberships", "العضويات")}
            value={memberships.length}
          />
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <nav className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map(({ id, labelEn, labelAr, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === id
                ? "bg-primary text-primary-foreground"
                : "border hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(labelEn, labelAr)}
          </button>
        ))}
      </nav>

      <section className="space-y-6">
        {tab === "profile" && (
          <CompanyProfileUpdateForm companySlug={selectedCompany.company_slug} />
        )}

        {tab === "team" && (
          <CompanyTeamInvite
            companySlug={selectedCompany.company_slug}
            companyName={selectedCompany.display_name}
            actorEmail={actorEmail}
            actorRole={actorRole}
            claimApproved
          />
        )}

        {tab === "medicines" && (
          <MedicineDataContributionHub companies={managedForHub} />
        )}

        {tab === "distribution" && (
          <CompanyDistributionManager companies={managedForHub} />
        )}

        {tab === "jobs" && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
                {t("Vacancies & recruitment", "الوظائف والتوظيف")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  "Vacancy publishing, applications, shortlisting, and employment verification already run on the Pharma Professional Network. This workspace does not duplicate that pipeline — it routes you into the same governed /jobs surface used by verified companies.",
                  "نشر الوظائف وطلبات التقديم والقائمة المختصرة وتوثيق الخبرة تعمل بالفعل على الشبكة المهنية الدوائية. هذه المساحة لا تكرر ذلك المسار — بل توجّهك إلى نفس سطح /jobs المنضبط الذي تستخدمه الشركات الموثقة.",
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href="/jobs#open-jobs">
                    {t("Open jobs network", "فتح شبكة الوظائف")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href="/jobs">
                    {t("Publish vacancy / review applications", "نشر وظيفة / مراجعة الطلبات")}
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Open vacancies for this company:",
                  "الوظائف المفتوحة لهذه الشركة:",
                )}{" "}
                <strong>{openJobsCount}</strong>
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <footer className="mt-10 rounded-2xl border bg-muted/30 p-5 text-sm text-muted-foreground">
        {t(
          "Integrity note: this page only composes existing components and tables (industry_company_profiles, organization_members, company team hierarchy, medicine_catalog_submissions, distribution availability, professional_job_posts). No parallel recruitment or hierarchy model is introduced.",
          "ملاحظة سلامة: تجمع هذه الصفحة المكوّنات والجداول القائمة فقط دون إدخال نموذج موازٍ للتوظيف أو الهيكل.",
        )}
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
