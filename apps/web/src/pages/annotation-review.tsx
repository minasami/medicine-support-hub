/**
 * Light RLAIF voting UI — 3 high-trust users can approve/reject OCR annotations.
 * Full Vertex fine-tune remains deferred (retrainModel stub).
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import {
  listPendingAnnotations,
  voteOnAnnotation,
  type AnnotationRow,
} from "@/lib/annotation-votes";
import { currentUserId } from "@/lib/drug-contributions";
import { OcrAiDisclaimer } from "@/components/ocr-ai-disclaimer";

export default function AnnotationReviewPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<AnnotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listPendingAnnotations(30));
    } catch (e: any) {
      setError(e?.message || t("Could not load annotations", "تعذّر تحميل التعليقات"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void currentUserId().then(setUserId);
    void reload();
  }, []);

  async function vote(id: string, ballot: "up" | "down") {
    setBusyId(id);
    try {
      await voteOnAnnotation(id, ballot);
      await reload();
    } catch (e: any) {
      setError(e?.message || t("Vote failed", "فشل التصويت"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold">
        {t("OCR annotation review", "مراجعة تعليقات قراءة الروشتة")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t(
          "High-trust users (TrustScore > 50) — three agreeing votes approve or reject a label. Vertex MedGemma retrain is not run from this screen.",
          "المستخدمون عاليو الثقة (TrustScore > 50) — ثلاثة أصوات متفقة تعتمد أو ترفض الوسم. لا يُشغّل إعادة تدريب MedGemma من هذه الشاشة.",
        )}
      </p>
      <OcrAiDisclaimer />
      <p className="text-xs">
        <Link href="/prescription-ocr" className="underline">
          {t("Back to OCR assist", "العودة لمساعدة قراءة الروشتة")}
        </Link>
      </p>

      {!userId && (
        <p className="text-sm">
          {t("Sign in to vote.", "سجّل الدخول للتصويت.")}{" "}
          <Link href="/login" className="underline font-medium">
            {t("Sign in", "تسجيل الدخول")}
          </Link>
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("No pending annotations.", "لا تعليقات معلّقة.")}
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.$id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {row.drug_name || t("Unnamed crop", "قصّة بلا اسم")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {row.confidence != null && (
                  <p className="text-xs text-muted-foreground">
                    {t("Confidence", "الثقة")}: {(Number(row.confidence) * 100).toFixed(0)}%
                  </p>
                )}
                {row.label_json && (
                  <pre className="text-[11px] overflow-x-auto rounded bg-muted/50 p-2 whitespace-pre-wrap">
                    {row.label_json}
                  </pre>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {t("Votes", "الأصوات")}: {(row.votes || []).length} · {row.status || "pending"}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!userId || busyId === row.$id}
                    onClick={() => void vote(row.$id, "up")}
                  >
                    <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                    {t("Looks right", "صحيح")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!userId || busyId === row.$id}
                    onClick={() => void vote(row.$id, "down")}
                  >
                    <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                    {t("Looks wrong", "خطأ")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
