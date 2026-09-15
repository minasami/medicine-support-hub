import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  Combine,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { useRole } from "@/lib/role";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import {
  listCatalogQualityFlags,
  resolveQualityFlag,
  type QualityFlag,
} from "@/lib/catalog-admin-actions";
import { encyclopediaProductUrl } from "@/lib/catalog-links";
import { functions } from "@/lib/appwrite";

export default function AdminCatalogQualityPage() {
  const { t } = useLanguage();
  const { session, profile, isAuthenticated } = usePatientAuth();
  const { user } = useRole();
  const isAdmin = isPlatformAdminUser({
    email:
      session?.user?.email ||
      (user as { username?: string } | null)?.username ||
      null,
    profileRole: profile?.role || (user as { role?: string } | null)?.role || null,
  });
  const [flags, setFlags] = useState<QualityFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCatalogQualityFlags({ status: "open", limit: 80 });
      setFlags(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  async function runDetector() {
    setBusy("detect");
    setError(null);
    setMessage(null);
    try {
      const exec = await functions.createExecution(
        "detectCatalogQuality",
        JSON.stringify({ limit: 400 }),
        false,
      );
      const body = exec.responseBody || "";
      setMessage(
        t(
          `Detector execution ${exec.status}. ${body.slice(0, 180)}`,
          `تشغيل الكاشف ${exec.status}. ${body.slice(0, 180)}`,
        ),
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t(
              "Could not invoke detectCatalogQuality (deploy function first).",
              "تعذر استدعاء detectCatalogQuality (انشر الدالة أولاً).",
            ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(flag: QualityFlag) {
    setBusy(flag.$id);
    const res = await resolveQualityFlag(flag.$id, "dismissed_by_admin");
    setBusy(null);
    if (!res.ok) {
      setError(res.error || res.message);
      return;
    }
    setFlags((prev) => prev.filter((f) => f.$id !== flag.$id));
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Platform admin access required.",
              "يلزم صلاحية مشرف المنصة.",
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <Button asChild variant="ghost" className="-ms-3">
        <Link href="/admin/hub">
          <ArrowLeft className="me-2 h-4 w-4" />
          {t("Back to hub", "العودة للوحة")}
        </Link>
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge className="mb-2 bg-amber-100 text-amber-900">
            {t("Catalog quality", "جودة الكتالوج")}
          </Badge>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-700" />
            {t("Duplicate & misinformation flags", "علامات التكرار والمعلومات الخاطئة")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            {t(
              "Review automated near-duplicate and misinfo signals. Merge from the product card or open the target peer.",
              "راجع إشارات التكرار القريب والمعلومات الخاطئة. ادمج من بطاقة المنتج أو افتح النظير.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="me-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
          <Button onClick={() => void runDetector()} disabled={busy === "detect"}>
            {busy === "detect" ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("Run detector", "تشغيل الكاشف")}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertDescription className="text-xs font-mono break-all">{message}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {t(
              "No open flags. Run the detector or wait for the daily cron.",
              "لا علامات مفتوحة. شغّل الكاشف أو انتظر الجدولة اليومية.",
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const href = encyclopediaProductUrl({
              nameEn: flag.name_en || "product",
              canonicalId: flag.canonical_id,
              idSource: flag.canonical_id ? "live_db" : "unknown",
            });
            const peerHref =
              flag.peer_canonical_id
                ? encyclopediaProductUrl({
                    nameEn: "peer",
                    canonicalId: flag.peer_canonical_id,
                    idSource: "live_db",
                  })
                : null;
            return (
              <Card key={flag.$id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {flag.name_en || flag.medicine_id || flag.$id}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {flag.summary}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{flag.flag_type}</Badge>
                      <Badge
                        variant={
                          flag.severity === "high" ? "destructive" : "secondary"
                        }
                      >
                        {flag.severity || "medium"}
                      </Badge>
                      {typeof flag.score === "number" ? (
                        <Badge variant="outline">
                          {Math.round(flag.score * 100)}%
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={href}>{t("Open product", "فتح المنتج")}</Link>
                  </Button>
                  {peerHref ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={peerHref}>
                        <Combine className="me-1 h-3.5 w-3.5" />
                        {t("Open peer / merge target", "فتح النظير / هدف الدمج")}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === flag.$id}
                    onClick={() => void dismiss(flag)}
                  >
                    {t("Dismiss", "تجاهل")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
