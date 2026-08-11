import { FormEvent, useState } from "react";
import { ImageIcon, Loader2, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";
import { resolvePackshotFromBarcode } from "@/lib/packshot-from-barcode";
import { fetchMedicinesPage } from "@/lib/medicines-appwrite-page";
import { writeEnrichmentToAppwrite } from "@/lib/medicine-enrichment-writeback";
import { usePatientAuth } from "@/lib/patient-auth";

type Row = {
  $id?: string;
  canonical_id: number;
  name_en: string | null;
  barcode: string | null;
  image_url: string | null;
  candidate?: string | null;
  status?: string;
};

/**
 * Admin helper: find products with barcode but no image, preview OPF packshots,
 * accept fill-only write-back.
 */
export default function AdminPackshotQueuePage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const { session } = usePatientAuth();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const scan = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const page = await fetchMedicinesPage({
        limit: 40,
        filters: { query: query.trim() || undefined },
      });
      const base: Row[] = (page.items || [])
        .filter((m) => m.barcode && !(m.image_url || "").trim())
        .map((m) => ({
          $id: m.$id,
          canonical_id: m.canonical_id,
          name_en: m.name_en,
          barcode: m.barcode || null,
          image_url: m.image_url || null,
        }));

      const enriched: Row[] = [];
      for (const row of base.slice(0, 15)) {
        const pack = await resolvePackshotFromBarcode(row.barcode);
        enriched.push({
          ...row,
          candidate: pack?.image_url || null,
          status: pack ? "candidate" : "no_opf",
        });
      }
      setRows(enriched);
      setMessage(
        t(
          `Scanned ${base.length} barcode rows without images; showing ${enriched.length} with OPF lookup.`,
          `تم فحص ${base.length} صف باركود بلا صورة؛ عرض ${enriched.length} مع بحث Open Facts.`,
        ),
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const accept = async (row: Row) => {
    if (!row.candidate) return;
    const result = await writeEnrichmentToAppwrite({
      product: {
        id: row.$id,
        canonical_id: row.canonical_id,
        name_en: row.name_en,
        image_url: row.image_url,
        barcode: row.barcode,
      },
      patch: { image_url: row.candidate },
      provenance: { image_url: "openproductsfacts:packshot_review" },
      actorEmail: session?.user?.email,
      actorRole: "PLATFORM_ADMIN",
      forceAttempt: true,
    });
    setRows((prev) =>
      prev.map((r) =>
        r.canonical_id === row.canonical_id
          ? {
              ...r,
              status:
                result.mode === "appwrite" && result.ok
                  ? "accepted_cloud"
                  : result.ok
                    ? "accepted_session"
                    : `error:${result.error || "failed"}`,
              image_url: result.ok ? row.candidate! : r.image_url,
            }
          : r,
      ),
    );
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-4 px-4 py-8" dir={ar ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          {t("Packshot review queue", "قائمة مراجعة صور العبوات")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Products with barcode but no image. Preview Open Product Facts candidates, then accept fill-only.",
            "منتجات لها باركود بلا صورة. معاينة مرشحي Open Product Facts ثم قبول التعبئة فقط.",
          )}
        </p>
      </div>

      <form onSubmit={scan} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Optional name filter…", "فلتر اسم اختياري…")}
          className="rounded-xl"
        />
        <Button type="submit" disabled={loading} className="rounded-xl gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t("Scan", "فحص")}
        </Button>
      </form>

      {message && (
        <Alert>
          <AlertDescription className="text-sm">{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.$id || row.canonical_id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                {row.name_en || `#${row.canonical_id}`}
                <Badge variant="outline" className="text-[10px]">
                  {row.barcode}
                </Badge>
                {row.status && (
                  <Badge className="text-[10px]" variant="secondary">
                    {row.status}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-start gap-4">
              {row.candidate ? (
                <img
                  src={row.candidate}
                  alt=""
                  className="h-24 w-24 rounded border object-contain bg-white"
                />
              ) : (
                <div className="h-24 w-24 rounded border flex items-center justify-center text-xs text-muted-foreground">
                  {t("No OPF hit", "لا نتيجة")}
                </div>
              )}
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  canonical_id: {row.canonical_id}
                </p>
                {row.candidate && (
                  <Button size="sm" className="rounded-xl" onClick={() => void accept(row)}>
                    {t("Accept packshot", "قبول صورة العبوة")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
