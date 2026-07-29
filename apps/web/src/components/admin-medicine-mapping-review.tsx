/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Check, Database, MapPin, Pill, Search, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePatientAuth } from "@/lib/patient-auth";

type MappingRow = {
  id: string;
  source_table: string;
  legacy_medicine_id: number | null;
  legacy_name: string | null;
  canonical_id: number | null;
  confidence_score: number;
  status: string;
  context: Record<string, unknown> | null;
};

type CanonicalProduct = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  manufacturer: string | null;
  scientific_name: string | null;
};

export function AdminMedicineMappingReview() {
  const { supabaseFetch } = usePatientAuth();
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [active, setActive] = useState<MappingRow | null>(null);
  const [search, setSearch] = useState("");
  const [canonicalCandidates, setCanonicalCandidates] = useState<
    CanonicalProduct[]
  >([]);
  const [targetCanonicalId, setTargetCanonicalId] = useState<number | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    try {
      const data = await supabaseFetch<MappingRow[]>(
        "/rest/v1/medicine_legacy_mappings?select=*&status=in.(pending_review,auto_matched)&order=confidence_score.asc&limit=100",
      );
      setRows(data || []);
      if (data && data.length > 0 && !active) {
        setActive(data[0]);
        setTargetCanonicalId(data[0].canonical_id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load mapping exceptions.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function searchCanonical(query: string) {
    setSearch(query);
    if (query.trim().length < 2) return;
    try {
      const results = await supabaseFetch<CanonicalProduct[]>(
        `/rest/v1/medicine_canonical_products_v1?select=canonical_id,name_en,name_ar,manufacturer,scientific_name&or=(name_en.ilike.*${encodeURIComponent(query)}*,name_ar.ilike.*${encodeURIComponent(query)}*,manufacturer.ilike.*${encodeURIComponent(query)}*)&limit=20`,
      );
      setCanonicalCandidates(results || []);
    } catch {
      setCanonicalCandidates([]);
    }
  }

  async function approve(
    id: string,
    canonicalId: number | null,
    reviewNote?: string,
  ) {
    if (!canonicalId) {
      setError("Please select a target canonical medicine first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_medicine_legacy_mapping", {
        method: "POST",
        body: JSON.stringify({
          target_mapping_id: id,
          p_decision: "approve",
          target_canonical_id: canonicalId,
          p_review_notes: reviewNote || "Approved in platform admin",
        }),
      });
      setMessage("Legacy mapping approved.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to approve mapping.");
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/review_medicine_legacy_mapping", {
        method: "POST",
        body: JSON.stringify({
          target_mapping_id: id,
          p_decision: "reject",
          target_canonical_id: null,
          p_review_notes: "Rejected in platform admin",
        }),
      });
      setMessage("Legacy mapping rejected.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to reject mapping.");
    } finally {
      setBusy(false);
    }
  }

  const visibleRows = rows;
  const contextEntries = active?.context
    ? Object.entries(active.context).slice(0, 10)
    : [];

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            Medicine Legacy &amp; Alternate Name Resolution
          </h2>
          <p className="text-xs text-muted-foreground">
            Review automatically matched and ambiguous legacy medicine entries to map them to the canonical encyclopedia.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Refresh queue
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unresolved Legacy Exceptions ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
                    {String(row.status || "").replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {String(row.source_table || "").replaceAll("_", " ")} · #
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
                    {String(active.source_table || "").replaceAll("_", " ")}
                  </div>
                  {contextEntries.length > 0 && (
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      {contextEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-md bg-background/70 p-2"
                        >
                          <dt className="text-xs font-medium text-muted-foreground">
                            {String(key || "").replaceAll("_", " ")}
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
                    Search target canonical product
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="canonical-medicine-search"
                      className="pl-9"
                      value={search}
                      onChange={(e) => void searchCanonical(e.target.value)}
                      placeholder="Search by name, scientific name or manufacturer..."
                    />
                  </div>
                </div>
                {canonicalCandidates.length > 0 && (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-xs">
                    {canonicalCandidates.map((c) => (
                      <button
                        key={c.canonical_id}
                        onClick={() => setTargetCanonicalId(c.canonical_id)}
                        className={`block w-full rounded p-2 text-left hover:bg-muted ${targetCanonicalId === c.canonical_id ? "bg-primary/10 font-semibold text-primary" : ""}`}
                      >
                        {c.name_en || c.name_ar} (#{c.canonical_id}) ·{" "}
                        {c.manufacturer || "unknown manufacturer"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      void approve(active.id, targetCanonicalId)
                    }
                    disabled={busy || !targetCanonicalId}
                    className="flex-1"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve Mapping
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void reject(active.id)}
                    disabled={busy}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an exception from the list to review and confirm its canonical destination.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
