import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, AlertCircle, Building2, Database, FolderKanban, RefreshCw, ShieldCheck, Users } from "lucide-react";

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
const ROLES = ["admin", "reviewer", "physician", "pharmacist", "pharmacy_assistant", "coordinator", "data_entry", "branch_manager", "cosmetician", "employee"];
const ORG_TYPES = ["ngo", "commercial_pharmacy", "pharma_company", "psp", "donor", "supplier", "pharmacy_partner", "hospital", "corporate_csr", "government_program"];

function getSession(): Session | null { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
function config() { const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, ""); const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY; if (!url || !key) throw new Error("Supabase environment variables are missing."); return { url, key }; }
async function api<T>(path: string, session: Session, init: RequestInit = {}) { const { url, key } = config(); const res = await fetch(`${url}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) } }); const text = await res.text(); const data = text ? JSON.parse(text) : null; if (!res.ok) throw new Error(data?.message || data?.error || "Request failed"); return data as T; }

export default function AdminPortal() {
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
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);

  const isAdmin = ["admin", "platform_admin", "super_admin"].includes(me?.role ?? "");
  const stats = useMemo(() => ({ users: users.length, orgs: orgs.length, requests: requests.length, pending: requests.filter(r => r.status === "pending").length, programs: programs.length, beneficiaries: beneficiaries.length, events: events.length, members: members.length }), [users, orgs, requests, programs, beneficiaries, events, members]);

  async function load() {
    const s = getSession(); setSession(s); setLoading(true); setError(null); setMessage(null);
    try {
      if (!s?.access_token) throw new Error("Please sign in first from the staff portal.");
      const authUser = await api<{ id: string }>("/auth/v1/user", s);
      const own = await api<Profile[]>(`/rest/v1/profiles?select=${PROFILE_SELECT}&id=eq.${authUser.id}&limit=1`, s);
      const mine = own[0] ?? null; setMe(mine);
      if (!mine || !["admin", "platform_admin", "super_admin"].includes(mine.role)) throw new Error("Your account is not authorized as platform admin.");
      const [u, r, o, p, b, e, m] = await Promise.all([
        api<Profile[]>(`/rest/v1/profiles?select=${PROFILE_SELECT}&order=created_at.desc&limit=300`, s),
        api<Req[]>("/rest/v1/medicine_requests?select=id,requester_name,requester_phone,status,medicines,created_at&order=created_at.desc&limit=50", s),
        api<Org[]>(`/rest/v1/organizations?select=${ORG_SELECT}&order=name.asc&limit=500`, s),
        api<Program[]>("/rest/v1/programs?select=id,name,status,budget_amount,currency,organization_id,organizations(name)&order=created_at.desc&limit=200", s),
        api<Beneficiary[]>("/rest/v1/beneficiaries?select=id,full_name,city,primary_condition,risk_level,status,organization_id,program_id,organizations(name),programs(name)&order=created_at.desc&limit=300", s),
        api<BeneficiaryEvent[]>("/rest/v1/beneficiary_events?select=id,title,event_type,event_date,beneficiary_id,beneficiaries(full_name)&order=event_date.desc&limit=100", s),
        api<OrgMember[]>("/rest/v1/organization_members?select=id,role,is_active,organizations(name),profiles(full_name)&order=created_at.desc&limit=200", s),
      ]);
      setUsers(u); setRequests(r); setOrgs(o); setPrograms(p); setBeneficiaries(b); setEvents(e); setMembers(m);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load admin dashboard."); }
    finally { setLoading(false); }
  }

  async function updateUser(user: Profile, patch: Partial<Profile>) { if (!session) return; setError(null); setMessage(null); try { const updated = await api<Profile[]>(`/rest/v1/profiles?id=eq.${user.id}&select=${PROFILE_SELECT}`, session, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }); setUsers(cur => cur.map(u => u.id === user.id ? { ...u, ...(updated[0] ?? patch) } : u)); setMessage("User updated."); } catch (e) { setError(e instanceof Error ? e.message : "Failed to update user."); } }
  async function createOrg(e: React.FormEvent) { e.preventDefault(); if (!session || !orgDraft.name.trim()) return; setSaving(true); setError(null); setMessage(null); try { const body = { ...orgDraft, name: orgDraft.name.trim(), city: orgDraft.city || null, contact_email: orgDraft.contact_email || null, contact_phone: orgDraft.contact_phone || null, notes: orgDraft.notes || null, is_active: true }; const created = await api<Org[]>(`/rest/v1/organizations?select=${ORG_SELECT}`, session, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) }); setOrgs(cur => [created[0], ...cur].filter(Boolean)); setOrgDraft({ name: "", organization_type: "ngo", country: "Egypt", city: "", contact_email: "", contact_phone: "", notes: "" }); setMessage("Organization added."); } catch (e) { setError(e instanceof Error ? e.message : "Failed to add organization."); } finally { setSaving(false); } }
  useEffect(() => { load(); }, []);

  if (!session?.access_token) return <div className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>Please sign in first.</AlertDescription></Alert><Button asChild><Link href="/portal">Go to staff portal</Link></Button></div>;

  return <div className="container mx-auto max-w-7xl px-4 py-8">
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-4 w-4" />Unified Platform Administration</div><h1 className="text-3xl font-bold">Admin Dashboard</h1><p className="text-muted-foreground">Users, roles, organizations, enterprise programs, beneficiaries, timelines, and medicine requests.</p></div><Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    {loading && <p className="mb-4 text-muted-foreground">Loading...</p>}
    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-4"><AlertDescription>{message}</AlertDescription></Alert>}
    {!loading && isAdmin && <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-5"><div className="text-3xl font-bold">{stats.orgs}</div><div className="text-sm text-muted-foreground">Organizations</div></CardContent></Card><Card><CardContent className="p-5"><div className="text-3xl font-bold">{stats.programs}</div><div className="text-sm text-muted-foreground">Programs</div></CardContent></Card><Card><CardContent className="p-5"><div className="text-3xl font-bold">{stats.beneficiaries}</div><div className="text-sm text-muted-foreground">Beneficiaries</div></CardContent></Card><Card><CardContent className="p-5"><div className="text-3xl font-bold">{stats.events}</div><div className="text-sm text-muted-foreground">Timeline events</div></CardContent></Card></div>

      <Card className="mb-6"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Enterprise Data</CardTitle></CardHeader><CardContent className="grid gap-6 xl:grid-cols-2">
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><FolderKanban className="h-4 w-4" />Programs</h3><div className="space-y-3">{programs.map(p => <Link key={p.id} href={`/workspace/programs/${p.id}`} className="block rounded-lg border p-3 transition hover:bg-muted/40"><div className="flex justify-between gap-3"><div><div className="font-semibold">{p.name}</div><div className="text-xs text-muted-foreground">{p.organizations?.name || "Unknown organization"} • {Number(p.budget_amount || 0).toLocaleString()} {p.currency}</div></div><Badge>{p.status}</Badge></div></Link>)}{!programs.length && <p className="text-sm text-muted-foreground">No programs yet.</p>}</div></div>
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />Beneficiaries</h3><div className="space-y-3">{beneficiaries.map(b => <Link key={b.id} href={`/workspace/beneficiaries/${b.id}`} className="block rounded-lg border p-3 transition hover:bg-muted/40"><div className="flex justify-between gap-3"><div><div className="font-semibold">{b.full_name}</div><div className="text-xs text-muted-foreground">{b.organizations?.name || "Unknown organization"} • {b.programs?.name || "Unassigned"}</div><div className="text-xs text-muted-foreground">{[b.primary_condition, b.city].filter(Boolean).join(" • ") || "No details"}</div></div><Badge variant="secondary">{b.risk_level}</Badge></div></Link>)}{!beneficiaries.length && <p className="text-sm text-muted-foreground">No beneficiaries yet.</p>}</div></div>
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" />Recent timeline events</h3><div className="space-y-3">{events.map(e => <div key={e.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{e.title}</div><div className="text-xs text-muted-foreground">{e.beneficiaries?.full_name || e.beneficiary_id} • {new Date(e.event_date).toLocaleString()}</div></div><Badge variant="outline">{e.event_type.replaceAll("_", " ")}</Badge></div></div>)}{!events.length && <p className="text-sm text-muted-foreground">No events yet.</p>}</div></div>
        <div><h3 className="mb-3 flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4" />Organization members</h3><div className="space-y-3">{members.map(m => <div key={m.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{m.profiles?.full_name || "Unnamed user"}</div><div className="text-xs text-muted-foreground">{m.organizations?.name || "Unknown organization"}</div></div><Badge variant={m.is_active ? "default" : "outline"}>{m.role}</Badge></div></div>)}{!members.length && <p className="text-sm text-muted-foreground">No organization members yet.</p>}</div></div>
      </CardContent></Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Organizations</CardTitle></CardHeader><CardContent className="space-y-4"><form onSubmit={createOrg} className="rounded-lg border bg-muted/20 p-4 space-y-3"><div className="grid gap-2 md:grid-cols-2"><div><Label>Name</Label><Input value={orgDraft.name} onChange={e => setOrgDraft({ ...orgDraft, name: e.target.value })} required /></div><div><Label>Type</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={orgDraft.organization_type} onChange={e => setOrgDraft({ ...orgDraft, organization_type: e.target.value })}>{ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div><div><Label>Country</Label><Input value={orgDraft.country} onChange={e => setOrgDraft({ ...orgDraft, country: e.target.value })} /></div><div><Label>City</Label><Input value={orgDraft.city} onChange={e => setOrgDraft({ ...orgDraft, city: e.target.value })} /></div><div><Label>Email</Label><Input value={orgDraft.contact_email} onChange={e => setOrgDraft({ ...orgDraft, contact_email: e.target.value })} /></div><div><Label>Phone</Label><Input value={orgDraft.contact_phone} onChange={e => setOrgDraft({ ...orgDraft, contact_phone: e.target.value })} /></div></div><div><Label>Notes</Label><Textarea value={orgDraft.notes} onChange={e => setOrgDraft({ ...orgDraft, notes: e.target.value })} /></div><Button type="submit" disabled={saving}>{saving ? "Adding..." : "Add organization"}</Button></form><div className="space-y-3">{orgs.map(o => <div key={o.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{o.name}</div><div className="text-xs text-muted-foreground">{o.organization_type} • {o.city || "No city"}, {o.country || "No country"}</div><div className="text-xs text-muted-foreground">{o.contact_email || o.contact_phone || "No contact"}</div></div><Badge variant={o.is_active ? "default" : "outline"}>{o.is_active ? "active" : "inactive"}</Badge></div>{o.notes && <p className="mt-2 text-xs text-muted-foreground">{o.notes}</p>}</div>)}{!orgs.length && <p className="text-sm text-muted-foreground">No organizations yet.</p>}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Users and Roles</CardTitle></CardHeader><CardContent className="space-y-3">{users.map(u => <div key={u.id} className="rounded-lg border p-3"><div className="mb-3 flex justify-between gap-3"><div><div className="font-semibold">{u.full_name || "Unnamed user"}</div><div className="text-xs text-muted-foreground">{u.phone || u.id}</div></div><Badge>{u.role}</Badge></div><div className="grid gap-2 md:grid-cols-[1fr_auto]"><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={u.role} onChange={e => updateUser(u, { role: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select><Button variant={u.is_active ? "outline" : "default"} onClick={() => updateUser(u, { is_active: !u.is_active })}>{u.is_active ? "Deactivate" : "Activate"}</Button></div></div>)}</CardContent></Card>
      </div>
      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Recent Requests</CardTitle></CardHeader><CardContent className="space-y-3">{requests.map(r => <div key={r.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">#{r.id} — {r.requester_name}</div><div className="text-xs text-muted-foreground">{r.requester_phone} • {new Date(r.created_at).toLocaleString()}</div></div><Badge>{r.status}</Badge></div></div>)}</CardContent></Card>
    </>}
  </div>;
}
