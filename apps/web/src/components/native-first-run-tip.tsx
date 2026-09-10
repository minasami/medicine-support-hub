import { useEffect, useState } from "react";
import { Smartphone, WifiOff, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { isNativePlatform } from "@/lib/native-mlkit-barcode";
import { isBrowserOnline, subscribeOnlineStatus } from "@/lib/network-status";

const FIRST_RUN_KEY = "msh.native.firstRunSeen.v1";

/**
 * Capacitor first-run tip + offline banner for the mobile shell.
 * Hidden on web/PWA; one-time dismissible tip on native.
 */
export function NativeFirstRunTip() {
  const { t } = useLanguage();
  const [showTip, setShowTip] = useState(false);
  const [offline, setOffline] = useState(() => !isBrowserOnline());

  useEffect(() => {
    if (!isNativePlatform()) return;
    try {
      if (!localStorage.getItem(FIRST_RUN_KEY)) setShowTip(true);
    } catch {
      setShowTip(true);
    }
  }, []);

  useEffect(() => subscribeOnlineStatus((online) => setOffline(!online)), []);

  if (!isNativePlatform()) return null;

  const dismiss = () => {
    setShowTip(false);
    try {
      localStorage.setItem(FIRST_RUN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[65] px-3 lg:hidden">
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        {offline ? (
          <div
            role="status"
            className="pointer-events-auto flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-50/95 px-3 py-2.5 text-amber-950 shadow-lg backdrop-blur dark:bg-amber-950/90 dark:text-amber-50"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <p className="font-semibold">
                {t("You are offline", "أنت غير متصل")}
              </p>
              <p className="opacity-90">
                {t(
                  "Browse what is already on this device. Search and sign-in need a connection.",
                  "تصفح ما هو محفوظ على الجهاز. البحث وتسجيل الدخول يحتاجان اتصالاً.",
                )}
              </p>
            </div>
          </div>
        ) : null}

        {showTip ? (
          <div
            role="dialog"
            aria-label={t("Welcome to the app", "مرحبًا بك في التطبيق")}
            className="pointer-events-auto rounded-2xl border border-emerald-500/30 bg-background/95 p-3 shadow-xl backdrop-blur"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Smartphone className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-semibold text-foreground">
                  {t("Medicine Support Hub on your phone", "منصة دعم الدواء على هاتفك")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "Scan a barcode, search medicines, or sign in with Google. Staff and admin tools stay behind a separate portal.",
                    "امسح باركودًا، ابحث عن الأدوية، أو سجّل الدخول عبر Google. أدوات الفريق والإدارة تبقى في بوابة منفصلة.",
                  )}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700">
                    <Link href="/medicines" onClick={dismiss}>
                      {t("Browse medicines", "تصفح الأدوية")}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-lg">
                    <Link href="/scan" onClick={dismiss}>
                      {t("Scan", "مسح")}
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg"
                    onClick={dismiss}
                  >
                    {t("Got it", "حسنًا")}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("Dismiss", "إغلاق")}
                onClick={dismiss}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
