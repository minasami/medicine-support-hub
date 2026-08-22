import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Globe2, Loader2, Search, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  globalDrugSearch,
  worldSourceLabel,
  type GlobalDrugSearchResult,
} from "@/lib/global-drug-search";
import { encyclopediaSearchUrl } from "@/lib/catalog-links";
import { useLanguage } from "@/lib/i18n";

export default function MedicineWorldSearchPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GlobalDrugSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const didAuto = useRef(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash || "";
      const fromHash = hash.startsWith("#q=")
        ? decodeURIComponent(hash.slice(3))
        : "";
      const initial = (params.get("q") || fromHash || "").trim();
      if (initial) setQ(initial);
    } catch {
      /* ignore */
    }
  }, []);

  const run = async (queryOverride?: string) => {
    const query = (queryOverride ?? q).trim();
    if (!query) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("q", query);
        window.history.replaceState({}, "", url.toString());
      } catch {
        /* ignore */
      }

      const r = await globalDrugSearch(query, {
        limit: 10,
        locale: ar ? "ar" : "en",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setResult(r);
      if (!r.hits.length) {
        const softNet = (r.errors || []).some((e) =>
          /unreachable|failed to fetch|network/i.test(e),
        );
        if (softNet) {
          setError(
            t(
              "No matches in open sources. One world source was temporarily unreachable — try again, or search the Egyptian encyclopedia / use an external engine below.",
              "لا نتائج في المصادر المفتوحة. أحد المصادر العالمية كان غير متاح مؤقتًا — أعد المحاولة، أو ابحث في الموسوعة المصرية / استخدم محركًا خارجيًا أدناه.",
            ),
          );
        } else {
          setError(
            t(
              "No open-source hits for this name — try the INN (scientific name) or another brand spelling, search the Egyptian encyclopedia, or open an external engine below.",
              "لا نتائج من المصادر المفتوحة لهذا الاسم — جرّب الاسم العلمي أو تهجئة أخرى، ابحث في الموسوعة المصرية، أو افتح محركًا خارجيًا أدناه.",
            ),
          );
        }
      } else if (r.errors?.length) {
        setError(null);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (didAuto.current) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    didAuto.current = true;
    void run(trimmed);
  }, [q]);

  const whoHits = result?.hits.filter((h) => h.source === "who_eml") ?? [];
  const otherHits = result?.hits.filter((h) => h.source !== "who_eml") ?? [];
  const links = result?.links ?? [];
  const structureImg = result?.merged?.structure_image_url ?? null;
  const whoNames =
    result?.who_hits?.map((h) => h.name_en).filter(Boolean).join(", ") || "";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <Globe2 className="h-6 w-6 text-sky-600" />
        <h1 className="text-xl font-semibold">
          {t("World drug search", "بحث عالمي عن الدواء")}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "Aggregates OpenFDA, RxNorm, PubChem, and WHO Essential Medicines. Egyptian local data stays primary in the encyclopedia.",
          "يجمع OpenFDA و RxNorm و PubChem وقائمة منظمة الصحة العالمية للأدوية الأساسية. البيانات المحلية المصرية لها الأولوية في الموسوعة.",
        )}
      </p>

      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
          placeholder={t("Brand or INN…", "اسم تجاري أو علمي…")}
          className="flex-1"
          aria-label={t("Search query", "نص البحث")}
        />
        <Button onClick={() => void run()} disabled={loading || !q.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {result && (
        <p className="text-xs text-muted-foreground">
          {t("Queried", "استُعلم")}{" "}
          {result.sources_queried.join(", ") || "—"}
          {result.duration_ms != null && ` · ${result.duration_ms} ms`}
          {result.primary_query && result.primary_query !== result.query && (
            <> · {t("primary", "أساسي")}: {result.primary_query}</>
          )}
        </p>
      )}

      {result?.who_essential && (
        <Alert className="border-emerald-300 bg-emerald-50">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900">
            {t(
              "Likely on the WHO Essential Medicines List",
              "مرشح لقائمة منظمة الصحة العالمية للأدوية الأساسية",
            )}
            {whoNames && (
              <span className="ml-1 text-xs opacity-80">({whoNames})</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert
          variant={
            /unreachable|temporarily|encyclopedia/i.test(error)
              ? "default"
              : "destructive"
          }
          className={
            /unreachable|temporarily|encyclopedia/i.test(error)
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : undefined
          }
        >
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && !!result.errors?.length && !!result.hits.length && (
        <p className="text-xs text-amber-800">
          {t("Source notes", "ملاحظات المصادر")}: {result.errors.join(" · ")}
        </p>
      )}

      {result?.merged &&
        (result.merged.scientific_name ||
          result.merged.drug_class ||
          result.merged.manufacturer ||
          structureImg) && (
          <Card>
            <CardContent className="flex flex-wrap items-start gap-4 p-4">
              {structureImg && (
                <img
                  src={structureImg}
                  alt={result.merged.scientific_name || q}
                  className="h-20 w-20 rounded border bg-white object-contain"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                {result.merged.scientific_name && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("INN", "الاسم العلمي")}:{" "}
                    </span>
                    <span className="font-medium">{result.merged.scientific_name}</span>
                  </p>
                )}
                {result.merged.drug_class && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("Class", "الفئة")}:{" "}
                    </span>
                    {result.merged.drug_class}
                  </p>
                )}
                {result.merged.manufacturer && (
                  <p>
                    <span className="text-muted-foreground">
                      {t("Manufacturer", "الشركة")}:{" "}
                    </span>
                    {result.merged.manufacturer}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {whoHits.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">
              {t("WHO Essential Medicines", "أدوية منظمة الصحة الأساسية")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {whoHits.map((h, i) => (
              <div key={`who-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">WHO</Badge>
                <span className="font-medium">{h.name_en}</span>
                {h.who_section && (
                  <span className="text-xs text-muted-foreground">{h.who_section}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {otherHits.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t("Matches", "النتائج")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {otherHits.map((h, i) => (
              <div key={`${h.source}-${h.external_id || i}`} className="border-b pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{worldSourceLabel(h.source)}</Badge>
                  <span className="font-medium">{h.name_en || "—"}</span>
                </div>
                {h.scientific_name && (
                  <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
                )}
                {h.source_url && (
                  <a
                    href={h.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                  >
                    {t("Open source", "فتح المصدر")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={encyclopediaSearchUrl(q)}>
            {t("Egyptian encyclopedia", "الموسوعة المصرية")}
          </Link>
        </Button>
        {links.map((l) => (
          <Button key={l.url} variant="ghost" size="sm" asChild>
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.label} <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "World search is identity enrichment only — not a prescribing tool. Local Egyptian catalog remains the primary operational source.",
          "البحث العالمي لإثراء الهوية فقط — وليس أداة وصف. الكتالوج المصري المحلي يبقى المصدر التشغيلي الأساسي.",
        )}
      </p>
    </div>
  );
}
