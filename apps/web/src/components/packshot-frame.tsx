import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

export type PackshotVariant = "thumb" | "list" | "card" | "comfort" | "hero" | "portfolio";

function isUsableUrl(url?: string | null): string | null {
  if (!url || !String(url).trim()) return null;
  if (/unsplash\.com|placeholder|via\.placeholder|no_image|picsum/i.test(url)) return null;
  return String(url).trim();
}

const FRAME: Record<
  PackshotVariant,
  { wrap: string; imgPad: string; showCaption: boolean; emoji: string }
> = {
  thumb: {
    wrap: "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:from-slate-900 dark:to-slate-900",
    imgPad: "h-full w-full object-contain p-0.5",
    showCaption: false,
    emoji: "text-base",
  },
  list: {
    wrap: "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 sm:h-16 sm:w-16",
    imgPad: "h-full w-full object-contain p-1",
    showCaption: false,
    emoji: "text-xl",
  },
  card: {
    wrap: "relative flex w-full aspect-[5/4] max-h-[88px] items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 sm:max-h-[104px]",
    imgPad: "absolute inset-0 h-full w-full object-contain p-1.5",
    showCaption: false,
    emoji: "text-2xl",
  },
  comfort: {
    wrap: "relative flex w-full aspect-[2/1] max-h-[100px] items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40",
    imgPad: "absolute inset-0 h-full w-full object-contain p-1.5",
    showCaption: false,
    emoji: "text-2xl",
  },
  portfolio: {
    wrap: "relative flex aspect-[5/3] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50/80 to-teal-50/40",
    imgPad: "absolute inset-0 h-full w-full object-contain p-2",
    showCaption: true,
    emoji: "text-3xl",
  },
  hero: {
    wrap: "relative flex aspect-[16/10] max-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-emerald-50/90 to-teal-50/50",
    imgPad: "absolute inset-0 h-full w-full object-contain p-3",
    showCaption: true,
    emoji: "text-4xl opacity-50",
  },
};

/**
 * Fixed-size packshot frame: rounded, consistent aspect, calm empty state,
 * and onError fallback so broken URLs never show the browser broken-image icon.
 */
export function PackshotFrame({
  url,
  alt = "",
  variant = "card",
  emoji = "💊",
  className = "",
  children,
}: {
  url?: string | null;
  alt?: string;
  variant?: PackshotVariant;
  emoji?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const initial = isUsableUrl(url);
  const [src, setSrc] = useState<string | null>(initial);
  const cfg = FRAME[variant];

  useEffect(() => {
    setSrc(isUsableUrl(url));
  }, [url]);

  return (
    <div className={`${cfg.wrap} ${className}`.trim()}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={cfg.imgPad}
          onError={() => setSrc(null)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-muted-foreground/55">
          <span className={cfg.emoji} aria-hidden>
            {emoji}
          </span>
          {cfg.showCaption ? (
            <span className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 sm:text-xs">
              {t("No packshot yet", "لا توجد صورة عبوة بعد")}
            </span>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
