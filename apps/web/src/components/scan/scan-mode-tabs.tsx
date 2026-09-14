import { FileText, Receipt, ScanLine } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export type ScanMode = "pack" | "rx" | "invoice";

const MODES: { id: ScanMode; icon: typeof ScanLine; en: string; ar: string }[] = [
  { id: "pack", icon: ScanLine, en: "Pack", ar: "عبوة" },
  { id: "rx", icon: FileText, en: "Prescription", ar: "روشتة" },
  { id: "invoice", icon: Receipt, en: "Invoice", ar: "فاتورة" },
];

type Props = {
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
};

export function ScanModeTabs({ value, onChange }: Props) {
  const { t } = useLanguage();
  return (
    <div role="tablist" aria-label={t("Scan mode", "وضع المسح")} className="grid grid-cols-3 gap-1 rounded-2xl border bg-muted/60 p-1">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              active ? "bg-background text-teal-800 shadow-sm dark:text-teal-200" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(m.en, m.ar)}</span>
          </button>
        );
      })}
    </div>
  );
}
