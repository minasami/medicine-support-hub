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

export function CompanyProfileUpdateForm() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [profileId, setProfileId] = useState<string | null>(null);
  
  // Form fields
  const [displayName, setDisplayName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      if (!session?.user?.id) return;
      try {
        setLoading(true);
        // 1. Get user's orgs
        const memberships = await supabaseFetch<any[]>(
          `/rest/v1/organization_members?select=organization_id&user_id=eq.${session.user.id}&is_active=eq.true&limit=10`
        );
        const orgIds = Array.isArray(memberships) ? memberships.map(m => m.organization_id).filter(Boolean) : [];
        if (!orgIds.length && !active) return;
        
        // 2. Get first verified profile
        const profiles = await supabaseFetch<CompanyProfile[]>(
          `/rest/v1/industry_company_profiles?select=id,organization_id,display_name,company_type,description,website_url,contact_email,country,city&organization_id=in.(${orgIds.join(",")})&verification_status=eq.verified&limit=1`
        );
        
        if (Array.isArray(profiles) && profiles.length > 0 && active) {
          const p = profiles[0];
          setProfileId(p.id);
          setDisplayName(p.display_name || "");
          setCompanyType(p.company_type || "pharma_company");
          setDescription(p.description || "");
          setWebsiteUrl(p.website_url || "");
          setContactEmail(p.contact_email || "");
          setCountry(p.country || "");
          setCity(p.city || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    
    fetchProfile();
    return () => { active = false; };
  }, [session, supabaseFetch]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!profileId) return;
    
    setBusy(true);
    setError(null);
    setMessage(null);
    
    try {
      await supabaseFetch(`/rest/v1/industry_company_profiles?id=eq.${profileId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          company_type: companyType,
          description: description.trim(),
          website_url: websiteUrl.trim(),
          contact_email: contactEmail.trim(),
          country: country.trim(),
          city: city.trim(),
        })
      });
      setMessage(t("Company profile data successfully updated.", "تم تحديث بيانات ملف الشركة بنجاح."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not update profile.", "تعذر تحديث الملف."));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex justify-center p-6">
        <Spinner className="h-6 w-6 text-blue-600" />
      </div>
    );
  }

  if (!profileId) {
    // If no verified profile exists, hide the form
    return null;
  }

  return (
    <section id="update-company-profile" className="mt-8 rounded-2xl border bg-white shadow-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          {t("Update Company Page data", "تحديث بيانات صفحة الشركة")}
        </h2>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="default" className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("Display Name", "اسم العرض")}</Label>
          <Input 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
            required 
            placeholder={t("Company Name", "اسم الشركة")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Company Type", "نوع الشركة")}</Label>
          <Select value={companyType} onValueChange={setCompanyType}>
            <SelectTrigger>
              <SelectValue placeholder={t("Select Type", "اختر النوع")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pharma_company">{t("Pharma Company", "شركة أدوية")}</SelectItem>
              <SelectItem value="medical_products_company">{t("Medical Products", "منتجات طبية")}</SelectItem>
              <SelectItem value="medical_device_company">{t("Medical Devices", "أجهزة طبية")}</SelectItem>
              <SelectItem value="distributor">{t("Distributor", "موزع")}</SelectItem>
              <SelectItem value="supplier">{t("Supplier", "مورد")}</SelectItem>
              <SelectItem value="healthcare_company">{t("Healthcare Company", "شركة رعاية صحية")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t("Description", "الوصف")}</Label>
          <Textarea 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            rows={4}
            placeholder={t("Briefly describe your company's mission and products...", "صف باختصار مهمة ومنتجات شركتك...")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Website URL", "رابط الموقع الإلكتروني")}</Label>
          <Input 
            value={websiteUrl} 
            onChange={e => setWebsiteUrl(e.target.value)} 
            type="url"
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Contact Email", "البريد الإلكتروني للتواصل")}</Label>
          <Input 
            value={contactEmail} 
            onChange={e => setContactEmail(e.target.value)} 
            type="email"
            placeholder="contact@company.com"
          />
        </div>

        <div className="space-y-2">
          <Label>{t("Country", "الدولة")}</Label>
          <Input 
            value={country} 
            onChange={e => setCountry(e.target.value)} 
            placeholder={t("e.g. Egypt", "مثال: مصر")}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("City", "المدينة")}</Label>
          <Input 
            value={city} 
            onChange={e => setCity(e.target.value)} 
            placeholder={t("e.g. Cairo", "مثال: القاهرة")}
          />
        </div>

        <div className="sm:col-span-2 pt-4">
          <Button type="submit" disabled={busy} className="w-full sm:w-auto min-w-[200px]">
            {busy && <Spinner className="mr-2 h-4 w-4" />}
            {t("Save Company Profile", "حفظ ملف الشركة")}
          </Button>
        </div>
      </form>
    </section>
  );
}
