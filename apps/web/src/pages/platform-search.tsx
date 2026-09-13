import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

/**
 * Legacy Universal Search route.
 * Consumer search+browse now lives on /medicines — redirect with query preserved.
 */
export default function PlatformSearchRedirect() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let q = "";
    try {
      const params = new URLSearchParams(window.location.search);
      q = (params.get("q") || params.get("query") || "").trim();
      if (!q && window.location.hash) {
        const hash = window.location.hash.replace(/^#/, "");
        if (hash.includes("=")) {
          const fromHash = new URLSearchParams(hash);
          q = (fromHash.get("q") || fromHash.get("query") || "").trim();
        }
      }
    } catch {
      q = "";
    }
    const target = q ? `/medicines?q=${encodeURIComponent(q)}` : "/medicines";
    window.history.replaceState(null, "", target);
    navigate(target);
  }, [navigate]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
      {t("Opening Medicines…", "جاري فتح الأدوية…")}
    </div>
  );
}
