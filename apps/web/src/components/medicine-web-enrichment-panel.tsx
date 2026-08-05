import { useMemo, useState } from "react";
import { ExternalLink, Globe2, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildWorldSourceLinks,
  fillMissingFromMerged,
  localNeedsEnrichment,
  suggestExternalEnrichment,
  type LocalMedicineLike,
  type MergedEnrichment,
} from "@/lib/medicine-aggregator";
import { useLanguage } from "@/lib/i18n";

type Props = {
  product: LocalMedicineLike & { name_en?: string | null };
  onApplyPreview?: (patch: Partial<LocalMedicineLike>, provenance: Record<string, string>) => void;
};

export function MedicineWebEnrichmentPanel({ product, onApplyPreview }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const query = (product.name_en || product.name_ar || product.scientific_name || "").trim();
  const missing = useMemo(() => localNeedsEnrichment(product), [product]);
  const worldLinks = useMemo(
    () => buildWorldSourceLinks(query, product.scientific_name),
    [query, product.scientific_name],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState<MergedEnrichment | null>(null);
  const [sourcesUsed, setSourcesUsed] = useState<string[]>([]);

  const run = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const { merged: m, errors, hits } = await suggestExternalEnrichment(query);
      setMerged(m);
      setSourcesUsed([...new Set(hits.map((h) => String(h.source)))]);
      if (!m && errors.length) setError(errors.join("; "));
      if (!m)
        setError(
          ar ? "لم يتم العثور على بيانات إضافية" : "No additional data found from open sources",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const { patch, provenance } = useMemo(
    () => fillMissingFromMerged(product, merged),
    [product, merged],
  );
  const patchKeys = Object.keys(patch);

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50/90 to-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-sky-950">
          <Globe2 className="h-5 w-5 text-sky-700" />
          {ar ? "موسوعة مترابطة — ابحث في مصادر العالم" : "Connected encyclopedia — search the world"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "البيانات المحلية أولاً. عند النقص نستعلم OpenFDA وRxNorm ومصادر أخرى مع إظهار المصدر."
            : "Local Egypt data first. When fields are missing we query OpenFDA, RxNorm, and other open sources — always with provenance."}
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
            {ar ? "أكمل البيانات من الإنترنت" : "Complete data from the web"}
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
                  <strong>INN:</strong> {merged.scientific_name.value}{" "}
                  <span className="text-muted-foreground">({merged.scientific_name.source})</span>
                </li>
              )}
              {merged.drug_class && (
                <li>
                  <strong>Class:</strong> {merged.drug_class.value}{" "}
                  <span className="text-muted-foreground">({merged.drug_class.source})</span>
                </li>
              )}
              {merged.manufacturer && (
                <li>
                  <strong>Mfr:</strong> {merged.manufacturer.value}{" "}
                  <span className="text-muted-foreground">({merged.manufacturer.source})</span>
                </li>
              )}
              {merged.indications_summary && (
                <li className="line-clamp-3">
                  <strong>Label:</strong> {merged.indications_summary.value}
                </li>
              )}
              {merged.price_egp && (
                <li>
                  <strong>EGP:</strong> {merged.price_egp.value}{" "}
                  <span className="text-muted-foreground">({merged.price_egp.source})</span>
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
                {ar ? "معاينة الدمج (الحقول الفارغة فقط)" : "Preview merge (empty fields only)"}
              </Button>
            )}
            {patchKeys.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? "لا توجد حقول فارغة لملئها تلقائياً — استخدم الروابط أدناه للمراجعة."
                  : "No empty fields to auto-fill — use links below for full labels."}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-slate-700">
            {ar ? "موسوعات ومحركات أخرى" : "Other encyclopedias & engines"}
          </p>
          <div className="flex flex-wrap gap-2">
            {worldLinks.map((l) => (
              <a
                key={l.source}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-50"
              >
                {l.label}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
