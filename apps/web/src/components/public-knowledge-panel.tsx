import { useEffect, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
type Knowledge = {
  title: string;
  extract: string;
  pageUrl: string;
  imageUrl: string | null;
  attribution: string;
};
export function PublicKnowledgePanel({
  type,
  name,
}: {
  type: "company" | "generic" | "therapeutic-category" | "medicine";
  name: string;
}) {
  const { t, language } = useLanguage();
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/public-knowledge?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&language=${language === "ar" ? "ar" : "en"}`,
      { signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setKnowledge(data?.result || null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [type, name, language]);
  if (!knowledge) return null;
  return (
    <Card className="mt-6 overflow-hidden">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <BookOpen className="h-4 w-4" />
            {t("Public encyclopedia context", "سياق من الموسوعة العامة")}
          </p>
          <h2 className="mt-2 text-xl font-semibold">{knowledge.title}</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {knowledge.extract}
          </p>
          <a
            href={knowledge.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center text-sm font-semibold text-primary"
          >
            {t("Read and verify on Wikipedia", "اقرأ وتحقق على ويكيبيديا")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            {knowledge.attribution}{" "}
            {t(
              "General context only—not medical advice or a verified platform claim.",
              "سياق عام فقط وليس نصيحة طبية أو ادعاءً موثقًا من المنصة.",
            )}
          </p>
        </div>
        {knowledge.imageUrl && (
          <img
            src={knowledge.imageUrl}
            alt={knowledge.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="max-h-56 w-full rounded-xl border bg-muted/20 object-contain"
          />
        )}
      </CardContent>
    </Card>
  );
}
