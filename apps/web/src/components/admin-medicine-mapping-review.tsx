import { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  Link2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatientAuth } from "@/lib/patient-auth";

type Review = {
  id: string;
  source_table: string;
  source_record_id: string;
  legacy_medicine_id: number | null;
  legacy_name: string | null;
  context_snapshot: Record<string, unknown>;
  suggested_matches: SuggestedMedicine[];
  selected_canonical_id: number | null;
  status: string;
  decision_note: string | null;
  created_at: string;
};
type Medicine = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  manufacturer: string | null;
  scientific_name: string | null;
};
type SuggestedMedicine = Medicine & {
  match_reason: string;
  confidence: "high" | "medium" | "low";
};
type Readiness = {
  generated_at: string;
  database_size_bytes: number;
  database_size_pretty: string;
  queue: { total: number; open: number; approved: number; rejected: number; with_suggestions: number };
  references: Array<{ source: string; total: number; unresolved: number }>;
  read_cutover_ready: boolean;
  legacy_deletion_ready: boolean;
};

const openStatuses = ["pending", "in_review", "reopened"];
const searchBody = (query: string) => ({
  p_query: query,
  p_manufacturer: null,
  p_drug_class: null,
  p_route: null,
  p_category: null,
  p_scientific_name: null,
  p_source_system: null,
  p_min_price: null,
  p_max_price: null,
  p_has_price_history: null,
  p_verified_only: null,
  p_has_marketplace_offers: null,
  p_has_image: null,
  p_min_completeness: null,
  p_query_mode: "all",
  p_sort: "best",
  p_limit: 8,
  p_offset: 0,
});

export function AdminMedicineMappingReview() {
  const { supabaseFetch } = usePatientAuth();
  const [rows, setRows] = useState<Review[]>([]);
  const [active, setActive] = useState<Review | null>(null);
  const [query, setQuery] = useState("");
  const [queueQuery, setQueueQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [matches, setMatches] = useState<Medicine[]>([]);
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const data = await supabaseFetch<Review[]>(
        "/rest/v1/medicine_mapping_review_queue?select=*&order=created_at.asc&limit=250",
      );
      const readinessReport = await supabaseFetch<Readiness>(
        "/rest/v1/rpc/get_medicine_normalization_readiness",
        { method: "POST", body: "{}" },
      );
      setRows(data);
      setReadiness(readinessReport);
      if (active) setActive(data.find((row) => row.id === active.id) ?? null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load mapping reviews.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!active) return;
    setQuery(active.legacy_name ?? "");
    setSelected(null);
    setMatches([]);
    setNote(active.decision_note ?? "");
  }, [active?.id]);
  useEffect(() => {
    const value = query.trim();
    if (!active || value.length < 2) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      void supabaseFetch<Medicine[]>(
        "/rest/v1/rpc/search_medicine_encyclopedia_v4",
        { method: "POST", body: JSON.stringify(searchBody(value)) },
      )
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, active?.id]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const count = await supabaseFetch<number>(
        "/rest/v1/rpc/refresh_medicine_mapping_review_queue",
        { method: "POST", body: "{}" },
      );
      const suggested = await supabaseFetch<number>(
        "/rest/v1/rpc/refresh_medicine_mapping_suggestions",
        { method: "POST", body: "{}" },
      );
      setMessage(
        `${count} unresolved references synchronized; ${suggested} suggestion sets refreshed.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not refresh mapping reviews.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approved" | "rejected" | "reopened") {
    if (!active) return;
    if (decision === "approved" && !selected) {
      setError("Choose the canonical medicine first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_medicine_mapping", {
        method: "POST",
        body: JSON.stringify({
          p_review_id: active.id,
          p_decision: decision,
          p_canonical_id:
            decision === "approved" ? selected?.canonical_id : null,
          p_note: note.trim() || null,
        }),
      });
      setMessage(
        decision === "approved"
          ? "Canonical mapping approved without deleting the legacy reference."
          : decision === "reopened"
            ? "Mapping reopened and its canonical link safely removed."
            : "Mapping rejected and retained for audit.",
      );
      setActive(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save mapping decision.",
      );
    } finally {
      setBusy(false);
    }
  }

  const pending = rows.filter((row) => openStatuses.includes(row.status));
  const reviewed = rows.length - pending.length;
  const needle = queueQuery.trim().toLocaleLowerCase();
  const visibleRows = rows.filter((row) => {
    if (statusFilter === "open" && !openStatuses.includes(row.status))
      return false;
    if (!["all", "open"].includes(statusFilter) && row.status !== statusFilter)
      return false;
    if (sourceFilter !== "all" && row.source_table !== sourceFilter)
      return false;
    return (
      !needle ||
      [
        row.legacy_name,
        row.legacy_medicine_id,
        row.source_record_id,
        row.source_table,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase()
          .includes(needle),
      )
    );
  });
  const contextEntries = active
    ? Object.entries(active.context_snapshot ?? {})
        .filter(
          ([, value]) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== "",
        )
        .slice(0, 8)
    : [];
  const suggestions = active?.suggested_matches ?? [];

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Medicine mapping exceptions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resolve legacy references into the unified catalog. Nothing is
            merged or overwritten automatically.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={busy}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Synchronize exceptions
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mt-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">{pending.length}</div>
            <div className="text-sm text-muted-foreground">Awaiting review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">{reviewed}</div>
            <div className="text-sm text-muted-foreground">
              Reviewed with audit history
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold">
              {rows.length ? Math.round((reviewed / rows.length) * 100) : 100}%
            </div>
            <div className="text-sm text-muted-foreground">Review progress</div>
          </CardContent>
        </Card>
      </div>
      {readiness && (
        <Card className="mt-5">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Normalization cutover readiness</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Live, read-only coverage across every remaining compatibility reference.</p>
              </div>
              <Badge variant={readiness.read_cutover_ready ? "default" : "secondary"}>
                {readiness.read_cutover_ready ? "Read cutover ready" : "Review still required"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {readiness.references.map((reference) => {
                const mapped = reference.total - reference.unresolved;
                const percentage = reference.total ? Math.round((mapped / reference.total) * 100) : 100;
                return (
                  <div key={reference.source} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{reference.source}</div>
                    <div className="mt-2 text-2xl font-bold">{percentage}%</div>
                    <div className="text-xs text-muted-foreground">{reference.unresolved.toLocaleString()} unresolved of {reference.total.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
            <Alert>
              <AlertDescription>
                Database size: {readiness.database_size_pretty}. Legacy deletion remains locked. Completing mapping review is only one gate; backup verification, dependency telemetry, compatibility tests, and the observation window are still required.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {visibleRows.length} shown
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={queueQuery}
                onChange={(event) => setQueueQuery(event.target.value)}
                placeholder="Search name, ID, or source"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Review status"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="open">Awaiting review</option>
                <option value="all">All statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="reopened">Reopened</option>
              </select>
              <select
                aria-label="Reference source"
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="all">All sources</option>
                <option value="medicine_enrichments">Enrichments</option>
                <option value="medicine_enrichment_import_queue">
                  Import queue
                </option>
                <option value="pharmacy_inventory_items">
                  Pharmacy inventory
                </option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[38rem] space-y-2 overflow-y-auto">
            {visibleRows.map((row) => (
              <button
                key={row.id}
                onClick={() => setActive(row)}
                className={`block w-full rounded-lg border p-3 text-left transition-colors ${active?.id === row.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">
                    {row.legacy_name ||
                      `Legacy medicine #${row.legacy_medicine_id}`}
                  </div>
                  <Badge
                    variant={
                      row.status === "approved" ? "default" : "secondary"
                    }
                  >
                    {row.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {row.source_table.replaceAll("_", " ")} · #
                  {row.legacy_medicine_id ?? "unlinked"}
                </div>
              </button>
            ))}
            {!visibleRows.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No mapping exceptions match these filters.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {active ? "Review canonical destination" : "Select an exception"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {active ? (
              <>
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <strong>
                    {active.legacy_name || "Unnamed legacy medicine"}
                  </strong>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Legacy #{active.legacy_medicine_id ?? "none"} ·{" "}
                    {active.source_table.replaceAll("_", " ")}
                  </div>
                  {contextEntries.length > 0 && (
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      {contextEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-md bg-background/70 p-2"
                        >
                          <dt className="text-xs font-medium text-muted-foreground">
                            {key.replaceAll("_", " ")}
                          </dt>
                          <dd className="mt-0.5 break-words text-sm">
                            {String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium"
                    htmlFor="canonical-medicine-search"
                  >
                    Find the canonical medicine
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="canonical-medicine-search"
                      className="pl-9"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search English, Arabic, scientific name, or company"
                    />
                  </div>
                </div>
                {suggestions.length > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">Suggested exact-name match</div>
                      <Badge variant="secondary">Review required</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This is a navigation aid, not an automatic approval. Compare the
                      company, ingredient, strength, and source evidence before deciding.
                    </p>
                    <div className="mt-3 space-y-2">
                      {suggestions.map((medicine) => (
                        <button
                          key={medicine.canonical_id}
                          type="button"
                          onClick={() => setSelected(medicine)}
                          className={`block w-full rounded-md border bg-background p-3 text-left ${selected?.canonical_id === medicine.canonical_id ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"}`}
                        >
                          <div className="font-medium">
                            {medicine.name_en || medicine.name_ar || `#${medicine.canonical_id}`}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {[medicine.name_ar, medicine.scientific_name, medicine.manufacturer]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                          <div className="mt-2 text-xs font-medium text-primary">
                            {medicine.match_reason}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {matches.map((medicine) => (
                    <div
                      key={medicine.canonical_id}
                      className={`flex items-center gap-2 rounded-lg border p-3 ${selected?.canonical_id === medicine.canonical_id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <button
                        onClick={() => setSelected(medicine)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-medium">
                          {medicine.name_en ||
                            medicine.name_ar ||
                            `#${medicine.canonical_id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[
                            medicine.name_ar,
                            medicine.scientific_name,
                            medicine.manufacturer,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </button>
                      <a
                        href={`/catalog/${medicine.canonical_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md p-2 hover:bg-muted"
                        aria-label={`Open ${medicine.name_en || medicine.name_ar || medicine.canonical_id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                  {query.trim().length >= 2 && !matches.length && !busy && (
                    <p className="text-sm text-muted-foreground">
                      No canonical matches yet. Try another spelling, Arabic
                      name, scientific name, or company.
                    </p>
                  )}
                </div>
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional review note"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void decide("approved")}
                    disabled={busy || !selected}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve mapping
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void decide("rejected")}
                    disabled={busy}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  {active.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => void decide("reopened")}
                      disabled={busy}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reopen
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Approval adds the canonical link while preserving the original
                  legacy reference and audit history.
                </p>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Choose a reference from the review queue to compare it with the
                unified medicine catalog.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
