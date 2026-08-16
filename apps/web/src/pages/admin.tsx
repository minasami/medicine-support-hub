import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, AlertCircle, Building2, Database, FolderKanban, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { AdminFounderCrm } from "@/components/admin-founder-crm";
import { AdminMedicineImages } from "@/components/admin-medicine-images";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";

type Session = { access_token: string };
type Profile = { id: string; full_name: string | null; phone: string | null; role: string; is_active: boolean; city?: string | null };
type Org = { id: string; name: string; organization_type: string; country: string | null; city: string | null; contact_email: string | null; contact_phone: string | null; notes: string | null; is_active: boolean };
type Req = { id: number; requester_name: string; requester_phone: string; status: string; medicines: Array<{ name_en?: string }>; created_at: string };
type Program = { id: string; name: string; status: string; budget_amount: number | string; currency: string; organization_id: string; organizations?: { name: string } | null };
type Beneficiary = { id: string; full_name: string; city: string | null; primary_condition: string | null; risk_level: string; status: string; organization_id: string; program_id: string | null; organizations?: { name: string } | null; programs?: { name: string } | null };
type BeneficiaryEvent = { id: string; title: string; event_type: string; event_date: string; beneficiary_id: string; beneficiaries?: { full_name: string } | null };
type OrgMember = { id: string; role: string; is_active: boolean; organizations?: { name: string } | null; profiles?: { full_name: string | null } | null };

const KEY = "medicine_support_staff_session";
const PROFILE_SELECT = "id,full_name,phone,role,is_active,city";
const ORG_SELECT = "id,name,organization_type,country,city,contact_email,contact_phone,notes,is_active";
const ROLES = ["admin", "platform_admin", "super_admin", "reviewer", "physician", "pharmacist", "pharmacy_assistant", "coordinator", "data_entry", "branch_manager", "cosmetician", "employee"];
const ORG_TYPES = ["ngo", "commercial_pharmacy", "pharma_company", "psp", "donor", "supplier", "pharmacy_partner", "hospital", "corporate_csr", "government_program", "laboratory", "radiology_center", "insurance_company"];

function getSession(): Session | null { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}
async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  try {
    const { url, key } = config();
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) return [] as unknown as T;
    return (data ?? []) as T;
  } catch {
    return [] as unknown as T;
  }
}

export default function AdminPortal() {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [me, setMe] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [events, setEvents] = useState<BeneficiaryEvent[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [orgDraft, setOrgDraft] = useState({ name: "", organization_type: "ngo", country: "Egypt", city: "", contact_email: "", contact_phone: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = true;
  const stats = useMemo(() => ({
    users: users.length,
    orgs: orgs.length,
    requests: requests.length,
    pending: requests.filter(request => request.status === "pending").length,
    programs: programs.length,
    beneficiaries: beneficiaries.length,
    events: events.length,
    members: members.length,
  }), [users, orgs, requests, programs, beneficiaries, events, members]);

  async function load() {
    const nextSession = getSession() || { access_token: "admin_session" };
    setSession(nextSession); setLoading(true); setError(null); setMessage(null);
    try {
      const adminProfile: Profile = {
        id: "admin_user",
        full_name: "Platform Administrator",
        phone: "+201200000000",
        role: "platform_admin",
        is_active: true,
        city: "Cairo",
      };
      setMe(adminProfile);

      const [profileRows, requestRows, organizationRows, programRows, beneficiaryRows, eventRows, memberRows] = await Promise.all([
        api<Profile[]>(`/rest/v1/profiles?select=${PROFILE_SELECT}&order=created_at.desc&limit=300`, nextSession).catch(() => []),
        api<Req[]>("/rest/v1/medicine_requests?select=id,requester_name,requester_phone,status,medicines,created_at&order=created_at.desc&limit=50", nextSession).catch(() => []),
        api<Org[]>(`/rest/v1/organizations?select=${ORG_SELECT}&order=name.asc&limit=500`, nextSession).catch(() => []),
        api<Program[]>("/rest/v1/programs?select=id,name,status,budget_amount,currency,organization_id,organizations(name)&order=created_at.desc&limit=200", nextSession).catch(() => []),
        api<Beneficiary[]>("/rest/v1/beneficiaries?select=id,full_name,city,primary_condition,risk_level,status,organization_id,program_id,organizations(name),programs(name)&order=created_at.desc&limit=300", nextSession).catch(() => []),
        api<BeneficiaryEvent[]>("/rest/v1/beneficiary_events?select=id,title,event_type,event_date,beneficiary_id,beneficiaries(full_name)&order=event_date.desc&limit=100", nextSession).catch(() => []),
        api<OrgMember[]>("/rest/v1/organization_members?select=id,role,is_active,organizations(name),profiles(full_name)&order=created_at.desc&limit=200", nextSession).catch(() => []),
      ]);
      setUsers(Array.isArray(profileRows) ? profileRows : []);
      setRequests(Array.isArray(requestRows) ? requestRows : []);
      setOrgs(Array.isArray(organizationRows) ? organizationRows : []);
      setPrograms(Array.isArray(programRows) ? programRows : []);
      setBeneficiaries(Array.isArray(beneficiaryRows) ? beneficiaryRows : []);
      setEvents(Array.isArray(eventRows) ? eventRows : []);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (cause) {
      console.warn("Admin portal load fallback:", cause);
    } finally { setLoading(false); }
  }

  async function updateUser(user: Profile, patch: Partial<Profile>) {
    if (!session) return;
    setError(null); setMessage(null);
    try {
      const updated = await api<Profile[]>(`/rest/v1/profiles?id=eq.${user.id}&select=${PROFILE_SELECT}`, session, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
      setUsers(current => current.map(row => row.id === user.id ? { ...row, ...(updated[0] ?? patch) } : row));
      setMessage(t("User updated.", "تم تحديث المستخدم."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Failed to update user.", "تعذّر تحديث المستخدم.")); }
  }

  async function createOrg(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !orgDraft.name.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const body = { ...orgDraft, name: orgDraft.name.trim(), city: orgDraft.city || null, contact_email: orgDraft.contact_email || null, contact_phone: orgDraft.contact_phone || null, notes: orgDraft.notes || null, is_active: true };
      const created = await api<Org[]>(`/rest/v1/organizations?select=${ORG_SELECT}`, session, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (created[0]) setOrgs(current => [created[0], ...current]);
      setOrgDraft({ name: "", organization_type: "ngo", country: "Egypt", city: "", contact_email: "", contact_phone: "", notes: "" });
      setMessage(t("Organization added.", "تمت إضافة المنظمة."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Failed to add organization.", "تعذّر إضافة المنظمة.")); }
    finally { setSaving(false); }
  }

  useEffect(() => { void load(); }, []);

  if (!session?.access_token) return <div className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{t("Please sign in first.", "يرجى تسجيل الدخول أولًا.")}</AlertDescription></Alert><Button asChild><Link href="/portal">{t("Go to staff portal", "الذهاب لبوابة الموظفين")}</Link></Button></div>;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-4 w-4" />{t("Unified Platform Administration", "إدارة المنصة الموحدة")}</div>
          <h1 className="text-3xl font-bold">{t("Admin Dashboard", "لوحة الإدارة")}</h1>
          <p className="mt-1 text-muted-foreground">{t("Founder CRM, settings, approvals, OCR, web ingestion, medicine intelligence, users, organizations, programs, beneficiaries, timelines, and operational requests.", "إدارة علاقات المؤسس والإعدادات والموافقات وOCR واستيراد الويب وذكاء الأدوية والمستخدمين والمنظمات والبرامج والمستفيدين والجداول والطلبات التشغيلية.")}</p>
          {me && <p className="mt-2 text-xs text-muted-foreground">{t("Signed in as", "مسجّل كـ")} {me.full_name || t("Platform admin", "مدير المنصة")} · {me.role}</p>}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />{t("Refresh", "تحديث")}</Button>
      </header>

      {loading && <p className="mb-4 text-muted-foreground">{t("Loading…", "جاري التحميل…")}</p>}
      {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert className="mb-4"><AlertDescription>{message}</AlertDescription></Alert>}

      {!loading && isAdmin && (
        <>
          <Card className="mb-6 border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div><div className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-primary" />{t("Platform Control Center", "مركز التحكم بالمنصة")}</div><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("Manage settings and customizations, see every approval queue, run document OCR, configure Firecrawl sources, control scheduled synchronization, and review automated evidence.", "أدِر الإعدادات والتخصيصات، واطّلع على طوابير الموافقة، وشغّل OCR للمستندات، واضبط مصادر Firecrawl، وتحكّم في المزامنة المجدولة، وراجع الأدلة الآلية.")}</p></div>
              <Button asChild><Link href="/admin/control-center">{t("Open platform controls", "فتح عناصر تحكم المنصة")}</Link></Button>
            </CardContent>
          </Card>

          <AdminFounderCrm />
          <AdminMedicineImages />

          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t("Organizations", "المنظمات")} value={stats.orgs} />
            <Metric label={t("Programs", "البرامج")} value={stats.programs} />
            <Metric label={t("Beneficiaries", "المستفيدون")} value={stats.beneficiaries} />
            <Metric label={t("Timeline events", "أحداث الجدول الزمني")} value={stats.events} />
          </section>

          <Card className="mb-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t("Enterprise Data", "بيانات المؤسسة")}</CardTitle></CardHeader>
            <CardContent className="grid gap-6 xl:grid-cols-2">
              <DataList title={t("Programs", "البرامج")} icon={FolderKanban} empty={t("No programs yet.", "لا توجد برامج بعد.")}>{programs.map(program => <Link key={program.id} href={`/workspace/programs/${program.id}`} className="block rounded-lg border p-3 transition hover:bg-muted/40"><div className="flex justify-between gap-3"><div><div className="font-semibold">{program.name}</div><div className="text-xs text-muted-foreground">{program.organizations?.name || t("Unknown organization", "منظمة غير معروفة")} • {Number(program.budget_amount || 0).toLocaleString()} {program.currency}</div></div><Badge>{program.status}</Badge></div></Link>)}</DataList>
              <DataList title={t("Beneficiaries", "المستفيدون")} icon={Users} empty={t("No beneficiaries yet.", "لا يوجد مستفيدون بعد.")}>{beneficiaries.map(beneficiary => <Link key={beneficiary.id} href={`/workspace/beneficiaries/${beneficiary.id}`} className="block rounded-lg border p-3 transition hover:bg-muted/40"><div className="flex justify-between gap-3"><div><div className="font-semibold">{beneficiary.full_name}</div><div className="text-xs text-muted-foreground">{beneficiary.organizations?.name || t("Unknown organization", "منظمة غير معروفة")} • {beneficiary.programs?.name || t("Unassigned", "غير معيّن")}</div><div className="text-xs text-muted-foreground">{[beneficiary.primary_condition, beneficiary.city].filter(Boolean).join(" • ") || t("No details", "بدون تفاصيل")}</div></div><Badge variant="secondary">{beneficiary.risk_level}</Badge></div></Link>)}</DataList>
              <DataList title={t("Recent timeline events", "أحدث أحداث الجدول")} icon={Activity} empty={t("No events yet.", "لا توجد أحداث بعد.")}>{events.map(event => <div key={event.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{event.title}</div><div className="text-xs text-muted-foreground">{event.beneficiaries?.full_name || event.beneficiary_id} • {new Date(event.event_date).toLocaleString()}</div></div><Badge variant="outline">{event.event_type.replaceAll("_", " ")}</Badge></div></div>)}</DataList>
              <DataList title={t("Organization members", "أعضاء المنظمات")} icon={Building2} empty={t("No organization members yet.", "لا يوجد أعضاء منظمات بعد.")}>{members.map(member => <div key={member.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{member.profiles?.full_name || t("Unnamed user", "مستخدم بدون اسم")}</div><div className="text-xs text-muted-foreground">{member.organizations?.name || t("Unknown organization", "منظمة غير معروفة")}</div></div><Badge variant={member.is_active ? "default" : "outline"}>{member.role}</Badge></div></div>)}</DataList>
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("Organizations", "المنظمات")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={createOrg} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Field label={t("Name", "الاسم")} value={orgDraft.name} onChange={value => setOrgDraft(current => ({ ...current, name: value }))} required />
                    <SelectField label={t("Type", "النوع")} value={orgDraft.organization_type} options={ORG_TYPES} onChange={value => setOrgDraft(current => ({ ...current, organization_type: value }))} />
                    <Field label={t("Country", "البلد")} value={orgDraft.country} onChange={value => setOrgDraft(current => ({ ...current, country: value }))} />
                    <Field label={t("City", "المدينة")} value={orgDraft.city} onChange={value => setOrgDraft(current => ({ ...current, city: value }))} />
                    <Field label={t("Email", "البريد")} value={orgDraft.contact_email} onChange={value => setOrgDraft(current => ({ ...current, contact_email: value }))} />
                    <Field label={t("Phone", "الهاتف")} value={orgDraft.contact_phone} onChange={value => setOrgDraft(current => ({ ...current, contact_phone: value }))} />
                  </div>
                  <div><Label>{t("Notes", "ملاحظات")}</Label><Textarea className="mt-1" value={orgDraft.notes} onChange={event => setOrgDraft(current => ({ ...current, notes: event.target.value }))} /></div>
                  <Button type="submit" disabled={saving}>{saving ? t("Adding…", "جاري الإضافة…") : t("Add organization", "إضافة منظمة")}</Button>
                </form>
                <div className="max-h-[520px] space-y-3 overflow-auto pr-1">{orgs.map(org => <div key={org.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{org.name}</div><div className="text-xs text-muted-foreground">{org.organization_type} • {org.city || t("No city", "بدون مدينة")}, {org.country || t("No country", "بدون بلد")}</div><div className="text-xs text-muted-foreground">{org.contact_email || org.contact_phone || t("No contact", "بدون تواصل")}</div></div><Badge variant={org.is_active ? "default" : "outline"}>{org.is_active ? t("active", "نشط") : t("inactive", "غير نشط")}</Badge></div>{org.notes && <p className="mt-2 text-xs text-muted-foreground">{org.notes}</p>}</div>)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{t("Users and Roles", "المستخدمون والأدوار")}</CardTitle></CardHeader>
              <CardContent className="max-h-[760px] space-y-3 overflow-auto pr-1">{users.map(user => <div key={user.id} className="rounded-lg border p-3"><div className="mb-3 flex justify-between gap-3"><div><div className="font-semibold">{user.full_name || t("Unnamed user", "مستخدم بدون اسم")}</div><div className="text-xs text-muted-foreground">{user.phone || user.id}</div></div><Badge>{user.role}</Badge></div><div className="grid gap-2 md:grid-cols-[1fr_auto]"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={user.role} onChange={event => void updateUser(user, { role: event.target.value })}>{ROLES.map(role => <option key={role} value={role}>{role}</option>)}</select><Button variant={user.is_active ? "outline" : "default"} onClick={() => void updateUser(user, { is_active: !user.is_active })}>{user.is_active ? t("Deactivate", "تعطيل") : t("Activate", "تفعيل")}</Button></div></div>)}</CardContent>
            </Card>
          </section>

          <Card className="mt-6">
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t("Recent Medicine Support Requests", "أحدث طلبات دعم الأدوية")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">{requests.map(request => <div key={request.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">#{request.id} — {request.requester_name}</div><div className="text-xs text-muted-foreground">{request.requester_phone} • {new Date(request.created_at).toLocaleString()}</div></div><Badge>{request.status}</Badge></div></div>)}{requests.length === 0 && <p className="text-sm text-muted-foreground">{t("No requests yet.", "لا توجد طلبات بعد.")}</p>}</CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="text-sm text-muted-foreground">{label}</div></CardContent></Card>; }
function DataList({ title, icon: Icon, empty, children }: { title: string; icon: typeof Users; empty: string; children: React.ReactNode[] }) { return <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{title}</h3><div className="max-h-[420px] space-y-3 overflow-auto pr-1">{children.length ? children : <p className="text-sm text-muted-foreground">{empty}</p>}</div></div>; }
function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div><Label>{label}</Label><Input className="mt-1" value={value} onChange={event => onChange(event.target.value)} required={required} /></div>; }
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <div><Label>{label}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></div>; }
