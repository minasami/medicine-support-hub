import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientAuth } from "@/lib/patient-auth";
import { parseDonationCsv } from "@/lib/donation-csv";
import {
  createDonationRequest,
  importDonationLots,
  listPublishedLots,
  listRequestsForOrg,
  reviewDonationRequest,
  storageModeLabel,
} from "@/lib/donation-data";
import type {
  DonationLot,
  DonationRequest,
  ParsedDonationCsvRow,
} from "@/lib/donation-types";
import { daysToExpiry, quantityRequestable } from "@/lib/donation-types";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Gift,
  Package,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";

const DEFAULT_ORG_ID = "demo-ngo-org";

function money(n: number) {
  return `${Math.round(n).toLocaleString()} EGP`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function NgoDonationsPage() {
  const { isAuthenticated, session } = usePatientAuth();
  const userId = session?.user?.id || "anonymous";
  const orgId =
    (session?.user as { org_id?: string } | undefined)?.org_id || DEFAULT_ORG_ID;

  const [tab, setTab] = useState("browse");
  const [lots, setLots] = useState<DonationLot[]>([]);
  const [donorRequests, setDonorRequests] = useState<DonationRequest[]>([]);
  const [myRequests, setMyRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState("Detecting…");
  const [search, setSearch] = useState("");

  // Import state
  const [csvPreview, setCsvPreview] = useState<ParsedDonationCsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<ParsedDonationCsvRow[]>([]);
  const [csvFilename, setCsvFilename] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [publishOnImport, setPublishOnImport] = useState(true);
  const [importing, setImporting] = useState(false);

  // Request dialog state (inline)
  const [requestLotId, setRequestLotId] = useState<string | null>(null);
  const [requestQty, setRequestQty] = useState("");
  const [requestJustification, setRequestJustification] = useState("");
  const [requestProgram, setRequestProgram] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [published, asDonor, asRequester] = await Promise.all([
        listPublishedLots(300),
        listRequestsForOrg(orgId, "donor"),
        listRequestsForOrg(orgId, "requester"),
      ]);
      setLots(published);
      setDonorRequests(asDonor);
      setMyRequests(asRequester);
      setStorageMode(storageModeLabel());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load donations.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter(
      (l) =>
        l.item_desc.toLowerCase().includes(q) ||
        l.item_code.toLowerCase().includes(q) ||
        l.lot_no.toLowerCase().includes(q) ||
        (l.org_code || "").toLowerCase().includes(q),
    );
  }, [lots, search]);

  async function onFile(file: File | null) {
    setMessage(null);
    setError(null);
    if (!file) return;
    const text = await file.text();
    const result = parseDonationCsv(text);
    setCsvFilename(file.name);
    setCsvPreview(result.valid);
    setCsvErrors(result.errors);
    if (!listingTitle) {
      setListingTitle(`Donation import — ${file.name.replace(/\.csv$/i, "")}`);
    }
    if (result.valid.length === 0) {
      setError("No valid rows found in CSV. Check headers and exp dates.");
    }
  }

  async function runImport() {
    if (csvPreview.length === 0) {
      setError("Parse a valid CSV first.");
      return;
    }
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const { listing, lots: imported } = await importDonationLots({
        orgId,
        orgCode: csvPreview[0]?.org_code,
        title: listingTitle || "Donation listing",
        filename: csvFilename,
        createdBy: userId,
        publish: publishOnImport,
        rows: csvPreview,
      });
      setMessage(
        `Imported ${imported.length} lots into “${listing.title}” (${listing.status}). Storage: ${storageModeLabel()}.`,
      );
      setCsvPreview([]);
      setCsvErrors([]);
      setCsvFilename("");
      await load();
      setTab("browse");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function submitRequest(lot: DonationLot) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (!isAuthenticated) {
        throw new Error("Sign in from the platform portal before requesting.");
      }
      const qty = Number(requestQty);
      await createDonationRequest({
        lot,
        requesterOrgId: orgId,
        requestedBy: userId,
        quantity: qty,
        justification: requestJustification,
        programName: requestProgram,
      });
      setMessage(`Request submitted for ${qty} × ${lot.item_desc}.`);
      setRequestLotId(null);
      setRequestQty("");
      setRequestJustification("");
      setRequestProgram("");
      await load();
      setTab("my-requests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onReview(
    requestId: string,
    approve: boolean,
    qty?: number,
  ) {
    setError(null);
    setMessage(null);
    try {
      await reviewDonationRequest({
        requestId,
        approve,
        quantityApproved: qty,
        reviewedBy: userId,
        rejectionReason: approve ? undefined : "Not available for this cycle",
      });
      setMessage(approve ? "Request approved." : "Request rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            NGO Donation Exchange
          </Badge>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Gift className="h-8 w-8 text-emerald-700" />
            Medicine donations
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Pharma and NGO donors publish near-expiry surplus. Receiving NGOs
            browse lots and request quantities through the platform.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Storage mode: {storageMode} · Org context: {orgId}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/ngo/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="browse">Browse available</TabsTrigger>
          <TabsTrigger value="import">Import CSV (donor)</TabsTrigger>
          <TabsTrigger value="inbox">Incoming requests</TabsTrigger>
          <TabsTrigger value="my-requests">My requests</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search item, code, lot, org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <div className="text-sm text-muted-foreground">
              {filteredLots.length} lot{filteredLots.length === 1 ? "" : "s"}
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading lots…</p>
          ) : filteredLots.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
                No published donation lots yet. Import a donor CSV to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Value/unit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.map((lot) => {
                    const days = daysToExpiry(lot.expiry_date);
                    const avail = quantityRequestable(lot);
                    return (
                      <TableRow key={lot.$id}>
                        <TableCell>
                          <div className="font-medium">{lot.item_desc}</div>
                          <div className="text-xs text-muted-foreground">
                            {lot.item_code}
                            {lot.org_code ? ` · ${lot.org_code}` : ""}
                            {lot.near_expire ? (
                              <Badge
                                variant="outline"
                                className="ml-2 border-amber-300 text-amber-700"
                              >
                                Near expire
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {lot.lot_no}
                        </TableCell>
                        <TableCell>
                          <div>{formatDate(lot.expiry_date)}</div>
                          <div className="text-xs text-muted-foreground">
                            {days} day{days === 1 ? "" : "s"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {avail.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(lot.list_price_egp)}
                        </TableCell>
                        <TableCell className="text-right">
                          {requestLotId === lot.$id ? (
                            <div className="flex min-w-[220px] flex-col gap-2 text-left">
                              <Input
                                type="number"
                                min={1}
                                max={avail}
                                placeholder="Qty"
                                value={requestQty}
                                onChange={(e) => setRequestQty(e.target.value)}
                              />
                              <Input
                                placeholder="Program (optional)"
                                value={requestProgram}
                                onChange={(e) =>
                                  setRequestProgram(e.target.value)
                                }
                              />
                              <Textarea
                                placeholder="Justification"
                                value={requestJustification}
                                onChange={(e) =>
                                  setRequestJustification(e.target.value)
                                }
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={submitting}
                                  onClick={() => void submitRequest(lot)}
                                >
                                  Submit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRequestLotId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={avail <= 0}
                              onClick={() => {
                                setRequestLotId(lot.$id);
                                setRequestQty(
                                  String(Math.min(100, avail) || 1),
                                );
                              }}
                            >
                              Request
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import donor CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Expected headers: Org Code, Item Code, Item Desc, Lot No.,
                Locator, Quantity Accept, Price List, Exp Date, Po Category
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>CSV file</Label>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void onFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Listing title</Label>
                  <Input
                    value={listingTitle}
                    onChange={(e) => setListingTitle(e.target.value)}
                    placeholder="Near-expiry donation – Dec 2026"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishOnImport}
                  onChange={(e) => setPublishOnImport(e.target.checked)}
                />
                Publish immediately (visible to network NGOs)
              </label>

              {csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {csvErrors.length} row(s) skipped. First error: row{" "}
                    {csvErrors[0].row_index} — {csvErrors[0].error}
                  </AlertDescription>
                </Alert>
              )}

              {csvPreview.length > 0 && (
                <>
                  <div className="text-sm font-medium">
                    Preview: {csvPreview.length} valid lot
                    {csvPreview.length === 1 ? "" : "s"}
                    {csvFilename ? ` from ${csvFilename}` : ""}
                  </div>
                  <div className="max-h-64 overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Lot</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Expiry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.slice(0, 50).map((r) => (
                          <TableRow key={`${r.item_code}-${r.lot_no}-${r.row_index}`}>
                            <TableCell className="text-sm">{r.item_desc}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.lot_no}
                            </TableCell>
                            <TableCell>{r.quantity_accept.toLocaleString()}</TableCell>
                            <TableCell>{formatDate(r.expiry_date)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={() => void runImport()} disabled={importing}>
                    {importing ? "Importing…" : `Import ${csvPreview.length} lots`}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Incoming requests (as donor)</CardTitle>
            </CardHeader>
            <CardContent>
              {donorRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No requests against your org’s lots yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {donorRequests.map((req) => (
                    <div
                      key={req.$id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-medium">
                          {req.item_desc || req.item_code}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Qty requested: {req.quantity_requested.toLocaleString()}{" "}
                          · Status: {req.status}
                          {req.justification
                            ? ` · ${req.justification.slice(0, 80)}`
                            : ""}
                        </div>
                      </div>
                      {req.status === "submitted" ||
                      req.status === "under_review" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              void onReview(
                                req.$id,
                                true,
                                req.quantity_requested,
                              )
                            }
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onReview(req.$id, false)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary">{req.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My donation requests</CardTitle>
            </CardHeader>
            <CardContent>
              {myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You have not requested any donation lots yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div key={req.$id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {req.item_desc || req.item_code}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Requested {req.quantity_requested.toLocaleString()}
                            {req.quantity_approved
                              ? ` · approved ${req.quantity_approved.toLocaleString()}`
                              : ""}
                          </div>
                        </div>
                        <Badge>{req.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
