/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Check, FileCheck2, Filter, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

type NetworkEnrollment = {
  id: string;
  application_type: string;
  entity_type: string;
  applicant_name: string;
  organization_name: string;
  work_email: string;
  phone_number: string | null;
  license_number: string | null;
  facility_identifier: string | null;
  country: string;
  city: string;
  full_address: string | null;
  website_url: string | null;
  service_scope: string[];
  notes: string | null;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

type StatusTab = "pending" | "approved" | "rejected" | "all";

async function safeFetch<T>(fetcher: (path: string, init?: RequestInit) => Promise<T>, path: string, init?: RequestInit): Promise<T> {
  try {
    const data = await fetcher(path, init);
    if (data === null || data === undefined) return [] as unknown as T;
    if (typeof data === "object" && !Array.isArray(data) && "message" in (data as Record<string, unknown>)) {
      return [] as unknown as T;
    }
    return data;
  } catch {
    return [] as unknown as T;
  }
}

async function safeFetchWithStatus<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(path, init);
    const data = await response.json();
    if (!response.ok) return [] as unknown as T;
    return (data ?? []) as T;
  } catch {
    return [] as unknown as T;
  }
}

const humanize = (value: any) => String(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const isOpen = (status: string) => status === "pending" || status === "under_review";

function initialQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("careStatus");
  return {
    tab: (["pending", "approved", "rejected", "all"].includes(String(requestedTab)) ? requestedTab : "pending") as StatusTab,
    requestId: params.get("request"),
  };
}

export function AdminCareNetworkEnrollments() {
  const { session, supabaseFetch } = usePatientAuth();
  const queryDefaults = initialQuery();
  const [requests, setRequests] = useState<NetworkEnrollment[]>([]);
  const [activeTab, setActiveTab] = useState<StatusTab>(queryDefaults.tab);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await safeFetch<NetworkEnrollment[]>(
        supabaseFetch,
        "/rest/v1/healthcare_network_enrollments?select=*&order=submitted_at.desc&limit=150"
      );
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load healthcare network enrollments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.access_token]);

  const counts = {
    pending: requests.filter((r) => isOpen(r.status)).length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    all: requests.length,
  };

  const filteredRequests = requests.filter((row) => {
    const matchesTab =
      activeTab === "all"
        ? true
        : activeTab === "pending"
        ? isOpen(row.status)
        : row.status === activeTab;

    if (!matchesTab) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    return (
      row.applicant_name.toLowerCase().includes(q) ||
      row.organization_name.toLowerCase().includes(q) ||
      row.work_email.toLowerCase().includes(q) ||
      (row.city && row.city.toLowerCase().includes(q)) ||
      (row.license_number && row.license_number.toLowerCase().includes(q))
    );
  });

  async function decide(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/healthcare_network_enrollments?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: decision,
          reviewer_notes: notes[id] || null,
          reviewed_at: new Date().toISOString(),
        }),
      });
      setMessage(decision === "approved" ? "Enrollment approved." : "Enrollment refused.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Decision could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading healthcare network requests...
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
            <ShieldCheck className="h-4 w-4" />
            Healthcare Network Governance
          </div>
          <h2 className="text-2xl font-bold">Provider &amp; Institutional Enrollments</h2>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert>
          <Check className="h-4 w-4 text-emerald-600" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {(["pending", "approved", "rejected", "all"] as StatusTab[]).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
            className="justify-between"
          >
            <span className="capitalize">{tab}</span>
            <Badge variant="secondary">{counts[tab]}</Badge>
          </Button>
        ))}
      </div>

      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by applicant, facility name, email, or city..."
          className="pl-9"
        />
      </div>

      <div className="space-y-4">
        {filteredRequests.map((row) => (
          <Card key={row.id}>
            <CardHeader>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{row.organization_name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanize(row.application_type)} · {humanize(row.entity_type)}
                  </p>
                </div>
                <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>
                  {row.status === "rejected" ? "refused" : humanize(row.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div><span className="font-semibold">Applicant:</span> {row.applicant_name}</div>
                <div><span className="font-semibold">Work Email:</span> {row.work_email}</div>
                <div><span className="font-semibold">Location:</span> {[row.city, row.country].filter(Boolean).join(", ")}</div>
                {row.license_number && <div><span className="font-semibold">License:</span> {row.license_number}</div>}
                {row.facility_identifier && <div><span className="font-semibold">Facility Code:</span> {row.facility_identifier}</div>}
              </div>

              {row.notes && (
                <p className="rounded-lg bg-muted p-3 text-muted-foreground">{row.notes}</p>
              )}

              {isOpen(row.status) && (
                <div className="space-y-3 pt-2">
                  <Textarea
                    value={notes[row.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                    placeholder="Reviewer notes or verification comments..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => void decide(row.id, "approved")} disabled={busy === row.id}>
                      <Check className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => void decide(row.id, "rejected")} disabled={busy === row.id}>
                      <X className="mr-2 h-4 w-4" /> Refuse
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredRequests.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No enrollment requests found in this queue.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
