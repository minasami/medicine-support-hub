import { useState, FormEvent, useEffect } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CompanyProfile = {
  id: string;
  organization_id: string;
  display_name: string;
  company_type: string;
  description: string;
  website_url: string;
  contact_email: string;
  country: string;
  city: string;
};

export function CompanyProfileUpdateForm({ companySlug }: { companySlug?: string } = {}) {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [profileId, setProfileId] = useState<string | null>(null);
  
  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [companyType, setCompanyType] = useState("pharma_company");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("Egypt");
  const [city, setCity] = useState("Cairo");
  const [logoUrl, setLogoUrl] = useState("");

  // Array fields (comma separated in input for UX)
  const [therapeuticAreas, setTherapeuticAreas] = useState("");
  const [productCategories, setProductCategories] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [services, setServices] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [supportPrograms, setSupportPrograms] = useState("");

  useEffect(() => {
    async function loadCompanyProfile() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Query user company membership or claim
        const targetSlug = companySlug || "soulpharma";
        const profiles = await supabaseFetch<any[]>(
          `/rest/v1/industry_company_profiles?company_slug=eq.${targetSlug}&limit=1`
        );

        if (profiles && profiles.length > 0) {
          const p = profiles[0];
          setProfileId(p.id);
          setDisplayName(p.display_name || "");
          setCompanyType(p.company_type || "pharma_company");
          setDescription(p.description || "");
          setWebsiteUrl(p.website_url || "");
          setContactEmail(p.contact_email || session?.user?.email || "");
          setCountry(p.country || "Egypt");
          setCity(p.city || "Cairo");
          setLogoUrl(p.logo_url || "");
          
          if (Array.isArray(p.therapeutic_areas)) setTherapeuticAreas(p.therapeutic_areas.join(", "));
          if (Array.isArray(p.product_categories)) setProductCategories(p.product_categories.join(", "));
          if (Array.isArray(p.capabilities)) setCapabilities(p.capabilities.join(", "));
          if (Array.isArray(p.services)) setServices(p.services.join(", "));
          if (Array.isArray(p.differentiators)) setDifferentiators(p.differentiators.join(", "));
          if (Array.isArray(p.support_programs)) setSupportPrograms(p.support_programs.join(", "));
        }
      } catch (err) {
        console.error("Error loading company profile:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadCompanyProfile();
  }, [session?.user?.id, supabaseFetch, companySlug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    const parseList = (str: string) => str.split(",").map(s => s.trim()).filter(Boolean);

    const payload = {
      display_name: displayName.trim(),
      company_type: companyType,
      description: description.trim(),
      website_url: websiteUrl.trim(),
      contact_email: contactEmail.trim(),
      country: country.trim(),
      city: city.trim(),
      logo_url: logoUrl.trim() || null,
      therapeutic_areas: parseList(therapeuticAreas),
      product_categories: parseList(productCategories),
      capabilities: parseList(capabilities),
      services: parseList(services),
      differentiators: differentiators.trim(),
      support_programs: parseList(supportPrograms),
      updated_at: new Date().toISOString(),
    };

    try {
      const targetSlug = companySlug || "soulpharma";
      if (profileId) {
        await supabaseFetch(`/rest/v1/industry_company_profiles?id=eq.${profileId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      } else {
        await supabaseFetch("/rest/v1/industry_company_profiles", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            ...payload,
            company_slug: targetSlug,
            verification_status: "verified",
            is_public: true,
          }),
        });
      }

      setMessage(t("Company profile updated successfully!", "تم تحديث الملف التعريفي للشركة بنجاح!"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not update company profile.", "تعذر تحديث الملف التعريفي للشركة."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="mb-8 border-emerald-500/20 shadow-md">
      <CardHeader className="bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-background dark:from-emerald-950/20 dark:via-teal-950/10">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
          🏢 {t("Update Official Company Profile", "تحديث الملف التعريفي الرسمي للشركة")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="mb-4 border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("Official Company Name", "اسم الشركة الرسمي")}</Label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Soul Pharma"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Company Type", "نوع الشركة / الكيان")}</Label>
              <Select value={companyType} onValueChange={setCompanyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pharma_company">{t("Pharmaceutical Manufacturer", "شركة مصنعة للأدوية")}</SelectItem>
                  <SelectItem value="distributor">{t("Medical Distributor / Wholesaler", "موزع / تاجر جملة طبي")}</SelectItem>
                  <SelectItem value="biotech">{t("Biotech & Speciality", "شركة تكنولوجيا حيوية وتخصصية")}</SelectItem>
                  <SelectItem value="cosmetic">{t("Cosmetics & Personal Care", "مستحضرات التجميل والعناية الشخصية")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("Contact Email", "البريد الإلكتروني للتواصل")}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="contact@soulpharma.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Official Website", "الموقع الإلكتروني الرسمي")}</Label>
              <Input
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://soulpharma.com"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Country", "الدولة")}</Label>
              <Input
                value={country}
                onChange={e => setCountry(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Headquarters City", "مدينة المقر الرئيسي")}</Label>
              <Input
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Company Description / Overview", "نبذة عن الشركة والأنشطة الرئيسية")}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t("Brief background about manufacturing capacity, history, and market presence...", "نبذة عن القدرة التصنيعية والتاريخ والتواجد في السوق...")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>{t("Therapeutic Areas (comma separated)", "المجالات العلاجية (مفصولة بفواصل)")}</Label>
              <Input
                value={therapeuticAreas}
                onChange={e => setTherapeuticAreas(e.target.value)}
                placeholder="Cardiology, Oncology, Pediatrics, OTC"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Product Categories (comma separated)", "فئات المنتجات (مفصولة بفواصل)")}</Label>
              <Input
                value={productCategories}
                onChange={e => setProductCategories(e.target.value)}
                placeholder="Prescription Medicines, OTC, Medical Devices"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Manufacturing & Supply Capabilities", "إمكانيات التصنيع والإمداد")}</Label>
              <Input
                value={capabilities}
                onChange={e => setCapabilities(e.target.value)}
                placeholder="Sterile Injectables, Solid Oral Dosage, Cold Chain"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Services & Patient Programs", "الخدمات وبرامج رعاية المرضى")}</Label>
              <Input
                value={supportPrograms}
                onChange={e => setSupportPrograms(e.target.value)}
                placeholder="Co-pay assistance, Disease awareness, Free screening"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Official Logo / Document Image", "صورة الشعار أو ملف الاعتماد الرسمية")}</Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { uploadToAppwriteStorage } = await import("@/lib/appwrite-storage");
                  const res = await uploadToAppwriteStorage(file, "company_documents");
                  if (res?.url) setLogoUrl(res.url);
                } catch {}
              }}
            />
            {logoUrl && (
              <p className="text-xs text-emerald-600 truncate font-mono mt-1">
                ✓ Appwrite Bucket Logo: {logoUrl}
              </p>
            )}
          </div>

          <Button type="submit" disabled={busy} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {busy ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? t("Saving Profile…", "جارٍ حفظ الملف…") : t("Save Official Company Profile", "حفظ الملف التعريفي الرسمي للشركة")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
