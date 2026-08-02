import { useState } from "react";
import { Link } from "wouter";
import { ScanLine, ExternalLink, Package, Sparkles, Loader2 } from "lucide-react";
import {
  BarcodeScanner,
  BarcodeLookupBusy,
} from "@/components/barcode-scanner";
import {
  lookupBarcode,
  medicineUrlForHit,
  type BarcodeHit,
} from "@/lib/barcode-lookup";
import {
  gemmaProductBrief,
  isGemmaConfigured,
} from "@/lib/gemma-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function BarcodeScanPage() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [hits, setHits] = useState<BarcodeHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gemmaText, setGemmaText] = useState<string | null>(null);
  const [gemmaBusy, setGemmaBusy] = useState(false);
  const [gemmaError, setGemmaError] = useState<string | null>(null);
  const gemmaOn = isGemmaConfigured();

  async function handleDetected(raw: string) {
    setBusy(true);
    setError(null);
    setCode(raw);
    setHits(null);
    setGemmaText(null);
    setGemmaError(null);
    try {
      const { barcode, hits: found } = await lookupBarcode(raw);
      setCode(barcode);
      setHits(found);
      if (!found.length) {
        setError(
          t(
            "No encyclopedia product matched this barcode yet. Prices enrichment may still be filling barcodes — try name search.",
            "لا يوجد منتج مطابق لهذا الباركود في الموسوعة بعد. قد تُستكمل الباركودات لاحقًا — جرّب البحث بالاسم.",
          ),
        );
      }
    } catch (e: any) {
      setError(e?.message || "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function runGemma(hit: BarcodeHit) {
    setGemmaBusy(true);
    setGemmaError(null);
    try {
      const text = await gemmaProductBrief({
        name_en: hit.name_en,
        name_ar: hit.name_ar,
        manufacturer: hit.manufacturer,
        barcode: hit.barcode || code || undefined,
        product_type: hit.product_type,
        price_egp: hit.current_price_egp,
      });
      setGemmaText(text);
    } catch (e: any) {
      setGemmaError(e?.message || "Gemma request failed");
    } finally {
      setGemmaBusy(false);
    }
  }

  return (
    <main className="container mx-auto max-w-lg px-4 py-8 space-y-6">
      <div className="space-y-2 text-center md:text-left">
        <Badge className="bg-teal-700 text-white">
          {t("Mobile · Encyclopedia", "الجوال · الموسوعة")}
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center justify-center md:justify-start gap-2">
          <ScanLine className="h-7 w-7 text-teal-700" />
          {t("Scan medicine barcode", "مسح باركود الدواء")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Use your phone camera to identify a pack and open its encyclopedia entry. Native app uses ML Kit (fast EAN/UPC). Optional Gemma 4 brief when configured.",
            "استخدم كاميرا الهاتف للتعرّف على العبوة. التطبيق الأصلي يستخدم ML Kit. ملخص Gemma 4 اختياري عند تفعيل المفتاح.",
          )}
        </p>
      </div>

      <BarcodeScanner onDetected={(c) => void handleDetected(c)} />

      {busy && <BarcodeLookupBusy />}

      {code && !busy && (
        <p className="text-center text-xs text-muted-foreground font-mono">
          {t("Scanned", "تم المسح")}: {code}
        </p>
      )}

      {error && (
        <Card className="border-amber-500/40">
          <CardContent className="p-4 text-sm space-y-3">
            <p>{error}</p>
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link href="/medicines">
                {t("Search by name", "البحث بالاسم")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hits && hits.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t("Matches", "النتائج")} ({hits.length})
          </h2>
          {hits.map((hit) => (
            <Card key={`${hit.source}-${hit.canonical_id}`} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-start gap-2">
                  <Package className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                  <span>{hit.name_en}</span>
                </CardTitle>
                {hit.name_ar && (
                  <p className="text-sm text-muted-foreground text-right" dir="rtl">
                    {hit.name_ar}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-2">
                  {hit.manufacturer && (
                    <Badge variant="outline">{hit.manufacturer}</Badge>
                  )}
                  {hit.product_type && (
                    <Badge variant="secondary">{hit.product_type}</Badge>
                  )}
                  <Badge variant="outline">{hit.source}</Badge>
                  {hit.current_price_egp != null && (
                    <Badge className="bg-emerald-600 text-white">
                      {hit.current_price_egp} EGP
                    </Badge>
                  )}
                </div>
                <Button asChild className="w-full rounded-xl bg-teal-700 hover:bg-teal-800">
                  <Link href={medicineUrlForHit(hit)}>
                    {t("Open monograph", "فتح المونوغراف")}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {gemmaOn && (
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(gemmaText || gemmaError) && (
        <Card className="border-violet-500/30 bg-violet-50/40 dark:bg-violet-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              {t("Gemma 4 · educational brief", "Gemma 4 · ملخص توعوي")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {gemmaError && <p className="text-destructive">{gemmaError}</p>}
            {gemmaText && <p className="leading-relaxed whitespace-pre-wrap">{gemmaText}</p>}
            <p className="text-[10px] text-muted-foreground">
              {t(
                "Not medical advice. Confirm with the package leaflet and a licensed pharmacist.",
                "ليس استشارة طبية. راجع النشرة واسأل صيدليًا مرخصًا.",
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
