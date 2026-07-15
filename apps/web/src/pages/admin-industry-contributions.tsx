import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  FileCheck2,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AdminCompanyDirectoryGovernance } from "@/components/admin-company-directory-governance";
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
  full_address: string | null;
  work_email: string;
  mobile_phone: string | null;
  whatsapp_same_as_mobile: boolean;
  whatsapp_phone: string | null;
  role_title: string | null;
  website: string | null;
  evidence_url: string | null;
  notes: string | null;
  status: string;
  requested_by: string;
  created_at: string;
  verification_score: number;
  verification_checks: Record<string, unknown> | null;
  automated_recommendation: string;
  risk_flags: string[] | null;
  last_verified_at: string | null;
  email_domain: string | null;
  website_domain: string | null;
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

type MedicineContribution = {
  id: string;
  canonical_id: number;
  contribution_type: string;
  title: string;
  summary: string;
  proposed_price_egp: number | null;
  evidence_urls: string[];
  organization_name: string | null;
  status: string;
  submitted_by: string;
  created_at: string;
};

type Medicine = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  manufacturer: string | null;
  current_price_egp: number | null;
};

type Profile = { id: string; role: string; is_active: boolean };

const ADMIN_ROLES = new Set(["admin", "platform_admin", "super_admin"]);
const arrayOf = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);
const strings = (value: unknown) =>
  arrayOf<unknown>(value)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
const humanize = (value: unknown) =>
  String(value || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
const scoreClass = (score: number) =>
  score >= 75
    ? "bg-emerald-100 text-emerald-800"
    : score >= 45
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";

export default function AdminIndustryContributions() {
  const { session, supabaseFetch } = usePatientAuth();
  const [me, setMe] = useState<Profile | null>(null);
  const [claims, setClaims] = useState<ProfileClaim[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [medicineContributions, setMedicineContributions] = useState<MedicineContribution[]>([]);
  const [medicines, setMedicines] = useState<Record<number, Medicine>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isAdmin = Boolean(me?.is_active && ADMIN_ROLES.has(me.role));

  const pendingClaims = useMemo(
    () => claims.filter((row) => ["pending", "under_review"].includes(row.status)),
    [claims],
  );
  const pendingContributions = useMemo(
    () => contributions.filter((row) => ["submitted", "under_review"].includes(row.status)),
    [contributions],
  );
  const pendingMedicineContributions = useMemo(
    () => medicineContributions.filter((row) => ["submitted", "under_review"].includes(row.status)),
    [medicineContributions],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        setMe(null);
        return;
      }
      const own = await supabaseFetch<Profile[]>(
        `/rest/v1/profiles?select=id,role,is_active&id=eq.${encodeURIComponent(userId)}&limit=1`,
      );
      const profile = arrayOf<Profile>(own)[0] || null;
      setMe(profile);
      if (!profile?.is_active || !ADMIN_ROLES.has(profile.role)) {
        setClaims([]);
        setContributions([]);
        setMedicineContributions([]);
        return;
      }
      const claimSelect =
        "id,company_slug,proposed_company_name,company_type,country,city,full_address,work_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,role_title,website,evidence_url,notes,status,requested_by,created_at,verification_score,verification_checks,automated_recommendation,risk_flags,last_verified_at,email_domain,website_domain";
      const [nextClaims, nextContributions, nextMedicineContributions] = await Promise.all([
        supabaseFetch<ProfileClaim[]>(
          `/rest/v1/industry_company_profile_claims?select=${claimSelect}&order=created_at.asc&limit=300`,
        ),
        supabaseFetch<Contribution[]>(
          "/rest/v1/industry_company_contributions?select=id,company_slug,contribution_type,title,summary,payload,evidence_urls,status,submitted_by,submitted_at&order=submitted_at.asc&limit=400",
        ),
        supabaseFetch<MedicineContribution[]>(
          "/rest/v1/medicine_collaboration_submissions?select=id,canonical_id,contribution_type,title,summary,proposed_price_egp,evidence_urls,organization_name,status,submitted_by,created_at&order=created_at.asc&limit=400",
        ),
      ]);
      const safeClaims = arrayOf<ProfileClaim>(nextClaims);
      const safeContributions = arrayOf<Contribution>(nextContributions);
      const safeMedicine = arrayOf<MedicineContribution>(nextMedicineContributions);
      setClaims(safeClaims);
      setContributions(safeContributions);
      setMedicineContributions(safeMedicine);
      const ids = [...new Set(safeMedicine.map((row) => Number(row.canonical_id)).filter(Number.isFinite))];
      if (ids.length) {
        const rows = await supabaseFetch<Medicine[]>(
          `/rest/v1/medicine_canonical_products_v1?select=canonical_id,name_en,name_ar,manufacturer,current_price_egp&canonical_id=in.(${ids.join(",")})`,
        );
        setMedicines(Object.fromEntries(arrayOf<Medicine>(rows).map((row) => [row.canonical_id, row])));
      } else {
        setMedicines({});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load moderation queues.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.user?.id]);

  async function reviewClaim(claim: ProfileClaim, decision: "approved" | "rejected") {
    const note = notes[claim.id]?.trim() || null;
    if (
      decision === "approved" &&
      ["high_risk", "blocked_existing_profile"].includes(claim.automated_recommendation) &&
      !note
    ) {
      setError("Document the verification override before approving this high-risk claim.");
      return;
    }
    await reviewRpc(
      claim.id,
      "/rest/v1/rpc/review_industry_company_claim",
      { target_claim: claim.id, decision, reviewer_notes: note },
      `${claim.proposed_company_name} claim ${decision}.`,
    );
  }

  async function recheckClaim(claim: ProfileClaim) {
    await reviewRpc(
      claim.id,
      "/rest/v1/rpc/recheck_industry_company_claim",
      { target_claim: claim.id },
      `${claim.proposed_company_name} automated checks refreshed.`,
    );
  }

  async function reviewContribution(row: Contribution, decision: "approved" | "rejected") {
    await reviewRpc(
      row.id,
      "/rest/v1/rpc/review_industry_company_contribution",
      { target_contribution: row.id, decision, reviewer_notes: notes[row.id]?.trim() || null },
      `${row.title} ${decision}.`,
    );
  }

  async function reviewMedicineContribution(
    row: MedicineContribution,
    decision: "approved" | "rejected",
  ) {
    await reviewRpc(
      row.id,
      "/rest/v1/rpc/review_medicine_collaboration_submission",
      { target_submission: row.id, decision, reviewer_notes: notes[row.id]?.trim() || null },
      `${row.title} ${decision}.`,
    );
  }

  async function reviewRpc(
    id: string,
    path: string,
    body: Record<string, unknown>,
    success: string,
  ) {
    setSaving(id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the review.");
    } finally {
      setSaving(null);
    }
  }

  if (!session?.access_token) {
    return (
      <main className="container mx-auto max-w-xl px-4 py-10">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>Sign in through the staff portal before opening moderation.</AlertDescription>
        </Alert>
        <a
          href="/portal"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open staff portal
        </a>
      </main>
    );
  }

  if (!loading && !isAdmin) {
    return (
      <main className="container mx-auto max-w-xl px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your active account is not authorized to review company or medicine contributions.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Platform trust and moderation
            </p>
            <h1 className="mt-3 text-3xl font-bold">Companies, directory integrity, and knowledge review</h1>
            <p className="mt-3 max-w-4xl text-muted-foreground">
              Review company ownership, repair duplicate identities without deleting source evidence, edit governed company data, and moderate medicine contributions.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </section>

      {loading && <p className="mt-5 text-sm text-muted-foreground">Loading moderation queues…</p>}
      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mt-5">
          <Check className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {!loading && isAdmin && (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="Pending company claims" value={pendingClaims.length} />
            <Metric
              label="Ready for admin review"
              value={pendingClaims.filter((row) => row.automated_recommendation === "ready_for_admin_review").length}
            />
            <Metric
              label="High-risk claims"
              value={pendingClaims.filter((row) => ["high_risk", "blocked_existing_profile"].includes(row.automated_recommendation)).length}
            />
            <Metric label="Pending company knowledge" value={pendingContributions.length} />
            <Metric label="Pending medicine knowledge" value={pendingMedicineContributions.length} />
            <Metric label="All claims" value={claims.length} />
          </section>

          <AdminCompanyDirectoryGovernance />

          <QueueSection icon={Building2} title="Company profile claims" empty="No company claims need review.">
            {pendingClaims.map((claim) => (
              <Card
                key={claim.id}
                className={
                  claim.verification_score >= 75
                    ? "border-emerald-300"
                    : claim.verification_score < 45
                      ? "border-red-300"
                      : ""
                }
              >
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{claim.proposed_company_name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {humanize(claim.company_type)} · {claim.company_slug ? `Claims ${claim.company_slug}` : "New company"}
                      </p>
                    </div>
                    <Badge variant="secondary">{humanize(claim.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreClass(Number(claim.verification_score || 0))}`}>
                      Automated score {Number(claim.verification_score || 0)}/100
                    </span>
                    <Badge variant="outline"><Sparkles className="mr-1 h-3 w-3" />{humanize(claim.automated_recommendation)}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Info label="Work email" value={claim.work_email} />
                    <Info label="Email domain" value={claim.email_domain} />
                    <Info label="Website domain" value={claim.website_domain} />
                    <Info label="Representative role" value={claim.role_title} />
                    <Info label="Location" value={[claim.city, claim.country].filter(Boolean).join(", ")} icon={MapPin} />
                    <Info label="Mobile" value={claim.mobile_phone} icon={Phone} />
                    <Info
                      label="WhatsApp"
                      value={claim.whatsapp_same_as_mobile ? claim.mobile_phone : claim.whatsapp_phone}
                      icon={Phone}
                    />
                    <Info label="Full address" value={claim.full_address} />
                    <Info
                      label="Checks refreshed"
                      value={claim.last_verified_at ? new Date(claim.last_verified_at).toLocaleString() : null}
                    />
                  </div>
                  {strings(claim.risk_flags).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk flags</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {strings(claim.risk_flags).map((flag) => <Badge key={flag} variant="destructive">{humanize(flag)}</Badge>)}
                      </div>
                    </div>
                  )}
                  <VerificationChecks checks={claim.verification_checks} />
                  {claim.website && <a href={claim.website} target="_blank" rel="noreferrer" className="block font-semibold text-primary">Company website</a>}
                  {claim.evidence_url && <a href={claim.evidence_url} target="_blank" rel="noreferrer" className="block font-semibold text-primary">Identity evidence</a>}
                  {claim.notes && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{claim.notes}</p>}
                  <ReviewControls
                    id={claim.id}
                    notes={notes}
                    setNotes={setNotes}
                    saving={saving}
                    approve={() => void reviewClaim(claim, "approved")}
                    reject={() => void reviewClaim(claim, "rejected")}
                    recheck={() => void recheckClaim(claim)}
                    requireApprovalNote={["high_risk", "blocked_existing_profile"].includes(claim.automated_recommendation)}
                  />
                </CardContent>
              </Card>
            ))}
          </QueueSection>

          <QueueSection icon={Pill} title="Medicine knowledge contributions" empty="No medicine contributions need review.">
            {pendingMedicineContributions.map((row) => {
              const medicine = medicines[row.canonical_id];
              return (
                <Card key={row.id}>
                  <CardHeader><CardTitle>{row.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p>{row.summary}</p>
                    <Info label="Medicine" value={medicine?.name_en || medicine?.name_ar || `Product ${row.canonical_id}`} />
                    <Evidence urls={row.evidence_urls} />
                    <BasicReview id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={() => void reviewMedicineContribution(row, "approved")} reject={() => void reviewMedicineContribution(row, "rejected")} />
                  </CardContent>
                </Card>
              );
            })}
          </QueueSection>

          <QueueSection icon={FileCheck2} title="Company knowledge contributions" empty="No company contributions need review.">
            {pendingContributions.map((row) => (
              <Card key={row.id}>
                <CardHeader><CardTitle>{row.title}</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>{row.summary}</p>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs">{JSON.stringify(row.payload, null, 2)}</pre>
                  <Evidence urls={row.evidence_urls} />
                  <BasicReview id={row.id} notes={notes} setNotes={setNotes} saving={saving} approve={() => void reviewContribution(row, "approved")} reject={() => void reviewContribution(row, "rejected")} />
                </CardContent>
              </Card>
            ))}
          </QueueSection>

          <Alert className="mt-8">
            <AlertDescription>
              Approval attributes and publishes a profile or contribution. It does not establish regulatory approval, clinical suitability, inventory, pricing validity, or product-batch quality.
            </AlertDescription>
          </Alert>
        </>
      )}
    </main>
  );
}

function VerificationChecks({ checks }: { checks: Record<string, unknown> | null }) {
  const rows = Object.entries(checks || {});
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automated checks</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span>{humanize(key)}</span>
            <Badge variant={value === true ? "default" : value === false ? "destructive" : "outline"}>
              {typeof value === "boolean" ? (value ? "Pass" : "Review") : String(value ?? "—")}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueSection({
  icon: Icon,
  title,
  empty,
  children,
}: {
  icon: typeof Pill;
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mt-10">
      <div className="flex items-center gap-2"><Icon className="h-5 w-5" /><h2 className="text-2xl font-semibold">{title}</h2></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">{has ? children : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></CardContent></Card>;
}

function Info({ label, value, icon: Icon }: { label: string; value: unknown; icon?: typeof MapPin }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
      <div className="mt-1 break-words">{value ? String(value) : "—"}</div>
    </div>
  );
}

function Evidence({ urls }: { urls: string[] }) {
  return urls?.length ? <div className="space-y-1">{urls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all font-semibold text-primary">{url}</a>)}</div> : null;
}

function ReviewControls({
  id,
  notes,
  setNotes,
  saving,
  approve,
  reject,
  recheck,
  requireApprovalNote,
}: {
  id: string;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: string | null;
  approve: () => void;
  reject: () => void;
  recheck: () => void;
  requireApprovalNote: boolean;
}) {
  return (
    <div className="space-y-3">
      <div><Label>Reviewer notes{requireApprovalNote ? " (required for approval)" : ""}</Label><Textarea className="mt-1" value={notes[id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} /></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={saving === id} onClick={approve}><Check className="mr-2 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" disabled={saving === id} onClick={reject}><X className="mr-2 h-4 w-4" />Reject</Button><Button size="sm" variant="outline" disabled={saving === id} onClick={recheck}><RefreshCw className="mr-2 h-4 w-4" />Recheck</Button></div>
    </div>
  );
}

function BasicReview({
  id,
  notes,
  setNotes,
  saving,
  approve,
  reject,
}: {
  id: string;
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: string | null;
  approve: () => void;
  reject: () => void;
}) {
  return (
    <div className="space-y-3"><div><Label>Reviewer notes</Label><Textarea className="mt-1" value={notes[id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))} /></div><div className="flex gap-2"><Button size="sm" disabled={saving === id} onClick={approve}><Check className="mr-2 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" disabled={saving === id} onClick={reject}><X className="mr-2 h-4 w-4" />Reject</Button></div></div>
  );
}
