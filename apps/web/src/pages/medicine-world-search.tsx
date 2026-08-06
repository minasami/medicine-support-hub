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
      if (!r.hits.length && r.errors.length) {
        setError(r.errors.join("; "));
      } else if (!r.hits.length) {
        setError(
          t(
            "No open-source hits — try the INN or brand name, or open an external engine below.",
            "لا نتائج من المصادر المفتوحة — جرّب الاسم العلمي أو الاسم التجاري، أو افتح محركًا خارجيًا أدناه.",
          ),
        );
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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
                      {t("Class", "التصنيف")}:{" "}
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
                {result.merged.indications_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {result.merged.indications_summary}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {whoHits.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-emerald-800">
            {t("WHO Essential Medicines", "قائمة الأدوية الأساسية (WHO EML)")}
          </h2>
          {whoHits.map((h, i) => (
            <Card key={"who-" + i} className="border-emerald-200">
              <CardContent className="flex items-start justify-between gap-3 p-3 text-sm">
                <div>
                  <Badge className="mb-1 bg-emerald-100 text-emerald-900">{h.source}</Badge>
                  <p className="font-medium">{h.name_en || "—"}</p>
                  {h.scientific_name && h.scientific_name !== h.name_en && (
                    <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
                  )}
                  {h.indications_summary && (
                    <p className="text-xs text-muted-foreground">{h.indications_summary}</p>
                  )}
                </div>
                {h.source_url && (
                  <a
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-sky-700 underline"
                    href={h.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {otherHits.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">{t("Global sources", "مصادر عالمية")}</h2>
          {otherHits.map((h, i) => (
            <Card key={h.source + "-" + i}>
              <CardContent className="flex items-start justify-between gap-3 p-3 text-sm">
                <div>
                  <Badge variant="outline" className="mb-1">
                    {h.source}
                    {h.rxcui ? " · RxCUI " + h.rxcui : ""}
                    {h.pubchem_cid ? " · CID " + h.pubchem_cid : ""}
                  </Badge>
                  <p className="font-medium">{h.name_en || "—"}</p>
                  {h.scientific_name && h.scientific_name !== h.name_en && (
                    <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
                  )}
                  {(h.dosage_form || h.route) && (
                    <p className="text-xs text-muted-foreground">
                      {[h.dosage_form, h.route].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {h.indications_summary && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {h.indications_summary}
                    </p>
                  )}
                </div>
                {h.source_url && (
                  <a
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-sky-700 underline"
                    href={h.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("All engines", "كل المحركات")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.source + l.url}
              href={l.url}
              target={l.url.startsWith("/") ? undefined : "_blank"}
              rel={l.url.startsWith("/") ? undefined : "noreferrer"}
              className={
                l.source === "who_eml"
                  ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-900 hover:bg-emerald-100"
                  : "rounded-full border px-3 py-1 text-xs hover:bg-muted"
              }
            >
              {worldSourceLabel(l, ar ? "ar" : "en")}
            </a>
          ))}
          <Link
            href={encyclopediaSearchUrl(q)}
            className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs text-sky-900 hover:bg-sky-100"
          >
            {t("Local encyclopedia", "الموسوعة المحلية")}
          </Link>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t(
          "Local Egypt catalog is authoritative for price and availability. World engines fill identity gaps and link out for verification.",
          "الكتالوج المحلي المصري هو المرجع للسعر والتوافر. المحركات العالمية تسد فجوات الهوية مع روابط للتحقق.",
        )}
      </p>
    </div>
  );
}
