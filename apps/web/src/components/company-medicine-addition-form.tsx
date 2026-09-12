import { useState, FormEvent, useEffect, useMemo, useCallback } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { PackshotFrame } from "@/components/packshot-frame";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { SearchableMultiCombobox } from "@/components/ui/searchable-multi-combobox";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
import {
  joinScientificIngredients,
  parseScientificIngredients,
} from "@/lib/scientific-ingredients";
import {
  loadScientificIngredientOptions,
  loadTaxonomyOptions,
  normalizeTaxonomyKey,
  persistTaxonomyValue,
  type TaxonomyKind,
} from "@/lib/platform-taxonomy";
import { normalizeCompanySlug } from "@/lib/company-portfolio-scope";
import { planContributionSave } from "@/lib/company-contribution-workflow";
import { loadCompanyPortfolio } from "@/lib/load-company-portfolio";
import { fetchMedicinesPage } from "@/lib/medicines-appwrite-page";
import {
  applyOwnershipMeta,
  claimCatalogProductIntoPortfolio,
  confirmPortfolioOwnership,
  unclaimPortfolioProduct,
  type PortfolioOwnershipState,
} from "@/lib/company-portfolio-actions";
import { ShieldCheck, Plus, Trash2, Search, Package } from "lucide-react";

type MedicineProduct = {
  canonical_id: number;
  name_en: string;
  name_ar: string;
  scientific_name: string;
  manufacturer: string;
  drug_class: string;
  route: string;
  category: string;
  image_url: string;
  barcode: string;
  code: string;
  current_price_egp: number;
  line?: string;
  dosage_form?: string;
  strength?: string;
  company_slug?: string;
  ownership_status?: PortfolioOwnershipState;
};

type SciOption = { label: string; value: string; meta?: string; drugClasses: string[] };

const DEFAULT_ROUTE = "Oral";
const DEFAULT_CATEGORY = "Prescription Medicines";

export function CompanyMedicineAdditionForm({
  companySlug,
  companyName,
}: {
  companySlug?: string;
  companyName?: string;
}) {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  const [portfolio, setPortfolio] = useState<MedicineProduct[]>([]);
  const [activeProfile, setActiveProfile] = useState<{
    id: string;
    organization_id: string;
    company_slug: string;
    display_name?: string;
  } | null>(null);

  const [scientificRaw, setScientificRaw] = useState<SciOption[]>([]);
  const [drugClassOptions, setDrugClassOptions] = useState<{ label: string; value: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<{ label: string; value: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [dosageFormOptions, setDosageFormOptions] = useState<{ label: string; value: string }[]>([]);
  const [strengthOptions, setStrengthOptions] = useState<{ label: string; value: string }[]>([]);
  const [lineOptions, setLineOptions] = useState<{ label: string; value: string }[]>([]);

  const [canonicalId, setCanonicalId] = useState<number | null>(null);

  const [medicineName, setMedicineName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [scientificIngredients, setScientificIngredients] = useState<string[]>([]);
  const [drugClass, setDrugClass] = useState("");
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [line, setLine] = useState("");
  const [barcode, setBarcode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  const [tollManufacturerChoice, setTollManufacturerChoice] = useState("");
  const [trademarkOwnerChoice, setTrademarkOwnerChoice] = useState("");

  const [claimQuery, setClaimQuery] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimHits, setClaimHits] = useState<MedicineProduct[]>([]);

  const actor = useMemo(
    () => ({
      userId: session?.user?.id,
      email: session?.user?.email,
      companySlug: activeProfile?.company_slug || companySlug || "company",
      companyName: activeProfile?.display_name || companyName || "Company",
    }),
    [session?.user?.id, session?.user?.email, activeProfile, companySlug, companyName],
  );

  const scientificOptions = useMemo(() => {
    const classKey = drugClass.trim().toLowerCase();
    const filtered = classKey
      ? scientificRaw.filter((opt) =>
          opt.drugClasses.some((c) => c.toLowerCase() === classKey || c.toLowerCase().includes(classKey)),
        )
      : scientificRaw;
    // Fall back to full list if class filter would empty results (class may be custom/new)
    const source = filtered.length > 0 || !classKey ? filtered : scientificRaw;
    return source.map(({ label, value, meta }) => ({ label, value, meta }));
  }, [scientificRaw, drugClass]);

  const scientificName = useMemo(
    () => joinScientificIngredients(scientificIngredients),
    [scientificIngredients],
  );

  const tradeNameOptions = useMemo(
    () =>
      portfolio
        .filter((p) => Boolean(p.name_en?.trim()))
        .map((p) => ({
          label: p.name_en,
          value: `id:${p.canonical_id}`,
          meta:
            [p.name_ar, p.scientific_name, p.line || p.category]
              .filter(Boolean)
              .slice(0, 2)
              .join(" · ") || undefined,
        })),
    [portfolio],
  );

  const tradeNameValue =
    canonicalId && portfolio.some((p) => p.canonical_id === canonicalId)
      ? `id:${canonicalId}`
      : medicineName;

  useEffect(() => {
    async function loadPickerOptions() {
      try {
        // Live Appwrite platform_taxonomy (+ medicines enrich for APIs).
        // Replaces fragile Supabase facet REST paths that fell through to static fallbacks.
        const [drugClass, route, category, dosageForm, strength, productLine, sciOpts] =
          await Promise.all([
            loadTaxonomyOptions("drug_class"),
            loadTaxonomyOptions("route"),
            loadTaxonomyOptions("category"),
            loadTaxonomyOptions("dosage_form"),
            loadTaxonomyOptions("strength"),
            loadTaxonomyOptions("product_line"),
            loadScientificIngredientOptions(),
          ]);

        setDrugClassOptions(drugClass);
        setRouteOptions(route);
        setCategoryOptions(category);
        setDosageFormOptions(dosageForm);
        setStrengthOptions(strength);
        setLineOptions(productLine);
        setScientificRaw(sciOpts);
      } catch (e) {
        console.error("Error loading picker options:", e);
      }
    }
    void loadPickerOptions();
  }, []);

  const persistGlobalAdd = useCallback(
    (kind: TaxonomyKind) => async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const result = await persistTaxonomyValue(kind, trimmed, {
        userId: session?.user?.id,
        email: session?.user?.email,
      });
      if (!result.ok && result.error && result.error !== "no_client") {
        console.warn(`[taxonomy] ${kind} persist:`, result.error);
      }
      // Keep local option lists in sync immediately (shared cache already bumped).
      const opt = { label: trimmed, value: trimmed };
      const merge = (
        prev: { label: string; value: string }[],
      ): { label: string; value: string }[] => {
        if (prev.some((o) => normalizeTaxonomyKey(o.value) === normalizeTaxonomyKey(trimmed))) {
          return prev;
        }
        return [opt, ...prev];
      };
      if (kind === "drug_class") setDrugClassOptions(merge);
      if (kind === "route") setRouteOptions(merge);
      if (kind === "category") setCategoryOptions(merge);
      if (kind === "dosage_form") setDosageFormOptions(merge);
      if (kind === "strength") setStrengthOptions(merge);
      if (kind === "product_line") setLineOptions(merge);
      if (kind === "ingredient") {
        setScientificRaw((prev) => {
          if (prev.some((o) => normalizeTaxonomyKey(o.value) === normalizeTaxonomyKey(trimmed))) {
            return prev;
          }
          return [
            {
              label: trimmed,
              value: trimmed,
              meta: drugClass.trim() || t("Custom ingredient", "مادة فعالة مخصصة"),
              drugClasses: drugClass.trim() ? [drugClass.trim()] : [],
            },
            ...prev,
          ];
        });
      }
    },
    [session?.user?.id, session?.user?.email, drugClass, t],
  );

  const loadPortfolio = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoadingPortfolio(true);
      const result = await loadCompanyPortfolio({
        companySlug,
        companyName,
        userEmail: session.user.email,
      });
      setActiveProfile({
        id: result.resolvedSlug,
        organization_id: `org_${result.resolvedSlug}`,
        company_slug: result.resolvedSlug,
        display_name: result.resolvedName,
      });
      const scoped = applyOwnershipMeta(
        result.products as MedicineProduct[],
        result.resolvedSlug,
      );
      setPortfolio(scoped);
    } catch (e) {
      console.error("Error loading portfolio:", e);
      setPortfolio([]);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [session?.user, companySlug, companyName]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  // When a single API is selected and drug class empty, auto-fill if unique class known
  useEffect(() => {
    if (scientificIngredients.length !== 1 || drugClass.trim()) return;
    const only = scientificIngredients[0]?.trim();
    if (!only) return;
    const match = scientificRaw.find((o) => o.value.toLowerCase() === only.toLowerCase());
    if (match && match.drugClasses.length === 1) {
      setDrugClass(match.drugClasses[0]);
    }
  }, [scientificIngredients, scientificRaw, drugClass]);

  const selectProductToEdit = (prod: MedicineProduct) => {
    setCanonicalId(prod.canonical_id);
    setMedicineName(prod.name_en || "");
    setNameAr(prod.name_ar || "");
    setScientificIngredients(parseScientificIngredients(prod.scientific_name || ""));
    setDrugClass(prod.drug_class || "");
    setRoute(prod.route || "");
    setCategory(prod.category || "");
    setDosageForm(prod.dosage_form || "");
    setStrength(prod.strength || "");
    setBarcode(prod.barcode || "");
    setProductCode(prod.code || "");
    setPriceEgp(prod.current_price_egp ? String(prod.current_price_egp) : "");
    setImageUrl(prod.image_url || "");
    setLine(prod.line || "");

    const mfg = prod.manufacturer || "";
    if (mfg.includes("(")) {
      const parts = mfg.split("(");
      setTrademarkOwnerChoice(parts[0].trim());
      setTollManufacturerChoice(parts[1]?.replace(")", "").trim() || "");
    } else {
      setTrademarkOwnerChoice(mfg);
      setTollManufacturerChoice("");
    }

    setMessage(
      t(
        `Loaded "${prod.name_en}" for editing. Update fields below and click Save.`,
        `تم تحميل "${prod.name_en}" للتعديل. حدّث الحقول أدناه ثم احفظ.`,
      ),
    );
    window.scrollTo({
      top: document.getElementById("add-medicine")?.offsetTop || 400,
      behavior: "smooth",
    });
  };

  const handleResetForm = () => {
    setCanonicalId(null);
    setMedicineName("");
    setNameAr("");
    setScientificIngredients([]);
    setDrugClass("");
    setRoute("");
    setCategory("");
    setStrength("");
    setDosageForm("");
    setLine("");
    setBarcode("");
    setProductCode("");
    setPriceEgp("");
    setImageUrl("");
    setDescription("");
    setTollManufacturerChoice("");
    setTrademarkOwnerChoice("");
    setError(null);
    setMessage(null);
  };

  const handleConfirmOwnership = (prod: MedicineProduct) => {
    confirmPortfolioOwnership(prod, actor);
    setMessage(
      t(
        `Confirmed ownership of "${prod.name_en}" for ${actor.companyName}.`,
        `تم تأكيد ملكية "${prod.name_en}" لـ ${actor.companyName}.`,
      ),
    );
    void loadPortfolio();
  };

  const handleRemoveOwnership = (prod: MedicineProduct) => {
    unclaimPortfolioProduct(prod, actor);
    setMessage(
      t(
        `Removed "${prod.name_en}" from your portfolio. Global catalog entry was not deleted.`,
        `تمت إزالة "${prod.name_en}" من محفظتكم. لم يُحذف السجل من الكتالوج العام.`,
      ),
    );
    void loadPortfolio();
  };

  const handleClaimSearch = async () => {
    const q = claimQuery.trim();
    if (q.length < 2) return;
    setClaimBusy(true);
    setError(null);
    try {
      const result = await fetchMedicinesPage({
        limit: 25,
        filters: { query: q },
      });
      const ownedIds = new Set(portfolio.map((p) => p.canonical_id));
      const hits = (result.items || [])
        .filter((item) => item.canonical_id && !ownedIds.has(item.canonical_id))
        .map(
          (item): MedicineProduct => ({
            canonical_id: item.canonical_id,
            name_en: item.name_en || "",
            name_ar: item.name_ar || "",
            scientific_name: item.scientific_name || "",
            manufacturer: item.manufacturer || "",
            drug_class: item.drug_class || "",
            route: item.route || "",
            category: item.category || "",
            image_url: item.image_url || "",
            barcode: item.barcode || "",
            code: item.code || "",
            current_price_egp: Number(item.current_price_egp) || 0,
          }),
        );
      setClaimHits(hits);
      if (hits.length === 0) {
        setMessage(
          t(
            "No catalog products found to claim. Try another name or add a new product above.",
            "لا منتجات في الكتالوج للمطالبة. جرّب اسماً آخر أو أضف منتجاً جديداً أعلاه.",
          ),
        );
      }
    } catch (e: any) {
      setError(e?.message || t("Catalog search failed.", "فشل البحث في الكتالوج."));
    } finally {
      setClaimBusy(false);
    }
  };

  const handleClaimProduct = (prod: MedicineProduct) => {
    claimCatalogProductIntoPortfolio(prod, actor);
    setClaimHits((prev) => prev.filter((p) => p.canonical_id !== prod.canonical_id));
    setMessage(
      t(
        `Claimed "${prod.name_en}" into ${actor.companyName} portfolio.`,
        `تمت مطالبة "${prod.name_en}" ضمن محفظة ${actor.companyName}.`,
      ),
    );
    void loadPortfolio();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) {
      setError(t("Product English Name is required.", "اسم المنتج بالإنجليزية مطلوب."));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const finalToll = tollManufacturerChoice;
      const finalTrademark =
        trademarkOwnerChoice || activeProfile?.display_name || companyName || "Company";
      const finalMfg = finalToll
        ? `${finalTrademark} (${finalToll})`
        : finalTrademark;

      // Soft defaults when left empty so portfolio rows are not blank
      const resolvedRoute = route.trim() || DEFAULT_ROUTE;
      const resolvedCategory = category.trim() || DEFAULT_CATEGORY;

      const rawPayload: Partial<MedicineProduct> & Record<string, any> = {
        canonical_id: canonicalId || Date.now(),
        name_en: medicineName.trim(),
        name_ar: nameAr.trim(),
        scientific_name: scientificName.trim(),
        drug_class: drugClass.trim(),
        route: resolvedRoute,
        category: resolvedCategory,
        strength: strength.trim(),
        dosage_form: dosageForm.trim(),
        line: line.trim(),
        barcode: barcode.trim(),
        code: productCode.trim(),
        current_price_egp: priceEgp ? parseFloat(priceEgp) : 0,
        image_url: imageUrl.trim(),
        manufacturer: finalMfg,
        description: description.trim(),
        company_slug: activeProfile?.company_slug || companySlug || "company",
        ownership_status: "confirmed",
        updated_at: new Date().toISOString(),
      };

      const savePlan = planContributionSave({
        actor: {
          email: session?.user?.email || "rep@company.com",
          userId: session?.user?.id,
          member: {
            id: session?.user?.id || "member_1",
            company_slug: activeProfile?.company_slug || companySlug || "company",
            company_name: activeProfile?.display_name || companyName || "Company",
            user_email: session?.user?.email || "rep@company.com",
            user_id: session?.user?.id,
            role: "company_ceo",
            status: "active",
            invited_at: new Date().toISOString(),
          },
          claimApproved: true,
        },
        product: {
          company_slug: activeProfile?.company_slug || companySlug || "company",
          company_name: activeProfile?.display_name || companyName,
          product_line: line.trim(),
          canonical_id: canonicalId || undefined,
          manufacturer: finalMfg,
        },
        payload: rawPayload,
        intent: "publish",
        isUpdate: Boolean(canonicalId),
        notes: description.trim() || undefined,
      });

      if (!savePlan.ok) {
        setError(savePlan.error || "Contribution policy rejected product update.");
        setBusy(false);
        return;
      }

      const productPayload = {
        ...rawPayload,
        ...(savePlan.provenance || {}),
      };

      if (canonicalId) {
        await supabaseFetch(`/rest/v1/medicine_encyclopedia_products_v2?canonical_id=eq.${canonicalId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(productPayload),
        }).catch(() => {});
      } else {
        await supabaseFetch(`/rest/v1/medicine_encyclopedia_products_v2`, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(productPayload),
        }).catch(() => {});
      }

      if (typeof window !== "undefined") {
        try {
          const scopeSlug = normalizeCompanySlug(
            activeProfile?.company_slug || companySlug || "company",
          );
          const storageKey = `company_portfolio_updates_${scopeSlug}`;
          const existingRaw = localStorage.getItem(storageKey);
          let existingList: MedicineProduct[] = existingRaw ? JSON.parse(existingRaw) : [];
          if (!Array.isArray(existingList)) existingList = [];

          const existingIdx = existingList.findIndex(
            (p) => p.canonical_id === productPayload.canonical_id,
          );
          if (existingIdx >= 0) {
            existingList[existingIdx] = {
              ...existingList[existingIdx],
              ...productPayload,
            } as MedicineProduct;
          } else {
            existingList.unshift(productPayload as MedicineProduct);
          }
          localStorage.setItem(storageKey, JSON.stringify(existingList));

          recordCompanyProductProvenance({
            canonicalId: Number(productPayload.canonical_id),
            isUpdate: Boolean(canonicalId),
            companyName: activeProfile?.display_name,
            companySlug: scopeSlug,
            actorUserId: session?.user?.id,
            actorEmail: session?.user?.email,
            productPayload: productPayload as Record<string, unknown>,
          });

          localStorage.setItem(
            `medicine_update_${productPayload.canonical_id}`,
            JSON.stringify(productPayload),
          );

          const globalRaw = localStorage.getItem("all_custom_medicine_updates");
          let globalList: MedicineProduct[] = globalRaw ? JSON.parse(globalRaw) : [];
          if (!Array.isArray(globalList)) globalList = [];
          const gIdx = globalList.findIndex(
            (p) => p.canonical_id === productPayload.canonical_id,
          );
          if (gIdx >= 0) globalList[gIdx] = { ...globalList[gIdx], ...productPayload } as MedicineProduct;
          else globalList.unshift(productPayload as MedicineProduct);
          localStorage.setItem("all_custom_medicine_updates", JSON.stringify(globalList));
        } catch {}
      }

      // Persist any custom taxonomy values that were typed without going through + Add new.
      const actorMeta = { userId: session?.user?.id, email: session?.user?.email };
      const ensurePersist = async (kind: TaxonomyKind, val: string) => {
        const v = val.trim();
        if (!v) return;
        await persistTaxonomyValue(kind, v, actorMeta);
      };
      await Promise.all([
        ...scientificIngredients.map((ing) => ensurePersist("ingredient", ing)),
        ensurePersist("drug_class", drugClass),
        ensurePersist("route", resolvedRoute),
        ensurePersist("category", resolvedCategory),
        ensurePersist("dosage_form", dosageForm),
        ensurePersist("strength", strength),
        ensurePersist("product_line", line),
      ]);

      setMessage(
        canonicalId
          ? t(
              `Successfully updated "${medicineName.trim()}".`,
              `تم تحديث "${medicineName.trim()}" بنجاح.`,
            )
          : t(
              `Successfully published new medicine "${medicineName.trim()}".`,
              `تم نشر الدواء الجديد "${medicineName.trim()}" بنجاح.`,
            ),
      );
      handleResetForm();
      void loadPortfolio();
    } catch (err: any) {
      console.error("Submit error:", err);
      setError(
        err.message ||
          t(
            "Failed to save medicine product. Please try again.",
            "تعذر حفظ منتج الدواء. حاول مرة أخرى.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="add-medicine" className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold">
            {canonicalId
              ? t("Edit Company Product Portfolio Item", "تعديل منتج في محفظة الشركة")
              : t("Submit & Add Product Portfolio", "تقديم وإضافة منتج للمحفظة")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProfile?.display_name || companySlug?.toUpperCase() || "Company"}{" "}
            {t("verified brand catalog management", "إدارة كتالوج العلامة الموثّق")}
          </p>
        </div>

        {canonicalId && (
          <Button variant="outline" size="sm" type="button" onClick={handleResetForm}>
            {t("+ Add New Product Instead", "＋ إضافة منتج جديد بدلاً من ذلك")}
          </Button>
        )}
      </div>

      {message && (
        <Alert className="mb-6 border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <AlertDescription className="font-semibold">{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">
              {t("Product Trade Name (English) *", "الاسم التجاري (إنجليزي) *")}
            </Label>
            <div className="mt-1">
              <SearchableCombobox
                options={tradeNameOptions}
                value={tradeNameValue}
                onChange={(v) => {
                  if (v.startsWith("id:")) {
                    const id = Number(v.slice(3));
                    const prod = portfolio.find((p) => p.canonical_id === id);
                    if (prod) {
                      selectProductToEdit(prod);
                      return;
                    }
                  }
                  // + Add new / custom trade name → portfolio create path (does not delete globals)
                  setCanonicalId(null);
                  setMedicineName(v);
                }}
                placeholder={t(
                  "Search your company portfolio or add new…",
                  "ابحث في محفظة شركتك أو أضف جديداً…",
                )}
                searchPlaceholder={t(
                  "Search company products…",
                  "ابحث في منتجات الشركة…",
                )}
                addNewText={t("+ Add new trade name", "＋ إضافة اسم تجاري جديد")}
                addNewDescription={t(
                  "Create a new company portfolio product name.",
                  "أنشئ اسم منتج جديداً في محفظة الشركة.",
                )}
                emptyText={t(
                  "No company portfolio match. Use + Add new trade name.",
                  "لا تطابق في محفظة الشركة. استخدم ＋ إضافة اسم تجاري جديد.",
                )}
              />
            </div>
            {!medicineName.trim() && !canonicalId ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t(
                  "Required — pick an existing company product to edit, or add a new trade name.",
                  "مطلوب — اختر منتجاً من محفظة الشركة للتعديل، أو أضف اسماً تجارياً جديداً.",
                )}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t(
                  "Company-scoped: options come from your pharmaceutical company portfolio.",
                  "نطاق الشركة: الخيارات من محفظة شركتك الدوائية.",
                )}
              </p>
            )}
            {/* Hidden required mirror for native form validation when combobox is custom */}
            <input type="text" value={medicineName} required readOnly className="sr-only" tabIndex={-1} aria-hidden />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Product Name (Arabic)", "اسم المنتج (عربي)")}
            </Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: نقط نينو"
              dir="rtl"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t(
                "Prefills when you select a company product that already has an Arabic name.",
                "يُملأ تلقائياً عند اختيار منتج شركة له اسم عربي.",
              )}
            </p>
          </div>

          {/* Cascade: Therapeutic class first → narrows API list */}
          <div>
            <Label className="text-xs font-semibold">
              {t("Therapeutic / Drug Class", "الفئة العلاجية / فئة الدواء")}
            </Label>
            <SearchableCombobox
              options={drugClassOptions}
              value={drugClass}
              onChange={setDrugClass}
              onAddNew={persistGlobalAdd("drug_class")}
              placeholder={t(
                "Start here — e.g. Probiotics, Antibiotics…",
                "ابدأ من هنا — مثال: بروبيوتيك، مضادات حيوية…",
              )}
              searchPlaceholder={t("Search therapeutic class...", "ابحث عن الفئة العلاجية...")}
              addNewText={t("+ Add New Drug Class", "＋ إضافة فئة دواء جديدة")}
              addNewDescription={t(
                "Add a class if missing from the list.",
                "أضف فئة إذا لم تكن موجودة في القائمة.",
              )}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t(
                "Filtering the API list by class makes exact ingredients easier to find.",
                "تصفية قائمة المواد الفعالة حسب الفئة تسهّل إيجاد المادة الدقيقة.",
              )}
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Scientific Active Ingredient (API)", "المادة الفعالة العلمية (API)")}
            </Label>
            <SearchableMultiCombobox
              options={scientificOptions}
              values={scientificIngredients}
              onChange={setScientificIngredients}
              onAddNew={persistGlobalAdd("ingredient")}
              placeholder={
                drugClass
                  ? t(
                      `APIs in ${drugClass} — multi-select, exact first`,
                      `مواد فعالة في ${drugClass} — اختيار متعدد، التطابق التام أولاً`,
                    )
                  : t(
                      "Select one or more active ingredients…",
                      "اختر مادة فعالة واحدة أو أكثر…",
                    )
              }
              searchPlaceholder={t(
                "Search API (exact / prefix ranked)…",
                "ابحث عن المادة الفعالة (تطابق تام / بادئة أولاً)…",
              )}
              addNewText={t("+ Add New Ingredient", "＋ إضافة مادة فعالة جديدة")}
              addNewDescription={t(
                "Add a custom API for this portfolio entry if missing from the list.",
                "أضف مادة فعالة مخصصة لهذا السجل إذا لم تكن في القائمة.",
              )}
              emptyText={t(
                "No matching ingredient. Use + Add New Ingredient.",
                "لا مادة مطابقة. استخدم ＋ إضافة مادة فعالة جديدة.",
              )}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t(
                "Combo products: select multiple APIs. Saved as a joined scientific name.",
                "المنتجات المركّبة: اختر عدة مواد فعالة. تُحفظ كاسم علمي مدمج.",
              )}
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Administration Route", "طريق الإعطاء")}
            </Label>
            <SearchableCombobox
              options={routeOptions}
              value={route}
              onChange={setRoute}
              onAddNew={persistGlobalAdd("route")}
              placeholder={t(
                `Select route (default if empty: ${DEFAULT_ROUTE})`,
                `اختر طريق الإعطاء (الافتراضي إن تُرك فارغاً: ${DEFAULT_ROUTE})`,
              )}
              searchPlaceholder={t("Search route (Oral, IV, Topical)…", "ابحث عن الطريق (فموي، وريدي، موضعي)…")}
              addNewText={t("+ Add New Route", "＋ إضافة طريق إعطاء جديد")}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Product Category", "فئة المنتج")}
            </Label>
            <SearchableCombobox
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              onAddNew={persistGlobalAdd("category")}
              placeholder={t(
                `Select category (default if empty: ${DEFAULT_CATEGORY})`,
                `اختر الفئة (الافتراضي إن تُركت فارغة: ${DEFAULT_CATEGORY})`,
              )}
              searchPlaceholder={t("Search category…", "ابحث عن الفئة…")}
              addNewText={t("+ Add New Category", "＋ إضافة فئة جديدة")}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">{t("Dosage Form", "الشكل الصيدلاني")}</Label>
            <SearchableCombobox
              options={dosageFormOptions}
              value={dosageForm}
              onChange={setDosageForm}
              onAddNew={persistGlobalAdd("dosage_form")}
              placeholder={t("Select dosage form…", "اختر الشكل الصيدلاني…")}
              searchPlaceholder={t(
                "Search dosage form (Tablet, Drops, Syrup)…",
                "ابحث عن الشكل (أقراص، نقط، شراب)…",
              )}
              addNewText={t("+ Add New Dosage Form", "＋ إضافة شكل صيدلاني جديد")}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Strength / Concentration", "التركيز / القوة")}
            </Label>
            <SearchableCombobox
              options={strengthOptions}
              value={strength}
              onChange={setStrength}
              onAddNew={persistGlobalAdd("strength")}
              placeholder={t("Select strength…", "اختر التركيز…")}
              searchPlaceholder={t(
                "Search concentration (e.g. 500mg, 10mg/ml)…",
                "ابحث عن التركيز (مثال: 500mg)…",
              )}
              addNewText={t("+ Add New Strength", "＋ إضافة تركيز جديد")}
            />
          </div>
        </div>

        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">
              {t("Trademark Owner / Brand Owner", "مالك العلامة التجارية")}
            </Label>
            <Input
              value={trademarkOwnerChoice || activeProfile?.display_name || companyName || ""}
              onChange={(e) => setTrademarkOwnerChoice(e.target.value)}
              placeholder={t("Company Trademark Owner", "مالك العلامة")}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Toll / Contract Manufacturer (If Applicable)", "التصنيع لدى الغير (إن وُجد)")}
            </Label>
            <Input
              value={tollManufacturerChoice}
              onChange={(e) => setTollManufacturerChoice(e.target.value)}
              placeholder={t("e.g., Contract Plant", "مثال: مصنع تعاقدي")}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Product Line / Division", "خط الإنتاج / القسم")}
            </Label>
            <SearchableCombobox
              options={lineOptions}
              value={line}
              onChange={setLine}
              onAddNew={persistGlobalAdd("product_line")}
              placeholder={t("Select product line…", "اختر خط المنتج…")}
              searchPlaceholder={t("Search division / product line…", "ابحث عن القسم / الخط…")}
              addNewText={t("+ Add New Product Line", "＋ إضافة خط منتج جديد")}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Official List Price (EGP)", "سعر القائمة الرسمي (ج.م)")}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={priceEgp}
              onChange={(e) => setPriceEgp(e.target.value)}
              placeholder="e.g., 45.00"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("International Barcode (GTIN / EAN-13)", "الباركود الدولي")}
            </Label>
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="622..."
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Internal SKU / Product Code", "كود المنتج الداخلي")}
            </Label>
            <Input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="SKU-001"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">
            {t("Product High-Resolution Image URL", "رابط صورة المنتج عالية الدقة")}
          </Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold">
            {t("Clinical Indications & Regulatory Notes", "الاستطبابات والملاحظات التنظيمية")}
          </Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(
              "Approved indications, storage conditions, and prescribing information…",
              "الاستطبابات المعتمدة، ظروف التخزين، ومعلومات الوصف…",
            )}
            rows={3}
            className="mt-1"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {canonicalId && (
            <Button type="button" variant="outline" onClick={handleResetForm}>
              {t("Cancel Edit", "إلغاء التعديل")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {busy ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {canonicalId
              ? t("Save Product Updates", "حفظ تحديثات المنتج")
              : t("Publish to Verified Catalog", "نشر إلى الكتالوج الموثّق")}
          </Button>
        </div>
      </form>

      {/* Claim from catalog */}
      <div className="border-t mt-8 pt-6 space-y-3">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Plus className="h-4 w-4 text-emerald-600" />
          {t("Add / Claim Catalog Product", "إضافة / مطالبة منتج من الكتالوج")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "Search the live encyclopedia and claim a product into your company portfolio without deleting anyone else’s catalog entry.",
            "ابحث في الموسوعة المباشرة وطالب بمنتج لمحفظة شركتكم دون حذف سجلات الآخرين.",
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={claimQuery}
            onChange={(e) => setClaimQuery(e.target.value)}
            placeholder={t("Search catalog by trade name or API…", "ابحث في الكتالوج بالاسم أو المادة الفعالة…")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleClaimSearch();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={claimBusy || claimQuery.trim().length < 2}
            onClick={() => void handleClaimSearch()}
          >
            {claimBusy ? <Spinner className="mr-2 h-4 w-4" /> : <Search className="mr-2 h-4 w-4" />}
            {t("Search", "بحث")}
          </Button>
        </div>
        {claimHits.length > 0 && (
          <div className="rounded-xl border divide-y max-h-64 overflow-y-auto">
            {claimHits.map((hit) => (
              <div
                key={hit.canonical_id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{hit.name_en}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {hit.scientific_name || "—"} · {hit.manufacturer || "—"}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => handleClaimProduct(hit)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("Claim into portfolio", "مطالبة للمحفظة")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio product cards — stacked on mobile, denser grid on sm+ */}
      <div className="border-t mt-8 pt-6">
        <h3 className="text-lg font-bold mb-3 flex items-center justify-between gap-2">
          <span>
            {t("Registered Portfolio Products", "منتجات المحفظة المسجّلة")} ({portfolio.length})
          </span>
          {loadingPortfolio && <Spinner className="h-4 w-4 shrink-0 text-emerald-600" />}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {t(
            "Only products owned by or claimed for your company are listed. Remove unclaims from your portfolio only — the global catalog stays intact.",
            "تُعرض فقط المنتجات المملوكة أو المطالَب بها لشركتكم. الإزالة تلغي المطالبة من محفظتكم فقط — الكتالوج العام يبقى كما هو.",
          )}
        </p>

        {portfolio.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
              <Package className="h-6 w-6" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("No products in your portfolio yet", "لا منتجات في محفظتكم بعد")}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {t(
                  "Publish a new product above, or search the catalog and claim an existing one into your portfolio.",
                  "انشر منتجاً جديداً أعلاه، أو ابحث في الكتالوج وطالب بمنتج موجود لإضافته إلى محفظتكم.",
                )}
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {portfolio.map((prod) => {
              const metaBits = [
                prod.scientific_name,
                prod.strength,
                prod.dosage_form,
              ].filter((bit): bit is string => Boolean(bit && String(bit).trim()));
              const lineLabel = prod.line || prod.category || "";
              return (
                <li
                  key={prod.canonical_id}
                  className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
                >
                  <PackshotFrame url={prod.image_url} variant="portfolio" />
                  <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold leading-snug break-words">
                        {prod.name_en}
                      </h4>
                      {prod.name_ar ? (
                        <p className="mt-0.5 text-xs text-muted-foreground break-words">
                          {prod.name_ar}
                        </p>
                      ) : null}
                    </div>
                    {prod.ownership_status === "confirmed" ? (
                      <Badge className="shrink-0 bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {t("Confirmed", "مؤكد")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        {t("Claimed", "مطالَب")}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {metaBits.length > 0 ? (
                      <p className="leading-relaxed break-words">
                        <span className="font-medium text-foreground/80">
                          {t("API / Strength", "المادة / التركيز")}:{" "}
                        </span>
                        {metaBits.join(" · ")}
                      </p>
                    ) : (
                      <p className="leading-relaxed">
                        <span className="font-medium text-foreground/80">
                          {t("API / Ingredient", "المادة الفعالة")}:{" "}
                        </span>
                        —
                      </p>
                    )}
                    {lineLabel ? (
                      <p>
                        <span className="font-medium text-foreground/80">
                          {t("Line", "الخط")}:{" "}
                        </span>
                        {lineLabel}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:mt-auto sm:pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full justify-center text-sm"
                      onClick={() => selectProductToEdit(prod)}
                    >
                      {t("Edit", "تعديل")}
                    </Button>
                    {prod.ownership_status !== "confirmed" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 w-full justify-center text-sm"
                        onClick={() => handleConfirmOwnership(prod)}
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4 shrink-0" />
                        {t("Confirm ownership", "تأكيد الملكية")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 w-full justify-center text-sm text-destructive hover:text-destructive"
                      onClick={() => handleRemoveOwnership(prod)}
                      title={t(
                        "Remove from your portfolio only (does not delete catalog)",
                        "إزالة من محفظتكم فقط (لا يحذف الكتالوج)",
                      )}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4 shrink-0" />
                      {t("Remove", "إزالة")}
                    </Button>
                  </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
