import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CircleCheckBig,
  ExternalLink,
  Handshake,
  HeartHandshake,
  Search,
  Send,
  Sparkles,
  Users,
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
import { seoEntityPath } from "@/lib/seo-entities";

type Opportunity = {
  id: string;
  profile_id: string;
  organization_id: string;
  company_slug: string;
  company_name: string;
  logo_url: string | null;
  company_type: string;
  company_country: string | null;
  contribution_type: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  evidence_urls: string[];
  published_at: string;
  opportunity_type: string;
  audience: string | null;
  geography: string | null;
  deadline: string | null;
  contact_route: string | null;
  expected_outcome: string | null;
};

type IndustryProfile = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
};

type ResponseRecord = {
  id: string;
  contribution_id: string;
  company_slug: string;
  respondent_type: string;
  organization_name: string | null;
  contact_email: string;
  message: string;
  status: string;
  created_at: string;
};

const opportunityTypes = [
  "patient_support",
  "medicine_access",
  "donation",
  "procurement",
  "education_training",
  "research_evidence",
  "distribution",
  "technology_integration",
  "other",
];

const respondentTypes = [
  "ngo",
  "pharmacy",
  "hospital",
  "clinic",
  "clinician",
  "distributor",
  "supplier",
  "researcher",
  "patient_support_organization",
  "government",
  "other",
];

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function splitList(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export default function CollaborationExchange() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState({
    respondentType: "ngo",
    organizationName: "",
    contactEmail: session?.user?.email || "",
    country: "",
    city: "",
    message: "",
    capabilities: "",
  });
  const [opportunityDraft, setOpportunityDraft] = useState({
    profileId: "",
    opportunityType: "patient_support",
    title: "",
    summary: "",
    audience: "",
    geography: "",
    deadline: "",
    contactRoute: "",
    expectedOutcome: "",
    evidenceUrls: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const nextOpportunities = await supabaseFetch<Opportunity[]>(
        "/rest/v1/industry_collaboration_opportunities?select=id,profile_id,organization_id,company_slug,company_name,logo_url,company_type,company_country,contribution_type,title,summary,payload,evidence_urls,published_at,opportunity_type,audience,geography,deadline,contact_route,expected_outcome&order=published_at.desc&limit=100",
      );
      setOpportunities(nextOpportunities);
      if (isAuthenticated) {
        const [nextProfiles, nextResponses] = await Promise.all([
          supabaseFetch<IndustryProfile[]>("/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name&verification_status=eq.verified&order=display_name.asc&limit=50"),
          supabaseFetch<ResponseRecord[]>("/rest/v1/industry_opportunity_responses?select=id,contribution_id,company_slug,respondent_type,organization_name,contact_email,message,status,created_at&order=created_at.desc&limit=100"),
        ]);
        setProfiles(nextProfiles);
        setResponses(nextResponses);
        if (!opportunityDraft.profileId && nextProfiles[0]) {
          setOpportunityDraft((current) => ({ ...current, profileId: nextProfiles[0].id }));
        }
      } else {
        setProfiles([]);
        setResponses([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not load collaboration opportunities.", "تعذر تحميل فرص التعاون."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [isAuthenticated]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return opportunities.filter((opportunity) => {
      if (typeFilter && opportunity.opportunity_type !== typeFilter) return false;
      if (!normalized) return true;
      return [opportunity.title, opportunity.summary, opportunity.company_name, opportunity.audience, opportunity.geography]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized));
    });
  }, [opportunities, query, typeFilter]);

  async function submitResponse(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_opportunity_responses", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          contribution_id: selected.id,
          company_slug: selected.company_slug,
          respondent_id: session.user.id,
          respondent_type: responseDraft.respondentType,
          organization_name: responseDraft.organizationName.trim() || null,
          contact_email: responseDraft.contactEmail.trim(),
          country: responseDraft.country.trim() || null,
          city: responseDraft.city.trim() || null,
          message: responseDraft.message.trim(),
          capabilities: splitList(responseDraft.capabilities),
          status: "submitted",
        }),
      });
      setMessage(t("Your collaboration response was sent to the verified company team.", "تم إرسال رد التعاون إلى فريق الشركة الموثق."));
      setSelected(null);
      setResponseDraft((current) => ({ ...current, organizationName: "", country: "", city: "", message: "", capabilities: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not submit your response.", "تعذر إرسال ردك."));
    } finally {
      setSaving(false);
    }
  }

  async function submitOpportunity(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    const profile = profiles.find((item) => item.id === opportunityDraft.profileId);
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_company_contributions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          profile_id: profile.id,
          organization_id: profile.organization_id,
          company_slug: profile.company_slug,
          contribution_type: "partnership_opportunity",
          title: opportunityDraft.title.trim(),
          summary: opportunityDraft.summary.trim(),
          payload: {
            opportunity_type: opportunityDraft.opportunityType,
            audience: opportunityDraft.audience.trim() || null,
            geography: opportunityDraft.geography.trim() || null,
            deadline: opportunityDraft.deadline || null,
            contact_route: opportunityDraft.contactRoute.trim() || null,
            expected_outcome: opportunityDraft.expectedOutcome.trim() || null,
          },
          evidence_urls: splitList(opportunityDraft.evidenceUrls),
          submitted_by: session.user.id,
          status: "submitted",
        }),
      });
      setMessage(t("Opportunity submitted for evidence and trust review.", "تم إرسال الفرصة لمراجعة الأدلة والثقة."));
      setOpportunityDraft((current) => ({ ...current, title: "", summary: "", audience: "", geography: "", deadline: "", contactRoute: "", expectedOutcome: "", evidenceUrls: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not submit the opportunity.", "تعذر إرسال الفرصة."));
    } finally {
      setSaving(false);
    }
  }

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><HeartHandshake className="h-4 w-4" />{t("Healthcare collaboration exchange", "منصة تبادل التعاون الصحي")}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{t("Turn trusted healthcare knowledge into real partnerships", "حوّل المعرفة الصحية الموثوقة إلى شراكات حقيقية")}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{t("Verified companies can publish reviewed opportunities. NGOs, pharmacies, hospitals, clinicians, researchers, distributors, and public-health organizations can respond through one accountable network.", "يمكن للشركات الموثقة نشر فرص خاضعة للمراجعة، ويمكن للمؤسسات والصيدليات والمستشفيات والأطباء والباحثين والموزعين وجهات الصحة العامة الاستجابة من خلال شبكة واحدة موثوقة.")}</p>
          <div className="mt-6 flex flex-wrap gap-3"><a href="#opportunities" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{t("Explore opportunities", "استكشف الفرص")}</a><a href="/industry" className="rounded-lg border px-5 py-3 text-sm font-semibold hover:bg-muted">{t("Create a verified company profile", "أنشئ ملف شركة موثق")}</a></div>
        </div>
        <div className="grid gap-3">
          <Value icon={Building2} title={t("Verified companies", "شركات موثقة")} text={t("Every public opportunity is tied to a reviewed company profile.", "كل فرصة عامة مرتبطة بملف شركة خضع للمراجعة.")} />
          <Value icon={Users} title={t("All stakeholders", "جميع أصحاب المصلحة")} text={t("Connect industry with care delivery, access, research, distribution, and impact.", "ربط الصناعة بتقديم الرعاية والوصول والبحث والتوزيع والأثر.")} />
          <Value icon={Handshake} title={t("Actionable collaboration", "تعاون قابل للتنفيذ")} text={t("Move from information discovery to accountable partnership responses.", "الانتقال من اكتشاف المعلومات إلى استجابات شراكة قابلة للمساءلة.")} />
        </div>
      </div>
    </section>

    {error && <Alert variant="destructive" className="mt-6"><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-6"><CircleCheckBig className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

    <section id="opportunities" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">{t("Open collaboration opportunities", "فرص التعاون المتاحة")}</h2><p className="mt-2 text-muted-foreground">{t("Reviewed opportunities from verified healthcare companies.", "فرص خضعت للمراجعة من شركات رعاية صحية موثقة.")}</p></div><div className="text-sm text-muted-foreground">{filtered.length.toLocaleString()} {t("opportunities", "فرصة")}</div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_280px]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search company, geography, audience, or need...", "ابحث عن شركة أو منطقة أو جمهور أو احتياج...")} /></label><select className="flex h-10 rounded-md border bg-background px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">{t("All opportunity types", "كل أنواع الفرص")}</option>{opportunityTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></div>
      {loading && <p className="mt-6 text-sm text-muted-foreground">{t("Loading opportunities...", "جاري تحميل الفرص...")}</p>}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((opportunity) => <Card key={opportunity.id} className="flex h-full flex-col shadow-sm"><CardHeader><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{humanize(opportunity.opportunity_type)}</Badge><CardTitle className="mt-3 text-xl leading-7">{opportunity.title}</CardTitle><a href={seoEntityPath("company", opportunity.company_slug)} className="mt-2 inline-flex font-semibold text-primary">{opportunity.company_name}</a></div>{opportunity.logo_url && <img src={opportunity.logo_url} alt="" className="h-12 w-12 rounded-lg border object-contain" />}</div></CardHeader><CardContent className="flex flex-1 flex-col"><p className="text-sm leading-6 text-muted-foreground">{opportunity.summary}</p><div className="mt-4 grid gap-2 text-sm">{opportunity.audience && <Info label={t("Audience", "الجمهور")} value={opportunity.audience} />}{opportunity.geography && <Info label={t("Geography", "النطاق الجغرافي")} value={opportunity.geography} />}{opportunity.deadline && <Info label={t("Deadline", "الموعد النهائي")} value={opportunity.deadline} />}{opportunity.expected_outcome && <Info label={t("Expected outcome", "النتيجة المتوقعة")} value={opportunity.expected_outcome} />}</div><div className="mt-auto pt-5 flex flex-wrap gap-3"><Button onClick={() => setSelected(opportunity)}><Send className="mr-2 h-4 w-4" />{t("Respond", "استجب")}</Button>{opportunity.evidence_urls?.[0] && <a href={opportunity.evidence_urls[0]} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">{t("Evidence", "الأدلة")}<ExternalLink className="ml-2 h-4 w-4" /></a>}</div></CardContent></Card>)}</div>
      {!loading && filtered.length === 0 && <Card className="mt-6"><CardContent className="p-8 text-center text-muted-foreground">{t("No reviewed opportunities match these filters yet.", "لا توجد فرص مراجعة تطابق هذه الفلاتر حتى الآن.")}</CardContent></Card>}
    </section>

    {selected && <section className="mt-10"><Card className="border-primary/30"><CardHeader><CardTitle>{t("Respond to", "الاستجابة إلى")}: {selected.title}</CardTitle></CardHeader><CardContent>{!isAuthenticated ? <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><p className="text-muted-foreground">{t("Sign in so your response is attributable and visible to the verified company team.", "سجل الدخول حتى تكون استجابتك منسوبة إليك ومرئية لفريق الشركة الموثق.")}</p><a href="/account" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">{t("Sign in", "تسجيل الدخول")}</a></div> : <form onSubmit={submitResponse} className="grid gap-4 md:grid-cols-2"><SelectField label={t("Stakeholder type", "نوع الجهة")} value={responseDraft.respondentType} values={respondentTypes} onChange={(value) => setResponseDraft({ ...responseDraft, respondentType: value })} /><Field label={t("Organization name", "اسم الجهة")} value={responseDraft.organizationName} onChange={(value) => setResponseDraft({ ...responseDraft, organizationName: value })} /><Field label={t("Contact email", "بريد التواصل")} type="email" value={responseDraft.contactEmail} onChange={(value) => setResponseDraft({ ...responseDraft, contactEmail: value })} required /><div className="grid grid-cols-2 gap-3"><Field label={t("Country", "الدولة")} value={responseDraft.country} onChange={(value) => setResponseDraft({ ...responseDraft, country: value })} /><Field label={t("City", "المدينة")} value={responseDraft.city} onChange={(value) => setResponseDraft({ ...responseDraft, city: value })} /></div><div className="md:col-span-2"><Label>{t("How can you collaborate?", "كيف يمكنك التعاون؟")}</Label><Textarea className="mt-1 min-h-28" value={responseDraft.message} onChange={(event) => setResponseDraft({ ...responseDraft, message: event.target.value })} required /></div><div className="md:col-span-2"><Field label={t("Capabilities, separated by commas", "القدرات مفصولة بفواصل")} value={responseDraft.capabilities} onChange={(value) => setResponseDraft({ ...responseDraft, capabilities: value })} /></div><div className="md:col-span-2 flex gap-3"><Button type="submit" disabled={saving || responseDraft.message.trim().length < 20 || !responseDraft.contactEmail.trim()}><Send className="mr-2 h-4 w-4" />{t("Send collaboration response", "إرسال استجابة التعاون")}</Button><Button type="button" variant="outline" onClick={() => setSelected(null)}>{t("Cancel", "إلغاء")}</Button></div></form>}</CardContent></Card></section>}

    {isAuthenticated && profiles.length > 0 && <section className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />{t("Publish a company opportunity", "نشر فرصة من الشركة")}</CardTitle></CardHeader><CardContent><form onSubmit={submitOpportunity} className="space-y-4">{profiles.length > 1 && <SelectField label={t("Company profile", "ملف الشركة")} value={opportunityDraft.profileId} values={profiles.map((profile) => profile.id)} labels={Object.fromEntries(profiles.map((profile) => [profile.id, profile.display_name]))} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, profileId: value })} />}<SelectField label={t("Opportunity type", "نوع الفرصة")} value={opportunityDraft.opportunityType} values={opportunityTypes} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, opportunityType: value })} /><Field label={t("Title", "العنوان")} value={opportunityDraft.title} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, title: value })} required /><div><Label>{t("Summary and public value", "الملخص والقيمة العامة")}</Label><Textarea className="mt-1 min-h-28" value={opportunityDraft.summary} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, summary: event.target.value })} required /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Target audience", "الجمهور المستهدف")} value={opportunityDraft.audience} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, audience: value })} /><Field label={t("Geography", "النطاق الجغرافي")} value={opportunityDraft.geography} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, geography: value })} /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Deadline", "الموعد النهائي")} type="date" value={opportunityDraft.deadline} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, deadline: value })} /><Field label={t("Preferred contact route", "طريقة التواصل المفضلة")} value={opportunityDraft.contactRoute} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, contactRoute: value })} /></div><Field label={t("Expected outcome", "النتيجة المتوقعة")} value={opportunityDraft.expectedOutcome} onChange={(value) => setOpportunityDraft({ ...opportunityDraft, expectedOutcome: value })} /><div><Label>{t("Evidence URLs, one per line", "روابط الأدلة، رابط بكل سطر")}</Label><Textarea className="mt-1" value={opportunityDraft.evidenceUrls} onChange={(event) => setOpportunityDraft({ ...opportunityDraft, evidenceUrls: event.target.value })} /></div><Button type="submit" disabled={saving || opportunityDraft.title.trim().length < 3 || opportunityDraft.summary.trim().length < 10}><Handshake className="mr-2 h-4 w-4" />{t("Submit opportunity for review", "إرسال الفرصة للمراجعة")}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>{t("Your collaboration responses", "استجابات التعاون الخاصة بك")}</CardTitle></CardHeader><CardContent className="space-y-3">{responses.map((response) => <div key={response.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{humanize(response.respondent_type)}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(response.created_at).toLocaleDateString()}</div></div><Badge variant="secondary">{humanize(response.status)}</Badge></div><p className="mt-3 text-sm text-muted-foreground">{response.message}</p></div>)}{responses.length === 0 && <p className="text-sm text-muted-foreground">{t("No collaboration responses yet.", "لا توجد استجابات تعاون بعد.")}</p>}</CardContent></Card></section>}

    <section className="mt-10 rounded-2xl border bg-muted/30 p-5 text-sm text-muted-foreground"><strong className="text-foreground">{t("Trust and safety:", "الثقة والسلامة:")}</strong> {t("Opportunities become public only after moderation. Responses are visible only to the respondent, the verified company team, and platform administrators. Participation does not establish endorsement, clinical suitability, regulatory approval, procurement commitment, or contractual agreement.", "لا تصبح الفرص عامة إلا بعد المراجعة. ولا تظهر الاستجابات إلا لصاحبها وفريق الشركة الموثق ومديري المنصة. ولا تعني المشاركة اعتمادًا أو ملاءمة علاجية أو موافقة تنظيمية أو التزامًا بالشراء أو اتفاقًا تعاقديًا.")}</section>
  </main>;
}

function Value({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <div className="rounded-2xl border bg-background/80 p-4"><Icon className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><div className="font-medium">{value}</div></div>;
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
}

function SelectField({ label, value, values, labels, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item} value={item}>{labels?.[item] || humanize(item)}</option>)}</select></div>;
}
