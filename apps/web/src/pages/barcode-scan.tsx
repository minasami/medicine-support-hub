import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ScanLine,
  Sparkles,
  Loader2,
  Keyboard,
  HelpCircle,
} from "lucide-react";
import {
  BarcodeScanner,
  BarcodeLookupBusy,
} from "@/components/barcode-scanner";
import { ProductActionCard } from "@/components/product-action-card";
import {
  lookupBarcode,
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
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
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
      const { barcode, hits: found, catalogId } = await lookupBarcode(raw);
      setCode(barcode);
      if (catalogId) {
        navigate(`/catalog/${catalogId}`);
        return;
      }
      setHits(found);
      if (!found.length) {
        setError(
          t(
            "No encyclopedia product matched this barcode or QR yet. Try name search.",
            "لا يوجد منتج مطابق لهذا الباركود أو QR في الموسوعة بعد. جرّب البحث بالاسم.",
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

  const stepsEn = [
    "Find the barcode or QR on the medicine box.",
    "On a phone, start the camera and hold the pack in the frame. On a laptop, type the digits or paste QR text.",
    "Look up opens the product card: company, generic name, similars, and alternatives.",
  ];
  const stepsAr = [
    "ابحث عن الباركود أو رمز QR على علبة الدواء.",
    "من الهاتف ابدأ الكاميرا. على الكمبيوتر اكتب الأرقام أو الصق نص QR.",
    "البحث يفتح بطاقة المنتج: الشركة والمادة الفعالة والمثائل والبدائل.",
  ];
  const steps = language === "ar" ? stepsAr : stepsEn;

  return (
    <main className="container mx-auto max-w-lg px-4 py-8 space-y-6">
      <div className="space-y-2 text-center md:text-left">
        <Badge className="bg-teal-700 text-white">
          {t("Pharmacy POS · Scan", "نقطة بيع · مسح")}
        </Badge>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center justify-center md:justify-start gap-2">
          <ScanLine className="h-7 w-7 text-teal-700" />
          {t("Scan barcode or QR", "مسح باركود أو QR")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Use this device to identify a pack, open product data, then jump to similars (same INN) or alternatives (same class).",
            "استخدم الجهاز للتعرّف على العبوة ثم الانتقال إلى المثائل أو البدائل.",
          )}
        </p>
      </div>

      <Card className="border-teal-600/20 bg-teal-50/40 dark:bg-teal-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-teal-700" />
            {t("How to look a pack up", "كيف تبحث عن العبوة")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            {steps.map((step, i) => (
              <li key={i} className="leading-relaxed">
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-lg border bg-background/80 px-3 py-2 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              {t("Example", "مثال")}
            </p>
            <p className="font-mono text-foreground">6223001380146</p>
            <p className="text-muted-foreground">
              {t(
                "Paste digits, a QR URL, or a trade name. Then press Look up.",
                "الصق الأرقام أو رابط QR أو اسم المنتج، ثم اضغط بحث.",
              )}
            </p>
          </div>
        </CardContent>
      </Card>

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
            </div>
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
            {gemmaText && (
              <p className="leading-relaxed whitespace-pre-wrap">{gemmaText}</p>
            )}
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
