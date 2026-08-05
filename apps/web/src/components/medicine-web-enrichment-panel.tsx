import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Globe2, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  autoEnrichIfNeeded,
  buildWorldSourceLinks,
  fillMissingFromMerged,
  localNeedsEnrichment,
  suggestExternalEnrichment,
  worldSourceLabel,
  type LocalMedicineLike,
  type MergedEnrichment,
  type WorldSourceLink,
} from "@/lib/medicine-aggregator";
import { useLanguage } from "@/lib/i18n";

type Props = {
  product: LocalMedicineLike & { name_en?: string | null };
  auto?: boolean;
  onApplyPreview?: (patch: Partial<LocalMedicineLike>, provenance: Record<string, string>) => void;
  onAutoPatch?: (patch: Partial<LocalMedicineLike>, provenance: Record<string, string>) => void;
};

export function MedicineWebEnrichmentPanel({
  product,
  auto = true,
  onApplyPreview,
  onAutoPatch,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const locale = ar ? "ar" : "en";
  const query = (product.name_en || product.name_ar || product.scientific_name || "").trim();
  const missing = useMemo(() => localNeedsEnrichment(product), [product]);
  const worldLinks = useMemo(
    () =>
      buildWorldSourceLinks(query, product.scientific_name, {
        nameAr: product.name_ar,
        locale,
      }),
    [query, product.scientific_name, product.name_ar, locale],
  );

  const [loading, setLoading] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState<MergedEnrichment | null>(null);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);
  const [liveProduct, setLiveProduct] = useState(product);
  const autoKey = useRef<string>("");

  useEffect(() => {
    setLiveProduct(product);
  }, [product]);

  useEffect(() => {
    if (!auto || !query) return;
    const critical = missing.filter((m) => m !== "image_url");
    if (!critical.length) return;
    const key = `${query}|${critical.join(",")}`;
    if (autoKey.current === key) return;
    autoKey.current = key;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await autoEnrichIfNeeded(product, { force: false });
        if (cancelled) return;
        setAutoRan(result.ran);
        setMerged(result.merged);
        if (result.merged) setSourcesUsed(result.merged.sources_used);
        if (result.patch && Object.keys(result.patch).length) {
          setLiveProduct((prev) => ({ ...prev, ...result.patch }));
          onAutoPatch?.(result.patch, result.provenance);
        }
        if (result.errors.length && !result.merged) setError(result.errors.join("; "));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auto, query, product.name_en, product.name_ar, product.scientific_name]);

  const run = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const { merged: m, errors, hits } = await suggestExternalEnrichment(query);
      setMerged(m);
      setSourcesUsed([...new Set(hits.map((h) => String(h.source)))]);
      setAutoRan(false);
      if (!m && errors.length) setError(errors.join("; "));
      if (!m) {
        setError(ar ? "لم يتم العثور على بيانات إضافية" : "No additional data found from open sources");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const { patch, provenance } = useMemo(
    () => fillMissingFromMerged(liveProduct, merged),
    [liveProduct, merged],
  );
  const patchKeys = Object.keys(patch);

  const byRegion = (region: WorldSourceLink["region"]) =>
    worldLinks.filter((l) => l.region === region);

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50/90 to-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-sky-950">
          <Globe2 className="h-5 w-5 text-sky-700" />
          {ar ? "موسوعة مترابطة — ابحث في مصادر العالم" : "Connected encyclopedia — search the world"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "البيانات المحلية أولاً. عند النقص نستعلم تلقائياً OpenFDA وRxNorm ونوفر روابط عربية وعالمية مع إظهار المصدر."
            : "Local Egypt data first. Missing fields trigger automatic OpenFDA/RxNorm lookup, plus Arabic and global encyclopedia links — always with provenance."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">
              {ar ? "حقول ناقصة:" : "Missing fields:"}
            </span>
            {missing.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px]">
                {m}
              </Badge>
            ))}
            {autoRan && (
              <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100 text-[10px]">
                {ar ? "إثراء تلقائي" : "auto-enriched"}
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-xs text-emerald-700">
            {ar ? "السجل المحلي مكتمل للحقول الأساسية." : "Local record looks complete for core fields."}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-sky-700 hover:bg-sky-800"
            disabled={loading || !query}
            onClick={() => void run()}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-4 w-4" />
            )}
            {ar ? "حدّث / أكمل من الإنترنت" : "Refresh from the web"}
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={`/world-search?q=${encodeURIComponent(query)}`}>
              {ar ? "البحث العالمي" : "World search"}
            </a>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {merged && (
          <div className="space-y-2 rounded-lg border bg-white p-3 text-sm">
            <div className="flex flex-wrap gap-1">
              {sourcesUsed.map((s) => (
                <Badge key={s} className="bg-sky-100 text-sky-900 hover:bg-sky-100">
                  {s}
                </Badge>
              ))}
              <Badge variant="secondary">conf {(merged.top_confidence * 100).toFixed(0)}%</Badge>
            </div>
            <ul className="space-y-1 text-xs text-slate-700">
              {merged.scientific_name && (
                <li>
                  <strong>{ar ? "الاسم العلمي:" : "INN:"}</strong> {merged.scientific_name.value}{" "}
                  <span className="text-muted-foreground">({merged.scientific_name.source})</span>
                </li>
              )}
              {merged.drug_class && (
                <li>
                  <strong>{ar ? "التصنيف:" : "Class:"}</strong> {merged.drug_class.value}{" "}
                  <span className="text-muted-foreground">({merged.drug_class.source})</span>
                </li>
              )}
              {merged.manufacturer && (
                <li>
                  <strong>{ar ? "الشركة:" : "Mfr:"}</strong> {merged.manufacturer.value}{" "}
                  <span className="text-muted-foreground">({merged.manufacturer.source})</span>
                </li>
              )}
              {merged.indications_summary && (
                <li className="line-clamp-3">
                  <strong>{ar ? "النشرة:" : "Label:"}</strong> {merged.indications_summary.value}
                </li>
              )}
            </ul>
            {patchKeys.length > 0 && onApplyPreview && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onApplyPreview(patch, provenance)}
              >
                {ar ? "معاينة الدمج" : "Preview merge"}
              </Button>
            )}
          </div>
        )}

        {(
          [
            ["egypt", ar ? "مصر" : "Egypt"],
            ["arabic", ar ? "موسوعات عربية" : "Arabic encyclopedias"],
            ["global", ar ? "عالمي" : "Global"],
          ] as const
        ).map(([region, title]) => {
          const links = byRegion(region);
          if (!links.length) return null;
          return (
            <div key={region}>
              <p className="mb-2 text-xs font-medium text-slate-700">{title}</p>
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <a
                    key={l.source}
                    href={l.url}
                    target={l.url.startsWith("/") ? undefined : "_blank"}
                    rel={l.url.startsWith("/") ? undefined : "noopener noreferrer"}
                    className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-50"
                  >
                    {worldSourceLabel(l, locale)}
                    {!l.url.startsWith("/") && <ExternalLink className="h-3 w-3 opacity-60" />}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
