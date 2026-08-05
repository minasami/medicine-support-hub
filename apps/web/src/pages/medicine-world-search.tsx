import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Globe2, Loader2, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildWorldSourceLinks,
  mergeAggregatorHits,
  searchOpenFdaClient,
  searchRxNormClient,
  worldSourceLabel,
  type AggregatorHit,
} from "@/lib/medicine-aggregator";
import { encyclopediaSearchUrl } from "@/lib/catalog-links";
import { useLanguage } from "@/lib/i18n";

export default function MedicineWorldSearchPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<AggregatorHit[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const run = async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        searchOpenFdaClient(query, 8),
        searchRxNormClient(query, 8),
      ]);
      setHits([...a, ...b]);
      if (!a.length && !b.length) {
        setError(
          ar
            ? "لا نتائج من المصادر المفتوحة — جرّب الروابط أدناه"
            : "No open-source hits — try the encyclopedia links below",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const merged = hits.length ? mergeAggregatorHits(hits, q.trim()) : null;
  const links = buildWorldSourceLinks(q.trim() || "medicine", merged?.scientific_name?.value, {
    nameAr: ar ? q.trim() : null,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Globe2 className="h-7 w-7 text-sky-700" />
          {ar ? "بحث عالمي عن الأدوية" : "World medicine search"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar
            ? "اجمع نتائج OpenFDA وRxNorm مع روابط عربية وعالمية. الأسعار المصرية تبقى في الموسوعة المحلية."
            : "Aggregate OpenFDA + RxNorm and jump to Arabic and global encyclopedias. Egypt prices stay in the local catalog."}
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ar ? "اسم تجاري أو علمي…" : "Brand or INN…"}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !q.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/medicines" className="text-primary underline-offset-4 hover:underline">
          {ar ? "الموسوعة المحلية" : "Local encyclopedia"}
        </Link>
        {q.trim() && (
          <Link
            href={encyclopediaSearchUrl(q.trim())}
            className="text-primary underline-offset-4 hover:underline"
          >
            {ar ? "ابحث محلياً عن" : "Search locally for"} “{q.trim()}”
          </Link>
        )}
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {merged && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ar ? "ملخص مدمج" : "Merged summary"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-1">
              {merged.sources_used.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
            {merged.scientific_name && (
              <p>
                <strong>INN:</strong> {merged.scientific_name.value}
              </p>
            )}
            {merged.drug_class && (
              <p>
                <strong>Class:</strong> {merged.drug_class.value}
              </p>
            )}
            {merged.manufacturer && (
              <p>
                <strong>Manufacturer:</strong> {merged.manufacturer.value}
              </p>
            )}
            {merged.indications_summary && (
              <p className="line-clamp-4 text-muted-foreground">{merged.indications_summary.value}</p>
            )}
          </CardContent>
        </Card>
      )}

      {hits.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{ar ? "نتائج المصادر" : "Source hits"}</h2>
          {hits.map((h, i) => (
            <Card key={`${h.source}-${i}`}>
              <CardContent className="flex items-start justify-between gap-3 p-3 text-sm">
                <div>
                  <Badge variant="outline" className="mb-1">
                    {h.source}
                  </Badge>
                  <p className="font-medium">{h.name_en || "—"}</p>
                  {h.scientific_name && (
                    <p className="text-xs text-muted-foreground">{h.scientific_name}</p>
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
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              {worldSourceLabel(l, ar ? "ar" : "en")}
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
