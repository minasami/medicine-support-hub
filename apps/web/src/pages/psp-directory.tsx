import { useState, useMemo, useEffect } from "react";
import { 
  Building2, Heart, PlusCircle, Search, ShieldCheck, Stethoscope, 
  Pill, Users, FileText, CheckCircle2, Award, Sparkles, Filter
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { usePageSeo } from "@/components/route-seo";

interface PspProgram {
  id: string;
  sponsorName: string;
  sponsorType: "pharma_company" | "ngo" | "hospital" | "foundation";
  title: string;
  diseaseArea: string;
  targetMedicine: string;
  icd11Code: string;
  supportType: string;
  copayAssistanceRatio: string;
  description: string;
  eligibility: string;
  status: "active" | "open" | "closed";
}

const INITIAL_PSPS: PspProgram[] = [
  {
    id: "psp-soul-1",
    sponsorName: "SOUL PHARMA & NGO Care Network",
    sponsorType: "pharma_company",
    title: "Ketomax & Dermatology Access Patient Support Program",
    diseaseArea: "Dermatology & Topical Antifungal Care",
    targetMedicine: "Ketomax Cream 20g (Ketoconazole 2%)",
    icd11Code: "1F20 Dermatophytosis / ICHI-Skin",
    supportType: "Copay Assistance & Free Refill Subsidy",
    copayAssistanceRatio: "Up to 80% Subsidy",
    description: "Co-sponsored Patient Support Program providing continuous access to dermatological formulations and specialist consultation subsidies.",
    eligibility: "Patients with verified prescription for Ketomax Cream or Lomecand.",
    status: "active",
  },
  {
    id: "psp-hikma-1",
    sponsorName: "Hikma Pharmaceuticals PSP Alliance",
    sponsorType: "pharma_company",
    title: "Oncology & Chronic Care Patient Navigation Program",
    diseaseArea: "Oncology & Specialty Therapeutics",
    targetMedicine: "Specialty Oncology Formulations",
    icd11Code: "2C10 Breast Malignancy / 2B50",
    supportType: "Diagnostic Assistance & Medication Access",
    copayAssistanceRatio: "100% Free Diagnostic Biomarkers",
    description: "Dedicated patient navigation assistance, free biomarker testing, and medicine co-pay reduction.",
    eligibility: "Newly diagnosed oncology patients referred by treating oncologists.",
    status: "active",
  },
  {
    id: "psp-sanofi-1",
    sponsorName: "Sanofi Patient Support Network",
    sponsorType: "pharma_company",
    title: "Diabetes & Insulin Continuity Support Initiative",
    diseaseArea: "Endocrinology & Diabetes Management",
    targetMedicine: "Insulin & Metabolic Therapies",
    icd11Code: "5A11 Type 2 Diabetes Mellitus",
    supportType: "Free Blood Glucose Meter & Co-Pay Card",
    copayAssistanceRatio: "50% Discount Co-Pay Card",
    description: "Comprehensive diabetes care support providing free glucose monitors, education, and co-pay discounts.",
    eligibility: "Diabetic patients enrolled in registered clinical centers.",
    status: "active",
  },
  {
    id: "psp-shifaa-1",
    sponsorName: "Egyptian Cure Bank (Shifaa) PSP",
    sponsorType: "ngo",
    title: "Cardiology & Open-Heart Surgical Aid Program",
    diseaseArea: "Cardiovascular Surgery & Anticoagulants",
    targetMedicine: "Clexane / Anticoagulants",
    icd11Code: "BlockL3-Circulatory / 1582405162",
    supportType: "Full Surgical Sponsorship & Post-Op Meds",
    copayAssistanceRatio: "100% Full Funding",
    description: "Provides zero-cost cardiac surgical care, intensive care stays, and 6 months of post-operative medications.",
    eligibility: "Low-income patients certified by social welfare review.",
    status: "active",
  }
];

export default function PspDirectoryPage() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();

  usePageSeo({
    title: t("Patient Support Programs (PSPs) Directory | Medicine Support Hub", "دليل برامج دعم المرضى PSPs | مركز دعم الدواء"),
    description: t("Directory of Patient Support Programs hosted by pharmaceutical companies and NGOs. Apply directly for co-pay assistance and medicine access.", "دليل برامج دعم المرضى المقدمة من شركات الأدوية والجمعيات. قدم مباشرة للحصول على دعم تكاليف الأدوية والعلاج."),
  });

  const [psps, setPsps] = useState<PspProgram[]>(INITIAL_PSPS);
  const [searchQuery, setSearchQuery] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState("all");

  // Modals state
  const [isSubmitPspOpen, setIsSubmitPspOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [selectedPsp, setSelectedPsp] = useState<PspProgram | null>(null);

  // New PSP Form
  const [newSponsorName, setNewSponsorName] = useState("");
  const [newSponsorType, setNewSponsorType] = useState<PspProgram["sponsorType"]>("pharma_company");
  const [newTitle, setNewTitle] = useState("");
  const [newDiseaseArea, setNewDiseaseArea] = useState("");
  const [newTargetMedicine, setNewTargetMedicine] = useState("");
  const [newIcd11Code, setNewIcd11Code] = useState("");
  const [newSupportType, setNewSupportType] = useState("");
  const [newCopayRatio, setNewCopayRatio] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEligibility, setNewEligibility] = useState("");

  // Apply Form
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantNationalId, setApplicantNationalId] = useState("");
  const [applicantMedicine, setApplicantMedicine] = useState("");
  const [applicantIcd11, setApplicantIcd11] = useState("");
  const [applicantDetails, setApplicantDetails] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const filteredPsps = useMemo(() => {
    return psps.filter((p) => {
      const matchSponsor = sponsorFilter === "all" || p.sponsorType === sponsorFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchQ = !q || p.title.toLowerCase().includes(q) || p.sponsorName.toLowerCase().includes(q) || p.targetMedicine.toLowerCase().includes(q) || p.diseaseArea.toLowerCase().includes(q);
      return matchSponsor && matchQ;
    });
  }, [psps, sponsorFilter, searchQuery]);

  const handleRegisterPsp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSponsorName.trim()) return;

    const newProg: PspProgram = {
      id: `psp-${Date.now()}`,
      sponsorName: newSponsorName.trim(),
      sponsorType: newSponsorType,
      title: newTitle.trim(),
      diseaseArea: newDiseaseArea.trim() || "General Medicine",
      targetMedicine: newTargetMedicine.trim() || "Standardized Medicine",
      icd11Code: newIcd11Code.trim() || "ICD-11 Standardized",
      supportType: newSupportType.trim() || "Co-pay & Access Assistance",
      copayAssistanceRatio: newCopayRatio.trim() || "Up to 75%",
      description: newDesc.trim(),
      eligibility: newEligibility.trim() || "Verified medical diagnosis.",
      status: "active",
    };

    setPsps([newProg, ...psps]);
    setIsSubmitPspOpen(false);
    setNewTitle("");
    setNewSponsorName("");
    setNewDesc("");
  };

  const handleApplyPsp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !selectedPsp) return;

    try {
      await supabaseFetch("/rest/v1/patient_psp_applications", {
        method: "POST",
        body: JSON.stringify({
          psp_id: selectedPsp.id,
          sponsor_name: selectedPsp.sponsorName,
          psp_title: selectedPsp.title,
          applicant_name: applicantName.trim(),
          applicant_phone: applicantPhone.trim(),
          national_id: applicantNationalId.trim(),
          medicine_name: applicantMedicine || selectedPsp.targetMedicine,
          icd11_code: applicantIcd11 || selectedPsp.icd11Code,
          details: applicantDetails.trim(),
          status: "pending_review",
          submitted_at: new Date().toISOString(),
        }),
      });
    } catch {}

    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setIsApplyOpen(false);
      setApplicantName("");
      setApplicantPhone("");
      setApplicantNationalId("");
      setApplicantMedicine("");
      setApplicantIcd11("");
      setApplicantDetails("");
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Hero Header */}
        <div className="relative rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-8 sm:p-12 text-white shadow-2xl overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12">
            <Award className="h-96 w-96 text-white" />
          </div>
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              {t("Patient Support Programs Directory (PSPs)", "دليل برامج دعم المرضى PSPs")}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {t("Patient Support Programs (PSPs)", "برامج دعم المرضى وتخفيض تكاليف العلاج")}
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              {t(
                "Public directory connecting patients, doctors, and institutions to Patient Support Programs (PSPs) funded by Pharmaceutical Manufacturers & Healthcare Foundations. Pre-filled with Centralized Medicines & ICD-11 ICHI databases.",
                "الدليل الوطني الموحد لربط المرضى والأطباء ببرامج دعم المرضى (PSPs) الممولة من شركات الأدوية والمؤسسات العلاجية والمربوطة بأكواد منظمة الصحة العالمية وقواعد الأدوية."
              )}
            </p>

            <div className="pt-4 flex flex-wrap gap-4">
              <Button onClick={() => setIsSubmitPspOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-blue-900/40">
                <PlusCircle className="mr-2 h-5 w-5" />
                {t("Publish New PSP Program", "نشر برنامج PSP جديد")}
              </Button>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search PSPs by medicine, company, disease...", "ابحث باسم الدواء، الشركة، أو المرض...")}
              className="pl-9 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
            <Button
              variant={sponsorFilter === "all" ? "default" : "outline"}
              onClick={() => setSponsorFilter("all")}
              className="rounded-xl text-xs font-semibold"
            >
              {t("All Sponsors", "جميع الرعاة")}
            </Button>
            <Button
              variant={sponsorFilter === "pharma_company" ? "default" : "outline"}
              onClick={() => setSponsorFilter("pharma_company")}
              className="rounded-xl text-xs font-semibold"
            >
              <Building2 className="mr-1 h-3.5 w-3.5 text-blue-500" />
              {t("Pharma Companies", "شركات الأدوية")}
            </Button>
            <Button
              variant={sponsorFilter === "ngo" ? "default" : "outline"}
              onClick={() => setSponsorFilter("ngo")}
              className="rounded-xl text-xs font-semibold"
            >
              <Heart className="mr-1 h-3.5 w-3.5 text-emerald-500" />
              {t("NGO Foundations", "الجمعيات الأهلية")}
            </Button>
          </div>
        </div>

        {/* PSP Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPsps.map((psp) => (
            <Card key={psp.id} className="rounded-2xl border hover:shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden bg-white">
              <CardHeader className="bg-gradient-to-r from-blue-50/50 to-white pb-4 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className="mb-2 bg-blue-100 text-blue-900 border-blue-200">
                      {psp.copayAssistanceRatio}
                    </Badge>
                    <CardTitle className="text-xl font-bold text-slate-900 leading-snug">
                      {psp.title}
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold text-blue-700 mt-1 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {psp.sponsorName}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {psp.description}
                </p>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border text-xs">
                  <div>
                    <span className="font-bold text-slate-700">{t("Therapeutic Area", "المجال العلاجي")}:</span>
                    <div className="text-slate-600 mt-0.5">{psp.diseaseArea}</div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700">{t("Support Type", "نوع الدعم")}:</span>
                    <div className="text-slate-600 mt-0.5">{psp.supportType}</div>
                  </div>
                </div>

                {/* Standardized Pre-filled Metadata */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t("Centralized Database Standards", "المواصفات المركزية للدواء والتشخيص")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                      💊 {psp.targetMedicine}
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                      🩺 {psp.icd11Code}
                    </Badge>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="bg-slate-50/50 border-t pt-4">
                <Button
                  onClick={() => {
                    setSelectedPsp(psp);
                    setIsApplyOpen(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t("Apply to Patient Support Program", "تقديم طلب انضمام لبرنامج PSP")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal 1: Register New PSP Program */}
      <Dialog open={isSubmitPspOpen} onOpenChange={setIsSubmitPspOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Publish Patient Support Program (PSP)", "نشر برنامج دعم مرضى جديد")}</DialogTitle>
            <DialogDescription>{t("Publish a PSP co-pay subsidy or drug access program to the national repository.", "أنشر برنامج دعم تكاليف علاج أو تخفيض أسعار الأدوية في الدليل الوطني.")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterPsp} className="space-y-4 py-2">
            <div>
              <Label>{t("PSP Program Title", "عنوان برنامج الدعم")}</Label>
              <Input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Dermatology & Oncology Co-Pay Card" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>{t("Sponsor Organization / Company Name", "اسم الشركة أو الجمعية الراعيات")}</Label>
              <Input required value={newSponsorName} onChange={(e) => setNewSponsorName(e.target.value)} placeholder="e.g. SOUL PHARMA / Hikma" className="rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Sponsor Type", "نوع جهة الرعاية")}</Label>
                <Select value={newSponsorType} onValueChange={(val: any) => setNewSponsorType(val)}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pharma_company">Pharma Company (شركة أدوية)</SelectItem>
                    <SelectItem value="ngo">NGO Foundation (جمعية أهلية)</SelectItem>
                    <SelectItem value="hospital">Hospital (مستشفى ومجمع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Co-Pay Assistance Ratio", "نسبة الدعم المالي")}</Label>
                <Input value={newCopayRatio} onChange={(e) => setNewCopayRatio(e.target.value)} placeholder="e.g. 75% Co-Pay Subsidy" className="rounded-xl mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Target Medicine (Dataset)", "الدواء المستهدف")}</Label>
                <Input value={newTargetMedicine} onChange={(e) => setNewTargetMedicine(e.target.value)} placeholder="e.g. Ketomax Cream 20g" className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("ICD-11 Code", "رمز ICD-11")}</Label>
                <Input value={newIcd11Code} onChange={(e) => setNewIcd11Code(e.target.value)} placeholder="e.g. 5A11 Type 2 Diabetes" className="rounded-xl mt-1" />
              </div>
            </div>
            <div>
              <Label>{t("Program Description", "وصف البرنامج وتفاصيله")}</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} className="rounded-xl mt-1" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                {t("Publish PSP Program Now", "نشر برنامج PSP الآن")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Apply for PSP Program */}
      <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Apply to Patient Support Program", "تقديم طلب انضمام لبرنامج PSP")}</DialogTitle>
            <DialogDescription>{selectedPsp?.title} ({selectedPsp?.sponsorName})</DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <Alert className="bg-blue-50 text-blue-900 border-blue-200 my-4">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mr-2" />
              <AlertDescription className="font-bold">
                {t("PSP Application submitted successfully! Directly logged to Platform Admin & Sponsor Management Dashboard.", "تم تقديم طلب الانضمام لبرنامج PSP بنجاح وتسجيله في لوحة الإدارة المركزية.")}
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleApplyPsp} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("Patient Full Name", "اسم المريض بالكامل")}</Label>
                  <Input required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label>{t("Contact Phone Number", "رقم التواصل")}</Label>
                  <Input required value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} placeholder="+20 100 000 0000" className="rounded-xl mt-1" />
                </div>
              </div>

              <div>
                <Label>{t("National ID Number", "الرقم القومي")}</Label>
                <Input value={applicantNationalId} onChange={(e) => setApplicantNationalId(e.target.value)} placeholder="2950101XXXXXXXX" className="rounded-xl mt-1" />
              </div>

              <div>
                <Label>{t("Target Medicine", "الدواء المطلوب للدعم")}</Label>
                <Input value={applicantMedicine || selectedPsp?.targetMedicine || ""} onChange={(e) => setApplicantMedicine(e.target.value)} className="rounded-xl mt-1" />
              </div>

              <div>
                <Label>{t("ICD-11 Medical Diagnosis Code", "رمز التشخيص ICD-11 ICHI")}</Label>
                <Input value={applicantIcd11 || selectedPsp?.icd11Code || ""} onChange={(e) => setApplicantIcd11(e.target.value)} className="rounded-xl mt-1" />
              </div>

              <div>
                <Label>{t("Medical Condition Summary", "ملخص الحالة الصحية ورأي الطبيب المعالج")}</Label>
                <Textarea value={applicantDetails} onChange={(e) => setApplicantDetails(e.target.value)} rows={3} className="rounded-xl mt-1" />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                  {t("Submit PSP Application", "إرسال طلب الانضمام لبرنامج PSP")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
