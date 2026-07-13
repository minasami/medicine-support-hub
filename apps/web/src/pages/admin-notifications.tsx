import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, BrainCircuit, CheckCircle2, RefreshCw, Send, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

interface Profile { id: string; role: string; is_active: boolean }
interface Campaign {
  id: string;
  title: string;
  body: string;
  audience_type: string;
  audience_values: string[];
  notification_topic: string;
  target_url: string;
  status: string;
  attempted_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
  completed_at: string | null;
}
interface Subscription { id: string; user_id: string | null; topics: string[]; is_enabled: boolean; last_seen_at: string }
interface CompanyMetric { count: number }
interface MedicineMetric { count: number }

const topics = ["platform_updates", "medicine_updates", "company_updates", "marketplace_updates", "learning_updates", "favorite_updates"];
const audienceTypes = ["topic", "all", "users", "role", "medicine", "company"];
const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

const templates = [
  { name: "Medicine update", topic: "medicine_updates", title: "Medicine encyclopedia updated", body: "New medicine records, manufacturer links, or source-backed price evidence are available. Open the encyclopedia to review the latest changes.", target: "/medicines" },
  { name: "Company portfolio update", topic: "company_updates", title: "Company medicine portfolios expanded", body: "Manufacturer profiles and canonical medicine portfolios have been refreshed. Explore companies and their connected medicines.", target: "/companies" },
  { name: "Marketplace update", topic: "marketplace_updates", title: "New reviewed marketplace activity", body: "There are new or updated reviewed marketplace listings. Verify seller, licensing, batch, expiry, and procurement details before acting.", target: "/marketplace" },
  { name: "Learning update", topic: "learning_updates", title: "New healthcare learning resources", body: "New role-based learning resources are available for patients, clinicians, pharmacists, and healthcare teams.", target: "/learn" },
  { name: "Support opportunity", topic: "platform_updates", title: "New medicine-support opportunity", body: "A new platform support, collaboration, or participation opportunity is available. Open Medicine Support Hub for details.", target: "/journey" },
];

export default function AdminNotifications() {
  const { session, supabaseFetch } = usePatientAuth();
  const [me, setMe] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [metrics, setMetrics] = useState({ medicines: 0, companies: 0 });
  const [draft, setDraft] = useState({ title: "", body: "", topic: "platform_updates", targetUrl: "/", audienceType: "topic", audienceValues: "", imageUrl: "" });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = me?.is_active && ["admin", "platform_admin", "super_admin"].includes(me.role);
  const activeSubscriptions = subscriptions.filter((row) => row.is_enabled).length;
  const deliveryRate = useMemo(() => {
    const attempted = campaigns.reduce((sum, row) => sum + Number(row.attempted_count || 0), 0);
    const delivered = campaigns.reduce((sum, row) => sum + Number(row.delivered_count || 0), 0);
    return attempted > 0 ? Math.round(delivered / attempted * 100) : 0;
  }, [campaigns]);

  async function load() {
    setLoading(true); setError(null);
    try {
      if (!session?.user?.id) throw new Error("Sign in as a platform administrator.");
      const [profiles, nextCampaigns, nextSubscriptions, medicineRows, companyRows] = await Promise.all([
        supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`),
        supabaseFetch<Campaign[]>("/rest/v1/notification_campaigns?select=id,title,body,audience_type,audience_values,notification_topic,target_url,status,attempted_count,delivered_count,failed_count,created_at,completed_at&order=created_at.desc&limit=100"),
        supabaseFetch<Subscription[]>("/rest/v1/push_subscriptions?select=id,user_id,topics,is_enabled,last_seen_at&order=last_seen_at.desc&limit=5000"),
        supabaseFetch<MedicineMetric[]>("/rest/v1/medicine_encyclopedia_products_v2?select=count"),
        supabaseFetch<CompanyMetric[]>("/rest/v1/medicine_company_profiles?select=count"),
      ]);
      const profile = profiles[0] || null;
      setMe(profile);
      if (!profile?.is_active || !["admin", "platform_admin", "super_admin"].includes(profile.role)) throw new Error("Active platform-administrator access is required.");
      setCampaigns(nextCampaigns || []);
      setSubscriptions(nextSubscriptions || []);
      setMetrics({ medicines: Number(medicineRows[0]?.count || 0), companies: Number(companyRows[0]?.count || 0) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notification management.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [session?.user?.id]);

  function applyTemplate(template: typeof templates[number]) {
    const enrichedBody = template.topic === "medicine_updates"
      ? `${template.body} The live encyclopedia currently connects approximately ${metrics.medicines.toLocaleString()} canonical records.`
      : template.topic === "company_updates"
        ? `${template.body} The company directory currently contains ${metrics.companies.toLocaleString()} manufacturer-derived profiles.`
        : template.body;
    setDraft({ ...draft, title: template.title, body: enrichedBody.slice(0, 500), topic: template.topic, targetUrl: template.target, audienceType: "topic", audienceValues: "" });
  }

  async function sendCampaign(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.access_token || !isAdmin) return;
    setSending(true); setError(null); setMessage(null);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Supabase configuration is unavailable.");
      const response = await fetch(`${url}/functions/v1/send-platform-notification`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          body: draft.body.trim(),
          topic: draft.topic,
          targetUrl: draft.targetUrl.trim() || "/",
          audienceType: draft.audienceType,
          audienceValues: draft.audienceValues.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
          imageUrl: draft.imageUrl.trim() || null,
          intelligentTemplate: true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not send the notification campaign.");
      setMessage(`Campaign sent: ${Number(result.delivered || 0).toLocaleString()} delivered, ${Number(result.failed || 0).toLocaleString()} failed, ${Number(result.attempted || 0).toLocaleString()} attempted.`);
      setDraft({ title: "", body: "", topic: "platform_updates", targetUrl: "/", audienceType: "topic", audienceValues: "", imageUrl: "" });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the notification campaign.");
    } finally { setSending(false); }
  }

  if (!session?.access_token) return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Sign in through the staff portal first.</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><BellRing className="h-4 w-4" />Push and in-app communication</p><h1 className="mt-3 text-4xl font-bold">Notification management</h1><p className="mt-3 max-w-3xl text-muted-foreground">Create attributable, targeted updates for platform news, medicines, companies, marketplace activity, learning, or favorites. Browser permission and user topic choices are always respected.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div></section>

    {error && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-5"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

    {!loading && isAdmin && <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active push subscriptions" value={activeSubscriptions} /><Metric label="Campaigns" value={campaigns.length} /><Metric label="Aggregate delivery rate" value={`${deliveryRate}%`} /><Metric label="Enabled topics" value={topics.length} /></section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" />Intelligent campaign templates</CardTitle></CardHeader><CardContent className="space-y-3">{templates.map((template) => <button key={template.name} onClick={() => applyTemplate(template)} className="block w-full rounded-xl border p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"><div className="font-semibold">{template.name}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(template.topic)} · {template.target}</div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{template.body}</p></button>)}</CardContent></Card>

        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Compose and send</CardTitle></CardHeader><CardContent><form onSubmit={sendCampaign} className="space-y-4"><div><Label>Title</Label><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} minLength={2} maxLength={120} required /></div><div><Label>Message</Label><Textarea className="min-h-28" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} minLength={2} maxLength={500} required /><div className="mt-1 text-right text-xs text-muted-foreground">{draft.body.length}/500</div></div><div className="grid gap-4 md:grid-cols-2"><div><Label>Topic</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })}>{topics.map((topic) => <option key={topic} value={topic}>{humanize(topic)}</option>)}</select></div><div><Label>Audience</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.audienceType} onChange={(event) => setDraft({ ...draft, audienceType: event.target.value })}>{audienceTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></div></div>{!["topic", "all"].includes(draft.audienceType) && <div><Label>Audience values</Label><Textarea value={draft.audienceValues} onChange={(event) => setDraft({ ...draft, audienceValues: event.target.value })} placeholder="User IDs, roles, medicine IDs, or company slugs — one per line" /></div>}<div className="grid gap-4 md:grid-cols-2"><div><Label>Target URL</Label><Input value={draft.targetUrl} onChange={(event) => setDraft({ ...draft, targetUrl: event.target.value })} placeholder="/medicines" required /></div><div><Label>Optional image URL</Label><Input type="url" value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="https://..." /></div></div><Alert><AlertDescription>Send only useful, attributable updates. Do not use push notifications for diagnosis, prescribing, emergency instructions, private patient information, or unverified medical claims.</AlertDescription></Alert><Button type="submit" disabled={sending || draft.title.trim().length < 2 || draft.body.trim().length < 2}><Send className="mr-2 h-4 w-4" />{sending ? "Sending…" : "Send notification"}</Button></form></CardContent></Card>
      </section>

      <section className="mt-10"><div className="flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="text-2xl font-semibold">Campaign history</h2></div><div className="mt-4 space-y-3">{campaigns.map((campaign) => <Card key={campaign.id}><CardContent className="grid gap-4 p-5 lg:grid-cols-[1.2fr_.8fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><div className="font-semibold">{campaign.title}</div><Badge variant={campaign.status === "sent" ? "default" : "secondary"}>{humanize(campaign.status)}</Badge></div><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{campaign.body}</p><div className="mt-2 text-xs text-muted-foreground">{humanize(campaign.notification_topic)} · {humanize(campaign.audience_type)} · {new Date(campaign.created_at).toLocaleString()}</div></div><div className="grid grid-cols-3 gap-2 text-center text-sm"><MiniMetric label="Attempted" value={campaign.attempted_count} /><MiniMetric label="Delivered" value={campaign.delivered_count} /><MiniMetric label="Failed" value={campaign.failed_count} /></div><a href={campaign.target_url} className="text-sm font-semibold text-primary">Open target</a></CardContent></Card>)}{campaigns.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No campaigns yet.</CardContent></Card>}</div></section>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>; }
function MiniMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-muted p-2"><div className="font-bold">{Number(value || 0).toLocaleString()}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>; }
