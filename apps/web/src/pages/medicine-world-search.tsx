import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Globe2, Loader2, Search, ShieldCheck } from "lucide-react";
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
      const r = await globalDrugSearch(query, {
        limit: 8,
        locale: ar ? "ar" : "en",
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setResult(r);
      if (!r.hits.length && r.errors.length) {
        setError(r.errors.join("; "));
      } else if (!r.hits.length) {
        setError(
          ar
            ? "لا نتائج من المصادر المفتوحة — جرّب الاسم العلمي أو الاسم التجاري."
            : "No open-source hits — try the INN or brand name."
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

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-sky-600" />
          <h1 className="text-xl font-semibold">
            {ar ? "بحث عالمي عن الدواء" : "World drug search"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "يجمع OpenFDA و RxNorm و PubChem وقائمة منظمة الصحة العالمية للأدوية الأساسية. البيانات المحلية المصرية لها الأولوية في الموسوعة."
            : "Aggregates OpenFDA, RxNorm, PubChem, and WHO Essential Medicines. Egyptian local data stays primary in the encyclopedia."}
        </p>

        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder={ar ? "اسم تجاري أو علمي…" : "Brand or INN…"}
            className="flex-1"
          />
          <Button onClick={() => void run()} disabled={loading || !q.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {result?.who_essential && (
          <Alert className="border-emerald-300 bg-emerald-50">
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
            <AlertDescription className="text-emerald-900">
              {ar
                ? "مرشح لقائمة منظمة الصحة العالمية للأدوية الأساسية"
                : "Likely on the WHO Essential Medicines List"}
              {result.who_hits.length > 0 && (
                <span className="ml-1 text-xs opacity-80">
                  ({result.who_hits.join(", ")})
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {whoHits.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-emerald-800">
              {ar ? "قائمة الأدوية الأساسية (WHO EML)" : "WHO Essential Medicines"}
            </h2>
            {whoHits.map((h, i) => (
              <Card key={"who-" + i} className="border-emerald-200">
                <CardContent className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div>
                    <Badge className="mb-1 bg-emerald-100 text-emerald-900">{h.source}</Badge>
                    <p className="font-medium">{h.name_en || "—"}</p>
                    {h.scientific_name && (
                      <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
                    )}
                    {h.indications_summary && (
                      <p className="text-xs text-muted-foreground">{h.indications_summary}</p>
                    )}
                  </div>
                  {h.source_url && (
                    <a
                      className="shrink-0 text-xs text-sky-700 underline"
                      href={h.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {otherHits.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium">
              {ar ? "مصادر عالمية" : "Global sources"}
            </h2>
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
                    {h.scientific_name && (
                      <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
                    )}
                    {(h.dosage_form || h.route) && (
                      <p className="text-xs text-muted-foreground">
                        {[h.dosage_form, h.route].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {h.source_url && (
                    <a
                      className="shrink-0 text-xs text-sky-700 underline"
                      href={h.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ar ? "كل المحركات" : "All engines"}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.source}
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
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              {ar ? "الموسوعة المحلية" : "Local encyclopedia"}
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
