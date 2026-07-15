import { useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Building2,
  Check,
  ExternalLink,
  Eye,
  FileCheck2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Session = { access_token: string };
type StatusTab = "pending" | "approved" | "rejected" | "all";
type EnrollmentRequest = {
  id: string;
  application_type: string;
  target_profile_id: string | null;
  entity_type: string;
  requested_name: string;
  work_email: string;
  contact_phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  website_url: string | null;
  license_authority: string | null;
  license_number: string;
  license_expiry: string | null;
  specialties: string[];
  services: string[];
  evidence_urls: string[];
  notes: string | null;
  status: string;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  result_profile_id: string | null;
  result_organization_id: string | null;
  created_at: string;
  updated_at: string;
};

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!response.ok) throw new Error(data?.message || data?.error || "Care-network request failed.");
  return data as T;
}

const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const isOpen = (status: string) => status === "pending" || status === "under_review";

function initialQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("careStatus");
  return {
    tab: (["pending", "approved", "rejected", "all"].includes(String(requestedTab)) ? requestedTab : "pending") as StatusTab,
    requestId: params.get("request"),
    decision: params.get("decision"),
  };
}

export function AdminCareNetworkEnrollments({ session }: { session: Session }) {
  const initial = initialQuery();
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [tab, setTab] = useState<StatusTab>(initial.tab);
  const [selectedId, setSelectedId] = useState<string | null>(initial.requestId);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const handledPushIntent = useRef(false);

  const counts = useMemo(
    () => ({
      pending: requests.filter((row) => isOpen(row.status)).length,
      approved: requests.filter((row) => row.status === "approved").length,
      rejected: requests.filter((row) => row.status === "rejected").length,
      all: requests.length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    if (tab === "pending") return requests.filter((row) => isOpen(row.status));
    if (tab === "all") return requests;
    return requests.filter((row) => row.status === tab);
  }, [requests, tab]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const rows = await api<EnrollmentRequest[]>(
        "/rest/v1/healthcare_entity_applications?select=*&order=created_at.desc&limit=500",
        session,
      );
      setRequests(rows);
      if (!selectedId && rows.some((row) => isOpen(row.status))) {
        setSelectedId(rows.find((row) => isOpen(row.status))?.id ?? null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load care-network enrollment requests.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 45_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session.access_token]);

  function updateQuery(next: { tab?: StatusTab; requestId?: string | null; decision?: string | null }) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "care-network");
    if (next.tab) params.set("careStatus", next.tab);
    if (next.requestId === null) params.delete("request");
    else if (next.requestId) params.set("request", next.requestId);
    if (next.decision === null) params.delete("decision");
    else if (next.decision) params.set("decision", next.decision);
    const query = params.toString();
    window.history.replaceState(null, document.title, `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function chooseTab(next: StatusTab) {
    setTab(next);
    updateQuery({ tab: next });
  }

  function openRequest(id: string) {
    setSelectedId(id);
    updateQuery({ requestId: id });
    window.setTimeout(() => document.getElementById(`care-request-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  }

  async function review(row: EnrollmentRequest, decision: "approved" | "rejected", suppliedNotes?: string | null) {
    if (!isOpen(row.status)) {
      setError("This request has already been reviewed.");
      return;
    }
    setBusy(row.id);
    setError(null);
    setMessage(null);
    try {
      await api("/rest/v1/rpc/review_healthcare_entity_application", session, {
        method: "POST",
        body: JSON.stringify({
          target_application: row.id,
          decision,
          reviewer_notes: suppliedNotes ?? notes[row.id]?.trim() ?? null,
        }),
      });
      await api(
        `/rest/v1/user_notifications?entity_type=eq.healthcare_entity_application&entity_key=eq.${encodeURIComponent(row.id)}`,
        session,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ read_at: new Date().toISOString() }) },
      ).catch(() => undefined);
      setMessage(`${row.requested_name} ${decision === "approved" ? "approved and enrolled" : "refused"}.`);
      setNotes((current) => ({ ...current, [row.id]: "" }));
      updateQuery({ decision: null });
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review the enrollment request.");
    } finally {
      setBusy(null);
    }
  }

  function requestApproval(row: EnrollmentRequest) {
    if (!window.confirm(`Approve ${row.requested_name} and enroll it in the care network?`)) return;
    void review(row, "approved");
  }

  function requestRefusal(row: EnrollmentRequest) {
    const reason = window.prompt("Reason for refusing this care-network enrollment request:", notes[row.id] || "");
    if (reason === null) return;
    setNotes((current) => ({ ...current, [row.id]: reason }));
    void review(row, "rejected", reason.trim() || null);
  }

  useEffect(() => {
    if (handledPushIntent.current || loading || !initial.requestId || !initial.decision) return;
    const row = requests.find((request) => request.id === initial.requestId);
    if (!row) return;
    handledPushIntent.current = true;
    setSelectedId(row.id);
    setTab("pending");
    if (!isOpen(row.status)) {
      setMessage(`${row.requested_name} was already ${row.status}.`);
      updateQuery({ decision: null });
      return;
    }
    if (initial.decision === "approved") requestApproval(row);
    if (initial.decision === "rejected") requestRefusal(row);
  }, [loading, requests]);

  return (
    <Card className="mb-8 overflow-hidden border-cyan-200" id="care-network-enrollments">
      <CardHeader className="border-b bg-gradient-to-r from-cyan-50 via-background to-background dark:from-cyan-950/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge className="w-fit bg-cyan-100 text-cyan-900 hover:bg-cyan-100">
              <BellRing className="mr-1 h-3.5 w-3.5" /> Operational approval queue
            </Badge>
            <CardTitle className="mt-3 flex items-center gap-2 text-2xl">
              <Building2 className="h-6 w-6 text-cyan-700" /> Care network enrollment requests
            </CardTitle>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              Review provider identity, licensing, services, location and evidence before enrolling or refusing a clinic, pharmacy, laboratory, radiology center or other care-network entity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button asChild variant="outline"><Link href="/admin/healthcare-network">Full network administration</Link></Button>
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(["pending", "approved", "rejected", "all"] as StatusTab[]).map((value) => (
            <Button key={value} size="sm" variant={tab === value ? "default" : "outline"} className="shrink-0" onClick={() => chooseTab(value)}>
              {value === "rejected" ? "Refused" : humanize(value)}
              <Badge variant="secondary" className="ml-2">{counts[value]}</Badge>
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert className="mb-4"><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
        {loading ? (
          <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading enrollment requests…</div>
        ) : visible.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((row) => {
              const selected = selectedId === row.id;
              return (
                <article key={row.id} id={`care-request-${row.id}`} className={`rounded-2xl border p-4 transition ${selected ? "border-cyan-500 bg-cyan-50/40 shadow-sm dark:bg-cyan-950/10" : "bg-card"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold">{row.requested_name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{humanize(row.application_type)} · {humanize(row.entity_type)}</p>
                    </div>
                    <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>{row.status === "rejected" ? "refused" : humanize(row.status)}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <Summary icon={MapPin} text={[row.city, row.country].filter(Boolean).join(", ") || "Location not provided"} />
                    <Summary icon={FileCheck2} text={`${row.license_authority || "License"}: ${row.license_number}`} />
                    <Summary icon={Mail} text={row.work_email} />
                    <Summary icon={Phone} text={row.contact_phone || "Phone not provided"} />
                  </div>
                  {!selected ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">Submitted {new Date(row.created_at).toLocaleString()}</span>
                      <Button size="sm" variant="outline" onClick={() => openRequest(row.id)}><Eye className="mr-2 h-4 w-4" />View details</Button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4 border-t pt-4">
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <Detail label="Address" value={row.address} />
                        <Detail label="Website" value={row.website_url} link />
                        <Detail label="License expiry" value={row.license_expiry} />
                        <Detail label="Submitted" value={new Date(row.created_at).toLocaleString()} />
                        <Detail label="Specialties" value={row.specialties.join(", ")} />
                        <Detail label="Services" value={row.services.join(", ")} />
                        <Detail label="Applicant notes" value={row.notes} wide />
                        {row.reviewed_at && <Detail label="Reviewed" value={new Date(row.reviewed_at).toLocaleString()} />}
                        {row.review_notes && <Detail label="Review notes" value={row.review_notes} wide />}
                      </div>
                      {row.evidence_urls.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</div>
                          <div className="mt-2 space-y-2">
                            {row.evidence_urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all rounded-lg border p-2 text-sm font-semibold text-primary"><ExternalLink className="h-4 w-4 shrink-0" />{url}</a>)}
                          </div>
                        </div>
                      )}
                      {isOpen(row.status) && (
                        <div>
                          <Label>Review notes</Label>
                          <Textarea className="mt-1" value={notes[row.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} placeholder="Identity, license, evidence, restrictions, or refusal reason" />
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button onClick={() => requestApproval(row)} disabled={busy === row.id}><Check className="mr-2 h-4 w-4" />Approve enrollment</Button>
                            <Button variant="destructive" onClick={() => requestRefusal(row)} disabled={busy === row.id}><X className="mr-2 h-4 w-4" />Refuse request</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No {tab === "rejected" ? "refused" : tab} care-network enrollment requests.</div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 p-2"><Icon className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{text}</span></div>;
}

function Detail({ label, value, wide = false, link = false }: { label: string; value: string | null; wide?: boolean; link?: boolean }) {
  const text = value || "Not provided";
  return <div className={wide ? "sm:col-span-2" : ""}><div className="text-xs text-muted-foreground">{label}</div>{link && value ? <a href={value} target="_blank" rel="noreferrer" className="break-all font-semibold text-primary">{text}</a> : <div className="break-words font-medium">{text}</div>}</div>;
}
