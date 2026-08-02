import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  loadCanonicalIdMap,
  getCanonicalIdMapSnapshot,
  getCanonicalIdMapStatus,
  type AccuracySummary,
  type CanonicalIdMapFile,
} from "@/lib/canonical-id-map";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CanonicalMapStatusBanner } from "@/components/canonical-map-status-banner";

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-mono">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

export default function MappingAccuracyDashboard() {
  const { t } = useLanguage();
  const [map, setMap] = useState<CanonicalIdMapFile | null>(
    getCanonicalIdMapSnapshot(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadCanonicalIdMap();
      if (!cancelled) {
        setMap(getCanonicalIdMapSnapshot());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary: AccuracySummary | undefined = map?.accuracy_summary;
  const stats = map?.stats || {};
  const mappedIds = Object.keys(map?.static_to_live || {}).length;
  const nameKeys = Object.keys(map?.name_to_live || {}).length;
  const ambKeys = Object.keys(map?.ambiguous_names || {}).length;

  const conf = summary?.confidence;
  const confTotal =
    (conf?.high_ge_0_9 || 0) +
    (conf?.medium_0_7_to_0_9 || 0) +
    (conf?.low_lt_0_7 || 0);

  const score = summary?.accuracy_score_percent;
  const pass = summary?.pass;

  const methodBreakdown = useMemo(() => {
    return [
      {
        key: "exact_barcode",
        label: t("Barcode", "باركود"),
        n: Number(stats.exact_barcode || 0),
      },
      {
        key: "exact_code",
        label: t("Reg. code", "كود تسجيل"),
        n: Number(stats.exact_code || 0),
      },
      {
        key: "exact_name_en",
        label: t("Name EN", "اسم إنجليزي"),
        n: Number(stats.exact_name_en || 0),
      },
      {
        key: "exact_name_ar",
        label: t("Name AR", "اسم عربي"),
        n: Number(stats.exact_name_ar || 0),
      },
      {
        key: "disambiguated",
        label: t("Disambiguated", "تم فك الالتباس"),
        n: Number(stats.disambiguated || 0),
      },
      {
        key: "ambiguous",
        label: t("Ambiguous", "غامض"),
        n: Number(stats.ambiguous || 0),
      },
      {
        key: "unmatched",
        label: t("Unmatched", "غير مطابق"),
        n: Number(stats.unmatched || 0),
      },
    ];
  }, [stats, t]);

  const methodTotal = methodBreakdown.reduce((a, b) => a + b.n, 0) || 1;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("Mapping accuracy", "دقة الربط")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              "Static dataset IDs → live Appwrite encyclopedia IDs",
              "معرّفات البيانات الثابتة → معرّفات موسوعة Appwrite الحية",
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">{t("Back to admin", "العودة للإدارة")}</Link>
        </Button>
      </div>

      <CanonicalMapStatusBanner showOpsHints showWhenEmpty />

      {loading && (
        <p className="text-sm text-muted-foreground">
          {t("Loading map…", "جاري تحميل الخريطة…")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Accuracy score", "درجة الدقة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {score != null ? `${score}%` : "—"}
            </p>
            <div className="mt-1">
              {pass == null ? (
                <Badge variant="outline">{t("No audit yet", "لا يوجد تدقيق بعد")}</Badge>
              ) : pass ? (
                <Badge className="bg-emerald-600">{t("Pass", "ناجح")}</Badge>
              ) : (
                <Badge variant="destructive">{t("Needs review", "يحتاج مراجعة")}</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Mapped IDs", "معرّفات مربوطة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{mappedIds}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("static_to_live entries", "إدخالات static_to_live")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Unique names", "أسماء فريدة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{nameKeys}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("name_to_live keys", "مفاتيح name_to_live")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Ambiguous names", "أسماء غامضة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{ambKeys}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "Not auto-linked by name alone",
                "لا تُربط تلقائياً بالاسم فقط",
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("Map status", "حالة الخريطة")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold capitalize">
              {getCanonicalIdMapStatus()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {map?.generated_at
                ? new Date(map.generated_at).toLocaleString()
                : t("Not generated", "غير مُنشأة")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("Confidence tiers", "مستويات الثقة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {confTotal > 0 ? (
              <>
                <Bar
                  label={t("High (≥ 0.9)", "عالي (≥ 0.9)")}
                  value={conf?.high_ge_0_9 || 0}
                  total={confTotal}
                  color="bg-emerald-500"
                />
                <Bar
                  label={t("Medium (0.7–0.9)", "متوسط (0.7–0.9)")}
                  value={conf?.medium_0_7_to_0_9 || 0}
                  total={confTotal}
                  color="bg-amber-500"
                />
                <Bar
                  label={t("Low (< 0.7)", "منخفض (< 0.7)")}
                  value={conf?.low_lt_0_7 || 0}
                  total={confTotal}
                  color="bg-rose-500"
                />
                <p className="pt-2 text-xs text-muted-foreground">
                  {t("Average confidence", "متوسط الثقة")}:{" "}
                  {conf?.average != null ? conf.average.toFixed(3) : "—"}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  "No confidence summary yet. Re-run the map script to embed accuracy_summary.",
                  "لا يوجد ملخص ثقة بعد. أعد تشغيل السكربت لتضمين accuracy_summary.",
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("Match methods", "طرق المطابقة")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {methodBreakdown.map((m) => (
              <Bar
                key={m.key}
                label={m.label}
                value={m.n}
                total={methodTotal}
                color={
                  m.key === "unmatched" || m.key === "ambiguous"
                    ? "bg-slate-400"
                    : "bg-sky-500"
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("How confidence is calculated", "كيف تُحسب الثقة")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {t(
                "Barcode unique match → 0.99; registration code → 0.97",
                "مطابقة باركود فريدة → 0.99؛ كود تسجيل → 0.97",
              )}
            </li>
            <li>
              {t(
                "Unique English / Arabic trade name → 0.92 / 0.90",
                "اسم تجاري إنجليزي / عربي فريد → 0.92 / 0.90",
              )}
            </li>
            <li>
              {t(
                "Duplicates: barcode → code → manufacturer → name Jaccard (capped 0.80)",
                "التكرار: باركود → كود → مصنع → تشابه أسماء (حد أقصى 0.80)",
              )}
            </li>
            <li>
              {t(
                "Still unclear → ambiguous (confidence 0, not auto-linked)",
                "إن بقي غامضاً → لا ربط تلقائي (ثقة 0)",
              )}
            </li>
          </ul>
          <p className="pt-2">
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="https://github.com/minasami/medicine-support-hub/blob/main/docs/mapping-confidence-scores.md"
              target="_blank"
              rel="noreferrer"
            >
              {t("Full documentation", "التوثيق الكامل")}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
