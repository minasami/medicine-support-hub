import { useMemo } from "react";
import { Link } from "wouter";
import { Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { shareInviteLink } from "@/lib/share-links";

export default function InvitePage() {
  const { t } = useLanguage();
  const ref = useMemo(() => {
    if (typeof window === "undefined") return "msh";
    try {
      return new URLSearchParams(window.location.search).get("ref") || "msh";
    } catch {
      return "msh";
    }
  }, []);

  return (
    <main className="container mx-auto max-w-lg px-4 py-10">
      <div className="rounded-3xl border bg-card p-8 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
          <Gift className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold">
          {t("You're invited", "لديك دعوة")}
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t(
            "Join Medicine Support Hub for verified medicine intelligence, patient support, and pharmacy tools.",
            "انضم إلى Medicine Support Hub لمعلومات دوائية موثقة ودعم المرضى وأدوات الصيدليات.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("Referral code", "رمز الدعوة")}: <code className="font-mono">{ref}</code>
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Link href="/patient-auth">
            <Button className="w-full sm:w-auto rounded-full">
              {t("Create account", "إنشاء حساب")}
            </Button>
          </Link>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => void shareInviteLink(ref)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {t("Share invite", "مشاركة الدعوة")}
          </Button>
        </div>
        <Link href="/medicines" className="block text-sm text-emerald-700 hover:underline pt-2">
          {t("Browse medicines", "تصفح الأدوية")}
        </Link>
      </div>
    </main>
  );
}
