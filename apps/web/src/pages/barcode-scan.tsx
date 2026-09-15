import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ScanLine, Sparkles, Loader2, Keyboard } from "lucide-react";
import { BarcodeScanner, BarcodeLookupBusy } from "@/components/barcode-scanner";
import { ProductActionCard } from "@/components/product-action-card";
import { lookupBarcode, type BarcodeHit } from "@/lib/barcode-lookup";
import { gemmaProductBrief, isGemmaConfigured } from "@/lib/gemma-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { BarcodeWikiModal } from "@/components/barcode-wiki-modal";
import { ScanModeTabs, type ScanMode } from "@/components/scan/scan-mode-tabs";
import { DocumentCapture } from "@/components/scan/document-capture";
import { claimPacketText, parseInvoiceText, type InvoiceDraft } from "@/lib/parse-invoice";
import { account, functions, storage } from "@/lib/appwrite";
import { ExecutionMethod, ID } from "appwrite";
import { OcrAiDisclaimer } from "@/components/ocr-ai-disclaimer";
import { recognizeTextFromFile } from "@/lib/native-mlkit-text";

const BUCKET = import.meta.env.VITE_APPWRITE_RX_BUCKET || "prescription-images";

function readMode(): ScanMode {
  if (typeof window === "undefined") return "pack";
  const q = new URLSearchParams(window.location.search).get("mode");
  if (q === "rx" || q === "prescription") return "rx";
  if (q === "invoice" || q === "claim") return "invoice";
  const saved = window.localStorage.getItem("msh.scanMode");
  if (saved === "rx" || saved === "invoice" || saved === "pack") return saved;
  return "pack";
}

export default function BarcodeScanPage() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<ScanMode>(readMode);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [hits, setHits] = useState<BarcodeHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gemmaText, setGemmaText] = useState<string | null>(null);
  const [gemmaBusy, setGemmaBusy] = useState(false);
  const [gemmaError, setGemmaError] = useState<string | null>(null);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiMode, setWikiMode] = useState<"choose" | "link" | "create">("choose");
  const [wikiNote, setWikiNote] = useState<string | null>(null);
  const [rxBusy, setRxBusy] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);
  const [invBusy, setInvBusy] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [invText, setInvText] = useState("");
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const gemmaOn = isGemmaConfigured();

  useEffect(() => {
    window.localStorage.setItem("msh.scanMode", mode);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState(null, "", url.pathname + url.search);
  }, [mode]);

  async function handleDetected(raw: string) {
    setBusy(true);
    setError(null);
    setCode(raw);
    setHits(null);
    setGemmaText(null);
    setGemmaError(null);
    try {
      const { barcode, hits: found, catalogId } = await lookupBarcode(raw);
      setCode(barcode);
      if (catalogId) { navigate(`/catalog/${catalogId}`); return; }
      setHits(found);
      if (!found.length) {
        setWikiNote(null);
        setError(t("No encyclopedia product matched this barcode or QR yet.", "لا يوجد منتج مطابق لهذا الباركود بعد."));
        setWikiMode("choose");
        setWikiOpen(true);
      }
    } catch (e: any) {
      setError(e?.message || "Lookup failed");
    } finally { setBusy(false); }
  }

  async function runGemma(hit: BarcodeHit) {
    setGemmaBusy(true);
    setGemmaError(null);
    try {
      setGemmaText(await gemmaProductBrief({ name_en: hit.name_en, name_ar: hit.name_ar, manufacturer: hit.manufacturer, barcode: hit.barcode || code || undefined, product_type: hit.product_type, price_egp: hit.current_price_egp }));
    } catch (e: any) {
      setGemmaError(e?.message || "Gemma request failed");
    } finally { setGemmaBusy(false); }
  }

  async function handleRxFile(file: File) {
    setRxBusy(true);
    setRxError(null);
    try {
      let user;
      try { user = await account.get(); }
      catch { navigate(`/patient-auth?next=${encodeURIComponent("/scan?mode=rx")}`); return; }
      const deviceText = await recognizeTextFromFile(file);
      const uploaded = await storage.createFile(BUCKET, ID.unique(), file);
      const exec = await functions.createExecution("ocr-prescription-parser", JSON.stringify({ imageId: uploaded.$id, user_id: user.$id, text: deviceText || undefined }), false, "/", ExecutionMethod.POST);
      const data = JSON.parse(exec.responseBody || "{}");
      if (data.prescription_id) { navigate(`/prescription/review/${data.prescription_id}`); return; }
      if (!data.success) throw new Error(data.error || "Parse failed");
      navigate("/rx/upload");
    } catch (e) {
      setRxError(e instanceof Error ? e.message : String(e));
    } finally { setRxBusy(false); }
  }

  async function handleInvoiceFile(file: File) {
    setInvBusy(true);
    setInvError(null);
    try {
      let userId = "";
      try { userId = (await account.get()).$id; } catch { /* draft ok */ }
      const deviceText = await recognizeTextFromFile(file);
      let raw = invText || deviceText || "";
      try {
        const uploaded = await storage.createFile(BUCKET, ID.unique(), file);
        const exec = await functions.createExecution("ocr-prescription-parser", JSON.stringify({ imageId: uploaded.$id, user_id: userId || undefined, kind: "invoice", text: invText || deviceText || undefined }), false, "/", ExecutionMethod.POST);
        const data = JSON.parse(exec.responseBody || "{}");
        raw = data.raw_text || data.text || raw || file.name;
      } catch { raw = raw || file.name; }
      const next = parseInvoiceText(raw);
      setDraft(next);
      setInvText(next.raw_text);
    } catch (e) {
      setInvError(e instanceof Error ? e.message : String(e));
    } finally { setInvBusy(false); }
  }

  async function shareClaim() {
    if (!draft) return;
    const text = claimPacketText(draft);
    try { if (navigator.share) { await navigator.share({ title: "TPA claim draft", text }); return; } } catch { /* copy */ }
    await navigator.clipboard?.writeText(text);
    setInvError(t("Claim text copied.", "تم نسخ نص المطالبة."));
  }

  const steps = language === "ar"
    ? ["ابحث عن الباركود على العلبة.", "من الهاتف ابدأ الكاميرا.", "البحث يفتح بطاقة المنتج."]
    : ["Find the barcode or QR on the medicine box.", "On a phone, start the camera.", "Look up opens the product card."];

  return (
    <main className="page-shell mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:max-w-4xl">
      <div className="space-y-2 text-center md:text-start">
        <Badge className="bg-teal-700 text-white">
          {t("Scan · Pack · Rx · Claim", "مسح · عبوة · روشتة · مطالبة")}
        </Badge>
        <h1 className="flex items-center justify-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl md:justify-start">
          <ScanLine className="h-7 w-7 shrink-0 text-teal-700" />
          {mode === "rx"
            ? t("Scan a prescription", "مسح روشتة")
            : mode === "invoice"
              ? t("Scan an invoice for a claim", "مسح فاتورة للمطالبة")
              : t("Scan barcode or QR", "مسح باركود أو QR")}
        </h1>
      </div>

      <ScanModeTabs value={mode} onChange={setMode} />

      {mode === "pack" ? (
        <div className="space-y-4">
          <Card className="border-teal-600/20 bg-teal-50/40 dark:bg-teal-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Keyboard className="h-4 w-4 text-teal-700" />
                {t("How to look a pack up", "كيف تبحث عن العبوة")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
                {steps.map((s, i) => (
                  <li key={i}>
                    <span className="text-foreground">{s}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <BarcodeScanner active={mode === "pack"} onDetected={(c) => void handleDetected(c)} />
          {busy ? <BarcodeLookupBusy /> : null}
          {code && !busy ? (
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t("Scanned", "تم المسح")}: {code}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "rx" ? (
        <div className="space-y-4">
          <OcrAiDisclaimer />
          <DocumentCapture
            title={t("Hold the prescription in frame", "ضع الروشتة داخل الإطار")}
            hint={t(
              "On-device ML Kit text first, then server parse.",
              "نص ML Kit على الجهاز أولًا ثم الخادم.",
            )}
            busy={rxBusy}
            onFile={(f) => void handleRxFile(f)}
          />
          {rxError ? <p className="text-sm text-red-600">{rxError}</p> : null}
          <Button asChild variant="ghost" className="w-full text-xs">
            <Link href="/prescription-ocr">
              {t("Paste text instead", "الصق النص بدلًا من ذلك")}
            </Link>
          </Button>
        </div>
      ) : null}

      {mode === "invoice" ? (
        <div className="space-y-4">
          <OcrAiDisclaimer />
          <DocumentCapture
            title={t("Photograph the invoice or receipt", "صوّر الفاتورة أو الإيصال")}
            hint={t(
              "On-device text plus editable claim draft. Nothing is sent to an insurer automatically.",
              "نص على الجهاز ثم مسودة قابلة للتحرير.",
            )}
            busy={invBusy}
            onFile={(f) => void handleInvoiceFile(f)}
          />
          <Textarea
            rows={5}
            value={invText}
            onChange={(e) => setInvText(e.target.value)}
            placeholder={t("Optional: paste invoice text", "اختياري: الصق نص الفاتورة")}
            className="rounded-xl font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            disabled={invBusy || !invText.trim()}
            onClick={() => setDraft(parseInvoiceText(invText))}
          >
            {t("Parse pasted text", "تحليل النص الملصق")}
          </Button>
          {invError ? <p className="text-sm text-red-600">{invError}</p> : null}
          {draft ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("Claim draft", "مسودة المطالبة")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(
                  [
                    ["provider", t("Provider / pharmacy", "الجهة / الصيدلية")],
                    ["invoice_no", t("Invoice no.", "رقم الفاتورة")],
                    ["date", t("Date", "التاريخ")],
                    ["patient", t("Patient name", "اسم المريض")],
                    ["tpa", t("TPA / insurer", "شركة التأمين")],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="grid gap-1 text-xs">
                    {label}
                    <Input
                      value={String(draft[key] || "")}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="grid gap-1 text-xs">
                  {t("Total", "الإجمالي")}
                  <Input
                    type="number"
                    value={draft.total ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        total: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                </label>
                <Button className="min-h-11 rounded-xl bg-teal-700" onClick={() => void shareClaim()}>
                  {t("Share claim draft", "مشاركة مسودة المطالبة")}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {error && mode === "pack" ? (
        <Card className="border-amber-500/40">
          <CardContent className="space-y-3 p-4 text-sm">
            <p>{error}</p>
            <div className="grid gap-2">
              <Button
                className="w-full rounded-xl"
                onClick={() => {
                  setWikiMode("link");
                  setWikiOpen(true);
                }}
              >
                {t("Add to existing drug", "إضافة إلى دواء موجود")}
              </Button>
              <Button
                variant="secondary"
                className="w-full rounded-xl"
                onClick={() => {
                  setWikiMode("create");
                  setWikiOpen(true);
                }}
              >
                {t("Create new product", "إنشاء منتج جديد")}
              </Button>
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href="/medicines">{t("Search by name", "البحث بالاسم")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <BarcodeWikiModal
        open={wikiOpen}
        barcode={code || ""}
        initialMode={wikiMode}
        onOpenChange={setWikiOpen}
        onSubmitted={(info) => {
          setWikiNote(String(info.status));
          setError(t("Contribution received.", "تم استلام المساهمة."));
        }}
      />

      {hits && hits.length > 0 && mode === "pack" ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t("Matches", "النتائج")} ({hits.length})
          </h2>
          {hits.map((hit) => (
            <div key={`${hit.source}-${hit.canonical_id}-${hit.name_en}`} className="space-y-2">
              <ProductActionCard
                product={{
                  name_en: hit.name_en,
                  name_ar: hit.name_ar,
                  scientific_name: hit.scientific_name,
                  manufacturer: hit.manufacturer,
                  drug_class: hit.drug_class,
                  current_price_egp: hit.current_price_egp,
                  canonical_id: hit.canonical_id,
                  id_source: hit.source === "appwrite" ? "live_db" : "unknown",
                  barcode: hit.barcode,
                  product_type: hit.product_type,
                }}
              />
              {gemmaOn ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  disabled={gemmaBusy}
                  onClick={() => void runGemma(hit)}
                >
                  {gemmaBusy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4 text-violet-600" />
                  )}
                  {t("Gemma 4 brief", "ملخص Gemma 4")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {(gemmaText || gemmaError) && mode === "pack" ? (
        <Card className="border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-violet-600" />
              {t("Gemma 4 · educational brief", "Gemma 4 · ملخص توعوي")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {gemmaError ? <p className="text-destructive">{gemmaError}</p> : null}
            {gemmaText ? <p className="whitespace-pre-wrap leading-relaxed">{gemmaText}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
