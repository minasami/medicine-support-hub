import { useState } from "react";
import { Link } from "wouter";
import { ScanLine, ExternalLink, Package } from "lucide-react";
import {
  BarcodeScanner,
  BarcodeLookupBusy,
} from "@/components/barcode-scanner";
import {
  lookupBarcode,
  medicineUrlForHit,
  type BarcodeHit,
} from "@/lib/barcode-lookup";
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

  async function handleDetected(raw: string) {
    setBusy(true);
    setError(null);
    setCode(raw);
    setHits(null);
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
            "Use your phone camera to identify a pack and open its encyclopedia entry. Works best on Chrome Android (HTTPS).",
            "استخدم كاميرا الهاتف للتعرّف على العبوة وفتح صفحة الموسوعة. الأفضل على Chrome أندرويد (HTTPS).",
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
