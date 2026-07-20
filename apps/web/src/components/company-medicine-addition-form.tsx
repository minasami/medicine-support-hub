import { useState, FormEvent, useEffect, useMemo, useCallback } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

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
};

export function CompanyMedicineAdditionForm({ companySlug }: { companySlug?: string }) {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  const [portfolio, setPortfolio] = useState<MedicineProduct[]>([]);
  const [activeProfile, setActiveProfile] = useState<{ id: string; organization_id: string; company_slug: string; display_name?: string } | null>(null);
  
  // Database option lists for pickers
  const [scientificOptions, setScientificOptions] = useState<{ label: string; value: string }[]>([]);
  const [drugClassOptions, setDrugClassOptions] = useState<{ label: string; value: string }[]>([]);
  const [routeOptions, setRouteOptions] = useState<{ label: string; value: string }[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [dosageFormOptions, setDosageFormOptions] = useState<{ label: string; value: string }[]>([]);
  const [strengthOptions, setStrengthOptions] = useState<{ label: string; value: string }[]>([]);
  const [existingTollManufacturers, setExistingTollManufacturers] = useState<string[]>([]);

  // Selected canonical id
  const [canonicalId, setCanonicalId] = useState<number | null>(null);

  // Form fields
  const [medicineName, setMedicineName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [drugClass, setDrugClass] = useState("");
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [barcode, setBarcode] = useState("");
  const [productCode, setProductCode] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  // Split Manufacturer Fields
  const [tollManufacturerChoice, setTollManufacturerChoice] = useState("");
  const [customTollManufacturer, setCustomTollManufacturer] = useState("");

  const [trademarkOwnerChoice, setTrademarkOwnerChoice] = useState("");
  const [customTrademarkOwner, setCustomTrademarkOwner] = useState("");

  // Load database option pickers
  useEffect(() => {
    async function loadPickerOptions() {
      try {
        // 1. Drug class, Route, Category from precomputed facets
        const facets = await supabaseFetch<{ facet_type: string; facet_value: string }[]>(
          "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_type,facet_value&facet_type=in.(drug_class,route,category)&order=product_count.desc&limit=2000"
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
          setDrugClassOptions(Array.from(dc).map(v => ({ label: v, value: v })));
          setRouteOptions(Array.from(rt).map(v => ({ label: v, value: v })));
          setCategoryOptions(Array.from(cat).map(v => ({ label: v, value: v })));
        }

        // 2. Dosage Form from medicines table
        const dosageRows = await supabaseFetch<{ dosage_form: string }[]>(
          "/rest/v1/medicines?select=dosage_form&dosage_form=not.is.null&order=dosage_form.asc&limit=500"
        );
        if (Array.isArray(dosageRows)) {
          const df = Array.from(new Set(dosageRows.map(d => d.dosage_form).filter(Boolean)));
          setDosageFormOptions(df.map(v => ({ label: v, value: v })));
        }

        // 3. Strength options from medicines table
        const strengthRows = await supabaseFetch<{ strength: string }[]>(
          "/rest/v1/medicines?select=strength&strength=not.is.null&order=strength.asc&limit=500"
        );
        if (Array.isArray(strengthRows)) {
          const st = Array.from(new Set(strengthRows.map(s => s.strength).filter(Boolean)));
          setStrengthOptions(st.map(v => ({ label: v, value: v })));
        }

        // 4. Scientific Names from canonical products
        const sciRows = await supabaseFetch<{ scientific_name: string }[]>(
          "/rest/v1/medicine_encyclopedia_products_v2?select=scientific_name&scientific_name=not.is.null&limit=1000"
        );
        if (Array.isArray(sciRows)) {
          const sc = Array.from(new Set(sciRows.map(s => s.scientific_name).filter(Boolean)));
          setScientificOptions(sc.map(v => ({ label: v, value: v })));
        }
      } catch (e) {
        console.error("Error loading picker options:", e);
      }
    }
    void loadPickerOptions();
  }, [supabaseFetch]);

  // Fetch portfolio when component mounts or re-loads
  const loadPortfolio = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      setLoadingPortfolio(true);
      // 1. Get user's orgs
      const memberships = await supabaseFetch<any[]>(
        `/rest/v1/organization_members?select=organization_id&user_id=${session.user.id}&is_active=eq.true&limit=10`
      );
      const orgIds = Array.isArray(memberships) ? memberships.map(m => m.organization_id).filter(Boolean) : [];
      
      // 2. Get user's company profiles
      let slugs: string[] = [];
      if (orgIds.length > 0) {
        const profiles = await supabaseFetch<any[]>(
          `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name&organization_id=in.(${orgIds.join(",")})&verification_status=eq.verified&limit=10`
        );
        if (Array.isArray(profiles)) {
          const validProfiles = profiles.filter(p => p.company_slug);
          slugs = validProfiles.map(p => p.company_slug);
          if (validProfiles.length > 0) {
            setActiveProfile(validProfiles[0]);
          }
        }
      }
      
      if (companySlug && !slugs.includes(companySlug)) {
        slugs.push(companySlug);
      }
      
      // 3. Fetch canonical products for these companies using the relationships table
      if (slugs.length > 0) {
        const relationships = await supabaseFetch<{ canonical_id: number; company_name?: string }[]>(
          `/rest/v1/medicine_product_company_relationships?select=canonical_id,company_name&company_slug=in.(${slugs.join(",")})&limit=1000`
        );
        
        if (Array.isArray(relationships) && relationships.length > 0) {
          const canonicalIds = Array.from(new Set(relationships.map(r => r.canonical_id)));
          const extraToll = Array.from(new Set(relationships.map(r => r.company_name).filter(Boolean) as string[]));
          setExistingTollManufacturers(extraToll);
          
          const products = await supabaseFetch<MedicineProduct[]>(
            `/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,image_url,barcode,code,current_price_egp&canonical_id=in.(${canonicalIds.join(",")})`
          );
          if (Array.isArray(products)) {
            setPortfolio(products);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching portfolio:", err);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [session?.user?.id, supabaseFetch, companySlug]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const companyDisplayName = activeProfile?.display_name || companySlug || "Represented Company";

  // Build options for Manufacturer (Toll Manufacturer)
  const manufacturerOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    
    // 1. Represented Company
    list.push({
      label: `${companyDisplayName} (${t("Represented Company", "الشركة الممثلة")})`,
      value: companyDisplayName
    });

    // 2. Existing toll manufacturers from database
    for (const tm of existingTollManufacturers) {
      if (tm !== companyDisplayName && !list.find(opt => opt.value === tm)) {
        list.push({ label: tm, value: tm });
      }
    }

    // 3. Option for Another company
    list.push({
      label: t("Another company...", "شركة أخرى..."),
      value: "__another_company__"
    });

    return list;
  }, [companyDisplayName, existingTollManufacturers, t]);

  // Build options for Trademark Owner
  const trademarkOwnerOptions = useMemo(() => {
    return [
      {
        label: `${companyDisplayName} (${t("Represented Company", "الشركة الممثلة")})`,
        value: companyDisplayName
      },
      {
        label: t("Another company...", "شركة أخرى..."),
        value: "__another_company__"
      }
    ];
  }, [companyDisplayName, t]);

  const portfolioOptions = useMemo(() => {
    return portfolio.map(p => ({
      label: p.name_en || p.name_ar || p.scientific_name || String(p.canonical_id),
      value: String(p.canonical_id)
    }));
  }, [portfolio]);

  const handleMedicineSelect = (value: string) => {
    const numericValue = Number(value);
    const existing = portfolio.find(p => p.canonical_id === numericValue);
    if (existing) {
      setCanonicalId(existing.canonical_id);
      setMedicineName(existing.name_en || "");
      setNameAr(existing.name_ar || "");
      setScientificName(existing.scientific_name || "");
      setDrugClass(existing.drug_class || "");
      setRoute(existing.route || "");
      setCategory(existing.category || "");
      setBarcode(existing.barcode || "");
      setProductCode(existing.code || "");
      setPriceEgp(existing.current_price_egp ? String(existing.current_price_egp) : "");
      setImageUrl(existing.image_url || "");

      // Parse Manufacturer string ("Toll > Owner" or single company)
      const rawMfr = existing.manufacturer || "";
      if (rawMfr.includes(">")) {
        const parts = rawMfr.split(">").map(s => s.trim());
        const toll = parts[0];
        const owner = parts[1] || parts[0];

        // Set Toll Manufacturer
        if (manufacturerOptions.find(o => o.value === toll)) {
          setTollManufacturerChoice(toll);
          setCustomTollManufacturer("");
        } else {
          setTollManufacturerChoice("__another_company__");
          setCustomTollManufacturer(toll);
        }

        // Set Trademark Owner
        if (trademarkOwnerOptions.find(o => o.value === owner)) {
          setTrademarkOwnerChoice(owner);
          setCustomTrademarkOwner("");
        } else {
          setTrademarkOwnerChoice("__another_company__");
          setCustomTrademarkOwner(owner);
        }
      } else if (rawMfr) {
        setTollManufacturerChoice(rawMfr);
        setCustomTollManufacturer(manufacturerOptions.find(o => o.value === rawMfr) ? "" : rawMfr);
        setTrademarkOwnerChoice(rawMfr);
        setCustomTrademarkOwner(trademarkOwnerOptions.find(o => o.value === rawMfr) ? "" : rawMfr);
      } else {
        setTollManufacturerChoice(companyDisplayName);
        setCustomTollManufacturer("");
        setTrademarkOwnerChoice(companyDisplayName);
        setCustomTrademarkOwner("");
      }
    } else {
      // It's a new custom addition
      setCanonicalId(null);
      setMedicineName(value);
      setNameAr("");
      setScientificName("");
      setDrugClass("");
      setRoute("");
      setCategory("");
      setStrength("");
      setDosageForm("");
      setBarcode("");
      setProductCode("");
      setPriceEgp("");
      setImageUrl("");
      setDescription("");

      // Default manufacturer choices to company
      setTollManufacturerChoice(companyDisplayName);
      setCustomTollManufacturer("");
      setTrademarkOwnerChoice(companyDisplayName);
      setCustomTrademarkOwner("");
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setBusy(true);
    setError(null);
    setMessage(null);

    // Compute effective manufacturer string
    const effectiveToll = tollManufacturerChoice === "__another_company__"
      ? customTollManufacturer.trim()
      : (tollManufacturerChoice || companyDisplayName);

    const effectiveOwner = trademarkOwnerChoice === "__another_company__"
      ? customTrademarkOwner.trim()
      : (trademarkOwnerChoice || companyDisplayName);

    let formattedManufacturer = effectiveOwner;
    if (effectiveToll && effectiveToll !== effectiveOwner) {
      formattedManufacturer = `${effectiveToll} > ${effectiveOwner}`;
    }
    
    try {
      const isEdit = canonicalId !== null;
      await supabaseFetch("/rest/v1/medicine_catalog_submissions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          submitted_by: session.user.id,
          organization_id: activeProfile?.organization_id || null,
          company_profile_id: activeProfile?.id || null,
          request_company_slug: activeProfile?.company_slug || null,
          submitter_kind: "company_representative",
          submission_kind: isEdit ? "medicine_correction" : "medicine_addition",
          title: `${isEdit ? 'Update' : 'Add'} medicine: ${medicineName.trim()}`,
          canonical_id: canonicalId,
          medicine_name: medicineName.trim(),
          name_ar: nameAr.trim(),
          scientific_name: scientificName.trim(),
          manufacturer_name: formattedManufacturer,
          drug_class: drugClass.trim(),
          route: route.trim(),
          category: category.trim(),
          strength: strength.trim(),
          dosage_form: dosageForm.trim(),
          barcode: barcode.trim(),
          code: productCode.trim(),
          price_egp: priceEgp ? Number(priceEgp) : null,
          image_url: imageUrl.trim(),
          description: description.trim(),
        })
      });
      setMessage(
        isEdit 
          ? t("Your medicine update has been published successfully.", "تم نشر وتحديث الدواء بنجاح.")
          : t("Your new medicine has been published successfully.", "تم نشر وإضافة الدواء الجديد بنجاح.")
      );
      
      // Clear form & reload portfolio to reflect changes immediately
      setCanonicalId(null);
      setMedicineName("");
      setNameAr("");
      setScientificName("");
      setDrugClass("");
      setRoute("");
      setCategory("");
      setStrength("");
      setDosageForm("");
      setBarcode("");
      setProductCode("");
      setPriceEgp("");
      setImageUrl("");
      setDescription("");
      setTollManufacturerChoice("");
      setCustomTollManufacturer("");
      setTrademarkOwnerChoice("");
      setCustomTrademarkOwner("");

      await loadPortfolio();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not submit request.", "تعذر إرسال الطلب."));
    } finally {
      setBusy(false);
    }
  }

  const modeTitle = canonicalId !== null 
    ? t("Update Portfolio Medicine", "تحديث دواء في محفظتك") 
    : t("Add a New Medicine or edit ", "إضافة دواء جديد أو تعديل");

  return (
    <section id="add-medicine" className="mt-8 rounded-2xl border bg-white/10 backdrop-blur shadow-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{modeTitle}</h2>
        {canonicalId !== null && (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            {t("Editing Mode", "وضع التعديل")}
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="default" className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2 pb-4 mb-2 border-b border-slate-200">
          <Label className="text-slate-700 font-semibold text-base">
            {t("Search Portfolio to Edit, or Add New", "ابحث في محفظتك للتعديل، أو أضف جديداً")} 
            {loadingPortfolio && <Spinner className="inline-block ml-2 h-3 w-3" />}
          </Label>
          <SearchableCombobox
            options={portfolioOptions}
            value={canonicalId ? String(canonicalId) : (canonicalId === null && medicineName === "" ? "" : "new")}
            onChange={handleMedicineSelect}
            placeholder={t("Select an existing medicine...", "اختر دواءً موجوداً...")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Medicine Name (English)", "اسم الدواء بالانجليزية")}</Label>
          <Input value={medicineName} onChange={e => setMedicineName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>{t("Medicine Name (Arabic)", "اسم الدواء بالعربية")}</Label>
          <Input value={nameAr} onChange={e => setNameAr(e.target.value)} />
        </div>

        {/* 1. Scientific/Generic Name Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Scientific/Generic Name", "الاسم العلمي")}</Label>
          <SearchableCombobox
            options={scientificOptions}
            value={scientificName}
            onChange={setScientificName}
            placeholder={t("Select or type scientific name...", "اختر أو اكتب الاسم العلمي...")}
          />
        </div>

        {/* 2. Drug class Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Drug class", "فئة الدواء")}</Label>
          <SearchableCombobox
            options={drugClassOptions}
            value={drugClass}
            onChange={setDrugClass}
            placeholder={t("Select or type drug class...", "اختر أو اكتب فئة الدواء...")}
          />
        </div>

        {/* 3. Route Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Route", "طريقة الإعطاء")}</Label>
          <SearchableCombobox
            options={routeOptions}
            value={route}
            onChange={setRoute}
            placeholder={t("e.g. Oral, IV...", "مثال: فموي، وريدي...")}
          />
        </div>

        {/* 4. Category Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Category", "الفئة")}</Label>
          <SearchableCombobox
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            placeholder={t("Select or type category...", "اختر أو اكتب الفئة...")}
          />
        </div>

        {/* 5. Strength Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Strength", "القوة")}</Label>
          <SearchableCombobox
            options={strengthOptions}
            value={strength}
            onChange={setStrength}
            placeholder={t("Select or type strength (e.g. 500 MG)...", "اختر أو اكتب القوة (مثال: 500 ملغم)...")}
          />
        </div>

        {/* 6. Dosage form Searchable Picker */}
        <div className="space-y-2">
          <Label>{t("Dosage form", "شكل الجرعة")}</Label>
          <SearchableCombobox
            options={dosageFormOptions}
            value={dosageForm}
            onChange={setDosageForm}
            placeholder={t("Select or type dosage form (e.g. Tablet, Syrup)...", "اختر أو اكتب شكل الجرعة...")}
          />
        </div>

        {/* Split Manufacturer Field 1: Toll Manufacturer / Producing Company */}
        <div className="space-y-2">
          <Label>{t("Manufacturer (Toll / Producing Factory)", "المصنع (التصنيع لدى الغير / المصنع المنتج)")}</Label>
          <SearchableCombobox
            options={manufacturerOptions}
            value={tollManufacturerChoice}
            onChange={setTollManufacturerChoice}
            placeholder={t("Select manufacturer...", "اختر المصنع...")}
          />
          {tollManufacturerChoice === "__another_company__" && (
            <Input
              value={customTollManufacturer}
              onChange={e => setCustomTollManufacturer(e.target.value)}
              placeholder={t("Enter producing company name...", "أدخل اسم الشركة المصنعة...")}
              className="mt-2"
              required
            />
          )}
        </div>

        {/* Split Manufacturer Field 2: Trademark Owner */}
        <div className="space-y-2">
          <Label>{t("Trademark owner", "صاحب العلامة التجارية")}</Label>
          <SearchableCombobox
            options={trademarkOwnerOptions}
            value={trademarkOwnerChoice}
            onChange={setTrademarkOwnerChoice}
            placeholder={t("Select trademark owner...", "اختر صاحب العلامة التجارية...")}
          />
          {trademarkOwnerChoice === "__another_company__" && (
            <Input
              value={customTrademarkOwner}
              onChange={e => setCustomTrademarkOwner(e.target.value)}
              placeholder={t("Enter trademark owner company name...", "أدخل اسم الشركة صاحبة العلامة التجارية...")}
              className="mt-2"
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("Barcode", "الباركود")}</Label>
          <Input value={barcode} onChange={e => setBarcode(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("Product Code", "كود المنتج")}</Label>
          <Input value={productCode} onChange={e => setProductCode(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("Price (EGP)", "السعر (جنيه)")}</Label>
          <Input type="number" step="0.01" value={priceEgp} onChange={e => setPriceEgp(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("Image URL", "رابط الصورة")}</Label>
          <Input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t("Additional Description/Notes", "ملاحظات إضافية")}</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 pt-2">
          <Button type="submit" disabled={busy || (!medicineName && !canonicalId)} className="w-full">
            {busy ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? t("Submitting…", "جارٍ الإرسال…") : (canonicalId !== null ? t("Submit Correction", "إرسال التعديل") : t("Submit Addition", "إرسال الإضافة"))}
          </Button>
        </div>
      </form>
    </section>
  );
}
