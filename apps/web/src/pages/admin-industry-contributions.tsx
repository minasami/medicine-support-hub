import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Check, FileCheck2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type ProfileClaim = {
  id: string;
  company_slug: string | null;
  proposed_company_name: string;
  company_type: string;
  country: string | null;
  city: string | null;
  work_email: string;
  role_title: string | null;
  website: string | null;
  evidence_url: string | null;
  notes: string | null;
  status: string;
  requested_by: string;
  created_at: string;
};

type Contribution = {
  id: string;
  company_slug: string;
  contribution_type: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  evidence_urls: string[];
  status: string;
  submitted_by: string;
  submitted_at: string;
};

type Profile = { id: string; role: string; is_active: boolean };

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function AdminIndustryContributions() {
  const { session, supabaseFetch } = usePatientAuth();
  const [me, setMe] = useState<Profile | null>(null);
  const [claims, setClaims] = useState<ProfileClaim[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = me?.is_active && ["admin", "platform_admin", "super_admin"].includes(me.role);
  const pendingClaims = useMemo(() => claims.filter((row) => ["pending", "under_review"].includes(row.status)), [claims]);
  const pendingContributions = useMemo(() => contributions.filter((row) => ["submitted", "under_review"].includes(row.status)), [contributions]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!session?.user?.id) throw new Error("Sign in through the staff portal before opening moderation.");
      const own = await supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`);
      const profile = own[0] || null;
      setMe(profile);
      if (!profile?.is_active || !["admin", "platform_admin", "super_admin"].includes(profile.role)) {
        throw new Error("Your account is not authorized to review industry contributions.");
      }
      const [nextClaims, nextContributions] = await Promise.all([
        supabaseFetch<ProfileClaim[]>("/rest/v1/industry_company_profile_claims?select=id,company_slug,proposed_company_name,company_type,country,city,work_email,role_title,website,evidence_url,notes,status,requested_by,created_at&order=created_at.asc&limit=200"),
        supabaseFetch<Contribution[]>("/rest/v1/industry_company_contributions?select=id,company_slug,contribution_type,title,summary,payload,evidence_urls,status,submitted_by,submitted_at&order=submitted_at.asc&limit=300"),
      ]);
      setClaims(nextClaims);
      setContributions(nextContributions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load moderation queues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session?.user?.id]);

  async function reviewClaim(claim: ProfileClaim, decision: "approved" | "rejected") {
    setSaving(claim.id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_industry_company_claim", {
        method: "POST",
        body: JSON.stringify({
          target_claim: claim.id,
          decision,
          reviewer_notes: notes[claim.id]?.trim() || null,
        }),
      });
      setMessage(`${claim.proposed_company_name} claim ${decision}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review the company claim.");
    } finally {
      setSaving(null);
    }
  }

  async function reviewContribution(contribution: Contribution, decision: "approved" | "rejected") {
    setSaving(contribution.id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_industry_company_contribution", {
        method: "POST",
        body: JSON.stringify({
          target_contribution: contribution.id,
          decision,
          reviewer_notes: notes[contribution.id]?.trim() || null,
        }),
      });
      setMessage(`${contribution.title} ${decision}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review the contribution.");
    } finally {
      setSaving(null);
    }
  }

  if (!session?.access_token) return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Sign in through the staff portal before opening this page.</AlertDescription></Alert><a href="/portal" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Open staff portal</a></main>;

  return <main className="container mx-auto max-w-7xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-4 w-4" />Industry trust and moderation</p><h1 className="mt-3 text-3xl font-bold">Company claims and knowledge contributions</h1><p className="mt-3 max-w-3xl text-muted-foreground">Verify company identity, create controlled organization ownership, and approve only attributable, evidence-backed contributions for public display.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    </section>

    {loading && <p className="mt-5 text-sm text-muted-foreground">Loading moderation queues...</p>}
    {error && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mt-5"><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

    {!loading && isAdmin && <>
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <Metric label="Pending company claims" value={pendingClaims.length} />
        <Metric label="Pending contributions" value={pendingContributions.length} />
        <Metric label="All claims" value={claims.length} />
        <Metric label="All contributions" value={contributions.length} />
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2"><Building2 className="h-5 w-5" /><h2 className="text-2xl font-semibold">Company profile claims</h2></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">{pendingClaims.map((claim) => <Card key={claim.id}>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{claim.proposed_company_name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(claim.company_type)} · {claim.company_slug ? `Claims ${claim.company_slug}` : "New company"}</p></div><Badge variant="secondary">{humanize(claim.status)}</Badge></div></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2"><Info label="Work email" value={claim.work_email} /><Info label="Representative role" value={claim.role_title} /><Info label="Location" value={[claim.city, claim.country].filter(Boolean).join(", ")} /><Info label="Requested" value={new Date(claim.created_at).toLocaleString()} /></div>
            {claim.website && <a href={claim.website} target="_blank" rel="noreferrer" className="block font-semibold text-primary">Company website</a>}
            {claim.evidence_url && <a href={claim.evidence_url} target="_blank" rel="noreferrer" className="block font-semibold text-primary">Identity evidence</a>}
            {claim.notes && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{claim.notes}</p>}
            <div><Label>Review notes</Label><Textarea className="mt-1" value={notes[claim.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [claim.id]: event.target.value }))} placeholder="Record verification basis or rejection reason." /></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void reviewClaim(claim, "approved")} disabled={saving === claim.id}><Check className="mr-2 h-4 w-4" />Approve and create profile</Button><Button variant="destructive" onClick={() => void reviewClaim(claim, "rejected")} disabled={saving === claim.id}><X className="mr-2 h-4 w-4" />Reject</Button></div>
          </CardContent>
        </Card>)}{pendingClaims.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No company claims need review.</CardContent></Card>}</div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5" /><h2 className="text-2xl font-semibold">Company knowledge contributions</h2></div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">{pendingContributions.map((contribution) => <Card key={contribution.id}>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{contribution.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{contribution.company_slug} · {humanize(contribution.contribution_type)}</p></div><Badge variant="secondary">{humanize(contribution.status)}</Badge></div></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="leading-6 text-muted-foreground">{contribution.summary}</p>
            <div className="rounded-lg border bg-muted/30 p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Structured payload</div><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(contribution.payload, null, 2)}</pre></div>
            {contribution.evidence_urls.length > 0 && <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</div><div className="mt-2 flex flex-col gap-1">{contribution.evidence_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-primary">{url}</a>)}</div></div>}
            <div><Label>Review notes</Label><Textarea className="mt-1" value={notes[contribution.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [contribution.id]: event.target.value }))} placeholder="Document evidence quality, limitations, and publication decision." /></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void reviewContribution(contribution, "approved")} disabled={saving === contribution.id}><Check className="mr-2 h-4 w-4" />Approve and publish</Button><Button variant="destructive" onClick={() => void reviewContribution(contribution, "rejected")} disabled={saving === contribution.id}><X className="mr-2 h-4 w-4" />Reject</Button></div>
          </CardContent>
        </Card>)}{pendingContributions.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No company contributions need review.</CardContent></Card>}</div>
      </section>

      <Alert className="mt-8"><AlertDescription>Approval publishes an attributed company contribution. It does not convert the contribution into regulatory approval, independent clinical evidence, Egyptian registration data, or a replacement for the verified source dataset.</AlertDescription></Alert>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium break-words">{value || "—"}</div></div>;
}
