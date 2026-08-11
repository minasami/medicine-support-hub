import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  globalDrugSearch,
  type GlobalDrugSearchResult,
} from "@/lib/global-drug-search";
import { useLanguage } from "@/lib/i18n";

type Props = {
  query: string;
};

/**
 * When the local Egypt catalog has zero hits, fan out to open world sources
 * so the user never hits a dead end.
 */
export function WorldMissPreview({ query }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GlobalDrugSearchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastQ = useRef("");

  useEffect(() => {
    const q = (query || "").trim();
    if (q.length < 2) {
      setResult(null);
      return;
    }
    if (q === lastQ.current) return;
    lastQ.current = q;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    void (async () => {
      try {
        const r = await globalDrugSearch(q, {
          limit: 6,
          locale: ar ? "ar" : "en",
          signal: ac.signal,
        });
        if (!ac.signal.aborted) setResult(r);
      } catch {
        if (!ac.signal.aborted) setResult(null);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [query, ar]);

  if (!query.trim()) return null;

  const hits = result?.hits?.slice(0, 6) || [];

  return (
    <div className="mt-6 space-y-3 text-left" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-sky-800 dark:text-sky-200">
          <Globe2 className="h-4 w-4" />
          {t("Found on the open web", "نتائج من الشبكة المفتوحة")}
        </h4>
        {result?.who_essential && (
          <Badge className="bg-emerald-100 text-emerald-900">
            <ShieldCheck className="mr-1 h-3 w-3" />
            WHO
          </Badge>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t(
            "Querying OpenFDA, RxNorm, PubChem, WHO…",
            "جاري الاستعلام من OpenFDA و RxNorm و PubChem و WHO…",
          )}
        </div>
      )}

      {!loading && hits.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            "No strong open-source hits yet — try the world search page or another spelling / INN.",
            "لا نتائج قوية من المصادر المفتوحة بعد — جرّب صفحة البحث العالمي أو تهجئة أخرى / الاسم العلمي.",
          )}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {hits.map((h, i) => (
          <Card key={`${h.source}-${h.external_id || i}`} className="border-sky-200/60">
            <CardContent className="space-y-1 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {h.source}
                  {h.rxcui ? ` · ${h.rxcui}` : ""}
                  {h.pubchem_cid ? ` · CID ${h.pubchem_cid}` : ""}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {Math.round((h.confidence || 0) * 100)}%
                </span>
              </div>
              <p className="font-medium text-sm leading-snug">
                {h.name_en || h.scientific_name || "—"}
              </p>
              {h.scientific_name && h.name_en && h.scientific_name !== h.name_en && (
                <p className="text-muted-foreground">{h.scientific_name}</p>
              )}
              {h.drug_class && (
                <p className="text-muted-foreground">{h.drug_class}</p>
              )}
              {h.manufacturer && (
                <p className="text-muted-foreground truncate">{h.manufacturer}</p>
              )}
              {h.source_url && (
                <a
                  href={h.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <a href={`/world-search?q=${encodeURIComponent(query.trim())}`}>
          <Button size="sm" className="gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white">
            <Globe2 className="h-3.5 w-3.5" />
            {t("Full world search", "بحث عالمي كامل")}
          </Button>
        </a>
        {result?.links
          ?.filter((l) => l.source !== "local")
          .slice(0, 6)
          .map((l) => (
            <a
              key={l.source + l.url}
              href={l.url}
              target={l.url.startsWith("/") ? undefined : "_blank"}
              rel={l.url.startsWith("/") ? undefined : "noreferrer"}
              className="rounded-full border px-2.5 py-1 text-[10px] hover:bg-muted"
            >
              {ar ? l.label_ar : l.label_en}
            </a>
          ))}
      </div>

      {result && result.duration_ms > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {t("Queried in", "تم الاستعلام في")} {result.duration_ms}ms ·{" "}
          {(result.sources_with_hits || []).join(", ") || "—"}
        </p>
      )}
    </div>
  );
}
