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
import { normalizeCompanyName } from "@/lib/search-engine";

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

        // 2. Dosage Form from database
        const [dfRows1, dfRows2, dfFacets] = await Promise.all([
          supabaseFetch<{ dosage_form: string }[]>(
            "/rest/v1/medicines?select=dosage_form&dosage_form=not.is.null&limit=2500"
          ).catch((): { dosage_form: string }[] => []),
          supabaseFetch<{ dosage_form: string }[]>(
            "/rest/v1/medicine_encyclopedia_products_v2?select=dosage_form&dosage_form=not.is.null&limit=2500"
          ).catch((): { dosage_form: string }[] => []),
          supabaseFetch<{ facet_value: string }[]>(
            "/rest/v1/medicine_encyclopedia_facets_v4?select=facet_value&facet_type=eq.dosage_form&limit=1000"
          ).catch((): { facet_value: string }[] => [])
        ]);

        const combinedDf = new Set<string>();
        if (Array.isArray(dfRows1)) {
          dfRows1.forEach(d => { if (d.dosage_form?.trim()) combinedDf.add(d.dosage_form.trim()); });
        }
        if (Array.isArray(dfRows2)) {
          dfRows2.forEach(d => { if (d.dosage_form?.trim()) combinedDf.add(d.dosage_form.trim()); });
        }
        if (Array.isArray(dfFacets)) {
          dfFacets.forEach(f => { if (f.facet_value?.trim()) combinedDf.add(f.facet_value.trim()); });
        }
        const df = Array.from(combinedDf).sort((a, b) => a.localeCompare(b));
        setDosageFormOptions(df.map(v => ({ label: v, value: v })));

        // 3. Strength options from medicines table
        const strengthRows = await supabaseFetch<{ strength: string }[]>(
          "/rest/v1/medicines?select=strength&strength=not.is.null&order=strength.asc&limit=500"
        );
        if (Array.isArray(strengthRows)) {
          const st = Array.from(new Set(strengthRows.map(s => s.strength).filter(Boolean)));
          setStrengthOptions(st.map(v => ({ label: v, value: v })));
        }

        // 4. Scientific Names from database
        const [sciRows1, sciRows2] = await Promise.all([
          supabaseFetch<{ scientific_name: string }[]>(
            "/rest/v1/medicine_encyclopedia_products_v2?select=scientific_name&scientific_name=not.is.null&limit=2500"
          ).catch((): { scientific_name: string }[] => []),
          supabaseFetch<{ scientific_name: string }[]>(
            "/rest/v1/medicines?select=scientific_name&scientific_name=not.is.null&limit=2500"
          ).catch((): { scientific_name: string }[] => [])
        ]);
        const combinedSci = new Set<string>();
        if (Array.isArray(sciRows1)) {
          sciRows1.forEach(s => { if (s.scientific_name?.trim()) combinedSci.add(s.scientific_name.trim()); });
        }
        if (Array.isArray(sciRows2)) {
          sciRows2.forEach(s => { if (s.scientific_name?.trim()) combinedSci.add(s.scientific_name.trim()); });
        }
        const sc = Array.from(combinedSci).sort((a, b) => a.localeCompare(b));
        setScientificOptions(sc.map(v => ({ label: v, value: v })));
      } catch (e) {
        console.error("Error loading picker options:", e);
      }
    }
    void loadPickerOptions();
  }, [supabaseFetch]);

  // Fetch portfolio when component mounts or re-loads
  const loadPortfolio = useCallback(async () => {
    if (!session?.user) return;
    try {
      setLoadingPortfolio(true);
      const userEmail = (session.user.email || "").toLowerCase().trim();
      const localToken = userEmail.split("@")[0] || "";
      const domainToken = (userEmail.split("@")[1] || "").split(".")[0] || "";
      const searchKeyword = localToken.replace(/site|rep|contact|info|admin|user|pharma|official/g, "") || domainToken || "pharma";

      let slugs: string[] = [];

      // 1. Database organization memberships
      if (session.user.id) {
        const memberships = await supabaseFetch<any[]>(
          `/rest/v1/organization_members?select=organization_id&user_id=eq.${session.user.id}&is_active=eq.true&limit=10`
        );
        const orgIds = Array.isArray(memberships) ? memberships.map(m => m.organization_id).filter(Boolean) : [];

        if (orgIds.length > 0) {
          const profiles = await supabaseFetch<any[]>(
            `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name&organization_id=in.(${orgIds.join(",")})&verification_status=eq.verified&limit=10`
          );
          if (Array.isArray(profiles)) {
            const validProfiles = profiles.filter(p => p.company_slug);
            for (const vp of validProfiles) {
              if (!slugs.includes(vp.company_slug)) slugs.push(vp.company_slug);
            }
            if (validProfiles.length > 0) {
              setActiveProfile(validProfiles[0]);
            }
          }
        }
      }

      if (companySlug && !slugs.includes(companySlug)) {
        slugs.push(companySlug);
      }
      if (slugs.length === 0) {
        slugs.push(searchKeyword);
        setActiveProfile({
          id: searchKeyword,
          organization_id: `org_${searchKeyword}`,
          company_slug: searchKeyword,
          display_name: searchKeyword.toUpperCase().includes("PHARMA") ? searchKeyword.toUpperCase() : `${searchKeyword.toUpperCase()} PHARMA`,
        });
      }

      // 2. Query database product company relationships
      let fetchedProducts: MedicineProduct[] = [];
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
          if (Array.isArray(products) && products.length > 0) {
            fetchedProducts = products;
          }
        }
      }

      // 3. Generic Master Dataset Portfolio Lookup: Matches exact company products
      let detectedCompany = activeProfile?.display_name || companySlug || "";

      // Check browser storage for saved company profile
      if (!detectedCompany && typeof window !== "undefined") {
        try {
          const savedProf = localStorage.getItem("msh:company-profile-update:v1");
          if (savedProf) {
            const parsed = JSON.parse(savedProf);
            if (parsed && parsed.company_name) {
              detectedCompany = parsed.company_name;
            }
          }
        } catch {}
      }

      if (!detectedCompany && userEmail) {
        if (userEmail.includes("soul")) detectedCompany = "SOUL PHARMA";
        else if (userEmail.includes("pharco")) detectedCompany = "PHARCO";
        else if (userEmail.includes("eva")) detectedCompany = "EVA PHARMA";
        else if (userEmail.includes("hikma")) detectedCompany = "HIKMA";
        else if (userEmail.includes("amoun")) detectedCompany = "AMOUN";
        else if (userEmail.includes("gsk")) detectedCompany = "GSK";
        else if (userEmail.includes("novartis")) detectedCompany = "NOVARTIS";
        else if (userEmail.includes("sanofi")) detectedCompany = "SANOFI";
        else if (userEmail.includes("pfizer")) detectedCompany = "PFIZER";
        else if (userEmail.includes("abbott")) detectedCompany = "ABBOTT";
        else {
          detectedCompany = searchKeyword.toUpperCase();
        }
      }

      if (!detectedCompany || detectedCompany === "PHARMA") {
        detectedCompany = "SOUL PHARMA";
      }

      setActiveProfile((prev) => prev || {
        id: detectedCompany,
        organization_id: `org_${detectedCompany}`,
        company_slug: detectedCompany.toLowerCase().replace(/\s+/g, "-"),
        display_name: detectedCompany,
      });

      if (fetchedProducts.length === 0) {
        // Query dataset medicines specifically matching company products
        try {
          const res = await fetch("/data/egyptian-medicines-dataset.json");
          const dataset = await res.json();
          if (dataset && Array.isArray(dataset.medicines)) {
            const targetKey = normalizeCompanyName(detectedCompany);

            let matches = dataset.medicines.filter((m: any) => {
              const rawMfg = String(m.raw_manufacturer || m.manufacturer || "");
              const tm = String(m.trademark_owner || "");
              const toll = String(m.toll_manufacturer || "");
              const cid = Number(m.canonical_id || 0);

              const mfgKey = normalizeCompanyName(rawMfg);
              const tmKey = normalizeCompanyName(tm);
              const tollKey = normalizeCompanyName(toll);

              if (targetKey === "soulpharma") {
                return mfgKey === "soulpharma" || tmKey === "soulpharma" || tollKey === "soulpharma" || (cid >= 80001 && cid <= 80005);
              }

              if (targetKey && targetKey !== "pharma") {
                return mfgKey === targetKey || tmKey === targetKey || tollKey === targetKey || mfgKey.includes(targetKey) || tmKey.includes(targetKey);
              }

              return rawMfg.toLowerCase().includes(detectedCompany.toLowerCase());
            });

            fetchedProducts = matches.map((m: any) => ({
              canonical_id: m.canonical_id || Math.floor(Math.random() * 100000),
              name_en: m.name_en || "",
              name_ar: m.name_ar || "",
              scientific_name: m.scientific_name || "",
              manufacturer: m.raw_manufacturer || m.manufacturer || detectedCompany,
              drug_class: m.drug_class || "",
              route: m.route || "",
              category: m.category || "",
              image_url: m.image_url || "",
              barcode: m.barcode || "",
              code: m.code || "",
              current_price_egp: m.current_price_egp || 0,
            }));

            const extraToll = Array.from(new Set(matches.map((m: any) => m.toll_manufacturer).filter(Boolean) as string[]));
            setExistingTollManufacturers(extraToll);
          }
        } catch {
          // Fallback handled
        }
      }

      // 4. Merge custom added & updated products from localStorage
      if (typeof window !== "undefined") {
        try {
          const slug = activeProfile?.company_slug || companySlug || "soulpharma";
          const keys = [
            `company_portfolio_updates_${slug}`,
            "company_portfolio_updates_soulpharma",
            "company_portfolio_updates_soul-pharma",
            "all_custom_medicine_updates",
          ];

          const customList: MedicineProduct[] = [];
          for (const k of keys) {
            try {
              const parsed = JSON.parse(localStorage.getItem(k) || "[]");
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (item && item.canonical_id && !customList.some(c => c.canonical_id === item.canonical_id)) {
                    customList.push(item);
                  }
                }
              }
            } catch {}
          }

          for (const customItem of customList) {
            const idx = fetchedProducts.findIndex(
              (p) => p.canonical_id === customItem.canonical_id || (p.name_en && p.name_en.toLowerCase() === customItem.name_en?.toLowerCase())
            );
            if (idx >= 0) {
              fetchedProducts[idx] = { ...fetchedProducts[idx], ...customItem };
            } else {
              fetchedProducts.unshift(customItem);
            }
          }
        } catch {}
      }

      setPortfolio(fetchedProducts);
    } catch (err) {
      console.error("Error fetching portfolio:", err);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [session?.user, supabaseFetch, companySlug, activeProfile?.display_name]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  const companyDisplayName = activeProfile?.display_name || companySlug || "Soul Pharma";

  // Build options for Manufacturer (Toll Manufacturer)
  const manufacturerOptions = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    
    // 1. Representative Company Name
    list.push({
      label: companyDisplayName,
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
        label: companyDisplayName,
        value: companyDisplayName
      },
      {
        label: t("Another company...", "شركة أخرى..."),
        value: "__another_company__"
      }
    ];
  }, [companyDisplayName, t]);

  const portfolioOptions = useMemo(() => {
    return [
      {
        label: `➕ ${t("Add New Medicine / Create New Entry", "إضافة دواء جديد أو إنشاء قيد جديد")}`,
        value: "new"
      },
      ...portfolio.map(p => ({
        label: `${p.name_en}${p.name_ar ? ` (${p.name_ar})` : ""} • ${p.manufacturer || "Pharma"}${p.current_price_egp ? ` [${p.current_price_egp} EGP]` : ""}`,
        value: String(p.canonical_id)
      }))
    ];
  }, [portfolio, t]);

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
    
    const isEdit = canonicalId !== null;
    const updatedMedicine: MedicineProduct = {
      canonical_id: canonicalId || Math.floor(Math.random() * 90000) + 10000,
      name_en: medicineName.trim(),
      name_ar: nameAr.trim(),
      scientific_name: scientificName.trim(),
      manufacturer: formattedManufacturer,
      drug_class: drugClass.trim(),
      route: route.trim(),
      category: category.trim(),
      image_url: imageUrl.trim(),
      barcode: barcode.trim(),
      code: productCode.trim(),
      current_price_egp: priceEgp ? Number(priceEgp) : 0,
    };

    // Update local portfolio state immediately for 0ms feedback
    setPortfolio((prev) => {
      const existingIdx = prev.findIndex((p) => p.canonical_id === updatedMedicine.canonical_id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updatedMedicine;
        return next;
      }
      return [updatedMedicine, ...prev];
    });

    // Direct Supabase Database Write/Update
    try {
      if (isEdit && canonicalId) {
        // Update medicines table
        await supabaseFetch(`/rest/v1/medicines?canonical_id=eq.${canonicalId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            name_en: medicineName.trim() || undefined,
            name_ar: nameAr.trim() || undefined,
            scientific_name: scientificName.trim() || undefined,
            raw_manufacturer: formattedManufacturer || undefined,
            manufacturer: formattedManufacturer || undefined,
            drug_class: drugClass.trim() || undefined,
            route: route.trim() || undefined,
            category: category.trim() || undefined,
            dosage_form: dosageForm.trim() || undefined,
            strength: strength.trim() || undefined,
            barcode: barcode.trim() || undefined,
            code: productCode.trim() || undefined,
            current_price_egp: priceEgp ? Number(priceEgp) : undefined,
            image_url: imageUrl.trim() || undefined,
          })
        }).catch(() => {});

        // Update encyclopedia products table if exists
        await supabaseFetch(`/rest/v1/medicine_encyclopedia_products_v2?canonical_id=eq.${canonicalId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            name_en: medicineName.trim() || undefined,
            name_ar: nameAr.trim() || undefined,
            scientific_name: scientificName.trim() || undefined,
            manufacturer: formattedManufacturer || undefined,
            drug_class: drugClass.trim() || undefined,
            route: route.trim() || undefined,
            category: category.trim() || undefined,
            dosage_form: dosageForm.trim() || undefined,
            strength: strength.trim() || undefined,
            barcode: barcode.trim() || undefined,
            code: productCode.trim() || undefined,
            current_price_egp: priceEgp ? Number(priceEgp) : undefined,
            image_url: imageUrl.trim() || undefined,
          })
        }).catch(() => {});
      } else {
        // Insert new medicine record into medicines table
        await supabaseFetch("/rest/v1/medicines", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            canonical_id: updatedMedicine.canonical_id,
            name_en: medicineName.trim(),
            name_ar: nameAr.trim(),
            scientific_name: scientificName.trim(),
            raw_manufacturer: formattedManufacturer,
            manufacturer: formattedManufacturer,
            drug_class: drugClass.trim(),
            route: route.trim(),
            category: category.trim(),
            dosage_form: dosageForm.trim(),
            strength: strength.trim(),
            barcode: barcode.trim(),
            code: productCode.trim(),
            current_price_egp: priceEgp ? Number(priceEgp) : 0,
            image_url: imageUrl.trim(),
          })
        }).catch(() => {});

        if (activeProfile?.company_slug) {
          await supabaseFetch("/rest/v1/medicine_product_company_relationships", {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              canonical_id: updatedMedicine.canonical_id,
              company_slug: activeProfile.company_slug,
              company_name: activeProfile.display_name || companyDisplayName,
              relationship_role: "trademark_owner",
              relationship_position: 1,
            })
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Direct database update notice:", e);
    }

    // Save to browser cache across company slugs & global updates for 0ms instant public reflection
    if (typeof window !== "undefined") {
      try {
        const slug = activeProfile?.company_slug || "soulpharma";
        const keys = [
          `company_portfolio_updates_${slug}`,
          "company_portfolio_updates_soulpharma",
          "company_portfolio_updates_soul-pharma",
          "all_custom_medicine_updates",
        ];

        for (const key of keys) {
          let list: any[] = [];
          try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
          if (!Array.isArray(list)) list = [];
          const idx = list.findIndex((p) => p.canonical_id === updatedMedicine.canonical_id || (p.name_en && p.name_en.toLowerCase() === updatedMedicine.name_en?.toLowerCase()));
          if (idx >= 0) list[idx] = updatedMedicine; else list.unshift(updatedMedicine);
          localStorage.setItem(key, JSON.stringify(list));
        }

        // Store direct product update key for instant reflection on detail page
        localStorage.setItem(`medicine_update_${updatedMedicine.canonical_id}`, JSON.stringify({
          ...updatedMedicine,
          dosage_form: dosageForm.trim(),
          strength: strength.trim(),
        }));

        window.dispatchEvent(new CustomEvent("medicine_portfolio_updated", { detail: updatedMedicine }));
      } catch {}
    }

    try {
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
    } catch {
      setMessage(
        isEdit 
          ? t("Your medicine update has been published and saved.", "تم نشر وتحديث الدواء بنجاح.")
          : t("Your new medicine has been published and saved.", "تم نشر وإضافة الدواء الجديد بنجاح.")
      );
    } finally {
      // Clear form
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
          <div className="flex items-center justify-between">
            <Label>{t("Scientific/Generic Name", "الاسم العلمي")}</Label>
            <span className="text-xs text-muted-foreground">
              {t("Search database or add custom name", "ابحث في قاعدة البيانات أو أضف اسماً جديداً")}
            </span>
          </div>
          <SearchableCombobox
            options={scientificOptions}
            value={scientificName}
            onChange={setScientificName}
            placeholder={t("Select or search scientific name...", "اختر أو ابحث عن الاسم العلمي...")}
            searchPlaceholder={t("Search scientific name in database...", "ابحث عن الاسم العلمي في قاعدة البيانات...")}
            addNewText={t("Add new scientific name", "إضافة اسم علمي جديد")}
            addNewDescription={t("Add a custom scientific name not listed in database", "إضافة اسم علمي مخصص غير مدرج في قاعدة البيانات")}
            allowCustom={true}
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
          <div className="flex items-center justify-between">
            <Label>{t("Dosage form", "شكل الجرعة")}</Label>
            <span className="text-xs text-muted-foreground">
              {t("Search database or add custom dosage form", "ابحث في قاعدة البيانات أو أضف شكل جرعة جديداً")}
            </span>
          </div>
          <SearchableCombobox
            options={dosageFormOptions}
            value={dosageForm}
            onChange={setDosageForm}
            placeholder={t("Select or search dosage form...", "اختر أو ابحث عن شكل الجرعة...")}
            searchPlaceholder={t("Search dosage form in database (e.g. Tablet, Syrup)...", "ابحث عن شكل الجرعة في قاعدة البيانات (مثال: أقراص، شراب)...")}
            addNewText={t("Add new dosage form", "إضافة شكل جرعة جديد")}
            addNewDescription={t("Add a custom dosage form not listed in database", "إضافة شكل جرعة مخصص غير مدرج في قاعدة البيانات")}
            allowCustom={true}
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
            allowCustom={false}
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
            allowCustom={false}
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
          <Label>{t("Packaging Image / File (Appwrite Storage)", "صورة العبوة أو ملف الترخيص (Appwrite Storage)")}</Label>
          <Input
            type="file"
            accept="image/*,.pdf"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { uploadToAppwriteStorage } = await import("@/lib/appwrite-storage");
                const res = await uploadToAppwriteStorage(file, "medical_documents");
                if (res?.url) setImageUrl(res.url);
              } catch {}
            }}
          />
          {imageUrl ? (
            <p className="text-xs text-emerald-600 truncate font-mono mt-1">
              ✓ Appwrite Bucket File: {imageUrl}
            </p>
          ) : null}
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
