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
import { useLanguage } from "@/lib/i18n";
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
  const { t } = useLanguage();
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

  const [csvPreview, setCsvPreview] = useState<ParsedDonationCsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<ParsedDonationCsvRow[]>([]);
  const [csvFilename, setCsvFilename] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [publishOnImport, setPublishOnImport] = useState(true);
  const [importing, setImporting] = useState(false);

  const [requestLotId, setRequestLotId] = useState<string | null>(null);
  const [requestQty, setRequestQty] = useState("");
  const [requestJustification, setRequestJustification] = useState("");
  const [requestProgram, setRequestProgram] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStorageMode(storageModeLabel());
      const [published, asDonor, asRequester] = await Promise.all([
        listPublishedLots(300),
        listRequestsForOrg(orgId, "donor"),
        listRequestsForOrg(orgId, "requester"),
      ]);
      setLots(published);
      setDonorRequests(asDonor);
      setMyRequests(asRequester);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Failed to load donations.", "تعذّر تحميل التبرعات."),
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((lot) =>
      [lot.item_desc, lot.item_code, lot.lot_no, lot.org_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [lots, search]);

  async function onFile(file: File | null) {
    if (!file) return;
    setCsvFilename(file.name);
    setError(null);
    const text = await file.text();
    const result = parseDonationCsv(text);
    setCsvPreview(result.valid);
    setCsvErrors(result.errors);
    if (!listingTitle) {
      setListingTitle(`Donation import — ${file.name.replace(/\.csv$/i, "")}`);
    }
    if (result.valid.length === 0) {
      setError(
        t(
          "No valid rows found in CSV. Check headers and exp dates.",
          "لا توجد صفوف صالحة في CSV. راجع العناوين وتواريخ الصلاحية.",
        ),
      );
    }
  }

  async function runImport() {
    if (csvPreview.length === 0) {
      setError(t("Parse a valid CSV first.", "حلّل ملف CSV صالحًا أولًا."));
      return;
    }
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const { listing, lots: imported } = await importDonationLots({
        orgId,
        createdBy: userId,
        title: listingTitle || t("Donation listing", "قائمة تبرع"),
        rows: csvPreview,
        publish: publishOnImport,
      });
      setMessage(
        t(
          `Imported ${imported.length} lot(s) under “${listing.title}”.`,
          `تم استيراد ${imported.length} دفعة ضمن «${listing.title}».`,
        ),
      );
      setCsvPreview([]);
      setCsvErrors([]);
      setCsvFilename("");
      await load();
      setTab("browse");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Import failed.", "فشل الاستيراد."),
      );
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
        throw new Error(
          t(
            "Sign in from the platform portal before requesting.",
            "سجّل الدخول من بوابة المنصة قبل الطلب.",
          ),
        );
      }
      const qty = Math.max(1, Number(requestQty) || 1);
      await createDonationRequest({
        lot,
        requesterOrgId: orgId,
        requestedBy: userId,
        quantity: qty,
        justification: requestJustification || undefined,
        programName: requestProgram || undefined,
      });
      setMessage(
        t(
          `Request submitted for ${qty} × ${lot.item_desc}.`,
          `تم إرسال طلب لـ ${qty} × ${lot.item_desc}.`,
        ),
      );
      setRequestLotId(null);
      setRequestQty("");
      setRequestJustification("");
      setRequestProgram("");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Could not submit request.", "تعذّر إرسال الطلب."),
      );
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
        rejectionReason: approve
          ? undefined
          : t("Not available for this cycle", "غير متاح لهذه الدورة"),
        reviewedBy: userId,
      });
      setMessage(
        approve
          ? t("Request approved.", "تمت الموافقة على الطلب.")
          : t("Request rejected.", "تم رفض الطلب."),
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Review failed.", "فشل المراجعة."),
      );
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {t("NGO Donation Exchange", "تبادل تبرعات الجمعيات")}
          </Badge>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Gift className="h-8 w-8 text-emerald-700" />
            {t("Medicine donations", "تبرعات الأدوية")}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {t(
              "Pharma and NGO donors publish near-expiry surplus. Receiving NGOs browse lots and request quantities through the platform.",
              "تنشر شركات الأدوية والجمعيات فائض قرب انتهاء الصلاحية. تتصفّح الجمعيات المستلمة الدفعات وتطلب الكميات عبر المنصة.",
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Storage mode", "وضع التخزين")}: {storageMode} ·{" "}
            {t("Org context", "سياق الجهة")}: {orgId}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/ngo/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("Dashboard", "لوحة التحكم")}
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
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
          <TabsTrigger value="browse">{t("Browse available", "تصفّح المتاح")}</TabsTrigger>
          <TabsTrigger value="import">{t("Import CSV (donor)", "استيراد CSV (متبرع)")}</TabsTrigger>
          <TabsTrigger value="inbox">{t("Incoming requests", "الطلبات الواردة")}</TabsTrigger>
          <TabsTrigger value="my-requests">{t("My requests", "طلباتي")}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              className="max-w-md"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "Search item, code, lot, org…",
                "ابحث عن صنف أو كود أو تشغيلة أو جهة…",
              )}
            />
          </div>

          {loading ? (
            <p className="text-muted-foreground">
              {t("Loading lots…", "جاري تحميل الدفعات…")}
            </p>
          ) : filteredLots.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
                {t(
                  "No published donation lots yet. Import a donor CSV to get started.",
                  "لا توجد دفعات تبرع منشورة بعد. استورد CSV للمتبرع للبدء.",
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Item", "الصنف")}</TableHead>
                    <TableHead>{t("Lot", "التشغيلة")}</TableHead>
                    <TableHead>{t("Expiry", "الصلاحية")}</TableHead>
                    <TableHead className="text-right">{t("Available", "المتاح")}</TableHead>
                    <TableHead className="text-right">{t("Value/unit", "القيمة/وحدة")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLots.map((lot) => {
                    const avail = quantityRequestable(lot);
                    const days = daysToExpiry(lot.expiry_date);
                    const open = requestLotId === lot.$id;
                    return (
                      <TableRow key={lot.$id}>
                        <TableCell>
                          <div className="font-medium">{lot.item_desc}</div>
                          <div className="text-xs text-muted-foreground">
                            {lot.item_code} · {lot.org_code}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{lot.lot_no}</TableCell>
                        <TableCell>
                          <div>{formatDate(lot.expiry_date)}</div>
                          {days != null && (
                            <div className="text-xs text-muted-foreground">
                              {days}d
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {avail.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(lot.list_price_egp || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {open ? (
                            <div className="ml-auto flex max-w-xs flex-col gap-2 text-left">
                              <Input
                                placeholder={t("Qty", "الكمية")}
                                value={requestQty}
                                onChange={(e) => setRequestQty(e.target.value)}
                              />
                              <Input
                                placeholder={t("Program (optional)", "البرنامج (اختياري)")}
                                value={requestProgram}
                                onChange={(e) => setRequestProgram(e.target.value)}
                              />
                              <Textarea
                                placeholder={t("Justification", "المبرر")}
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
                                  {t("Submit", "إرسال")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRequestLotId(null)}
                                >
                                  {t("Cancel", "إلغاء")}
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
                              {t("Request", "طلب")}
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
                {t("Import donor CSV", "استيراد CSV للمتبرع")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  "Expected headers: Org Code, Item Code, Item Desc, Lot No., Locator, Quantity Accept, Price List, Exp Date, Po Category",
                  "العناوين المتوقعة: Org Code, Item Code, Item Desc, Lot No., Locator, Quantity Accept, Price List, Exp Date, Po Category",
                )}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("CSV file", "ملف CSV")}</Label>
                  <Input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void onFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("Listing title", "عنوان القائمة")}</Label>
                  <Input
                    value={listingTitle}
                    onChange={(e) => setListingTitle(e.target.value)}
                    placeholder={t(
                      "Near-expiry donation – Dec 2026",
                      "تبرع قرب انتهاء الصلاحية – ديسمبر 2026",
                    )}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishOnImport}
                  onChange={(e) => setPublishOnImport(e.target.checked)}
                />
                {t(
                  "Publish immediately (visible to network NGOs)",
                  "انشر فورًا (ظاهر لجمعيات الشبكة)",
                )}
              </label>

              {csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {csvErrors.length}{" "}
                    {t(
                      "row(s) skipped. First error: row",
                      "صف(وف) تم تخطيها. أول خطأ: صف",
                    )}{" "}
                    {csvErrors[0].row_index} — {csvErrors[0].error}
                  </AlertDescription>
                </Alert>
              )}

              {csvPreview.length > 0 && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {csvFilename} · {csvPreview.length}{" "}
                    {t("valid rows", "صفوف صالحة")}
                  </div>
                  <div className="max-h-64 overflow-auto rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Item", "الصنف")}</TableHead>
                          <TableHead>{t("Lot", "التشغيلة")}</TableHead>
                          <TableHead>{t("Expiry", "الصلاحية")}</TableHead>
                          <TableHead className="text-right">
                            {t("Qty", "الكمية")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.slice(0, 40).map((row, i) => (
                          <TableRow key={`${row.item_code}-${row.lot_no}-${i}`}>
                            <TableCell>{row.item_desc}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {row.lot_no}
                            </TableCell>
                            <TableCell>{row.expiry_date}</TableCell>
                            <TableCell className="text-right">
                              {row.quantity_accept.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={() => void runImport()} disabled={importing}>
                    {importing
                      ? t("Importing…", "جاري الاستيراد…")
                      : t(
                          `Import ${csvPreview.length} lots`,
                          `استيراد ${csvPreview.length} دفعة`,
                        )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("Incoming requests (as donor)", "الطلبات الواردة (كمُتبرّع)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {donorRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "No requests against your org’s lots yet.",
                    "لا توجد طلبات على دفعات جهتك بعد.",
                  )}
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
                          {t("Qty requested", "الكمية المطلوبة")}:{" "}
                          {req.quantity_requested.toLocaleString()} ·{" "}
                          {t("Status", "الحالة")}: {req.status}
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
                            {t("Approve", "موافقة")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void onReview(req.$id, false)}
                          >
                            <X className="mr-1 h-4 w-4" />
                            {t("Reject", "رفض")}
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
              <CardTitle>
                {t("My donation requests", "طلبات التبرع الخاصة بي")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "You have not requested any donation lots yet.",
                    "لم تطلب أي دفعات تبرع بعد.",
                  )}
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
                            {t("Requested", "مطلوب")}{" "}
                            {req.quantity_requested.toLocaleString()}
                            {req.quantity_approved
                              ? ` · ${t("approved", "موافق عليه")} ${req.quantity_approved.toLocaleString()}`
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
