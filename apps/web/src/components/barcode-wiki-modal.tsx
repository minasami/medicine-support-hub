import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, PlusCircle, Link2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import {
  createDrugContribution,
  currentUserId,
  searchMedicinesForWiki,
} from "@/lib/drug-contributions";
import type { MedicineListItem } from "@/lib/medicines-appwrite-page";

export type WikiMode = "choose" | "link" | "create";

type Props = {
  open: boolean;
  barcode: string;
  initialMode?: WikiMode;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (info: { id: string; status: string; auto_approved?: boolean }) => void;
};

export function BarcodeWikiModal({ open, barcode, initialMode = "choose", onOpenChange, onSubmitted }: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<WikiMode>("choose");
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MedicineListItem[]>([]);
  const [picked, setPicked] = useState<MedicineListItem | null>(null);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [scientific, setScientific] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(initialMode || "choose");
    setError(null);
    setPicked(null);
    setQuery("");
    setHits([]);
    setNameEn("");
    setNameAr("");
    setManufacturer("");
    setScientific("");
    void currentUserId().then(setUserId);
  }, [open, barcode, initialMode]);

  useEffect(() => {
    if (mode !== "link") return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = setTimeout(() => {
      void searchMedicinesForWiki(q)
        .then(setHits)
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, mode]);

  async function submitLink() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createDrugContribution({
        barcode,
        kind: "link_barcode",
        medicine_id: picked.$id,
        canonical_id: picked.canonical_id,
        name_en: picked.name_en || undefined,
        name_ar: picked.name_ar || undefined,
      });
      onSubmitted?.(result);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || t("Could not submit contribution", "تعذّر إرسال المساهمة"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    if (!nameEn.trim()) {
      setError(t("English name is required", "الاسم بالإنجليزية مطلوب"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createDrugContribution({
        barcode,
        kind: "create_product",
        name_en: nameEn.trim(),
        name_ar: nameAr.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        scientific_name: scientific.trim() || undefined,
      });
      onSubmitted?.(result);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || t("Could not submit contribution", "تعذّر إرسال المساهمة"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "link"
              ? t("Add to existing drug", "إضافة إلى دواء موجود")
              : mode === "create"
                ? t("Create new product", "إنشاء منتج جديد")
                : t("Barcode not in encyclopedia", "الباركود غير موجود في الموسوعة")}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{barcode}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-50/70 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-50 flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            {t(
              "Community contributions start as pending. They do not publish to the public catalog until review. High-trust pharmacists/reps (TrustScore > 50) may be auto-approved; new products still enter draft → pending_review → published governance.",
              "تبدأ مساهمات المجتمع بحالة انتظار. لا تُنشر في الكتالوج العام قبل المراجعة. قد تُعتمد تلقائيًا لحسابات عالية الثقة (TrustScore > 50)؛ المنتجات الجديدة تبقى ضمن مسار مسودة → مراجعة → نشر.",
            )}
          </p>
        </div>

        {userId === null && (
          <p className="text-sm">
            {t("Sign in to contribute this barcode.", "سجّل الدخول للمساهمة بهذا الباركود.")}{" "}
            <Link href="/login" className="underline font-medium">
              {t("Sign in", "تسجيل الدخول")}
            </Link>
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {mode === "choose" && (
          <div className="grid gap-2">
            <Button
              type="button"
              className="w-full rounded-xl justify-start h-auto py-3"
              variant="outline"
              disabled={!userId}
              onClick={() => setMode("link")}
            >
              <Link2 className="mr-2 h-4 w-4" />
              <span className="text-left">
                <span className="block font-semibold">
                  {t("Add to existing drug", "إضافة إلى دواء موجود")}
                </span>
                <span className="block text-xs text-muted-foreground font-normal">
                  {t("Search the encyclopedia and link this barcode.", "ابحث في الموسوعة واربط هذا الباركود.")}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              className="w-full rounded-xl justify-start h-auto py-3"
              variant="outline"
              disabled={!userId}
              onClick={() => setMode("create")}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span className="text-left">
                <span className="block font-semibold">
                  {t("Create new product", "إنشاء منتج جديد")}
                </span>
                <span className="block text-xs text-muted-foreground font-normal">
                  {t("Minimal fields. Saved as a pending wiki claim.", "حقول مختصرة. تُحفظ كمطالبة ويكي معلّقة.")}
                </span>
              </span>
            </Button>
          </div>
        )}

        {mode === "link" && (
          <div className="space-y-3">
            <Label htmlFor="wiki-search">{t("Search medicines", "بحث الأدوية")}</Label>
            <Input
              id="wiki-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Trade name or generic…", "الاسم التجاري أو العلمي…")}
            />
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {hits.map((h) => (
                <li key={h.$id || `${h.canonical_id}-${h.name_en}`}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                      picked?.$id === h.$id ? "border-teal-600 bg-teal-50 dark:bg-teal-950/40" : ""
                    }`}
                    onClick={() => setPicked(h)}
                  >
                    <span className="font-medium">{h.name_en}</span>
                    {h.name_ar ? (
                      <span className="block text-xs text-muted-foreground">{h.name_ar}</span>
                    ) : null}
                    {h.manufacturer ? (
                      <span className="block text-[11px] text-muted-foreground">{h.manufacturer}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                {t("Back", "رجوع")}
              </Button>
              <Button type="button" disabled={!picked || busy || !userId} onClick={() => void submitLink()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("Submit link", "إرسال الربط")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="wiki-name-en">{t("Name (English)", "الاسم (إنجليزي)")} *</Label>
              <Input id="wiki-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiki-name-ar">{t("Name (Arabic)", "الاسم (عربي)")}</Label>
              <Input id="wiki-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiki-mfr">{t("Manufacturer", "الشركة المنتجة")}</Label>
              <Input id="wiki-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiki-sci">{t("Scientific / INN", "المادة الفعالة")}</Label>
              <Input id="wiki-sci" value={scientific} onChange={(e) => setScientific(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
                {t("Back", "رجوع")}
              </Button>
              <Button type="button" disabled={busy || !userId} onClick={() => void submitCreate()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("Submit new product", "إرسال منتج جديد")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
