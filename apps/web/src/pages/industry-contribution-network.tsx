import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CircleCheckBig,
  FilePlus2,
  Handshake,
  Network,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { fetchSeoEntityDirectory, seoEntityPath, type SeoEntity } from "@/lib/seo-entities";

type Claim = {
  id: string;
  company_slug: string | null;
  proposed_company_name: string;
  company_type: string;
  work_email: string;
  status: string;
  review_notes: string | null;
  profile_id: string | null;
  organization_id: string | null;
  created_at: string;
};

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
  status: string;
  review_notes: string | null;
  published_at: string | null;
  created_at: string;
};

const companyTypes = [
  "pharma_company",
  "medical_products_company",
  "medical_device_company",
  "diagnostics_company",
  "biotech_company",
  "supplier",
  "distributor",
  "healthcare_company",
];

const contributionTypes = [
  "product_addition",
  "product_update",
  "evidence",
  "correction",
  "educational_resource",
  "patient_support_program",
  "partnership_opportunity",
];

const emptyClaim = {
  existingCompanySlug: "",
  proposedCompanyName: "",
  companyType: "pharma_company",
  country: "",
  city: "",
  workEmail: "",
  roleTitle: "",
  website: "",
  evidenceUrl: "",
  notes: "",
};

const emptyContribution = {
  profileId: "",
  type: "product_addition",
  title: "",
  summary: "",
  productName: "",
  genericName: "",
  category: "",
  registrationReference: "",
  sourceUrl: "",
  evidenceUrls: "",
};

function splitList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(value: string[] | null | undefined) {
  return (value || []).join(", ");
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function IndustryContributionNetwork() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [companies, setCompanies] = useState<SeoEntity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [claimDraft, setClaimDraft] = useState(emptyClaim);
  const [contributionDraft, setContributionDraft] = useState(emptyContribution);
  const [profileDrafts, setProfileDrafts] = useState<Record<string, IndustryProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSourceCompany = useMemo(
    () => companies.find((company) => company.slug === claimDraft.existingCompanySlug) || null,
    [companies, claimDraft.existingCompanySlug],
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === contributionDraft.profileId) || profiles[0] || null,
    [profiles, contributionDraft.profileId],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const directory = await fetchSeoEntityDirectory();
      setCompanies(directory.entities.filter((entity) => entity.type === "company"));
      if (!isAuthenticated) {
        setClaims([]);
        setProfiles([]);
        setContributions([]);
        return;
      }
      const [nextClaims, nextProfiles, nextContributions] = await Promise.all([
        supabaseFetch<Claim[]>("/rest/v1/industry_company_profile_claims?select=id,company_slug,proposed_company_name,company_type,work_email,status,review_notes,profile_id,organization_id,created_at&order=created_at.desc&limit=50"),
        supabaseFetch<IndustryProfile[]>("/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public&order=display_name.asc&limit=50"),
        supabaseFetch<Contribution[]>("/rest/v1/industry_company_contributions?select=id,profile_id,company_slug,contribution_type,title,summary,status,review_notes,published_at,created_at&order=created_at.desc&limit=100"),
      ]);
      setClaims(nextClaims);
      setProfiles(nextProfiles);
      setContributions(nextContributions);
      setProfileDrafts(Object.fromEntries(nextProfiles.map((profile) => [profile.id, profile])));
      if (!contributionDraft.profileId && nextProfiles[0]) {
        setContributionDraft((current) => ({ ...current, profileId: nextProfiles[0].id }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load the industry workspace.", "تعذر تحميل مساحة الشركات."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [isAuthenticated]);

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) {
      setError(t("Sign in before submitting a company claim.", "سجل الدخول قبل إرسال طلب الشركة."));
      return;
    }
    const companyName = selectedSourceCompany?.name || claimDraft.proposedCompanyName.trim();
    if (!companyName || !claimDraft.workEmail.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_company_profile_claims", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          company_slug: selectedSourceCompany?.slug || null,
          proposed_company_name: companyName,
          company_type: claimDraft.companyType,
          country: claimDraft.country.trim() || null,
          city: claimDraft.city.trim() || null,
          work_email: claimDraft.workEmail.trim(),
          role_title: claimDraft.roleTitle.trim() || null,
          website: claimDraft.website.trim() || null,
          evidence_url: claimDraft.evidenceUrl.trim() || null,
          notes: claimDraft.notes.trim() || null,
          requested_by: session.user.id,
          status: "pending",
        }),
      });
      setClaimDraft(emptyClaim);
      setMessage(t("Your company profile request was submitted for verification.", "تم إرسال طلب ملف الشركة للمراجعة والتوثيق."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not submit the company request.", "تعذر إرسال طلب الشركة."));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(profileId: string) {
    const draft = profileDrafts[profileId];
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await supabaseFetch<IndustryProfile[]>(`/rest/v1/industry_company_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          display_name: draft.display_name.trim(),
          company_type: draft.company_type,
          description: draft.description?.trim() || null,
          website_url: draft.website_url?.trim() || null,
          logo_url: draft.logo_url?.trim() || null,
          country: draft.country?.trim() || null,
          city: draft.city?.trim() || null,
          contact_email: draft.contact_email?.trim() || null,
          therapeutic_areas: draft.therapeutic_areas,
          product_categories: draft.product_categories,
          capabilities: draft.capabilities,
          support_programs: draft.support_programs,
          social_links: draft.social_links || {},
        }),
      });
      const updated = rows[0];
      if (updated) {
        setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
        setProfileDrafts((current) => ({ ...current, [updated.id]: updated }));
      }
      setMessage(t("Official company profile updated.", "تم تحديث ملف الشركة الرسمي."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not update the company profile.", "تعذر تحديث ملف الشركة."));
    } finally {
      setSaving(false);
    }
  }

  async function submitContribution(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !activeProfile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_company_contributions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          organization_id: activeProfile.organization_id,
          company_slug: activeProfile.company_slug,
          contribution_type: contributionDraft.type,
          title: contributionDraft.title.trim(),
          summary: contributionDraft.summary.trim(),
          payload: {
            product_name: contributionDraft.productName.trim() || null,
            generic_name: contributionDraft.genericName.trim() || null,
            category: contributionDraft.category.trim() || null,
            registration_reference: contributionDraft.registrationReference.trim() || null,
            source_url: contributionDraft.sourceUrl.trim() || null,
          },
          evidence_urls: splitList(contributionDraft.evidenceUrls),
          submitted_by: session.user.id,
          status: "submitted",
        }),
      });
      setContributionDraft({ ...emptyContribution, profileId: activeProfile.id });
      setMessage(t("Contribution submitted. It will become public only after evidence review.", "تم إرسال المساهمة، ولن تصبح عامة إلا بعد مراجعة الأدلة."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not submit the contribution.", "تعذر إرسال المساهمة."));
    } finally {
      setSaving(false);
    }
  }

  function updateProfileDraft(profileId: string, patch: Partial<IndustryProfile>) {
    setProfileDrafts((current) => ({ ...current, [profileId]: { ...current[profileId], ...patch } }));
  }

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><Network className="h-4 w-4" />{t("Industry contribution network", "شبكة مساهمات قطاع الرعاية الصحية")}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">{t("Build the most connected medicine and healthcare knowledge platform together", "لنبنِ معًا أكثر منصة مترابطة لمعرفة الأدوية والرعاية الصحية")}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("Pharmaceutical, medical-device, diagnostics, biotech, supplier, and healthcare companies can claim verified profiles, present capabilities, connect products to trusted evidence, publish patient-support opportunities, and improve the encyclopedia through moderated contributions.", "يمكن لشركات الأدوية والأجهزة الطبية والتشخيص والتكنولوجيا الحيوية والموردين وشركات الرعاية الصحية المطالبة بملفات موثقة، وعرض قدراتها، وربط المنتجات بالأدلة الموثوقة، ونشر فرص دعم المرضى، وتحسين الموسوعة من خلال مساهمات خاضعة للمراجعة.")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#participate" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm">{t("Create or claim a profile", "إنشاء أو المطالبة بملف")}</a>
            <a href="/companies" className="rounded-lg border px-5 py-3 text-sm font-semibold hover:bg-muted">{t("Explore company network", "استكشاف شبكة الشركات")}</a>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ValueCard icon={BadgeCheck} title={t("Verified identity", "هوية موثقة")} text={t("Official company presence connected to existing product intelligence.", "وجود رسمي للشركة مرتبط بذكاء المنتجات الحالي.")} />
          <ValueCard icon={FilePlus2} title={t("Evidence contributions", "مساهمات بالأدلة")} text={t("Submit products, corrections, resources, and support programs without overwriting trusted records.", "إرسال المنتجات والتصحيحات والموارد وبرامج الدعم دون الكتابة فوق السجلات الموثوقة.")} />
          <ValueCard icon={Handshake} title={t("Healthcare-cycle connections", "ترابط دورة الرعاية الصحية")} text={t("Connect companies with pharmacies, NGOs, clinicians, programs, patients, procurement, and impact reporting.", "ربط الشركات بالصيدليات والمؤسسات والأطباء والبرامج والمرضى والمشتريات وتقارير الأثر.")} />
        </div>
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-4">
      <JourneyStep number="1" title={t("Claim", "المطالبة")} text={t("Request an existing profile or propose a new company.", "اطلب ملفًا قائمًا أو اقترح شركة جديدة.")} />
      <JourneyStep number="2" title={t("Verify", "التوثيق")} text={t("Platform reviewers validate identity and evidence.", "يتحقق مراجعو المنصة من الهوية والأدلة.")} />
      <JourneyStep number="3" title={t("Build", "البناء")} text={t("Maintain the official profile and submit contributions.", "حدّث الملف الرسمي وأرسل المساهمات.")} />
      <JourneyStep number="4" title={t("Connect", "الربط")} text={t("Approved knowledge connects across the healthcare network.", "تترابط المعرفة المعتمدة عبر شبكة الرعاية الصحية.")} />
    </section>

    <section id="participate" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-3xl font-bold">{t("Company participation workspace", "مساحة مشاركة الشركات")}</h2><p className="mt-2 text-muted-foreground">{t("Trusted participation is account-based, attributable, and moderated.", "المشاركة الموثوقة مرتبطة بالحساب، ومنسوبة لصاحبها، وخاضعة للمراجعة.")}</p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh", "تحديث")}</Button>
      </div>

      {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert className="mt-5"><CircleCheckBig className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      {loading && <p className="mt-5 text-sm text-muted-foreground">{t("Loading workspace...", "جاري تحميل المساحة...")}</p>}

      {!isAuthenticated && !loading && <Card className="mt-5 border-primary/30 bg-primary/5">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div><h3 className="text-2xl font-semibold">{t("Sign in to represent a company", "سجل الدخول لتمثيل شركة")}</h3><p className="mt-2 max-w-2xl text-muted-foreground">{t("Use a real work email and evidence of your role. Profile ownership is granted only after review.", "استخدم بريد العمل الحقيقي ودليلًا على دورك. لا تُمنح ملكية الملف إلا بعد المراجعة.")}</p></div>
            <a href="/account" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">{t("Sign in or create account", "تسجيل الدخول أو إنشاء حساب")}</a>
          </div>
        </CardContent>
      </Card>}

      {isAuthenticated && !loading && <div className="mt-5 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("Create or claim a company profile", "إنشاء أو المطالبة بملف شركة")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submitClaim} className="space-y-4">
              <div><Label>{t("Existing encyclopedia company", "شركة موجودة في الموسوعة")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={claimDraft.existingCompanySlug} onChange={(event) => setClaimDraft({ ...claimDraft, existingCompanySlug: event.target.value, proposedCompanyName: "" })}><option value="">{t("New or currently unlisted company", "شركة جديدة أو غير مدرجة حاليًا")}</option>{companies.map((company) => <option key={company.slug} value={company.slug}>{company.name}</option>)}</select></div>
              {!selectedSourceCompany && <Field label={t("Company name", "اسم الشركة")} value={claimDraft.proposedCompanyName} onChange={(value) => setClaimDraft({ ...claimDraft, proposedCompanyName: value })} required />}
              <div><Label>{t("Company type", "نوع الشركة")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={claimDraft.companyType} onChange={(event) => setClaimDraft({ ...claimDraft, companyType: event.target.value })}>{companyTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></div>
              <div className="grid gap-4 md:grid-cols-2"><Field label={t("Country", "الدولة")} value={claimDraft.country} onChange={(value) => setClaimDraft({ ...claimDraft, country: value })} /><Field label={t("City", "المدينة")} value={claimDraft.city} onChange={(value) => setClaimDraft({ ...claimDraft, city: value })} /></div>
              <Field label={t("Work email", "بريد العمل")} type="email" value={claimDraft.workEmail} onChange={(value) => setClaimDraft({ ...claimDraft, workEmail: value })} required />
              <Field label={t("Your role or title", "دورك أو مسماك الوظيفي")} value={claimDraft.roleTitle} onChange={(value) => setClaimDraft({ ...claimDraft, roleTitle: value })} />
              <Field label={t("Company website", "موقع الشركة")} type="url" value={claimDraft.website} onChange={(value) => setClaimDraft({ ...claimDraft, website: value })} />
              <Field label={t("Identity evidence URL", "رابط دليل الهوية")} type="url" value={claimDraft.evidenceUrl} onChange={(value) => setClaimDraft({ ...claimDraft, evidenceUrl: value })} />
              <div><Label>{t("Verification notes", "ملاحظات التوثيق")}</Label><Textarea className="mt-1" value={claimDraft.notes} onChange={(event) => setClaimDraft({ ...claimDraft, notes: event.target.value })} placeholder={t("Explain your relationship to the company and what you want to contribute.", "اشرح علاقتك بالشركة وما الذي تريد المساهمة به.")} /></div>
              <Button type="submit" disabled={saving || (!selectedSourceCompany && !claimDraft.proposedCompanyName.trim()) || !claimDraft.workEmail.trim()}><ShieldCheck className="mr-2 h-4 w-4" />{t("Submit for verification", "إرسال للتوثيق")}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("Your profile requests", "طلبات ملفاتك")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {claims.map((claim) => <div key={claim.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{claim.proposed_company_name}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(claim.company_type)} · {new Date(claim.created_at).toLocaleDateString()}</div></div><StatusBadge status={claim.status} /></div>{claim.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{claim.review_notes}</p>}{claim.status === "approved" && claim.company_slug && <a href={seoEntityPath("company", claim.company_slug)} className="mt-3 inline-flex text-sm font-semibold text-primary">{t("Open public profile", "فتح الملف العام")}</a>}</div>)}
            {claims.length === 0 && <p className="text-sm text-muted-foreground">{t("No profile requests yet.", "لا توجد طلبات ملفات بعد.")}</p>}
          </CardContent>
        </Card>
      </div>}
    </section>

    {isAuthenticated && profiles.length > 0 && <section className="mt-10">
      <div><h2 className="text-3xl font-bold">{t("Official company profiles you manage", "ملفات الشركات الرسمية التي تديرها")}</h2><p className="mt-2 text-muted-foreground">{t("Build a credible public presence that connects products, capabilities, programs, and evidence.", "ابنِ وجودًا عامًا موثوقًا يربط المنتجات والقدرات والبرامج والأدلة.")}</p></div>
      <div className="mt-5 grid gap-6 xl:grid-cols-2">{profiles.map((profile) => {
        const draft = profileDrafts[profile.id] || profile;
        return <Card key={profile.id} className="border-primary/20">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{profile.display_name}{profile.verification_status === "verified" && <BadgeCheck className="h-5 w-5 text-primary" />}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(profile.company_type)}</p></div><StatusBadge status={profile.verification_status} /></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2"><Field label={t("Display name", "الاسم المعروض")} value={draft.display_name} onChange={(value) => updateProfileDraft(profile.id, { display_name: value })} /><div><Label>{t("Company type", "نوع الشركة")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.company_type} onChange={(event) => updateProfileDraft(profile.id, { company_type: event.target.value })}>{companyTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></div></div>
            <div><Label>{t("Company overview", "نبذة الشركة")}</Label><Textarea className="mt-1 min-h-28" value={draft.description || ""} onChange={(event) => updateProfileDraft(profile.id, { description: event.target.value })} /></div>
            <div className="grid gap-4 md:grid-cols-2"><Field label={t("Website", "الموقع") } type="url" value={draft.website_url || ""} onChange={(value) => updateProfileDraft(profile.id, { website_url: value })} /><Field label={t("Logo URL", "رابط الشعار")} type="url" value={draft.logo_url || ""} onChange={(value) => updateProfileDraft(profile.id, { logo_url: value })} /></div>
            <div className="grid gap-4 md:grid-cols-3"><Field label={t("Country", "الدولة")} value={draft.country || ""} onChange={(value) => updateProfileDraft(profile.id, { country: value })} /><Field label={t("City", "المدينة")} value={draft.city || ""} onChange={(value) => updateProfileDraft(profile.id, { city: value })} /><Field label={t("Public contact", "وسيلة الاتصال العامة")} type="email" value={draft.contact_email || ""} onChange={(value) => updateProfileDraft(profile.id, { contact_email: value })} /></div>
            <ListField label={t("Therapeutic areas", "المجالات العلاجية")} value={draft.therapeutic_areas} onChange={(value) => updateProfileDraft(profile.id, { therapeutic_areas: value })} />
            <ListField label={t("Product categories", "فئات المنتجات")} value={draft.product_categories} onChange={(value) => updateProfileDraft(profile.id, { product_categories: value })} />
            <ListField label={t("Capabilities", "القدرات")} value={draft.capabilities} onChange={(value) => updateProfileDraft(profile.id, { capabilities: value })} />
            <ListField label={t("Patient-support programs", "برامج دعم المرضى")} value={draft.support_programs} onChange={(value) => updateProfileDraft(profile.id, { support_programs: value })} />
            <div className="flex flex-wrap gap-3"><Button onClick={() => void saveProfile(profile.id)} disabled={saving}><PencilLine className="mr-2 h-4 w-4" />{t("Save official profile", "حفظ الملف الرسمي")}</Button><a href={seoEntityPath("company", profile.company_slug)} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("View public profile", "عرض الملف العام")}</a></div>
          </CardContent>
        </Card>;
      })}</div>
    </section>}

    {isAuthenticated && profiles.length > 0 && <section className="mt-10 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />{t("Contribute to the encyclopedia", "ساهم في تطوير الموسوعة")}</CardTitle></CardHeader>
        <CardContent><form onSubmit={submitContribution} className="space-y-4">
          {profiles.length > 1 && <div><Label>{t("Company profile", "ملف الشركة")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={contributionDraft.profileId} onChange={(event) => setContributionDraft({ ...contributionDraft, profileId: event.target.value })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}</select></div>}
          <div><Label>{t("Contribution type", "نوع المساهمة")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={contributionDraft.type} onChange={(event) => setContributionDraft({ ...contributionDraft, type: event.target.value })}>{contributionTypes.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></div>
          <Field label={t("Contribution title", "عنوان المساهمة")} value={contributionDraft.title} onChange={(value) => setContributionDraft({ ...contributionDraft, title: value })} required />
          <div><Label>{t("Summary and public value", "الملخص والقيمة العامة")}</Label><Textarea className="mt-1 min-h-28" value={contributionDraft.summary} onChange={(event) => setContributionDraft({ ...contributionDraft, summary: event.target.value })} required /></div>
          <div className="grid gap-4 md:grid-cols-2"><Field label={t("Product name", "اسم المنتج")} value={contributionDraft.productName} onChange={(value) => setContributionDraft({ ...contributionDraft, productName: value })} /><Field label={t("Generic or active ingredient", "المادة الفعالة")} value={contributionDraft.genericName} onChange={(value) => setContributionDraft({ ...contributionDraft, genericName: value })} /></div>
          <div className="grid gap-4 md:grid-cols-2"><Field label={t("Product category", "فئة المنتج")} value={contributionDraft.category} onChange={(value) => setContributionDraft({ ...contributionDraft, category: value })} /><Field label={t("Registration or reference number", "رقم التسجيل أو المرجع")} value={contributionDraft.registrationReference} onChange={(value) => setContributionDraft({ ...contributionDraft, registrationReference: value })} /></div>
          <Field label={t("Primary source URL", "رابط المصدر الأساسي")} type="url" value={contributionDraft.sourceUrl} onChange={(value) => setContributionDraft({ ...contributionDraft, sourceUrl: value })} />
          <div><Label>{t("Evidence URLs, one per line", "روابط الأدلة، رابط بكل سطر")}</Label><Textarea className="mt-1" value={contributionDraft.evidenceUrls} onChange={(event) => setContributionDraft({ ...contributionDraft, evidenceUrls: event.target.value })} /></div>
          <Button type="submit" disabled={saving || !activeProfile || contributionDraft.title.trim().length < 3 || contributionDraft.summary.trim().length < 10}><FilePlus2 className="mr-2 h-4 w-4" />{t("Submit evidence for review", "إرسال الأدلة للمراجعة")}</Button>
        </form></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("Contribution history", "سجل المساهمات")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">{contributions.map((contribution) => <div key={contribution.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{contribution.title}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(contribution.contribution_type)} · {new Date(contribution.created_at).toLocaleDateString()}</div></div><StatusBadge status={contribution.status} /></div><p className="mt-3 text-sm text-muted-foreground">{contribution.summary}</p>{contribution.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{contribution.review_notes}</p>}</div>)}{contributions.length === 0 && <p className="text-sm text-muted-foreground">{t("No contributions submitted yet.", "لم يتم إرسال مساهمات بعد.")}</p>}</CardContent>
      </Card>
    </section>}

    <section className="mt-10 rounded-2xl border bg-muted/30 p-5 text-sm text-muted-foreground">
      <strong className="text-foreground">{t("Trust model:", "نموذج الثقة:")}</strong> {t("Company submissions are attributed, reviewed, and published as company contributions. They do not automatically replace regulatory records, independent evidence, Egyptian registration data, clinical guidance, or source-backed medicine listings.", "تُنسب مساهمات الشركات إلى أصحابها وتخضع للمراجعة وتُنشر بوصفها مساهمات من الشركة. ولا تستبدل تلقائيًا السجلات التنظيمية أو الأدلة المستقلة أو بيانات التسجيل المصرية أو الإرشادات السريرية أو قوائم الأدوية المدعومة بالمصادر.")}
    </section>
  </main>;
}

function ValueCard({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <div className="rounded-2xl border bg-background/80 p-4"><Icon className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function JourneyStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <Card><CardContent className="p-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{number}</div><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <div><Label>{label}</Label><Input className="mt-1" value={joinList(value)} onChange={(event) => onChange(splitList(event.target.value))} placeholder="Item one, item two" /></div>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "approved" || status === "verified" ? "default" : status === "rejected" || status === "suspended" ? "destructive" : "secondary";
  return <Badge variant={variant}>{humanize(status)}</Badge>;
}
