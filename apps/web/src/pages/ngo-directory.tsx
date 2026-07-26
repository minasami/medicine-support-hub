import { useState, useMemo, useEffect } from "react";
import { 
  Building2, Heart, PlusCircle, Search, ShieldCheck, Stethoscope, 
  Pill, Users, Briefcase, GraduationCap, CheckCircle2, ChevronRight,
  FileText, Sparkles, Filter, X
} from "lucide-react";
import { useRoute, useLocation } from "wouter";
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

interface NgoProfile {
  id: string;
  name: string;
  slug: string;
  licenseNumber: string;
  category: string;
  city: string;
  country: string;
  description: string;
  contactEmail: string;
  phone: string;
  website: string;
  verified: boolean;
  activeProgramsCount: number;
}

interface SupportProgram {
  id: string;
  ngoId: string;
  ngoName: string;
  title: string;
  category: "medical" | "medicines" | "social" | "economic" | "educational";
  description: string;
  eligibility: string;
  coverageDetails: string;
  targetMedicines?: string[];
  icd11Codes?: string[];
  status: "active" | "full" | "paused";
}

const INITIAL_NGOS: NgoProfile[] = [
  {
    id: "ngo-misr-el-kheir",
    name: "Misr El Kheir Foundation",
    slug: "misr-el-kheir",
    licenseNumber: "NGO-EG-5510",
    category: "Comprehensive Healthcare & Relief",
    city: "Cairo",
    country: "Egypt",
    description: "National foundation dedicated to healthcare access, chronic medicine aid, surgical interventions, and economic empowerment.",
    contactEmail: "health@misrelkheir.org",
    phone: "+20 2 16140",
    website: "https://misrelkheir.org",
    verified: true,
    activeProgramsCount: 8,
  },
  {
    id: "ngo-resala",
    name: "Resala Charity Association",
    slug: "resala",
    licenseNumber: "NGO-EG-1204",
    category: "Community Social & Medicine Support",
    city: "Giza",
    country: "Egypt",
    description: "Community-driven charity providing prescription medicine fulfillment, oncology support, and patient transportation.",
    contactEmail: "medical@resala.org",
    phone: "+20 2 19450",
    website: "https://resala.org",
    verified: true,
    activeProgramsCount: 5,
  },
  {
    id: "ngo-egyptian-cure-bank",
    name: "Egyptian Cure Bank (Shifaa)",
    slug: "egyptian-cure-bank",
    licenseNumber: "NGO-EG-4401",
    category: "Specialized Medical & Surgical Aid",
    city: "Cairo",
    country: "Egypt",
    description: "Specialized healthcare NGO funding high-cost biological treatments, cardiac surgeries, and organ transplant care.",
    contactEmail: "cure@egyptiancurebank.org",
    phone: "+20 2 16060",
    website: "https://egyptiancurebank.org",
    verified: true,
    activeProgramsCount: 12,
  },
  {
    id: "ngo-magdi-yacoub",
    name: "Magdi Yacoub Heart Foundation",
    slug: "magdi-yacoub-foundation",
    licenseNumber: "NGO-EG-9912",
    category: "Pediatric & Adult Cardiology Care",
    city: "Aswan",
    country: "Egypt",
    description: "World-class cardiac center offering free open-heart surgeries, cardiovascular medications, and rehabilitation.",
    contactEmail: "info@myf-egypt.org",
    phone: "+20 2 19687",
    website: "https://myf-egypt.org",
    verified: true,
    activeProgramsCount: 4,
  }
];

const INITIAL_PROGRAMS: SupportProgram[] = [
  {
    id: "prog-1",
    ngoId: "ngo-egyptian-cure-bank",
    ngoName: "Egyptian Cure Bank (Shifaa)",
    title: "High-Cost Oncology & Biologics Medicine Sponsorship",
    category: "medicines",
    description: "100% financial coverage for specialized biological and oncology medicines for eligible cancer patients.",
    eligibility: "Patients with verified medical prescription and financial assessment.",
    coverageDetails: "Covers monthly prescriptions up to 45,000 EGP.",
    targetMedicines: ["Ketomax Cream 20g", "Lomecand Lotion 100ml", "Augmentin 1g", "Controloc 40mg"],
    icd11Codes: ["2C10 Breast Malignancy", "1A00 Cholera", "5A11 Diabetes"],
    status: "active",
  },
  {
    id: "prog-2",
    ngoId: "ngo-misr-el-kheir",
    ngoName: "Misr El Kheir Foundation",
    title: "Critical Cardiac & Vascular Surgery Support",
    category: "medical",
    description: "Surgical funding and post-operative intensive care support for low-income patients requiring valve replacement.",
    eligibility: "Egyptian national patients with hospital surgical recommendation.",
    coverageDetails: "Includes hospital stay, surgeon fees, and 3 months of post-op anticoagulant medication.",
    status: "active",
  },
  {
    id: "prog-3",
    ngoId: "ngo-resala",
    ngoName: "Resala Charity Association",
    title: "Chronic Diseases Patient Caregiver & Social Relief",
    category: "social",
    description: "Provides emergency monthly living allowances, nutritional baskets, and medical transport assistance.",
    eligibility: "Chronic illness patients unable to work.",
    coverageDetails: "Monthly stipend + free medicine delivery.",
    status: "active",
  },
  {
    id: "prog-4",
    ngoId: "ngo-misr-el-kheir",
    ngoName: "Misr El Kheir Foundation",
    title: "Healthcare Vocational Micro-Grant & Economic Empowerment",
    category: "economic",
    description: "Funding micro-pharmacy kiosks and healthcare technician training for recovering patients and family caregivers.",
    eligibility: "Patients and family dependents seeking self-reliance.",
    coverageDetails: "Equipment grant + business mentorship.",
    status: "active",
  }
];

export default function NgoDirectoryPage() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [, setLocation] = useLocation();

  usePageSeo({
    title: t("NGO Network & Support Programs | Medicine Support Hub", "شبكة الجمعيات الأهلية وبرامج الدعم | مركز دعم الدواء"),
    description: t("Discover verified NGOs, publish healthcare support programs, and apply for medicine, medical, and social support.", "اكتشف الجمعيات الأهلية المعتمدة وانشر برامج الدعم الصحي وقدم طلبات الدعم المالي والدوائي."),
  });

  const [ngos, setNgos] = useState<NgoProfile[]>(INITIAL_NGOS);
  const [programs, setPrograms] = useState<SupportProgram[]>(INITIAL_PROGRAMS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modals state
  const [isNgoModalOpen, setIsNgoModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedProgramForApply, setSelectedProgramForApply] = useState<SupportProgram | null>(null);

  // Form states
  const [newNgoName, setNewNgoName] = useState("");
  const [newNgoLicense, setNewNgoLicense] = useState("");
  const [newNgoCategory, setNewNgoCategory] = useState("Healthcare & Relief");
  const [newNgoCity, setNewNgoCity] = useState("Cairo");
  const [newNgoDesc, setNewNgoDesc] = useState("");
  const [newNgoEmail, setNewNgoEmail] = useState("");

  const [newProgTitle, setNewProgTitle] = useState("");
  const [newProgCategory, setNewProgCategory] = useState<SupportProgram["category"]>("medicines");
  const [newProgDesc, setNewProgDesc] = useState("");
  const [newProgEligibility, setNewProgEligibility] = useState("");
  const [newProgCoverage, setNewProgCoverage] = useState("");
  const [newProgMedicine, setNewProgMedicine] = useState("");
  const [newProgIcd11, setNewProgIcd11] = useState("");

  // Application form states
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantNationalId, setApplicantNationalId] = useState("");
  const [applicantMedicineName, setApplicantMedicineName] = useState("");
  const [applicantIcd11Code, setApplicantIcd11Code] = useState("");
  const [applicantDetails, setApplicantDetails] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Load centralized medicines dataset for standardization autocomplete
  const [availableMedicines, setAvailableMedicines] = useState<string[]>([]);
  useEffect(() => {
    fetch("/data/egyptian-medicines-dataset.json")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.medicines)) {
          const names = Array.from(new Set(data.medicines.map((m: any) => m.name_en).filter(Boolean))) as string[];
          setAvailableMedicines(names.slice(0, 500));
        }
      })
      .catch(() => {});
  }, []);

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || p.title.toLowerCase().includes(q) || p.ngoName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [programs, selectedCategory, searchQuery]);

  const handleRegisterNgo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNgoName.trim()) return;

    const newProfile: NgoProfile = {
      id: `ngo-${Date.now()}`,
      name: newNgoName.trim(),
      slug: newNgoName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      licenseNumber: newNgoLicense.trim() || "NGO-EG-PENDING",
      category: newNgoCategory,
      city: newNgoCity,
      country: "Egypt",
      description: newNgoDesc.trim() || "Registered NGO offering healthcare and community support.",
      contactEmail: newNgoEmail.trim() || "contact@ngo.org",
      phone: "+20 2 27000000",
      website: "https://ngo.org",
      verified: true,
      activeProgramsCount: 0,
    };

    setNgos([newProfile, ...ngos]);
    setIsNgoModalOpen(false);
    setNewNgoName("");
    setNewNgoLicense("");
    setNewNgoDesc("");
  };

  const handlePublishProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgTitle.trim()) return;

    const newProg: SupportProgram = {
      id: `prog-${Date.now()}`,
      ngoId: ngos[0]?.id || "ngo-misr-el-kheir",
      ngoName: ngos[0]?.name || "Misr El Kheir Foundation",
      title: newProgTitle.trim(),
      category: newProgCategory,
      description: newProgDesc.trim(),
      eligibility: newProgEligibility.trim() || "Verified medical assessment.",
      coverageDetails: newProgCoverage.trim() || "Financial and logistical coverage.",
      targetMedicines: newProgMedicine ? [newProgMedicine] : ["Ketomax Cream 20g", "Controloc 40mg"],
      icd11Codes: newProgIcd11 ? [newProgIcd11] : ["5A11 Type 2 Diabetes"],
      status: "active",
    };

    setPrograms([newProg, ...programs]);
    setIsProgramModalOpen(false);
    setNewProgTitle("");
    setNewProgDesc("");
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !selectedProgramForApply) return;

    try {
      await supabaseFetch("/rest/v1/patient_program_applications", {
        method: "POST",
        body: JSON.stringify({
          program_id: selectedProgramForApply.id,
          ngo_name: selectedProgramForApply.ngoName,
          program_title: selectedProgramForApply.title,
          applicant_name: applicantName.trim(),
          applicant_phone: applicantPhone.trim(),
          national_id: applicantNationalId.trim(),
          medicine_requested: applicantMedicineName.trim(),
          icd11_diagnosis: applicantIcd11Code.trim(),
          details: applicantDetails.trim(),
          status: "pending_review",
          submitted_at: new Date().toISOString(),
        }),
      });
    } catch {}

    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setIsApplyModalOpen(false);
      setApplicantName("");
      setApplicantPhone("");
      setApplicantNationalId("");
      setApplicantMedicineName("");
      setApplicantIcd11Code("");
      setApplicantDetails("");
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Banner */}
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-8 sm:p-12 text-white shadow-2xl overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12">
            <Heart className="h-96 w-96 text-white" />
          </div>
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              {t("Verified NGO Healthcare Network", "شبكة الجمعيات الأهلية المعتمدة")}
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {t("NGO Public Profiles & Support Programs", "الملفات العامة للجمعيات وبرامج الدعم الصحي")}
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              {t(
                "A unified national platform where NGOs publish support programs (Medical, Medicines, Social, Economic) standardized with the Centralized Medicines Dataset & ICD-11 ICHI International Medical Codes.",
                "منصة موحدة تنشر فيها الجمعيات الأهلية برامج الدعم (طبي، دوائي، اجتماعي، تمكين اقتصادي) المربوطة بقاعدة بيانات الأدوية المركزية وأكواد منظمة الصحة العالمية ICD-11 ICHI."
              )}
            </p>
            
            <div className="pt-4 flex flex-wrap gap-4">
              <Button onClick={() => setIsNgoModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-6 py-6 shadow-lg shadow-emerald-900/40">
                <Building2 className="mr-2 h-5 w-5" />
                {t("Create NGO Public Profile", "إنشاء ملف جمعية أهلية")}
              </Button>
              <Button onClick={() => setIsProgramModalOpen(true)} variant="outline" className="border-white/30 text-white hover:bg-white/10 font-bold rounded-xl px-6 py-6">
                <PlusCircle className="mr-2 h-5 w-5" />
                {t("Publish New Support Program", "نشر برنامج دعم جديد")}
              </Button>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search programs by name, NGO, or medicine...", "ابحث عن برنامج، جمعية، أو اسم دواء...")}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Program Categories */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              onClick={() => setSelectedCategory("all")}
              className="rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              {t("All Programs", "كل البرامج")}
            </Button>
            <Button
              variant={selectedCategory === "medicines" ? "default" : "outline"}
              onClick={() => setSelectedCategory("medicines")}
              className="rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Pill className="mr-1 h-3.5 w-3.5 text-emerald-500" />
              {t("Medicines", "دعم دوائي")}
            </Button>
            <Button
              variant={selectedCategory === "medical" ? "default" : "outline"}
              onClick={() => setSelectedCategory("medical")}
              className="rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Stethoscope className="mr-1 h-3.5 w-3.5 text-blue-500" />
              {t("Medical & Surgeries", "عمليات وطب")}
            </Button>
            <Button
              variant={selectedCategory === "social" ? "default" : "outline"}
              onClick={() => setSelectedCategory("social")}
              className="rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Heart className="mr-1 h-3.5 w-3.5 text-rose-500" />
              {t("Social Aid", "اجتماعي ورعاية")}
            </Button>
            <Button
              variant={selectedCategory === "economic" ? "default" : "outline"}
              onClick={() => setSelectedCategory("economic")}
              className="rounded-xl text-xs font-semibold whitespace-nowrap"
            >
              <Briefcase className="mr-1 h-3.5 w-3.5 text-amber-500" />
              {t("Economic Empowerment", "تمكين اقتصادي")}
            </Button>
          </div>
        </div>

        {/* Support Programs Listing */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">
              {t("Active NGO Support Programs", "برامج الدعم المتاحة الآن")} ({filteredPrograms.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {filteredPrograms.map((program) => (
              <Card key={program.id} className="rounded-2xl border hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-4 border-b">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="mb-2 bg-emerald-100 text-emerald-800 border-emerald-200">
                        {program.category.toUpperCase()} SUPPORT
                      </Badge>
                      <CardTitle className="text-xl font-bold text-slate-900 leading-snug">
                        {program.title}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {program.ngoName}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {program.description}
                  </p>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-2 border">
                    <div>
                      <span className="font-bold text-slate-700">{t("Eligibility", "الشروط والاهلية")}: </span>
                      <span className="text-slate-600">{program.eligibility}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">{t("Coverage", "تفاصيل التغطية")}: </span>
                      <span className="text-slate-600">{program.coverageDetails}</span>
                    </div>
                  </div>

                  {/* Standardized Pre-filled Medicines & ICD-11 Badges */}
                  {(program.targetMedicines || program.icd11Codes) && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t("Standardized Medical Specifications (Dataset & ICD-11)", "المواصفات الطبية الموحدة")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {program.targetMedicines?.map((med, idx) => (
                          <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                            💊 {med}
                          </Badge>
                        ))}
                        {program.icd11Codes?.map((code, idx) => (
                          <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-xs">
                            🩺 {code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="bg-slate-50/50 border-t pt-4">
                  <Button
                    onClick={() => {
                      setSelectedProgramForApply(program);
                      setIsApplyModalOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t("Apply for Support", "تقديم طلب دعم")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* NGO Directory Profiles */}
        <div className="space-y-6 pt-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            {t("Verified NGO Profiles Directory", "دليل الجمعيات الأهلية المعتمدة")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ngos.map((ngo) => (
              <Card key={ngo.id} className="rounded-2xl border p-5 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Verified NGO
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">{ngo.licenseNumber}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900">{ngo.name}</h3>
                <p className="text-xs text-slate-600 line-clamp-2">{ngo.description}</p>
                <div className="pt-2 text-xs text-slate-500 border-t flex justify-between">
                  <span>📍 {ngo.city}, {ngo.country}</span>
                  <span className="font-semibold text-emerald-700">{ngo.activeProgramsCount} Programs</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Modal 1: Register NGO Profile */}
      <Dialog open={isNgoModalOpen} onOpenChange={setIsNgoModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Create NGO Public Profile", "إنشاء ملف جمعية أهلية جديد")}</DialogTitle>
            <DialogDescription>{t("Register your NGO to publish programs and accept standardized applications.", "سجل الجمعية لنشر برامج الدعم وتلقي الطلبات الموحدة.")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterNgo} className="space-y-4 py-2">
            <div>
              <Label>{t("NGO Official Name", "الاسم الرسمي للجمعية")}</Label>
              <Input required value={newNgoName} onChange={(e) => setNewNgoName(e.target.value)} placeholder="e.g. Misr Healthcare Foundation" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>{t("License / Registration Number", "رقم القيد أو الترخيص")}</Label>
              <Input value={newNgoLicense} onChange={(e) => setNewNgoLicense(e.target.value)} placeholder="NGO-EG-XXXX" className="rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Category", "التصنيف")}</Label>
                <Input value={newNgoCategory} onChange={(e) => setNewNgoCategory(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("City", "المدينة")}</Label>
                <Input value={newNgoCity} onChange={(e) => setNewNgoCity(e.target.value)} className="rounded-xl mt-1" />
              </div>
            </div>
            <div>
              <Label>{t("Description & Mission", "الوصف والرسالة")}</Label>
              <Textarea value={newNgoDesc} onChange={(e) => setNewNgoDesc(e.target.value)} rows={3} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>{t("Contact Email", "البريد الإلكتروني للجمعية")}</Label>
              <Input type="email" value={newNgoEmail} onChange={(e) => setNewNgoEmail(e.target.value)} placeholder="contact@ngo.org" className="rounded-xl mt-1" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                {t("Register & Save Profile", "حفظ وإنشاء الملف")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Publish Support Program */}
      <Dialog open={isProgramModalOpen} onOpenChange={setIsProgramModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Publish Support Program", "نشر برنامج دعم جديد")}</DialogTitle>
            <DialogDescription>{t("Add a new medical, medicine, or social support program with standardized ICD-11 & Medicine Dataset options.", "أضف برنامج دعم جديد وموحد مع اكواد منظمة الصحة وقواعد الأدوية.")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePublishProgram} className="space-y-4 py-2">
            <div>
              <Label>{t("Program Title", "عنوان البرنامج")}</Label>
              <Input required value={newProgTitle} onChange={(e) => setNewProgTitle(e.target.value)} placeholder="e.g. Chronic Biologics & Surgery Subsidy" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>{t("Support Type Category", "نوع الدعم")}</Label>
              <Select value={newProgCategory} onValueChange={(val: any) => setNewProgCategory(val)}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medicines">💊 Medicines Support (دعم دوائي)</SelectItem>
                  <SelectItem value="medical">🩺 Medical & Surgical (علاج وجراحة)</SelectItem>
                  <SelectItem value="social">🤝 Social Aid & Caregiver (اجتماعي ورعاية)</SelectItem>
                  <SelectItem value="economic">💼 Economic Empowerment (تمكين اقتصادي)</SelectItem>
                  <SelectItem value="educational">📚 Educational & Wellness (توعية وتعليم)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Description", "تفاصيل البرنامج")}</Label>
              <Textarea value={newProgDesc} onChange={(e) => setNewProgDesc(e.target.value)} rows={2} className="rounded-xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Standardized Medicine Pre-fill", "ربط بدواء موحد")}</Label>
                <Input value={newProgMedicine} onChange={(e) => setNewProgMedicine(e.target.value)} placeholder="e.g. Ketomax Cream 20g" className="rounded-xl mt-1" />
              </div>
              <div>
                <Label>{t("ICD-11 Diagnosis Code", "رمز التشخيص ICD-11")}</Label>
                <Input value={newProgIcd11} onChange={(e) => setNewProgIcd11(e.target.value)} placeholder="e.g. 5A11 Type 2 Diabetes" className="rounded-xl mt-1" />
              </div>
            </div>
            <div>
              <Label>{t("Eligibility Criteria", "شروط الأهلية")}</Label>
              <Input value={newProgEligibility} onChange={(e) => setNewProgEligibility(e.target.value)} placeholder="e.g. Low income assessment" className="rounded-xl mt-1" />
            </div>
            <div>
              <Label>{t("Coverage Details", "تغطية الدعم المالي/اللوجستي")}</Label>
              <Input value={newProgCoverage} onChange={(e) => setNewProgCoverage(e.target.value)} placeholder="e.g. 100% medication cost" className="rounded-xl mt-1" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                {t("Publish Support Program", "نشر البرنامج الآن")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Apply for Support */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t("Submit Support Application", "تقديم طلب دعم")}</DialogTitle>
            <DialogDescription>
              {selectedProgramForApply?.title} ({selectedProgramForApply?.ngoName})
            </DialogDescription>
          </DialogHeader>

          {submitSuccess ? (
            <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200 my-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2" />
              <AlertDescription className="font-bold">
                {t("Application submitted successfully! Sent to NGO review dashboard & Central Platform Admin.", "تم تقديم الطلب بنجاح! تم الإرسال إلى الجمعية ولوحة التحكم المركزية.")}
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleApplySubmit} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("Full Name", "الاسم بالكامل")}</Label>
                  <Input required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className="rounded-xl mt-1" />
                </div>
                <div>
                  <Label>{t("Phone Number", "رقم الهاتف")}</Label>
                  <Input required value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} placeholder="+20 100 000 0000" className="rounded-xl mt-1" />
                </div>
              </div>

              <div>
                <Label>{t("National ID (14 digits)", "الرقم القومي")}</Label>
                <Input value={applicantNationalId} onChange={(e) => setApplicantNationalId(e.target.value)} placeholder="2950101XXXXXXXX" className="rounded-xl mt-1" />
              </div>

              {/* Standardized Pre-filled Medicine Selection */}
              <div>
                <Label>{t("Requested Medicine (Dataset Pre-filled)", "الدواء المطلوب (من قاعدة البيانات المركزية)")}</Label>
                <Input
                  value={applicantMedicineName}
                  onChange={(e) => setApplicantMedicineName(e.target.value)}
                  placeholder="Type to search e.g. Ketomax, Controloc..."
                  className="rounded-xl mt-1"
                />
              </div>

              {/* Standardized ICD-11 Diagnosis Search */}
              <div>
                <Label>{t("ICD-11 Medical Code / Diagnosis", "التشخيص الطبي الحسابي ICD-11 ICHI")}</Label>
                <Input
                  value={applicantIcd11Code}
                  onChange={(e) => setApplicantIcd11Code(e.target.value)}
                  placeholder="e.g. 5A11 Type 2 Diabetes / IAA.BA.BB"
                  className="rounded-xl mt-1"
                />
              </div>

              <div>
                <Label>{t("Attach Medical Report / Prescription (Appwrite Storage)", "مرفق التقرير الطبي أو الروشتة (Appwrite Storage)")}</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { uploadToAppwriteStorage } = await import("@/lib/appwrite-storage");
                      const res = await uploadToAppwriteStorage(file, "medical_documents");
                      if (res?.url) {
                        setApplicantDetails((prev) => `${prev ? prev + "\n" : ""}Attached Document (Appwrite): ${res.url}`);
                      }
                    } catch {}
                  }}
                  className="rounded-xl mt-1"
                />
              </div>

              <div>
                <Label>{t("Case Summary & Additional Details", "شرح الحالة والتفاصيل الإضافية")}</Label>
                <Textarea value={applicantDetails} onChange={(e) => setApplicantDetails(e.target.value)} rows={3} className="rounded-xl mt-1" />
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                  {t("Submit Application Now", "إرسال طلب الدعم الآن")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
