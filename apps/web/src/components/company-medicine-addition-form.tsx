import { useState, FormEvent, useEffect, useMemo } from "react";
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
  const [activeProfile, setActiveProfile] = useState<{ id: string, organization_id: string, company_slug: string } | null>(null);
  
  // Selected canonical id
  const [canonicalId, setCanonicalId] = useState<number | null>(null);

  // Form fields
  const [medicineName, setMedicineName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
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
  
  // Fetch portfolio when component mounts
  useEffect(() => {
    let active = true;
    async function fetchPortfolio() {
      if (!session?.user?.id) return;
      try {
        setLoadingPortfolio(true);
        // 1. Get user's orgs
        const memberships = await supabaseFetch<any[]>(
          `/rest/v1/organization_members?select=organization_id&user_id=eq.${session.user.id}&is_active=eq.true&limit=10`
        );
        const orgIds = Array.isArray(memberships) ? memberships.map(m => m.organization_id).filter(Boolean) : [];
        if (!orgIds.length && !active) return;
        
        // 2. Get user's company profiles
        let slugs: string[] = [];
        if (orgIds.length > 0) {
          const profiles = await supabaseFetch<any[]>(
            `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug&organization_id=in.(${orgIds.join(",")})&verification_status=eq.verified&limit=10`
          );
          if (Array.isArray(profiles)) {
            const validProfiles = profiles.filter(p => p.company_slug);
            slugs = validProfiles.map(p => p.company_slug);
            if (validProfiles.length > 0 && active) {
              setActiveProfile(validProfiles[0]);
            }
          }
        }
        
        if (companySlug && !slugs.includes(companySlug)) {
          slugs.push(companySlug);
        }
        
        // 3. Fetch canonical products for these companies using the relationships table
        if (slugs.length > 0) {
          // Fetch relationships to get canonical IDs (this captures both verified and auto-matched products)
          const relationships = await supabaseFetch<{ canonical_id: number }[]>(
            `/rest/v1/medicine_product_company_relationships?select=canonical_id&company_slug=in.(${slugs.join(",")})&limit=1000`
          );
          
          if (Array.isArray(relationships) && relationships.length > 0) {
            const canonicalIds = Array.from(new Set(relationships.map(r => r.canonical_id)));
            
            // Fetch the actual product details for these IDs
            // Chunk them if there are many to avoid URL length limits, but for < 1000 it should be fine
            const products = await supabaseFetch<MedicineProduct[]>(
              `/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,image_url,barcode,code,current_price_egp&canonical_id=in.(${canonicalIds.join(",")})`
            );
            if (active && Array.isArray(products)) {
              setPortfolio(products);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching portfolio:", err);
      } finally {
        if (active) setLoadingPortfolio(false);
      }
    }
    fetchPortfolio();
    return () => { active = false; };
  }, [session?.user?.id, supabaseFetch, companySlug]);

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
      setManufacturer(existing.manufacturer || "");
      setDrugClass(existing.drug_class || "");
      setRoute(existing.route || "");
      setCategory(existing.category || "");
      setBarcode(existing.barcode || "");
      setProductCode(existing.code || "");
      setPriceEgp(existing.current_price_egp ? String(existing.current_price_egp) : "");
      setImageUrl(existing.image_url || "");
    } else {
      // It's a new custom value
      setCanonicalId(null);
      setMedicineName(value);
      // Clear other fields for new addition
      setNameAr("");
      setScientificName("");
      setManufacturer("");
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
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    
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
          manufacturer_name: manufacturer.trim(),
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
          ? t("Your medicine update request has been submitted for review.", "تم إرسال طلب تعديل الدواء للمراجعة.")
          : t("Your medicine addition request has been submitted for review.", "تم إرسال طلب إضافة الدواء للمراجعة.")
      );
      
      // Clear form
      setCanonicalId(null);
      setMedicineName("");
      setNameAr("");
      setScientificName("");
      setManufacturer("");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not submit request.", "تعذر إرسال الطلب."));
    } finally {
      setBusy(false);
    }
  }

  const emptyOptions: { label: string; value: string }[] = [];
  const modeTitle = canonicalId !== null 
    ? t("Update Portfolio Medicine", "تحديث دواء في محفظتك") 
    : t("Add a New Medicine or edit ", "إضافة دواء جديد أو تعديل");

  return (
    <section id="add-medicine" className="mt-8 rounded-2xl border bg-white/10 backdrop-blur shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">{modeTitle}</h2>
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
        <div className="space-y-2 sm:col-span-2 pb-4 mb-2 border-b border-white/10">
          <Label className="text-blue-200">
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

        <div className="space-y-2">
          <Label>{t("Scientific/Generic Name", "الاسم العلمي")}</Label>
          <Input value={scientificName} onChange={e => setScientificName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("Manufacturer", "المصنع")}</Label>
          <SearchableCombobox
            options={emptyOptions}
            value={manufacturer}
            onChange={setManufacturer}
            placeholder={t("Manufacturer name", "اسم المصنع")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Drug class", "فئة الدواء")}</Label>
          <SearchableCombobox
            options={emptyOptions}
            value={drugClass}
            onChange={setDrugClass}
            placeholder={t("Drug class", "فئة الدواء")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Route", "طريقة الإعطاء")}</Label>
          <SearchableCombobox
            options={emptyOptions}
            value={route}
            onChange={setRoute}
            placeholder={t("e.g. Oral, IV", "مثال: فموي، وريدي")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Category", "الفئة")}</Label>
          <SearchableCombobox
            options={emptyOptions}
            value={category}
            onChange={setCategory}
            placeholder={t("Category", "الفئة")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Strength", "القوة")}</Label>
          <Input value={strength} onChange={e => setStrength(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("Dosage form", "شكل الجرعة")}</Label>
          <SearchableCombobox
            options={emptyOptions}
            value={dosageForm}
            onChange={setDosageForm}
            placeholder={t("Dosage form", "شكل الجرعة")}
          />
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
