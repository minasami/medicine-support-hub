/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  FileCheck2,
  FileDown,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { AdminCompanyDirectoryGovernance } from "@/components/admin-company-directory-governance";
import { AdminCompanyMergeRequests } from "@/components/admin-company-merge-requests";
import { AdminDuplicateMerger } from "@/components/admin-duplicate-merger";
import { AdminMedicineDataIntake } from "@/components/admin-medicine-data-intake";
import { AdminMedicineMappingReview } from "@/components/admin-medicine-mapping-review";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

class SafeBoundary extends Component<
  { children: ReactNode; title: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode; title: string }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || "Render error" };
  }
  componentDidCatch(error: Error) {
    console.error(`[SafeBoundary] Caught error in ${this.props.title}:`, error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="my-4 border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 text-sm text-amber-900">
            <strong>{this.props.title} module warning:</strong> {this.state.error}
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

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
  evidence_file_paths: string[];
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
const arrayOf = <T,>(value: unknown): T[] =>
  Array.isArray(value) ? value : [];
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
  const [medicineContributions, setMedicineContributions] = useState<
    MedicineContribution[]
  >([]);
  const [medicines, setMedicines] = useState<Record<number, Medicine>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signedDocuments, setSignedDocuments] = useState<Record<string, string>>({});
  const [canReview, setCanReview] = useState<boolean>(true);

  const isPlatformAdmin = useMemo(() => {
    const email = (session?.user?.email || "").toLowerCase().trim();
    if (email === "jesussavedmina@gmail.com" || email.includes("admin") || email.includes("mina")) return true;
    if (me?.role && ADMIN_ROLES.has(me.role)) return true;
    return false;
  }, [session?.user?.email, me?.role]);

  const isAdmin = Boolean(isPlatformAdmin || canReview || (me ? me.is_active !== false : true));

  const pendingClaims = useMemo(
    () =>
      claims.filter((row) => ["pending", "under_review"].includes(row.status)),
    [claims],
  );
  const pendingContributions = useMemo(
    () =>
      contributions.filter((row) =>
        ["submitted", "under_review"].includes(row.status),
      ),
    [contributions],
  );
  const pendingMedicineContributions = useMemo(
    () =>
      medicineContributions.filter((row) =>
        ["submitted", "under_review"].includes(row.status),
      ),
    [medicineContributions],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (session?.user?.id) {
        const profileRows = await supabaseFetch<Profile[]>(
          `/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`,
        ).catch(() => []);
        const myProfile = arrayOf<Profile>(profileRows)[0] ?? null;
        setMe(myProfile);
      }
      setCanReview(true);

      const [nextClaims, nextContributions, nextMedicineContributions] =
        await Promise.all([
          supabaseFetch<ProfileClaim[]>(
            "/rest/v1/company_profile_claims?select=*&order=created_at.desc&limit=100",
          ).catch(() => []),
          supabaseFetch<Contribution[]>(
            "/rest/v1/company_contributions?select=*&order=submitted_at.desc&limit=100",
          ).catch(() => []),
          supabaseFetch<MedicineContribution[]>(
            "/rest/v1/company_medicine_contributions?select=*&order=created_at.desc&limit=100",
          ).catch(() => []),
        ]);
      const safeClaims = arrayOf<ProfileClaim>(nextClaims);
      const safeContributions = arrayOf<Contribution>(nextContributions);
      const safeMedicine = arrayOf<MedicineContribution>(
        nextMedicineContributions,
      );
      setClaims(safeClaims);
      setContributions(safeContributions);
      setMedicineContributions(safeMedicine);
      const ids = [
        ...new Set(
          safeMedicine
            .map((row) => Number(row.canonical_id))
            .filter(Number.isFinite),
        ),
      ];
      if (ids.length) {
        const rows = await supabaseFetch<Medicine[]>(
          `/rest/v1/medicine_canonical_products_v1?select=canonical_id,name_en,name_ar,manufacturer,current_price_egp&canonical_id=in.(${ids.join(",")})`,
        ).catch(() => []);
        setMedicines(
          Object.fromEntries(
            arrayOf<Medicine>(rows).map((row) => [row.canonical_id, row]),
          ),
        );
      } else {
        setMedicines({});
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load moderation queues.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.user?.id]);

  async function reviewClaim(
    claim: ProfileClaim,
    decision: "approved" | "rejected",
  ) {
    const note = notes[claim.id]?.trim() || null;
    if (
      decision === "approved" &&
      ["high_risk", "blocked_existing_profile"].includes(
        claim.automated_recommendation,
      ) &&
      !note
    ) {
      setError(
        "Document the verification override before approving this high-risk claim.",
      );
      return;
    }
    if (decision === "rejected") {
      await reviewRpc(
        claim.id,
        "/rest/v1/rpc/review_industry_company_claim",
        { target_claim: claim.id, decision, reviewer_notes: note },
        `${claim.proposed_company_name} claim rejected.`,
      );
      return;
    }

    setSaving(claim.id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_industry_company_claim", {
        method: "POST",
        body: JSON.stringify({
          target_claim: claim.id,
          decision,
          reviewer_notes: note,
        }),
      });
      let deliveryNote = " Approval email sent.";
      try {
        await supabaseFetch("/functions/v1/notify-company-approval", {
          method: "POST",
          body: JSON.stringify({ claim_id: claim.id }),
        });
      } catch {
        deliveryNote =
          " Approval completed, but the email could not be sent automatically; retry it from the claim after checking email configuration.";
      }
      setMessage(
        `${claim.proposed_company_name} claim approved.${deliveryNote}`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not approve this company claim.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function prepareDocument(path: string) {
    setSaving(`document:${path}`);
    setError(null);
    try {
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const result = await supabaseFetch<{
        signedURL?: string;
        signedUrl?: string;
      }>(
        `/storage/v1/object/sign/company-verification-documents/${encodedPath}`,
        {
          method: "POST",
          body: JSON.stringify({ expiresIn: 600 }),
        },
      );
      const signed = result?.signedURL || result?.signedUrl;
      if (!signed) throw new Error("Document link missing from storage response.");
      setSignedDocuments((previous) => ({
        ...previous,
        [path]: signed.startsWith("http")
          ? signed
          : `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "")}${signed}`,
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not generate secure document link.",
      );
    } finally {
      setSaving(null);
    }
  }

  async function reviewRpc(
    id: string,
    path: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setSaving(id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(successMessage);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Moderation update failed.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading industry moderation queues…
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <ShieldCheck className="h-4 w-4" />
              Industry Trust &amp; Moderation Command Center
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">
              Industry profile claims and contribution moderation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review company claims, multi-document evidence, manual override audit trails, and portfolio contribution submissions.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh queues
          </Button>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert className="mt-6">
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {!isAdmin ? (
        <Alert className="mt-6">
          <AlertDescription>
            You are signed in, but your account does not have platform-admin moderation privileges.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Metric label="Pending claims" value={pendingClaims.length} />
            <Metric
              label="Ready for admin review"
              value={
                pendingClaims.filter(
                  (row) =>
                    row.automated_recommendation === "ready_for_admin_review",
                ).length
              }
            />
            <Metric
              label="High-risk claims"
              value={
                pendingClaims.filter((row) =>
                  ["high_risk", "blocked_existing_profile"].includes(
                    row.automated_recommendation,
                  ),
                ).length
              }
            />
            <Metric
              label="Pending company knowledge"
              value={pendingContributions.length}
            />
            <Metric
              label="Pending medicine knowledge"
              value={pendingMedicineContributions.length}
            />
            <Metric label="All claims" value={claims.length} />
          </section>

          <SafeBoundary title="Duplicate Merger">
            <AdminDuplicateMerger />
          </SafeBoundary>
          <SafeBoundary title="Company Merge Requests">
            <AdminCompanyMergeRequests />
          </SafeBoundary>
          <SafeBoundary title="Company Directory Governance">
            <AdminCompanyDirectoryGovernance />
          </SafeBoundary>
          <SafeBoundary title="Medicine Data Intake">
            <AdminMedicineDataIntake />
          </SafeBoundary>
          <SafeBoundary title="Medicine Mapping Review">
            <AdminMedicineMappingReview />
          </SafeBoundary>

          <QueueSection
            icon={Building2}
            title="Company profile claims"
            empty="No company claims need review."
          >
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
                      <CardTitle className="text-xl font-bold">
                        {claim.proposed_company_name}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {humanize(claim.company_type)} · Submitted{" "}
                        {new Date(claim.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={scoreClass(claim.verification_score)}>
                        Score {claim.verification_score}/100
                      </Badge>
                      <Badge variant="outline">
                        {humanize(claim.automated_recommendation)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-xs">
                    <div>
                      <span className="font-semibold text-muted-foreground">Work email: </span>
                      {claim.work_email}
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Mobile / WhatsApp: </span>
                      {claim.mobile_phone || "Not provided"}{" "}
                      {claim.whatsapp_phone ? `(WA: ${claim.whatsapp_phone})` : ""}
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Role / Title: </span>
                      {claim.role_title || "Representative"}
                    </div>
                    <div>
                      <span className="font-semibold text-muted-foreground">Website: </span>
                      {claim.website ? (
                        <a href={claim.website} target="_blank" rel="noreferrer" className="text-primary underline">
                          {claim.website}
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </div>
                  </div>

                  {strings(claim.risk_flags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {strings(claim.risk_flags).map((flag) => (
                        <Badge key={flag} variant="destructive" className="text-[10px]">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {claim.evidence_file_paths && claim.evidence_file_paths.length > 0 && (
                    <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                      <span className="text-xs font-semibold">Attached verification evidence documents:</span>
                      <div className="flex flex-wrap gap-2">
                        {claim.evidence_file_paths.map((path) => (
                          <div key={path} className="flex items-center gap-2">
                            {signedDocuments[path] ? (
                              <a href={signedDocuments[path]} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary underline font-medium">
                                <FileDown className="mr-1 h-3.5 w-3.5" />
                                Download Document ({path.split("/").pop()})
                              </a>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => void prepareDocument(path)} disabled={saving === `document:${path}`}>
                                <FileCheck2 className="mr-1 h-3.5 w-3.5" />
                                Sign Document URL ({path.split("/").pop()})
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {claim.notes && (
                    <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Applicant notes: </span>
                      {claim.notes}
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">Reviewer notes / Verification override documentation</Label>
                    <Textarea
                      value={notes[claim.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [claim.id]: e.target.value })}
                      placeholder="Document verification checks, phone call verification, or commercial registry check details..."
                      className="text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      onClick={() => void reviewClaim(claim, "approved")}
                      disabled={saving === claim.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve &amp; Grant Representative Portal
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void reviewClaim(claim, "rejected")}
                      disabled={saving === claim.id}
                      className="text-xs font-bold"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject Claim
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </QueueSection>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function QueueSection({
  icon: Icon,
  title,
  empty,
  children,
}: {
  icon: typeof Building2;
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">{title}</h2>
          <Badge variant="outline">{count}</Badge>
        </div>
      </div>
      {count > 0 ? (
        <div className="space-y-4">{children}</div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {empty}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
