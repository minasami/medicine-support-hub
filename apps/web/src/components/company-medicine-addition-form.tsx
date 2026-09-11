import { useState, FormEvent, useEffect, useMemo, useCallback } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { recordCompanyProductProvenance } from "@/lib/record-company-product-provenance";
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
import { ShieldCheck, Plus, Trash2, Search } from "lucide-react";

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
  const [scientificName, setScientificName] = useState("");
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

  useEffect(() => {
    async function loadPickerOptions() {
      try {
        const facets = await supabaseFetch<{ facet_type: string; facet_value: string }[]>(
          "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_type,facet_value&facet_type=in.(drug_class,route,category)&order=product_count.desc&limit=2000",
        );
        if (Array.isArray(facets)) {
          const dc = new Set<string>();
          const rt = new Set<string>();
          const cat = new Set<string>();
          for (const f of facets) {
            if (f.facet_type === "drug_class" && f.facet_value) dc.add(f.facet_value);
            if (f.facet_type === "route" && f.facet_value) rt.add(f.facet_value);
            if (f.facet_type === "category" && f.facet_value) cat.add(f.facet_value);
          }
          setDrugClassOptions(Array.from(dc).map((v) => ({ label: v, value: v })));
          setRouteOptions(Array.from(rt).map((v) => ({ label: v, value: v })));
          setCategoryOptions(Array.from(cat).map((v) => ({ label: v, value: v })));
          // Sensible defaults when lists exist
          if (rt.has(DEFAULT_ROUTE) || Array.from(rt).some((v) => /^oral$/i.test(v))) {
            /* keep empty until user picks — placeholders guide; soft-default on first empty submit UX */
          }
        }

        const [dfRows1, dfRows2, dfFacets] = await Promise.all([
          supabaseFetch<{ dosage_form: string }[]>(
            "/rest/v1/medicines?select=dosage_form&dosage_form=not.is.null&limit=2500",
          ).catch((): { dosage_form: string }[] => []),
          supabaseFetch<{ dosage_form: string }[]>(
            "/rest/v1/medicine_encyclopedia_products_v2?select=dosage_form&dosage_form=not.is.null&limit=2500",
          ).catch((): { dosage_form: string }[] => []),
          supabaseFetch<{ facet_value: string }[]>(
            "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_value&facet_type=eq.dosage_form&limit=1000",
          ).catch((): { facet_value: string }[] => []),
        ]);

        const combinedDf = new Set<string>();
        for (const rows of [dfRows1, dfRows2]) {
          if (Array.isArray(rows)) {
            rows.forEach((d) => {
              if (d.dosage_form?.trim()) combinedDf.add(d.dosage_form.trim());
            });
          }
        }
        if (Array.isArray(dfFacets)) {
          dfFacets.forEach((f) => {
            if (f.facet_value?.trim()) combinedDf.add(f.facet_value.trim());
          });
        }
        setDosageFormOptions(
          Array.from(combinedDf)
            .sort((a, b) => a.localeCompare(b))
            .map((v) => ({ label: v, value: v })),
        );

        const strengthRows = await supabaseFetch<{ strength: string }[]>(
          "/rest/v1/medicines?select=strength&strength=not.is.null&order=strength.asc&limit=500",
        );
        if (Array.isArray(strengthRows)) {
          const st = Array.from(new Set(strengthRows.map((s) => s.strength).filter(Boolean)));
          setStrengthOptions(st.map((v) => ({ label: v, value: v })));
        }

        // Scientific names WITH drug_class for cascade filter
        const [sciPairs1, sciPairs2] = await Promise.all([
          supabaseFetch<{ scientific_name: string; drug_class?: string }[]>(
            "/rest/v1/medicines?select=scientific_name,drug_class&scientific_name=not.is.null&limit=4000",
          ).catch((): { scientific_name: string; drug_class?: string }[] => []),
          supabaseFetch<{ scientific_name: string; drug_class?: string }[]>(
            "/rest/v1/medicine_encyclopedia_products_v2?select=scientific_name,drug_class&scientific_name=not.is.null&limit=4000",
          ).catch((): { scientific_name: string; drug_class?: string }[] => []),
        ]);

        const byName = new Map<string, Set<string>>();
        for (const rows of [sciPairs1, sciPairs2]) {
          if (!Array.isArray(rows)) continue;
          for (const row of rows) {
            const name = String(row.scientific_name || "").trim();
            if (!name) continue;
            if (!byName.has(name)) byName.set(name, new Set());
            const cls = String(row.drug_class || "").trim();
            if (cls) byName.get(name)!.add(cls);
          }
        }

        const sciOpts: SciOption[] = Array.from(byName.entries()).map(([name, classes]) => {
          const classList = Array.from(classes);
          const isCombo = /[+\/&,;|]/.test(name) || name.length > 48;
          return {
            label: name,
            value: name,
            meta: classList[0]
              ? isCombo
                ? t("Combination · ", "تركيبة · ") + classList[0]
                : classList[0]
              : isCombo
                ? t("Combination API", "مادة فعالة مركّبة")
                : undefined,
            drugClasses: classList,
          };
        });
        setScientificRaw(sciOpts);

        const [lineRows1, lineRows2] = await Promise.all([
          supabaseFetch<{ line: string }[]>(
            "/rest/v1/company_area_representatives?select=line&line=not.is.null&limit=1000",
          ).catch((): { line: string }[] => []),
          supabaseFetch<{ line: string }[]>(
            "/rest/v1/medicines?select=line&line=not.is.null&limit=1000",
          ).catch((): { line: string }[] => []),
        ]);
        const combinedLines = new Set<string>();
        for (const rows of [lineRows1, lineRows2]) {
          if (Array.isArray(rows)) {
            rows.forEach((l) => {
              if (l.line?.trim()) combinedLines.add(l.line.trim());
            });
          }
        }
        setLineOptions(
          Array.from(combinedLines)
            .sort((a, b) => a.localeCompare(b))
            .map((v) => ({ label: v, value: v })),
        );
      } catch (e) {
        console.error("Error loading picker options:", e);
      }
    }
    void loadPickerOptions();
  }, [supabaseFetch, t]);

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

  // When API selected and drug class empty, auto-fill if unique class known
  useEffect(() => {
    if (!scientificName.trim() || drugClass.trim()) return;
    const match = scientificRaw.find(
      (o) => o.value.toLowerCase() === scientificName.trim().toLowerCase(),
    );
    if (match && match.drugClasses.length === 1) {
      setDrugClass(match.drugClasses[0]);
    }
  }, [scientificName, scientificRaw, drugClass]);

  const selectProductToEdit = (prod: MedicineProduct) => {
    setCanonicalId(prod.canonical_id);
    setMedicineName(prod.name_en || "");
    setNameAr(prod.name_ar || "");
    setScientificName(prod.scientific_name || "");
    setDrugClass(prod.drug_class || "");
    setRoute(prod.route || "");
    setCategory(prod.category || "");
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
    setScientificName("");
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

      // If user typed a brand-new API, keep it in the local picker list
      if (
        scientificName.trim() &&
        !scientificRaw.some(
          (o) => o.value.toLowerCase() === scientificName.trim().toLowerCase(),
        )
      ) {
        setScientificRaw((prev) => [
          {
            label: scientificName.trim(),
            value: scientificName.trim(),
            meta: drugClass.trim() || t("Custom ingredient", "مادة فعالة مخصصة"),
            drugClasses: drugClass.trim() ? [drugClass.trim()] : [],
          },
          ...prev,
        ]);
      }
      if (
        drugClass.trim() &&
        !drugClassOptions.some((o) => o.value.toLowerCase() === drugClass.trim().toLowerCase())
      ) {
        setDrugClassOptions((prev) => [
          { label: drugClass.trim(), value: drugClass.trim() },
          ...prev,
        ]);
      }
      if (
        route.trim() &&
        !routeOptions.some((o) => o.value.toLowerCase() === route.trim().toLowerCase())
      ) {
        setRouteOptions((prev) => [{ label: route.trim(), value: route.trim() }, ...prev]);
      }
      if (
        category.trim() &&
        !categoryOptions.some((o) => o.value.toLowerCase() === category.trim().toLowerCase())
      ) {
        setCategoryOptions((prev) => [
          { label: category.trim(), value: category.trim() },
          ...prev,
        ]);
      }

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
            <Input
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder={t("e.g., Neno drops", "مثال: نقط نينو")}
              required
              className="mt-1"
            />
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
            <SearchableCombobox
              options={scientificOptions}
              value={scientificName}
              onChange={setScientificName}
              placeholder={
                drugClass
                  ? t(
                      `APIs in ${drugClass} — exact matches first`,
                      `مواد فعالة في ${drugClass} — التطابق التام أولاً`,
                    )
                  : t(
                      "Select or add active ingredient…",
                      "اختر أو أضف مادة فعالة…",
                    )
              }
              searchPlaceholder={t(
                "Search API (exact / prefix ranked)…",
                "ابحث عن المادة الفعالة (تطابق تام / بادئة أولاً)…",
              )}
              addNewText={t("+ Add New Ingredient", "＋ إضافة مادة فعالة جديدة")}
              addNewDescription={t(
                "Create a new API if it is missing from the catalog.",
                "أنشئ مادة فعالة جديدة إذا لم تكن موجودة في الكتالوج.",
              )}
              emptyText={t(
                "No matching ingredient. Use + Add New Ingredient below.",
                "لا مادة مطابقة. استخدم ＋ إضافة مادة فعالة جديدة.",
              )}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              {t("Administration Route", "طريق الإعطاء")}
            </Label>
            <SearchableCombobox
              options={routeOptions}
              value={route}
              onChange={setRoute}
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

      {/* Portfolio Table */}
      <div className="border-t mt-8 pt-6">
        <h3 className="text-lg font-bold mb-3 flex items-center justify-between">
          <span>
            {t("Registered Portfolio Products", "منتجات المحفظة المسجّلة")} ({portfolio.length})
          </span>
          {loadingPortfolio && <Spinner className="h-4 w-4 text-emerald-600" />}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {t(
            "Only products owned by or claimed for your company are listed. Remove unclaims from your portfolio only — the global catalog stays intact.",
            "تُعرض فقط المنتجات المملوكة أو المطالَب بها لشركتكم. الإزالة تلغي المطالبة من محفظتكم فقط — الكتالوج العام يبقى كما هو.",
          )}
        </p>

        {portfolio.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t(
              "No portfolio items registered yet. Publish above or claim a catalog product.",
              "لا منتجات في المحفظة بعد. انشر أعلاه أو طالب بمنتج من الكتالوج.",
            )}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">{t("Product Name", "اسم المنتج")}</th>
                  <th className="p-3">{t("API / Ingredient", "المادة الفعالة")}</th>
                  <th className="p-3">{t("Line", "الخط")}</th>
                  <th className="p-3">{t("Ownership", "الملكية")}</th>
                  <th className="p-3 text-right">{t("Actions", "إجراءات")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {portfolio.map((prod) => (
                  <tr key={prod.canonical_id} className="hover:bg-muted/20">
                    <td className="p-3 font-medium">
                      <div className="font-bold">{prod.name_en}</div>
                      {prod.name_ar && (
                        <div className="text-xs text-muted-foreground">{prod.name_ar}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {prod.scientific_name || "—"}
                    </td>
                    <td className="p-3 text-xs">{prod.line || prod.category || "General"}</td>
                    <td className="p-3">
                      {prod.ownership_status === "confirmed" ? (
                        <Badge className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {t("Confirmed", "مؤكد")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("Claimed", "مطالَب")}</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => selectProductToEdit(prod)}
                        >
                          {t("Edit", "تعديل")}
                        </Button>
                        {prod.ownership_status !== "confirmed" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleConfirmOwnership(prod)}
                          >
                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                            {t("Confirm ownership", "تأكيد الملكية")}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRemoveOwnership(prod)}
                          title={t(
                            "Remove from your portfolio only (does not delete catalog)",
                            "إزالة من محفظتكم فقط (لا يحذف الكتالوج)",
                          )}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {t("Remove", "إزالة")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
