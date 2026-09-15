import { useEffect, useMemo, useState } from "react";
import {
  Combine,
  EllipsisVertical,
  Eye,
  EyeOff,
  Loader2,
  PencilLine,
  Search,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { useRole } from "@/lib/role";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import type { MedicineListItem } from "@/lib/medicines-appwrite-page";
import {
  editMedicineFields,
  mergeMedicineIntoTarget,
  searchMergeCandidates,
  setMedicineHidden,
  type CatalogEditFields,
} from "@/lib/catalog-admin-actions";
import { Link } from "wouter";

type Props = {
  item: MedicineListItem;
  onChanged?: (patch: Partial<MedicineListItem>) => void;
  compact?: boolean;
  /** Pre-selected merge target (e.g. from quality flag). */
  suggestedPeerId?: string | null;
};

export function PlatformAdminProductMenu({
  item,
  onChanged,
  compact = true,
  suggestedPeerId,
}: Props) {
  const { t } = useLanguage();
  const { session, profile } = usePatientAuth();
  const { user } = useRole();
  const actorEmail =
    session?.user?.email ||
    (user as { username?: string } | null)?.username ||
    null;
  const actorRole =
    profile?.role || (user as { role?: string } | null)?.role || null;
  const isAdmin = isPlatformAdminUser({
    email: actorEmail,
    profileRole: actorRole,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogEditFields>({});
  const [mergeQuery, setMergeQuery] = useState("");
  const [candidates, setCandidates] = useState<MedicineListItem[]>([]);
  const [target, setTarget] = useState<MedicineListItem | null>(null);
  const hidden = Boolean(item.is_hidden);

  useEffect(() => {
    if (!editOpen) return;
    setDraft({
      name_en: item.name_en,
      name_ar: item.name_ar,
      scientific_name: item.scientific_name,
      manufacturer: item.manufacturer,
      strength: item.strength,
      dosage_form: item.dosage_form,
      drug_class: item.drug_class,
      barcode: item.barcode,
      image_url: item.image_url,
      current_price_egp: item.current_price_egp,
      description: item.description,
    });
    setError(null);
    setMessage(null);
  }, [editOpen, item]);

  useEffect(() => {
    if (!mergeOpen) return;
    setMergeQuery(item.name_en || "");
    setTarget(null);
    setError(null);
    setMessage(null);
  }, [mergeOpen, item.name_en]);

  useEffect(() => {
    if (!mergeOpen) return;
    const q = mergeQuery.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void searchMergeCandidates(q, item.canonical_id).then((rows) => {
        if (!cancelled) {
          setCandidates(rows);
          if (suggestedPeerId) {
            const peer = rows.find((r) => r.$id === suggestedPeerId);
            if (peer) setTarget(peer);
          }
        }
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [mergeOpen, mergeQuery, item.canonical_id, suggestedPeerId]);

  const title = useMemo(
    () => item.name_en || item.name_ar || `#${item.canonical_id}`,
    [item],
  );

  if (!isAdmin) return null;

  async function toggleHide() {
    setBusy("hide");
    setError(null);
    setMessage(null);
    const res = await setMedicineHidden({
      item,
      hidden: !hidden,
      actorEmail,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error || res.message);
      return;
    }
    setMessage(res.message);
    onChanged?.({ is_hidden: !hidden });
  }

  async function saveEdit() {
    setBusy("edit");
    setError(null);
    setMessage(null);
    const res = await editMedicineFields({
      item,
      fields: draft,
      actorEmail,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error || res.message);
      return;
    }
    setMessage(res.message);
    onChanged?.({ ...draft, is_hidden: item.is_hidden });
    setEditOpen(false);
  }

  async function runMerge() {
    if (!target) {
      setError(t("Pick a merge target first.", "اختر هدف الدمج أولاً."));
      return;
    }
    setBusy("merge");
    setError(null);
    setMessage(null);
    const res = await mergeMedicineIntoTarget({
      source: item,
      target,
      actorEmail,
      reason: "product_card_merge",
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error || res.message);
      return;
    }
    setMessage(res.message);
    onChanged?.({
      is_hidden: true,
      merged_into_id: target.$id,
      merged_into_canonical_id: target.canonical_id,
    });
    setMergeOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={
              compact
                ? "h-7 w-7 rounded-full bg-background/90 shadow-sm border"
                : "h-9 w-9"
            }
            aria-label={t("Admin actions", "إجراءات المشرف")}
            onClick={(e) => e.stopPropagation()}
          >
            <EllipsisVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="flex items-center gap-2">
            {t("Platform admin", "مشرف المنصة")}
            {hidden ? (
              <Badge variant="secondary" className="text-[10px]">
                {t("Hidden", "مخفي")}
              </Badge>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilLine className="mr-2 h-4 w-4" />
            {t("Edit fields", "تعديل الحقول")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void toggleHide()} disabled={busy === "hide"}>
            {hidden ? (
              <Eye className="mr-2 h-4 w-4" />
            ) : (
              <EyeOff className="mr-2 h-4 w-4" />
            )}
            {hidden
              ? t("Unhide product", "إظهار المنتج")
              : t("Hide product", "إخفاء المنتج")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMergeOpen(true)}>
            <Combine className="mr-2 h-4 w-4" />
            {t("Merge into…", "دمج في…")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/catalog-quality">
              {t("Quality flags", "علامات الجودة")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {(error || message) && !editOpen && !mergeOpen ? (
        <div className="absolute z-20 start-1 bottom-1 max-w-[90%]">
          <Alert variant={error ? "destructive" : "default"} className="py-1 px-2 text-[10px]">
            <AlertDescription>{error || message}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <SheetHeader>
            <SheetTitle>{t("Edit product", "تعديل المنتج")}</SheetTitle>
            <SheetDescription className="line-clamp-2">{title}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {(
              [
                ["name_en", "Name (EN)", "الاسم إنجليزي"],
                ["name_ar", "Name (AR)", "الاسم عربي"],
                ["scientific_name", "Scientific name", "الاسم العلمي"],
                ["manufacturer", "Manufacturer", "الشركة"],
                ["strength", "Strength", "التركيز"],
                ["dosage_form", "Dosage form", "الشكل"],
                ["drug_class", "Drug class", "الفئة الدوائية"],
                ["barcode", "Barcode", "الباركود"],
                ["image_url", "Image URL", "رابط الصورة"],
                ["description", "Description", "الوصف"],
              ] as const
            ).map(([key, en, ar]) => (
              <div key={key}>
                <Label className="text-xs">{t(en, ar)}</Label>
                <Input
                  className="mt-1"
                  value={String(draft[key] ?? "")}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div>
              <Label className="text-xs">{t("Price (EGP)", "السعر (ج.م)")}</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={
                  draft.current_price_egp == null
                    ? ""
                    : String(draft.current_price_egp)
                }
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    current_price_egp:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {message ? (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="w-full"
              onClick={() => void saveEdit()}
              disabled={busy === "edit"}
            >
              {busy === "edit" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("Save", "حفظ")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{t("Merge product", "دمج المنتج")}</DialogTitle>
            <DialogDescription>
              {t(
                "Source will be hidden and redirected to the target. Missing target fields are filled from the source.",
                "سيتم إخفاء المصدر وإعادة توجيهه إلى الهدف. تُملأ الحقول الناقصة في الهدف من المصدر.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              <span className="text-muted-foreground">{t("Source", "المصدر")}: </span>
              <strong>{title}</strong>
            </p>
            <div>
              <Label className="text-xs">{t("Find target", "ابحث عن الهدف")}</Label>
              <div className="relative mt-1">
                <Search className="absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="ps-8"
                  value={mergeQuery}
                  onChange={(e) => setMergeQuery(e.target.value)}
                  placeholder={t("Product name…", "اسم المنتج…")}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {candidates.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {t("No candidates", "لا مرشحين")}
                </p>
              ) : (
                candidates.map((c) => (
                  <button
                    key={c.$id || c.canonical_id}
                    type="button"
                    className={`w-full text-start px-3 py-2 text-sm hover:bg-muted/60 ${
                      target?.$id === c.$id ? "bg-emerald-50 dark:bg-emerald-950/30" : ""
                    }`}
                    onClick={() => setTarget(c)}
                  >
                    <div className="font-medium line-clamp-1">
                      {c.name_en || c.name_ar}
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {[c.manufacturer, c.strength, `#${c.canonical_id}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </button>
                ))
              )}
            </div>
            {target ? (
              <Alert>
                <AlertDescription>
                  {t("Target", "الهدف")}: <strong>{target.name_en}</strong>
                </AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="w-full"
              disabled={!target || busy === "merge"}
              onClick={() => void runMerge()}
            >
              {busy === "merge" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Combine className="mr-2 h-4 w-4" />
              )}
              {t("Merge & hide source", "دمج وإخفاء المصدر")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
