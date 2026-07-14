import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  Building2,
  Check,
  FileCheck2,
  Handshake,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile = { id: string; role: string; is_active: boolean };
type Application = {
  id: string;
  application_type: string;
  entity_type: string;
  requested_name: string;
  work_email: string;
  contact_phone: string | null;
  country: string | null;
  city: string | null;
  license_authority: string | null;
  license_number: string;
  license_expiry: string | null;
  specialties: string[];
  services: string[];
  evidence_urls: string[];
  notes: string | null;
  status: string;
  created_at: string;
};
type Provider = {
  id: string;
  organization_id: string;
  display_name: string;
  entity_type: string;
  verification_status: string;
  is_public: boolean;
};
type Contract = {
  id: string;
  source_organization_id: string;
  destination_organization_id: string;
  service_types: string[];
  commission_model: string;
  commission_rate: number | null;
  commission_fixed_amount: number | null;
  currency: string;
  status: string;
  effective_from: string | null;
  effective_until: string | null;
  terms_summary: string | null;
};
type Organization = { id: string; name: string; organization_type: string };
const ADMIN_ROLES = new Set(["admin", "platform_admin", "super_admin"]);

export default function AdminHealthcareNetwork() {
  const { session, supabaseFetch } = usePatientAuth();
  const [me, setMe] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [contract, setContract] = useState({
    source: "",
    destination: "",
    services: "",
    model: "none",
    rate: "",
    fixed: "",
    from: "",
    until: "",
    terms: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isAdmin = Boolean(me?.is_active && ADMIN_ROLES.has(me.role));
  const pending = useMemo(
    () =>
      applications.filter((row) =>
        ["pending", "under_review"].includes(row.status),
      ),
    [applications],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!session?.user?.id) {
        setMe(null);
        return;
      }
      const profileRows = await supabaseFetch<Profile[]>(
        `/rest/v1/profiles?select=id,role,is_active&id=eq.${session.user.id}&limit=1`,
      );
      const profile = profileRows[0] || null;
      setMe(profile);
      if (!profile?.is_active || !ADMIN_ROLES.has(profile.role)) return;
      const [applicationRows, providerRows, organizationRows, contractRows] =
        await Promise.all([
          supabaseFetch<Application[]>(
            "/rest/v1/healthcare_entity_applications?select=*&order=created_at.asc&limit=500",
          ),
          supabaseFetch<Provider[]>(
            "/rest/v1/healthcare_entity_profiles?select=id,organization_id,display_name,entity_type,verification_status,is_public&order=display_name.asc&limit=500",
          ),
          supabaseFetch<Organization[]>(
            "/rest/v1/organizations?select=id,name,organization_type&is_active=eq.true&order=name.asc&limit=1000",
          ),
          supabaseFetch<Contract[]>(
            "/rest/v1/healthcare_provider_contracts?select=*&order=created_at.desc&limit=500",
          ),
        ]);
      setApplications(applicationRows);
      setProviders(providerRows);
      setOrganizations(organizationRows);
      setContracts(contractRows);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.user?.id]);

  async function review(row: Application, decision: "approved" | "rejected") {
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_healthcare_entity_application", {
        method: "POST",
        body: JSON.stringify({
          target_application: row.id,
          decision,
          reviewer_notes: notes[row.id]?.trim() || null,
        }),
      });
      setNotice(`${row.requested_name} ${decision}.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function createContract() {
    setBusy("contract");
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/healthcare_provider_contracts", {
        method: "POST",
        body: JSON.stringify({
          source_organization_id: contract.source,
          destination_organization_id: contract.destination,
          service_types: splitList(contract.services),
          commission_model: contract.model,
          commission_rate:
            contract.model === "percentage" ? Number(contract.rate) : null,
          commission_fixed_amount:
            contract.model === "fixed" ? Number(contract.fixed) : null,
          currency: "EGP",
          status: "draft",
          effective_from: contract.from || null,
          effective_until: contract.until || null,
          terms_summary: contract.terms.trim() || null,
        }),
      });
      setContract({
        source: "",
        destination: "",
        services: "",
        model: "none",
        rate: "",
        fixed: "",
        from: "",
        until: "",
        terms: "",
      });
      setNotice("Draft provider contract created for review.");
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function updateContractStatus(
    row: Contract,
    status: "active" | "paused" | "terminated",
  ) {
    if (
      status === "active" &&
      !window.confirm(
        "Activate this routing contract only after identity, licensing, legal, tax, commission, and payout reviews are complete?",
      )
    )
      return;
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch(
        `/rest/v1/healthcare_provider_contracts?id=eq.${row.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setNotice(`Provider contract ${status}.`);
      await load();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  if (!session?.access_token)
    return (
      <Gate text="Sign in through the staff portal before opening healthcare network administration." />
    );
  if (!loading && !isAdmin)
    return (
      <Gate text="Only an active platform administrator can approve healthcare providers or manage routing contracts." />
    );

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <ShieldCheck className="h-4 w-4" />
              Healthcare network governance
            </p>
            <h1 className="mt-3 text-4xl font-bold">
              Provider approval, routing, and commissions
            </h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              Verify entity identity and licensing before publication. Contracts
              record routing and commission terms but never authorize a payout
              or replace consent, clinical judgment, KYC, tax, or legal review.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </section>
      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mt-5">
          <Check className="h-4 w-4" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pending applications" value={pending.length} />
        <Metric
          label="Approved profiles"
          value={
            providers.filter((row) => row.verification_status === "verified")
              .length
          }
        />
        <Metric
          label="Public profiles"
          value={providers.filter((row) => row.is_public).length}
        />
        <Metric label="Provider contracts" value={contracts.length} />
      </section>

      <section className="mt-9">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <FileCheck2 className="h-5 w-5" />
          Entity claims and creations
        </h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {pending.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <div>
                    <CardTitle>{row.requested_name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {humanize(row.application_type)} ·{" "}
                      {humanize(row.entity_type)} ·{" "}
                      {[row.city, row.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <Badge>{humanize(row.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Work email" value={row.work_email} />
                  <Info label="Phone" value={row.contact_phone} />
                  <Info label="License" value={row.license_number} />
                  <Info label="Authority" value={row.license_authority} />
                  <Info label="License expiry" value={row.license_expiry} />
                  <Info
                    label="Submitted"
                    value={new Date(row.created_at).toLocaleString()}
                  />
                  <Info
                    label="Specialties"
                    value={row.specialties.join(", ")}
                  />
                  <Info label="Services" value={row.services.join(", ")} />
                </div>
                {row.evidence_urls.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Evidence
                    </div>
                    {row.evidence_urls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all font-semibold text-primary"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
                <div>
                  <Label>Review notes</Label>
                  <Textarea
                    className="mt-1"
                    value={notes[row.id] || ""}
                    onChange={(event) =>
                      setNotes({ ...notes, [row.id]: event.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void review(row, "approved")}
                    disabled={busy === row.id}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve and publish
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void review(row, "rejected")}
                    disabled={busy === row.id}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {pending.length === 0 && (
            <Empty text="No healthcare entity application needs review." />
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Handshake className="h-5 w-5" />
          Provider contracts and commission rules
        </h2>
        <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Create governed draft</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Source organization">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={contract.source}
                  onChange={(event) =>
                    setContract({ ...contract, source: event.target.value })
                  }
                >
                  <option value="">Select…</option>
                  {organizations.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Destination organization">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={contract.destination}
                  onChange={(event) =>
                    setContract({
                      ...contract,
                      destination: event.target.value,
                    })
                  }
                >
                  <option value="">Select…</option>
                  {organizations.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Services">
                <Input
                  value={contract.services}
                  onChange={(event) =>
                    setContract({ ...contract, services: event.target.value })
                  }
                  placeholder="laboratory, radiology"
                />
              </Field>
              <Field label="Commission model">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={contract.model}
                  onChange={(event) =>
                    setContract({ ...contract, model: event.target.value })
                  }
                >
                  <option value="none">No commission</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed EGP</option>
                </select>
              </Field>
              {contract.model === "percentage" && (
                <Field label="Percentage">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={contract.rate}
                    onChange={(event) =>
                      setContract({ ...contract, rate: event.target.value })
                    }
                  />
                </Field>
              )}
              {contract.model === "fixed" && (
                <Field label="Fixed amount">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={contract.fixed}
                    onChange={(event) =>
                      setContract({ ...contract, fixed: event.target.value })
                    }
                  />
                </Field>
              )}
              <Field label="Effective from">
                <Input
                  type="date"
                  value={contract.from}
                  onChange={(event) =>
                    setContract({ ...contract, from: event.target.value })
                  }
                />
              </Field>
              <Field label="Effective until">
                <Input
                  type="date"
                  value={contract.until}
                  onChange={(event) =>
                    setContract({ ...contract, until: event.target.value })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Terms summary">
                  <Textarea
                    value={contract.terms}
                    onChange={(event) =>
                      setContract({ ...contract, terms: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={() => void createContract()}
                  disabled={
                    busy === "contract" ||
                    !contract.source ||
                    !contract.destination ||
                    contract.source === contract.destination
                  }
                >
                  Create draft
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {contracts.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {organizationName(
                          organizations,
                          row.source_organization_id,
                        )}{" "}
                        →{" "}
                        {organizationName(
                          organizations,
                          row.destination_organization_id,
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.service_types.join(", ") || "All agreed services"}
                      </div>
                    </div>
                    <Badge>{humanize(row.status)}</Badge>
                  </div>
                  <div className="mt-3 text-sm">
                    {row.commission_model === "percentage"
                      ? `${row.commission_rate}% commission`
                      : row.commission_model === "fixed"
                        ? `${Number(row.commission_fixed_amount).toLocaleString()} ${row.currency}`
                        : "No commission"}
                  </div>
                  {row.terms_summary && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {row.terms_summary}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status !== "active" && row.status !== "terminated" && (
                      <Button
                        size="sm"
                        onClick={() => void updateContractStatus(row, "active")}
                        disabled={busy === row.id}
                      >
                        Activate after review
                      </Button>
                    )}
                    {row.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void updateContractStatus(row, "paused")}
                        disabled={busy === row.id}
                      >
                        Pause routing
                      </Button>
                    )}
                    {row.status !== "terminated" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void updateContractStatus(row, "terminated")
                        }
                        disabled={busy === row.id}
                      >
                        Terminate
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!contracts.length && (
              <Empty text="No provider contract exists yet." />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Gate({ text }: { text: string }) {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>{text}</AlertDescription>
      </Alert>
      <div className="mt-4 flex gap-2">
        <Button asChild>
          <Link href="/portal">Open staff portal</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/control-center">Control center</Link>
        </Button>
      </div>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-3xl font-bold">{value.toLocaleString()}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-7 text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function organizationName(rows: Organization[], id: string) {
  return rows.find((row) => row.id === id)?.name || id.slice(0, 8);
}
function messageOf(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "The operation could not be completed.";
}
