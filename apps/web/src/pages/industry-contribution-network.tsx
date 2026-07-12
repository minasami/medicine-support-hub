import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, CircleCheckBig, FilePlus2, Handshake, Network, PencilLine, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
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
  id: string; company_slug: string | null; proposed_company_name: string; company_type: string;
  work_email: string; status: string; review_notes: string | null; profile_id: string | null;
  organization_id: string | null; created_at: string; verification_score: number;
  verification_checks: Record<string, unknown> | null; automated_recommendation: string;
  risk_flags: string[] | null; last_verified_at: string | null;
};
type IndustryProfile = {
  id: string; organization_id: string; company_slug: string; display_name: string; company_type: string;
  description: string | null; website_url: string | null; logo_url: string | null; country: string | null;
  city: string | null; contact_email: string | null; therapeutic_areas: string[]; product_categories: string[];
  capabilities: string[]; support_programs: string[]; social_links: Record<string, string>;
  verification_status: string; is_public: boolean;
};
type Contribution = { id: string; profile_id: string; company_slug: string; contribution_type: string; title: string; summary: string; status: string; review_notes: string | null; published_at: string | null; created_at: string };

const companyTypes = ["pharma_company", "medical_products_company", "medical_device_company", "diagnostics_company", "biotech_company", "supplier", "distributor", "healthcare_company"];
const contributionTypes = ["product_addition", "product_update", "evidence", "correction", "educational_resource", "patient_support_program", "partnership_opportunity"];
const emptyClaim = { existingCompanySlug: "", proposedCompanyName: "", companyType: "pharma_company", country: "", city: "", workEmail: "", roleTitle: "", website: "", evidenceUrl: "", notes: "" };
const emptyContribution = { profileId: "", type: "product_addition", title: "", summary: "", productName: "", genericName: "", category: "", registrationReference: "", sourceUrl: "", evidenceUrls: "" };
function splitList(value: string) { return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean); }
function joinList(value: string[] | null | undefined) { return (value || []).join(", "); }
function humanize(value: string) { return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function scoreTone(score: number) { return score >= 75 ? "bg-emerald-100 text-emerald-800" : score >= 45 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"; }

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

  const selectedSourceCompany = useMemo(() => companies.find((company) => company.slug === claimDraft.existingCompanySlug) || null, [companies, claimDraft.existingCompanySlug]);
  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === contributionDraft.profileId) || profiles[0] || null, [profiles, contributionDraft.profileId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const directory = await fetchSeoEntityDirectory();
      const nextCompanies = directory.entities.filter((entity) => entity.type === "company");
      setCompanies(nextCompanies);
      const linkedSlug = new URLSearchParams(window.location.search).get("company");
      if (linkedSlug && nextCompanies.some((company) => company.slug === linkedSlug)) setClaimDraft((current) => ({ ...current, existingCompanySlug: linkedSlug, proposedCompanyName: "" }));
      if (!isAuthenticated) { setClaims([]); setProfiles([]); setContributions([]); return; }
      const claimSelect = "id,company_slug,proposed_company_name,company_type,work_email,status,review_notes,profile_id,organization_id,created_at,verification_score,verification_checks,automated_recommendation,risk_flags,last_verified_at";
      const [nextClaims, nextProfiles, nextContributions] = await Promise.all([
        supabaseFetch<Claim[]>(`/rest/v1/industry_company_profile_claims?select=${claimSelect}&order=created_at.desc&limit=50`),
        supabaseFetch<IndustryProfile[]>("/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public&order=display_name.asc&limit=50"),
        supabaseFetch<Contribution[]>("/rest/v1/industry_company_contributions?select=id,profile_id,company_slug,contribution_type,title,summary,status,review_notes,published_at,created_at&order=created_at.desc&limit=100"),
      ]);
      setClaims(Array.isArray(nextClaims) ? nextClaims : []);
      setProfiles(Array.isArray(nextProfiles) ? nextProfiles : []);
      setContributions(Array.isArray(nextContributions) ? nextContributions : []);
      setProfileDrafts(Object.fromEntries((Array.isArray(nextProfiles) ? nextProfiles : []).map((profile) => [profile.id, profile])));
      if (!contributionDraft.profileId && nextProfiles[0]) setContributionDraft((current) => ({ ...current, profileId: nextProfiles[0].id }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not load the industry workspace.", "تعذر تحميل مساحة الشركات.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [isAuthenticated]);

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) { setError(t("Sign in before submitting a company claim.", "سجل الدخول قبل إرسال طلب الشركة.")); return; }
    const companyName = selectedSourceCompany?.name || claimDraft.proposedCompanyName.trim();
    if (!companyName || !claimDraft.workEmail.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const rows = await supabaseFetch<Claim[]>("/rest/v1/industry_company_profile_claims?select=id,company_slug,proposed_company_name,company_type,work_email,status,review_notes,profile_id,organization_id,created_at,verification_score,verification_checks,automated_recommendation,risk_flags,last_verified_at", {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          company_slug: selectedSourceCompany?.slug || null, proposed_company_name: companyName, company_type: claimDraft.companyType,
          country: claimDraft.country.trim() || null, city: claimDraft.city.trim() || null, work_email: claimDraft.workEmail.trim(),
          role_title: claimDraft.roleTitle.trim() || null, website: claimDraft.website.trim() || null,
          evidence_url: claimDraft.evidenceUrl.trim() || null, notes: claimDraft.notes.trim() || null,
          requested_by: session.user.id, status: "pending",
        }),
      });
      const claim = Array.isArray(rows) ? rows[0] : null;
      setClaimDraft(emptyClaim);
      setMessage(claim ? t(`Automated checks scored this request ${claim.verification_score}/100 (${humanize(claim.automated_recommendation)}). Final platform-admin approval is still required.`, `منحت الفحوص الآلية الطلب ${claim.verification_score}/100 (${humanize(claim.automated_recommendation)}). وما زالت موافقة مسؤول المنصة مطلوبة.`) : t("Your company profile request was submitted for verification.", "تم إرسال طلب ملف الشركة للمراجعة والتوثيق."));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not submit the company request.", "تعذر إرسال طلب الشركة.")); }
    finally { setSaving(false); }
  }

  async function recheckClaim(id: string) {
    setSaving(true); setError(null); setMessage(null);
    try { await supabaseFetch("/rest/v1/rpc/recheck_industry_company_claim", { method: "POST", body: JSON.stringify({ target_claim: id }) }); setMessage(t("Automated verification checks were refreshed.", "تم تحديث فحوص التوثيق الآلية.")); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not recheck this claim.", "تعذر إعادة فحص الطلب.")); }
    finally { setSaving(false); }
  }

  async function saveProfile(profileId: string) {
    const draft = profileDrafts[profileId]; if (!draft) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const rows = await supabaseFetch<IndustryProfile[]>(`/rest/v1/industry_company_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,contact_email,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public`, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          display_name: draft.display_name.trim(), company_type: draft.company_type, description: draft.description?.trim() || null,
          website_url: draft.website_url?.trim() || null, logo_url: draft.logo_url?.trim() || null,
          country: draft.country?.trim() || null, city: draft.city?.trim() || null, contact_email: draft.contact_email?.trim() || null,
          therapeutic_areas: draft.therapeutic_areas, product_categories: draft.product_categories,
          capabilities: draft.capabilities, support_programs: draft.support_programs, social_links: draft.social_links || {},
        }),
      });
      const updated = rows[0]; if (updated) { setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile)); setProfileDrafts((current) => ({ ...current, [updated.id]: updated })); }
      setMessage(t("Official company profile updated.", "تم تحديث ملف الشركة الرسمي."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not update the company profile.", "تعذر تحديث ملف الشركة.")); }
    finally { setSaving(false); }
  }

  async function submitContribution(event: React.FormEvent) {
    event.preventDefault(); if (!session?.user?.id || !activeProfile) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_company_contributions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
        profile_id: activeProfile.id, organization_id: activeProfile.organization_id, company_slug: activeProfile.company_slug,
        contribution_type: contributionDraft.type, title: contributionDraft.title.trim(), summary: contributionDraft.summary.trim(),
        payload: { product_name: contributionDraft.productName.trim() || null, generic_name: contributionDraft.genericName.trim() || null, category: contributionDraft.category.trim() || null, registration_reference: contributionDraft.registrationReference.trim() || null, source_url: contributionDraft.sourceUrl.trim() || null },
        evidence_urls: splitList(contributionDraft.evidenceUrls), submitted_by: session.user.id, status: "submitted",
      }) });
      setContributionDraft({ ...emptyContribution, profileId: activeProfile.id });
      setMessage(t("Contribution submitted. It will become public only after evidence review.", "تم إرسال المساهمة، ولن تصبح عامة إلا بعد مراجعة الأدلة.")); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not submit the contribution.", "تعذر إرسال المساهمة.")); }
    finally { setSaving(false); }
  }
  function updateProfileDraft(profileId: string, patch: Partial<IndustryProfile>) { setProfileDrafts((current) => ({ ...current, [profileId]: { ...current[profileId], ...patch } })); }

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm"><div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><Network className="h-4 w-4" />{t("Industry contribution network", "شبكة مساهمات قطاع الرعاية الصحية")}</p><h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">{t("Claim, verify, build, and connect company profiles", "طالب بملفات الشركات ووثقها وطوّرها واربطها")}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("Companies can claim dataset-derived profiles, add attributable official information, connect medicine portfolios to evidence, and contribute resources through a moderated collaboration workflow.", "يمكن للشركات المطالبة بالملفات المشتقة من قاعدة البيانات وإضافة معلومات رسمية منسوبة إليها وربط محافظ الأدوية بالأدلة والمساهمة بالموارد عبر مسار تعاون خاضع للمراجعة.")}</p><div className="mt-6 flex flex-wrap gap-3"><a href="#participate" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{t("Create or claim a profile", "إنشاء أو المطالبة بملف")}</a><a href="/companies" className="rounded-lg border px-5 py-3 text-sm font-semibold hover:bg-muted">{t("Explore company network", "استكشاف شبكة الشركات")}</a></div></div><div className="grid gap-3"><ValueCard icon={Sparkles} title={t("Automated pre-verification", "فحص أولي آلي")} text={t("Domain, work-email, dataset-match, evidence, and risk checks produce an auditable score.", "تنتج فحوص النطاق وبريد العمل ومطابقة البيانات والأدلة والمخاطر درجة قابلة للتدقيق.")} /><ValueCard icon={ShieldCheck} title={t("Human approval preserved", "الموافقة البشرية محفوظة")} text={t("Automation recommends; a platform administrator makes the final ownership decision.", "تقدم الأتمتة توصية بينما يتخذ مسؤول المنصة قرار الملكية النهائي.")} /><ValueCard icon={Handshake} title={t("Connected collaboration", "تعاون مترابط")} text={t("Approved profiles can coordinate evidence, products, support programs, partnerships, and corrections.", "يمكن للملفات المعتمدة تنسيق الأدلة والمنتجات وبرامج الدعم والشراكات والتصحيحات.")} /></div></div></section>

    <section id="participate" className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-bold">{t("Company participation workspace", "مساحة مشاركة الشركات")}</h2><p className="mt-2 text-muted-foreground">{t("Participation is account-based, attributable, automatically checked, and finally moderated.", "المشاركة مرتبطة بالحساب ومنسوبة لصاحبها وتخضع للفحص الآلي ثم للمراجعة النهائية.")}</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh", "تحديث")}</Button></div>
      {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}{message && <Alert className="mt-5"><CircleCheckBig className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      {!isAuthenticated && !loading && <Card className="mt-5 border-primary/30 bg-primary/5"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><h3 className="text-2xl font-semibold">{t("Sign in to represent a company", "سجل الدخول لتمثيل شركة")}</h3><p className="mt-2 max-w-2xl text-muted-foreground">{t("Use a real work email, company website, and evidence of your role. Automated checks do not replace final admin approval.", "استخدم بريد عمل حقيقيًا وموقع الشركة ودليلًا على دورك. لا تحل الفحوص الآلية محل موافقة المسؤول النهائية.")}</p></div><a href="/account" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">{t("Sign in or create account", "تسجيل الدخول أو إنشاء حساب")}</a></div></CardContent></Card>}

      {isAuthenticated && !loading && <div className="mt-5 grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("Create or claim a company profile", "إنشاء أو المطالبة بملف شركة")}</CardTitle></CardHeader><CardContent><form onSubmit={submitClaim} className="space-y-4"><div><Label>{t("Existing dataset company", "شركة موجودة في قاعدة البيانات")}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={claimDraft.existingCompanySlug} onChange={(event) => setClaimDraft({ ...claimDraft, existingCompanySlug: event.target.value, proposedCompanyName: "" })}><option value="">{t("New or currently unlisted company", "شركة جديدة أو غير مدرجة حاليًا")}</option>{companies.map((company) => <option key={company.slug} value={company.slug}>{company.name}</option>)}</select></div>{!selectedSourceCompany && <Field label={t("Company name", "اسم الشركة")} value={claimDraft.proposedCompanyName} onChange={(value) => setClaimDraft({ ...claimDraft, proposedCompanyName: value })} required />}<SelectField label={t("Company type", "نوع الشركة")} value={claimDraft.companyType} values={companyTypes} onChange={(value) => setClaimDraft({ ...claimDraft, companyType: value })} /><div className="grid gap-4 md:grid-cols-2"><Field label={t("Country", "الدولة")} value={claimDraft.country} onChange={(value) => setClaimDraft({ ...claimDraft, country: value })} /><Field label={t("City", "المدينة")} value={claimDraft.city} onChange={(value) => setClaimDraft({ ...claimDraft, city: value })} /></div><Field label={t("Work email", "بريد العمل")} type="email" value={claimDraft.workEmail} onChange={(value) => setClaimDraft({ ...claimDraft, workEmail: value })} required /><Field label={t("Your role or title", "دورك أو مسماك الوظيفي")} value={claimDraft.roleTitle} onChange={(value) => setClaimDraft({ ...claimDraft, roleTitle: value })} /><Field label={t("Company website", "موقع الشركة")} type="url" value={claimDraft.website} onChange={(value) => setClaimDraft({ ...claimDraft, website: value })} /><Field label={t("Identity evidence URL", "رابط دليل الهوية")} type="url" value={claimDraft.evidenceUrl} onChange={(value) => setClaimDraft({ ...claimDraft, evidenceUrl: value })} /><div><Label>{t("Verification notes", "ملاحظات التوثيق")}</Label><Textarea className="mt-1" value={claimDraft.notes} onChange={(event) => setClaimDraft({ ...claimDraft, notes: event.target.value })} /></div><Button type="submit" disabled={saving || (!selectedSourceCompany && !claimDraft.proposedCompanyName.trim()) || !claimDraft.workEmail.trim()}><ShieldCheck className="mr-2 h-4 w-4" />{t("Run checks and submit", "تشغيل الفحوص والإرسال")}</Button></form></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("Your profile requests", "طلبات ملفاتك")}</CardTitle></CardHeader><CardContent className="space-y-3">{claims.map((claim) => <div key={claim.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{claim.proposed_company_name}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(claim.company_type)} · {new Date(claim.created_at).toLocaleDateString()}</div></div><StatusBadge status={claim.status} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreTone(Number(claim.verification_score || 0))}`}>{t("Automated score", "الدرجة الآلية")}: {Number(claim.verification_score || 0)}/100</span><Badge variant="outline">{humanize(claim.automated_recommendation)}</Badge></div>{(claim.risk_flags || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{(claim.risk_flags || []).map((flag) => <Badge key={flag} variant="destructive">{humanize(flag)}</Badge>)}</div>}<p className="mt-3 text-xs text-muted-foreground">{t("Automated checks are advisory. Final profile ownership requires platform-admin approval.", "الفحوص الآلية استشارية، وتتطلب ملكية الملف موافقة مسؤول المنصة النهائية.")}</p>{claim.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{claim.review_notes}</p>}<div className="mt-3 flex flex-wrap gap-3"><Button size="sm" variant="outline" disabled={saving} onClick={() => void recheckClaim(claim.id)}><RefreshCw className="mr-2 h-3.5 w-3.5" />{t("Recheck", "إعادة الفحص")}</Button>{claim.status === "approved" && claim.company_slug && <a href={seoEntityPath("company", claim.company_slug)} className="inline-flex items-center text-sm font-semibold text-primary">{t("Open public profile", "فتح الملف العام")}</a>}</div></div>)}{claims.length === 0 && <p className="text-sm text-muted-foreground">{t("No profile requests yet.", "لا توجد طلبات ملفات بعد.")}</p>}</CardContent></Card></div>}
    </section>

    {isAuthenticated && profiles.length > 0 && <section className="mt-10"><div><h2 className="text-3xl font-bold">{t("Official company profiles you manage", "ملفات الشركات الرسمية التي تديرها")}</h2><p className="mt-2 text-muted-foreground">{t("Maintain verified official information without overwriting independent dataset evidence.", "حدّث المعلومات الرسمية الموثقة دون الكتابة فوق أدلة قاعدة البيانات المستقلة.")}</p></div><div className="mt-5 grid gap-6 xl:grid-cols-2">{profiles.map((profile) => { const draft = profileDrafts[profile.id] || profile; return <Card key={profile.id} className="border-primary/20"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{profile.display_name}{profile.verification_status === "verified" && <BadgeCheck className="h-5 w-5 text-primary" />}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(profile.company_type)}</p></div><StatusBadge status={profile.verification_status} /></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label={t("Display name", "الاسم المعروض")} value={draft.display_name} onChange={(value) => updateProfileDraft(profile.id, { display_name: value })} /><SelectField label={t("Company type", "نوع الشركة")} value={draft.company_type} values={companyTypes} onChange={(value) => updateProfileDraft(profile.id, { company_type: value })} /></div><div><Label>{t("Company overview", "نبذة الشركة")}</Label><Textarea className="mt-1 min-h-28" value={draft.description || ""} onChange={(event) => updateProfileDraft(profile.id, { description: event.target.value })} /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Website", "الموقع")} type="url" value={draft.website_url || ""} onChange={(value) => updateProfileDraft(profile.id, { website_url: value })} /><Field label={t("Logo URL", "رابط الشعار")} type="url" value={draft.logo_url || ""} onChange={(value) => updateProfileDraft(profile.id, { logo_url: value })} /><Field label={t("Country", "الدولة")} value={draft.country || ""} onChange={(value) => updateProfileDraft(profile.id, { country: value })} /><Field label={t("City", "المدينة")} value={draft.city || ""} onChange={(value) => updateProfileDraft(profile.id, { city: value })} /><Field label={t("Contact email", "بريد التواصل")} type="email" value={draft.contact_email || ""} onChange={(value) => updateProfileDraft(profile.id, { contact_email: value })} /></div><ListField label={t("Therapeutic areas", "المجالات العلاجية")} value={joinList(draft.therapeutic_areas)} onChange={(value) => updateProfileDraft(profile.id, { therapeutic_areas: splitList(value) })} /><ListField label={t("Product categories", "فئات المنتجات")} value={joinList(draft.product_categories)} onChange={(value) => updateProfileDraft(profile.id, { product_categories: splitList(value) })} /><ListField label={t("Capabilities", "القدرات")} value={joinList(draft.capabilities)} onChange={(value) => updateProfileDraft(profile.id, { capabilities: splitList(value) })} /><ListField label={t("Support programs", "برامج الدعم")} value={joinList(draft.support_programs)} onChange={(value) => updateProfileDraft(profile.id, { support_programs: splitList(value) })} /><div className="flex flex-wrap gap-3"><Button onClick={() => void saveProfile(profile.id)} disabled={saving}><PencilLine className="mr-2 h-4 w-4" />{t("Save official profile", "حفظ الملف الرسمي")}</Button><a href={seoEntityPath("company", profile.company_slug)} className="rounded-lg border px-4 py-2 text-sm font-semibold">{t("View public profile", "عرض الملف العام")}</a></div></CardContent></Card>; })}</div></section>}

    {isAuthenticated && profiles.length > 0 && <section className="mt-10 grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />{t("Submit a company contribution", "إرسال مساهمة شركة")}</CardTitle></CardHeader><CardContent><form onSubmit={submitContribution} className="space-y-4"><SelectField label={t("Managed profile", "الملف المُدار")} value={contributionDraft.profileId || profiles[0].id} values={profiles.map((profile) => profile.id)} labels={Object.fromEntries(profiles.map((profile) => [profile.id, profile.display_name]))} onChange={(value) => setContributionDraft({ ...contributionDraft, profileId: value })} /><SelectField label={t("Contribution type", "نوع المساهمة")} value={contributionDraft.type} values={contributionTypes} onChange={(value) => setContributionDraft({ ...contributionDraft, type: value })} /><Field label={t("Title", "العنوان")} value={contributionDraft.title} onChange={(value) => setContributionDraft({ ...contributionDraft, title: value })} required /><div><Label>{t("Summary", "الملخص")}</Label><Textarea className="mt-1" value={contributionDraft.summary} onChange={(event) => setContributionDraft({ ...contributionDraft, summary: event.target.value })} required /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Product name", "اسم المنتج")} value={contributionDraft.productName} onChange={(value) => setContributionDraft({ ...contributionDraft, productName: value })} /><Field label={t("Generic name", "المادة الفعالة")} value={contributionDraft.genericName} onChange={(value) => setContributionDraft({ ...contributionDraft, genericName: value })} /><Field label={t("Category", "الفئة")} value={contributionDraft.category} onChange={(value) => setContributionDraft({ ...contributionDraft, category: value })} /><Field label={t("Registration reference", "مرجع التسجيل")} value={contributionDraft.registrationReference} onChange={(value) => setContributionDraft({ ...contributionDraft, registrationReference: value })} /><Field label={t("Source URL", "رابط المصدر")} type="url" value={contributionDraft.sourceUrl} onChange={(value) => setContributionDraft({ ...contributionDraft, sourceUrl: value })} /></div><ListField label={t("Evidence URLs", "روابط الأدلة")} value={contributionDraft.evidenceUrls} onChange={(value) => setContributionDraft({ ...contributionDraft, evidenceUrls: value })} /><Button type="submit" disabled={saving || !contributionDraft.title.trim() || !contributionDraft.summary.trim()}><FilePlus2 className="mr-2 h-4 w-4" />{t("Submit for review", "إرسال للمراجعة")}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>{t("Your contribution history", "سجل مساهماتك")}</CardTitle></CardHeader><CardContent className="space-y-3">{contributions.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(item.contribution_type)} · {item.company_slug}</div></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm text-muted-foreground">{item.summary}</p>{item.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{item.review_notes}</p>}</div>)}{contributions.length === 0 && <p className="text-sm text-muted-foreground">{t("No contributions yet.", "لا توجد مساهمات بعد.")}</p>}</CardContent></Card></section>}
  </main>;
}

function ValueCard({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) { return <div className="rounded-2xl border bg-background/80 p-4"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>; }
function ListField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Textarea className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Separate items with commas or new lines" /></div>; }
function SelectField({ label, value, values, labels, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) { return <div><Label>{label}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item} value={item}>{labels?.[item] || humanize(item)}</option>)}</select></div>; }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "approved" || status === "verified" ? "default" : status === "rejected" ? "destructive" : "secondary"}>{humanize(status)}</Badge>; }
