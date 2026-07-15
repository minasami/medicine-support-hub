import { useState } from "react";
import { Check, Clipboard, MessageSquarePlus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
export function ShareContributeActions({
  title,
  contributionUrl,
}: {
  title: string;
  contributionUrl: string;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title, url });
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void share()}>
        {copied ? (
          <Check className="mr-2 h-4 w-4" />
        ) : typeof (navigator as Navigator & { share?: unknown }).share ===
          "function" ? (
          <Share2 className="mr-2 h-4 w-4" />
        ) : (
          <Clipboard className="mr-2 h-4 w-4" />
        )}
        {copied ? t("Link copied", "تم نسخ الرابط") : t("Share", "مشاركة")}
      </Button>
      <Button asChild variant="outline">
        <a href={contributionUrl}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {t("Contribute or correct data", "ساهم أو صحح البيانات")}
        </a>
      </Button>
    </div>
  );
}
