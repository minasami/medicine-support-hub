import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ExampleRow = {
  rank: number;
  name: string;
  tierEn: string;
  tierAr: string;
  whyEn: string;
  whyAr: string;
  highlight?: boolean;
};

const CONCOR_EXAMPLES: ExampleRow[] = [
  {
    rank: 1,
    name: "CONCOR",
    tierEn: "Exact",
    tierAr: "تطابق تام",
    whyEn: "Trade name equals your query",
    whyAr: "اسم الدواء يطابق البحث تمامًا",
    highlight: true,
  },
  {
    rank: 2,
    name: "CONCOR COR",
    tierEn: "Prefix",
    tierAr: "يبدأ بـ",
    whyEn: "Starts with CONCOR — longer pack name",
    whyAr: "يبدأ بـ CONCOR — اسم أطول للعبوة",
  },
  {
    rank: 3,
    name: "CONCOR 5 MG",
    tierEn: "Prefix",
    tierAr: "يبدأ بـ",
    whyEn: "Same stem + strength",
    whyAr: "نفس الجذع مع التركيز",
  },
  {
    rank: 4,
    name: "ECONOCOR",
    tierEn: "Fuzzy",
    tierAr: "تهجئة قريبة",
    whyEn: "Similar spelling — ranked below exact",
    whyAr: "تهجئة مشابهة — بعد التطابق التام",
  },
];

const TYPO_EXAMPLES: ExampleRow[] = [
  {
    rank: 1,
    name: "Nortriptyline (INN)",
    tierEn: "Expanded",
    tierAr: "تصحيح",
    whyEn: "Nortryptalin → nortriptyline",
    whyAr: "Nortryptalin ← تصحيح إلى nortriptyline",
    highlight: true,
  },
  {
    rank: 2,
    name: "Motival",
    tierEn: "Related",
    tierAr: "ذو صلة",
    whyEn: "Local brand containing nortriptyline",
    whyAr: "اسم تجاري محلي يحتوي المادة",
  },
];

export function SearchRankingExamples({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(!compact);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/80 text-sm overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          {t("How search ranking works", "كيف تُرتَّب نتائج البحث")}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-4 border-t border-border/60">
          <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
            {t(
              "Results are re-ranked on your device: exact names first, then prefixes, then close spellings (fuzzy). Appwrite fulltext alone does not sort by relevance.",
              "تُعاد ترتيب النتائج على جهازك: الاسم المطابق أولاً، ثم ما يبدأ بنفس النص، ثم التهجئة القريبة. بحث Appwrite وحده لا يرتب حسب الصلة.",
            )}
          </p>

          <ExampleBlock
            title={t('Query: "concor"', 'البحث: "concor"')}
            rows={CONCOR_EXAMPLES}
          />

          <ExampleBlock
            title={t('Typo: "Nortryptalin"', 'خطأ إملائي: "Nortryptalin"')}
            rows={TYPO_EXAMPLES}
          />

          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
            <li>
              {t(
                "Exact trade name → top",
                "اسم تجاري مطابق → الأعلى",
              )}
            </li>
            <li>
              {t(
                "Shorter name wins among equal prefix scores (CONCOR before CONCOR COR)",
                "الاسم الأقصر يتقدم عند تساوي البادئة",
              )}
            </li>
            <li>
              {t(
                "Fuzzy uses edit distance + pharma letter patterns (ph/f, y/i)",
                "البحث التقريبي يستخدم مسافة التحرير وأنماط حروف دوائية",
              )}
            </li>
            <li>
              {t(
                "Voice search fills the same box — ranking rules identical",
                "البحث الصوتي يملأ نفس الحقل — نفس قواعد الترتيب",
              )}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ExampleBlock({
  title,
  rows,
}: {
  title: string;
  rows: ExampleRow[];
}) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="text-xs font-semibold text-foreground mb-1.5">{title}</p>
      <ol className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={cn(
              "flex gap-2 items-start rounded-lg border px-2 py-1.5",
              row.highlight
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border/60 bg-muted/20",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              {row.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-xs truncate">{row.name}</span>
                <span className="text-[9px] uppercase tracking-wide rounded-full border px-1.5 py-0.5 text-muted-foreground">
                  {t(row.tierEn, row.tierAr)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t(row.whyEn, row.whyAr)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
