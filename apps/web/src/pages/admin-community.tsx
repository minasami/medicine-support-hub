import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, MessageCircleWarning, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

interface Profile { id: string; role: string; is_active: boolean }
interface CommentRow { id: string; user_id: string; author_name: string; entity_type: string; entity_key: string; body: string; status: string; moderation_reason: string | null; created_at: string }
interface Observation { id: string; canonical_id: number; user_id: string; author_name: string; observation_type: string; title: string; description: string; severity: string | null; onset_timing: string | null; evidence_urls: string[]; status: string; created_at: string }
interface Report { id: string; reporter_user_id: string; entity_type: string; entity_key: string; reason: string; details: string | null; status: string; created_at: string }
interface CompanyMessage { id: string; company_slug: string; organization_id: string | null; sender_name: string; subject: string; body: string; status: string; created_at: string }

const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

export default function AdminCommunity() {
  const { session, supabaseFetch } = usePatientAuth();
  const [me, setMe] = useState<Profile | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [messages, setMessages] = useState<CompanyMessage[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = me?.is_active && ["admin", "platform_admin", "super_admin"].includes(me.role);
  const openMessages = useMemo(() => messages.filter((row) => ["unread", "read"].includes(row.status)), [messages]);

  async function load() {
    setLoading(true); setError(null);
    try {
      if (!session?.user?.id) throw new Error("Sign in as a platform administrator.");
      const [profiles, pendingComments, pendingObservations, openReports, companyMessages] = await Promise.all([
        supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`),
        supabaseFetch<CommentRow[]>("/rest/v1/public_entity_comments?select=id,user_id,author_name,entity_type,entity_key,body,status,moderation_reason,created_at&status=eq.pending&order=created_at.asc&limit=300"),
        supabaseFetch<Observation[]>("/rest/v1/medicine_community_observations?select=id,canonical_id,user_id,author_name,observation_type,title,description,severity,onset_timing,evidence_urls,status,created_at&status=in.(pending,needs_information)&order=created_at.asc&limit=300"),
        supabaseFetch<Report[]>("/rest/v1/public_entity_reports?select=id,reporter_user_id,entity_type,entity_key,reason,details,status,created_at&status=in.(open,reviewing)&order=created_at.asc&limit=300"),
        supabaseFetch<CompanyMessage[]>("/rest/v1/company_profile_messages?select=id,company_slug,organization_id,sender_name,subject,body,status,created_at&status=in.(unread,read)&order=created_at.asc&limit=300"),
      ]);
      const profile = profiles[0] || null;
      setMe(profile);
      if (!profile?.is_active || !["admin", "platform_admin", "super_admin"].includes(profile.role)) throw new Error("Active platform-administrator access is required.");
      setComments(pendingComments || []);
      setObservations(pendingObservations || []);
      setReports(openReports || []);
      setMessages(companyMessages || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load community moderation.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [session?.user?.id]);

  async function reviewComment(row: CommentRow, decision: "published" | "hidden" | "rejected") {
    setSaving(row.id); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_entity_comment", { method: "POST", body: JSON.stringify({ target_comment: row.id, decision, reviewer_notes: notes[row.id]?.trim() || null }) });
      setMessage(`Comment ${decision}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review comment."); }
    finally { setSaving(null); }
  }

  async function reviewObservation(row: Observation, decision: "approved" | "rejected" | "needs_information") {
    setSaving(row.id); setError(null); setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_medicine_community_observation", { method: "POST", body: JSON.stringify({ target_observation: row.id, decision, reviewer_notes: notes[row.id]?.trim() || null }) });
      setMessage(`Community observation ${decision.replaceAll("_", " ")}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review observation."); }
    finally { setSaving(null); }
  }

  async function updateReport(row: Report, status: "resolved" | "dismissed" | "reviewing") {
    if (!session?.user?.id) return;
    setSaving(row.id); setError(null); setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/public_entity_reports?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status, reviewed_by: session.user.id, reviewed_at: status === "reviewing" ? null : new Date().toISOString() }) });
      setMessage(`Report ${status}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update report."); }
    finally { setSaving(null); }
  }

  async function updateMessage(row: CompanyMessage, status: "read" | "replied" | "archived" | "closed") {
    setSaving(row.id); setError(null); setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/company_profile_messages?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status, updated_at: new Date().toISOString() }) });
      setMessage(`Company message marked ${status}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update company message."); }
    finally { setSaving(null); }
  }

  if (!session?.access_token) return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Sign in through the staff portal first.</AlertDescription></Alert></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary"><ShieldAlert className="h-4 w-4" />Community safety and accountability</p><h1 className="mt-3 text-4xl font-bold">Moderation dashboard</h1><p className="mt-3 max-w-3xl text-muted-foreground">Review medical-safety holds, possible benefits and adverse-effect experiences, community reports, and messages sent to company profiles. User experiences remain distinct from verified evidence and medical advice.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div></section>

    {error && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-5"><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

    {!loading && isAdmin && <>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Held comments" value={comments.length} /><Metric label="Experience reports" value={observations.length} /><Metric label="Open reports" value={reports.length} /><Metric label="Company messages" value={openMessages.length} /></section>

      <Queue title="Medicine experience reports" empty="No medicine experience reports need review.">
        {observations.map((row) => <Card key={row.id}><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{row.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{row.author_name} · <a href={`/catalog/${row.canonical_id}`} className="font-semibold text-primary">Medicine {row.canonical_id}</a></p></div><div className="flex gap-2"><Badge>{humanize(row.observation_type)}</Badge>{row.severity && <Badge variant="outline">{humanize(row.severity)}</Badge>}</div></div></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{row.description}</p>{row.onset_timing && <Info label="Onset timing" value={row.onset_timing} />}{row.evidence_urls.length > 0 && <div><div className="text-xs font-semibold uppercase text-muted-foreground">Submitted references</div>{row.evidence_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm font-semibold text-primary">{url}</a>)}</div>}<ReviewNotes id={row.id} notes={notes} setNotes={setNotes} /><div className="flex flex-wrap gap-2"><Button onClick={() => void reviewObservation(row, "approved")} disabled={saving === row.id}><Check className="mr-2 h-4 w-4" />Approve as community observation</Button><Button variant="outline" onClick={() => void reviewObservation(row, "needs_information")} disabled={saving === row.id}>Request information</Button><Button variant="destructive" onClick={() => void reviewObservation(row, "rejected")} disabled={saving === row.id}><X className="mr-2 h-4 w-4" />Reject</Button></div></CardContent></Card>)}
      </Queue>

      <Queue title="Medical-safety comment holds" empty="No comments are held for review.">
        {comments.map((row) => <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{row.author_name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(row.entity_type)} · {row.entity_key} · {new Date(row.created_at).toLocaleString()}</p></div><Badge variant="secondary">Held</Badge></div></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-6">{row.body}</p>{row.moderation_reason && <Info label="Automated reason" value={row.moderation_reason} />}<ReviewNotes id={row.id} notes={notes} setNotes={setNotes} /><div className="flex flex-wrap gap-2"><Button onClick={() => void reviewComment(row, "published")} disabled={saving === row.id}><Check className="mr-2 h-4 w-4" />Publish</Button><Button variant="outline" onClick={() => void reviewComment(row, "hidden")} disabled={saving === row.id}>Hide</Button><Button variant="destructive" onClick={() => void reviewComment(row, "rejected")} disabled={saving === row.id}><X className="mr-2 h-4 w-4" />Reject</Button></div></CardContent></Card>)}
      </Queue>

      <Queue title="Community reports" empty="No reports need review.">
        {reports.map((row) => <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{humanize(row.reason)}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(row.entity_type)} · {row.entity_key} · {new Date(row.created_at).toLocaleString()}</p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4">{row.details && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{row.details}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void updateReport(row, "reviewing")} disabled={saving === row.id}>Mark reviewing</Button><Button onClick={() => void updateReport(row, "resolved")} disabled={saving === row.id}>Resolve</Button><Button variant="ghost" onClick={() => void updateReport(row, "dismissed")} disabled={saving === row.id}>Dismiss</Button></div></CardContent></Card>)}
      </Queue>

      <Queue title="Messages to company profiles" empty="No company messages need attention.">
        {openMessages.map((row) => <Card key={row.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{row.subject}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{row.sender_name} → <a href={`/companies/${encodeURIComponent(row.company_slug)}`} className="font-semibold text-primary">{row.company_slug}</a></p></div><Badge variant="secondary">{humanize(row.status)}</Badge></div></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{row.body}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void updateMessage(row, "read")} disabled={saving === row.id}>Mark read</Button><Button onClick={() => void updateMessage(row, "replied")} disabled={saving === row.id}>Mark replied</Button><Button variant="ghost" onClick={() => void updateMessage(row, "archived")} disabled={saving === row.id}>Archive</Button><Button variant="ghost" onClick={() => void updateMessage(row, "closed")} disabled={saving === row.id}>Close</Button></div></CardContent></Card>)}
      </Queue>

      <Alert className="mt-8"><MessageCircleWarning className="h-4 w-4" /><AlertDescription>Approval means a community observation may be displayed with clear attribution and limitations. It does not establish causality, indication, benefit, safety, regulatory acceptance, or clinical suitability.</AlertDescription></Alert>
    </>}
  </main>;
}

function Queue({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) { const rows = Array.isArray(children) ? children : [children]; return <section className="mt-10"><h2 className="text-2xl font-semibold">{title}</h2><div className="mt-4 grid gap-4 xl:grid-cols-2">{rows.length > 0 ? children : <Card><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card>}</div></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>; }
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>; }
function ReviewNotes({ id, notes, setNotes }: { id: string; notes: Record<string, string>; setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>> }) { return <div><Label>Moderator notes</Label><Textarea className="mt-1" value={notes[id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} placeholder="Document evidence quality, safety limitations, and the decision rationale." /></div>; }
