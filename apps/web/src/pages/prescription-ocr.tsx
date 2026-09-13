/**
 * Prescription OCR assist UI — sends ML Kit / pasted text to ocr-prescription-parser.
 */
import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { Loader2, ScanLine } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { OcrAiDisclaimer } from "@/components/ocr-ai-disclaimer";
import { ExecutionMethod } from "appwrite";
import { functions } from "@/lib/appwrite";

type ParsedMed = {
  drug_name?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  confidence?: number;
  name_detected?: string;
};

export default function PrescriptionOcrPage() {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<ParsedMed[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setMedicines([]);
    setMeta(null);
    try {
      const execution = await functions.createExecution(
        "ocr-prescription-parser",
        JSON.stringify({ text: text.trim() }),
        false,
        "/",
        ExecutionMethod.POST,
      );
      const raw = execution.responseBody || "{}";
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data.success && data.error) {
        setError(String(data.error));
      }
      const list: ParsedMed[] = data.medicines || data.parsed_medicines || [];
      setMedicines(list);
      setMeta({
        parse_source: data.parse_source,
        medgemma_configured: data.medgemma_configured,
        annotations_created: data.annotations_created,
        interactions: data.interactions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-emerald-700" />
          {t("Prescription OCR assist", "مساعدة قراءة الروشتة")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Paste text from on-device ML Kit (preferred) or type prescription lines. Server accepts { text } and optional { image }.",
            "الصق النص من ML Kit على الجهاز (مفضّل) أو اكتب بنود الروشتة. الخادم يقبل { text } واختياريًا { image }.",
          )}
        </p>
      </div>

      <OcrAiDisclaimer />
      <p className="text-xs">
        <Link href="/annotations" className="underline">
          {t("Review OCR annotations (3 high-trust votes)", "مراجعة تعليقات OCR (3 أصوات عالية الثقة)")}
        </Link>
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={t(
            "e.g. Augmentin 1g BID x7 days\nPanadol 500mg TID",
            "مثال: أوجمنتين 1 جم مرتين يوميًا لمدة 7 أيام",
          )}
          className="rounded-2xl"
        />
        <Button type="submit" disabled={loading || !text.trim()} className="rounded-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("Parse prescription", "تحليل الروشتة")}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {medicines.length > 0 ? (
        <div className="space-y-3">
          <OcrAiDisclaimer />
          <ul className="space-y-2">
            {medicines.map((m, i) => {
              const name = m.drug_name || m.name_detected || "—";
              const conf = typeof m.confidence === "number" ? m.confidence : undefined;
              return (
                <li
                  key={`${name}-${i}`}
                  className="rounded-xl border bg-card p-3 text-sm space-y-1"
                >
                  <div className="font-semibold">{name}</div>
                  <div className="text-muted-foreground text-xs">
                    {[m.dose, m.frequency, m.duration].filter(Boolean).join(" · ") ||
                      t("No dose details", "لا تفاصيل جرعة")}
                  </div>
                  {conf != null ? (
                    <div
                      className={`text-[11px] font-medium ${
                        conf < 0.8 ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {t("Confidence", "الثقة")}: {(conf * 100).toFixed(0)}%
                      {conf < 0.8
                        ? ` · ${t("queued for review", "في قائمة المراجعة")}`
                        : ""}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {meta ? (
            <p className="text-[11px] text-muted-foreground font-mono">
              source={String(meta.parse_source)} medgemma=
              {String(meta.medgemma_configured)}
            </p>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
