import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Globe2,
  Loader2,
  Sparkles,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  autoEnrichIfNeeded,
  buildWorldSourceLinks,
  suggestExternalEnrichment,
  worldSourceLabel,
  type AggregatorHit,
  type LocalMedicineLike,
} from "@/lib/medicine-aggregator";
import { useLanguage } from "@/lib/i18n";

type Props = {
  product: LocalMedicineLike;
};

function kindLabel(kind: string, ar: boolean): string {
  const map: Record<string, [string, string]> = {
    who_eml: ["WHO EML", "قائمة الأدوية الأساسية"],
    openfda: ["OpenFDA", "OpenFDA"],
    rxnorm: ["RxNorm", "RxNorm"],
    pubchem: ["PubChem", "PubChem"],
    drugeye: ["DrugEye", "DrugEye"],
    local: ["Local", "محلي"],
  };
  const pair = map[kind] || [kind, kind];
  return ar ? pair[1] : pair[0];
}

export function MedicineWebEnrichmentPanel({ product }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<AggregatorHit[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [patch, setPatch] = useState<Record<string, string | boolean>>({});
  const [provenance, setProvenance] = useState<Record<string, string>>({});
  const [whoEssential, setWhoEssential] = useState(false);
  const ran = useRef(false);

  const query = useMemo(() => {
    return (
      product.scientific_name ||
      product.name_en ||
      product.name_ar ||
      ""
    ).trim();
  }, [product]);

  const links = useMemo(() => buildWorldSourceLinks(query || "medicine"), [query]);

  useEffect(() => {
    if (ran.current || !query) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const auto = await autoEnrichIfNeeded(product);
        if (cancelled) return;
        setPatch(auto.patch);
        setProvenance(auto.provenance);
        setWhoEssential(Boolean(auto.merged.who_essential));
        const sug = await suggestExternalEnrichment(query);
        if (cancelled) return;
        setHits(sug.hits);
        setErrors(sug.errors);
      } catch (e) {
        if (!cancelled) {
          setErrors([e instanceof Error ? e.message : String(e)]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product, query]);

  const whoHits = hits.filter((h) => h.source === "who_eml");
  const otherHits = hits.filter((h) => h.source !== "who_eml");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {ar ? "إثراء من مصادر عالمية" : "Federated enrichment"}
          {whoEssential && (
            <Badge className="bg-emerald-100 text-emerald-900">
              <ShieldCheck className="mr-1 h-3 w-3" />
              WHO
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {ar
            ? "البيانات المحلية المصرية لها الأولوية. المصادر الخارجية تملأ الحقول الناقصة فقط مع إثبات المصدر."
            : "Egyptian local data wins. External sources only fill missing fields with provenance."}
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {ar ? "جاري البحث…" : "Searching…"}
          </div>
        )}

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{errors.join("; ")}</AlertDescription>
          </Alert>
        )}

        {Object.keys(patch).length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium">
              {ar ? "اقتراحات للحقول الناقصة" : "Suggested fills for missing fields"}
            </p>
            <ul className="space-y-1 text-xs">
              {Object.entries(patch).map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono text-muted-foreground">{k}</span>: {String(v)}
                  {provenance[k] && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {provenance[k]}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {whoHits.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-800">
              <BookOpen className="h-3 w-3" />
              {ar ? "قائمة الأدوية الأساسية" : "WHO Essential Medicines"}
            </p>
            <div className="space-y-1">
              {whoHits.map((h, i) => (
                <div
                  key={"who-" + i}
                  className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs"
                >
                  <span>{h.name_en}</span>
                  {h.source_url && (
                    <a
                      href={h.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {otherHits.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium">
              {ar ? "مصادر أخرى" : "Other sources"}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">{ar ? "المصدر" : "Source"}</th>
                    <th className="py-1 pr-2">{ar ? "الاسم" : "Name"}</th>
                    <th className="py-1">{ar ? "رابط" : "Link"}</th>
                  </tr>
                </thead>
                <tbody>
                  {otherHits.slice(0, 8).map((h, i) => (
                    <tr key={h.source + i} className="border-b border-muted/50">
                      <td className="py-1 pr-2">
                        <Badge variant="outline" className="text-[10px]">
                          {kindLabel(h.source, ar)}
                        </Badge>
                      </td>
                      <td className="py-1 pr-2">{h.name_en || h.scientific_name || "—"}</td>
                      <td className="py-1">
                        {h.source_url && (
                          <a
                            href={h.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-700 underline"
                          >
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
          {links.map((l) => (
            <a
              key={l.source}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className={
                l.source === "who_eml"
                  ? "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-900"
                  : "rounded-full border px-2 py-0.5 text-[10px] hover:bg-muted"
              }
            >
              {worldSourceLabel(l, ar ? "ar" : "en")}
            </a>
          ))}
        </div>

        {!loading && hits.length === 0 && errors.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {ar
              ? "لا اقتراحات إضافية — البيانات المحلية مكتملة أو لا توجد نتائج."
              : "No extra suggestions — local fields look complete or no hits."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
