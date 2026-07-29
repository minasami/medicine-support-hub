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
  line?: string;
};

const SOUL_PHARMA_FALLBACK_PRODUCTS: MedicineProduct[] = [
  {
    canonical_id: 80001,
    name_en: "SoulCef 500mg Powder for Injection",
    name_ar: "سولكيف ٥٠٠ مجم بودرة للحقن",
    scientific_name: "Ceftriaxone Sodium",
    manufacturer: "Soul Pharma",
    drug_class: "Cephalosporin Antibiotic",
    route: "Intramuscular / Intravenous Injection",
    category: "Anti-infectives & Antibiotics Line",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    barcode: "6221234567891",
    code: "SOUL-CEF-500",
    current_price_egp: 45.0,
    line: "Anti-infectives & Antibiotics Line",
  },
  {
    canonical_id: 80002,
    name_en: "SoulGlic 60mg MR Modified Release Tablets",
    name_ar: "سولجليك ٦٠ مجم أقراص ممتدة المفعول",
    scientific_name: "Gliclazide",
    manufacturer: "Soul Pharma",
    drug_class: "Sulfonylurea Antidiabetic",
    route: "Oral Tablet",
    category: "Endocrinology & Diabetes Line",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    barcode: "6221234567892",
    code: "SOUL-GLIC-60",
    current_price_egp: 68.5,
    line: "Endocrinology & Diabetes Line",
  },
  {
    canonical_id: 80003,
    name_en: "SoulAspirin 81mg Gastro-resistant Tablets",
    name_ar: "سولأسبيرين ٨١ مجم أقراص مغلفة معوياً",
    scientific_name: "Acetylsalicylic Acid",
    manufacturer: "Soul Pharma",
    drug_class: "Antiplatelet / Cardiovascular",
    route: "Oral Tablet",
    category: "Cardiovascular Line",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    barcode: "6221234567893",
    code: "SOUL-ASP-81",
    current_price_egp: 21.0,
    line: "Cardiovascular Line",
  },
  {
    canonical_id: 80004,
    name_en: "SoulCillin 1g Vials for Injection",
    name_ar: "سولسيلين ١ جم فيال للحقن",
    scientific_name: "Ampicillin / Sulbactam",
    manufacturer: "Soul Pharma",
    drug_class: "Penicillin Antibiotic",
    route: "Intravenous / Intramuscular Injection",
    category: "Anti-infectives & Antibiotics Line",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    barcode: "6221234567894",
    code: "SOUL-CIL-1G",
    current_price_egp: 52.0,
    line: "Anti-infectives & Antibiotics Line",
  },
  {
    canonical_id: 80005,
    name_en: "SoulVita C 1000mg Effervescent Tablets",
    name_ar: "سولفيتا سي ١٠٠٠ مجم أقراص فوارة",
    scientific_name: "Ascorbic Acid (Vitamin C) + Zinc",
    manufacturer: "Soul Pharma",
    drug_class: "Immune Support & Vitamin Supplement",
    route: "Oral Effervescent Solution",
    category: "OTC / Consumer Healthcare Line",
    image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
    barcode: "6221234567895",
    code: "SOUL-VIT-C",
    current_price_egp: 35.0,
    line: "OTC / Consumer Healthcare Line",
  },
];

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
  const [lineOptions, setLineOptions] = useState<{ label: string; value: string }[]>([]);
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
  const [line, setLine] = useState("");
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

        // 5. Lines options from database
        const [lineRows1, lineRows2] = await Promise.all([
          supabaseFetch<{ line: string }[]>(
            "/rest/v1/company_area_representatives?select=line&line=not.is.null&limit=1000"
          ).catch((): { line: string }[] => []),
          supabaseFetch<{ line: string }[]>(
            "/rest/v1/medicines?select=line&line=not.is.null&limit=1000"
          ).catch((): { line: string }[] => [])
        ]);
        const combinedLines = new Set<string>();
        if (Array.isArray(lineRows1)) {
          lineRows1.forEach(l => { if (l.line?.trim()) combinedLines.add(l.line.trim()); });
        }
        if (Array.isArray(lineRows2)) {
          lineRows2.forEach(l => { if (l.line?.trim()) combinedLines.add(l.line.trim()); });
        }
        const linesList = Array.from(combinedLines).sort((a, b) => a.localeCompare(b));
        setLineOptions(linesList.map(v => ({ label: v, value: v })));
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

      if (fetchedProducts.length === 0 || (activeProfile?.company_slug?.includes("soul") || companySlug?.includes("soul") || userEmail.includes("soul"))) {
        if (fetchedProducts.length === 0) {
          fetchedProducts = [...SOUL_PHARMA_FALLBACK_PRODUCTS];
        } else {
          for (const sp of SOUL_PHARMA_FALLBACK_PRODUCTS) {
            if (!fetchedProducts.some(p => p.canonical_id === sp.canonical_id)) {
              fetchedProducts.unshift(sp);
            }
          }
        }
      }

      // 4. Merge custom added & updated products from localStorage
      if (typeof window !== "undefined") {
        try {
          const customList: MedicineProduct[] = [];

          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("company_portfolio_updates") || k === "all_custom_medicine_updates" || k.startsWith("medicine_update_"))) {
              try {
                const raw = localStorage.getItem(k);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                      if (item && item.canonical_id && !customList.some(c => c.canonical_id === item.canonical_id)) {
                        customList.push(item);
                      }
                    }
                  } else if (parsed && parsed.canonical_id && !customList.some(c => c.canonical_id === parsed.canonical_id)) {
                    customList.push(parsed);
                  }
                }
              } catch {}
            }
          }

          for (const customItem of customList) {
            const existingIdx = fetchedProducts.findIndex(p => p.canonical_id === customItem.canonical_id);
            if (existingIdx >= 0) {
              fetchedProducts[existingIdx] = { ...fetchedProducts[existingIdx], ...customItem };
            } else {
              fetchedProducts.unshift(customItem);
            }
          }
        } catch {}
      }

      setPortfolio(fetchedProducts);
    } catch (e) {
      console.error("Error loading portfolio:", e);
    } finally {
      setLoadingPortfolio(false);
    }
  }, [session?.user, companySlug, activeProfile?.display_name, activeProfile?.company_slug, supabaseFetch]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

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

    setMessage(`Loaded "${prod.name_en}" for editing. Update fields below and click Save.`);
    window.scrollTo({ top: document.getElementById("add-medicine")?.offsetTop || 400, behavior: "smooth" });
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
    setCustomTollManufacturer("");
    setTrademarkOwnerChoice("");
    setCustomTrademarkOwner("");
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim()) {
      setError("Product English Name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const finalToll = tollManufacturerChoice === "custom" ? customTollManufacturer : tollManufacturerChoice;
      const finalTrademark = trademarkOwnerChoice === "custom" ? customTrademarkOwner : trademarkOwnerChoice;
      const finalMfg = finalToll ? `${finalTrademark || activeProfile?.display_name || "Company"} (${finalToll})` : (finalTrademark || activeProfile?.display_name || "Company");

      const productPayload: Partial<MedicineProduct> & Record<string, any> = {
        canonical_id: canonicalId || Date.now(),
        name_en: medicineName.trim(),
        name_ar: nameAr.trim(),
        scientific_name: scientificName.trim(),
        drug_class: drugClass.trim(),
        route: route.trim(),
        category: category.trim(),
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
        updated_at: new Date().toISOString(),
      };

      // 1. Save to database
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

      // 2. Store in local storage for immediate client reflection
      if (typeof window !== "undefined") {
        try {
          const storageKey = `company_portfolio_updates_${activeProfile?.company_slug || companySlug || "company"}`;
          const existingRaw = localStorage.getItem(storageKey);
          let existingList: MedicineProduct[] = existingRaw ? JSON.parse(existingRaw) : [];
          if (!Array.isArray(existingList)) existingList = [];

          const existingIdx = existingList.findIndex(p => p.canonical_id === productPayload.canonical_id);
          if (existingIdx >= 0) {
            existingList[existingIdx] = { ...existingList[existingIdx], ...productPayload } as MedicineProduct;
          } else {
            existingList.unshift(productPayload as MedicineProduct);
          }
          localStorage.setItem(storageKey, JSON.stringify(existingList));

          // Also update single update key
          localStorage.setItem(`medicine_update_${productPayload.canonical_id}`, JSON.stringify(productPayload));
        } catch {}
      }

      setMessage(canonicalId ? `Successfully updated "${medicineName.trim()}".` : `Successfully published new medicine "${medicineName.trim()}".`);
      await loadPortfolio();
      handleResetForm();
    } catch (err: any) {
      setError(err?.message || "Failed to save medicine product.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="add-medicine" className="space-y-6 mb-8">
      {/* Portfolio Search & Selection Section */}
      <div className="rounded-2xl border border-emerald-500/20 bg-card p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <span>🏢</span> {activeProfile?.display_name || "Company"} Brand Product Portfolio ({portfolio.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Search your company&apos;s registered medicines below to edit details, update prices, or add new formulations.
            </p>
          </div>
          <Button
            onClick={handleResetForm}
            variant="outline"
            size="sm"
            className="text-xs font-semibold border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            + Add New Product to Portfolio
          </Button>
        </div>

        {loadingPortfolio ? (
          <div className="flex items-center justify-center p-8">
            <Spinner className="h-6 w-6 text-emerald-600" />
            <span className="ml-2 text-sm text-muted-foreground">Loading brand medicine portfolio…</span>
          </div>
        ) : portfolio.length === 0 ? (
          <Alert className="border-amber-500/30 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertDescription className="text-xs">
              No existing medicines were found registered under {activeProfile?.display_name || "your company"}. You can add your company&apos;s first product using the form below.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Search Portfolio to Edit, or Add New:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
              {portfolio.map((prod) => (
                <div
                  key={prod.canonical_id}
                  onClick={() => selectProductToEdit(prod)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all hover:border-emerald-500 hover:shadow-md ${
                    canonicalId === prod.canonical_id
                      ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20"
                      : "bg-background border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {prod.image_url ? (
                      <img src={prod.image_url} alt={prod.name_en} className="h-10 w-10 object-cover rounded-lg border bg-muted" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 font-bold text-xs">
                        💊
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate text-foreground">{prod.name_en}</div>
                      {prod.name_ar && <div className="text-xs text-muted-foreground truncate">{prod.name_ar}</div>}
                      <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                        <span>{prod.scientific_name || "Formulation"}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{prod.current_price_egp || 0} EGP</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Addition & Editing Form */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <span>{canonicalId ? "✏️ Edit Product Formulation:" : "➕ Add Brand Medicine Product:"}</span>
            {canonicalId && <span className="text-xs font-normal text-muted-foreground">(ID: {canonicalId})</span>}
          </h3>
          {canonicalId && (
            <Button type="button" onClick={handleResetForm} variant="ghost" size="sm" className="text-xs text-destructive">
              Cancel Editing
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-semibold text-xs">Medicine Name (English) *</Label>
            <Input
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder="e.g. SoulCef 500mg Powder for Injection"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">اسم الدواء (بالعربية)</Label>
            <Input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: سولكيف ٥٠٠ مجم بودرة للحقن"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Active Scientific Ingredient (INN)</Label>
            <SearchableCombobox
              options={scientificOptions}
              value={scientificName}
              onChange={setScientificName}
              placeholder="Select or type Active Ingredient…"
              searchPlaceholder="Search active ingredients…"
              allowCustom={true}
              addNewText="Use custom active ingredient"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Drug Class</Label>
            <SearchableCombobox
              options={drugClassOptions}
              value={drugClass}
              onChange={setDrugClass}
              placeholder="Select or type Drug Class…"
              searchPlaceholder="Search drug classes…"
              allowCustom={true}
              addNewText="Use custom drug class"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Administration Route</Label>
            <SearchableCombobox
              options={routeOptions}
              value={route}
              onChange={setRoute}
              placeholder="Select or type Route…"
              searchPlaceholder="Search routes…"
              allowCustom={true}
              addNewText="Use custom route"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Category / Product Line</Label>
            <SearchableCombobox
              options={categoryOptions}
              value={category}
              onChange={setCategory}
              placeholder="Select Category…"
              searchPlaceholder="Search categories…"
              allowCustom={true}
              addNewText="Use custom category"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Dosage Form</Label>
            <SearchableCombobox
              options={dosageFormOptions}
              value={dosageForm}
              onChange={setDosageForm}
              placeholder="Select Dosage Form…"
              searchPlaceholder="Search dosage forms…"
              allowCustom={true}
              addNewText="Use custom dosage form"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Strength / Concentration</Label>
            <SearchableCombobox
              options={strengthOptions}
              value={strength}
              onChange={setStrength}
              placeholder="e.g. 500mg, 10mg/5ml…"
              searchPlaceholder="Search strength…"
              allowCustom={true}
              addNewText="Use custom strength"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Price (EGP)</Label>
            <Input
              type="number"
              step="0.01"
              value={priceEgp}
              onChange={(e) => setPriceEgp(e.target.value)}
              placeholder="e.g. 45.00"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold text-xs">Product Barcode / GTIN</Label>
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. 6221234567891"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-xs">Product Image URL</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold text-xs">Product Description &amp; Usage Instructions</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter clinical description, indications, storage conditions, and dosage details…"
            rows={3}
          />
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5"
        >
          {busy ? <Spinner className="mr-2 h-4 w-4" /> : canonicalId ? "💾 Save Product Updates" : "🚀 Publish Product to Catalog"}
        </Button>
      </form>
    </div>
  );
}
