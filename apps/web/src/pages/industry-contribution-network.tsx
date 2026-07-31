/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  FileSpreadsheet,
  Globe2,
  Layers,
  Mail,
  Paperclip,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UploadCloud,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { submitCompanyClaim } from "@/lib/company-claims-data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ClaimDraft = {
  selectedCompanySlug: string;
  companyName: string;
  isCustomCompany: boolean;
  contactName: string;
  titleRole: string;
  workEmail: string;
  mobilePhone: string;
  officialRegNo: string;
  edaLicenseNo: string;
  websiteUrl: string;
  proofDocumentName: string;
  proofDocumentSize: string;
  documentationNote: string;
  declaredAuthority: boolean;
};

const DEFAULT_DRAFT: ClaimDraft = {
  selectedCompanySlug: "",
  companyName: "",
  isCustomCompany: false,
  contactName: "",
  titleRole: "",
  workEmail: "",
  mobilePhone: "",
  officialRegNo: "",
  edaLicenseNo: "",
  websiteUrl: "",
  proofDocumentName: "",
  proofDocumentSize: "",
  documentationNote: "",
  declaredAuthority: false,
};

export default function IndustryContributionNetwork() {
  const { t } = useLanguage();
  const { session, isAuthenticated, signUp, supabaseFetch } = usePatientAuth();
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(DEFAULT_DRAFT);
  const [accountPassword, setAccountPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Company searchable picker state
  const [companyList, setCompanyList] = useState<Array<{ company_name: string; company_slug: string }>>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    // Fetch available companies from directory RPC or dataset fallback
    void supabaseFetch<any[]>("/rest/v1/rpc/company_profile_directory_page", {
      method: "POST",
      body: JSON.stringify({ p_query: null, p_limit: 200, p_offset: 0 }),
    })
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped = rows.map((r) => ({
            company_name: r.company_name || r.canonical_name || "Company",
            company_slug: r.company_slug || r.id || "slug",
          }));
          setCompanyList(mapped);
        }
      })
      .catch(() => {
        // Fallback default top companies
        setCompanyList([
          { company_name: "SOUL PHARMA", company_slug: "soul-pharma" },
          { company_name: "Amoun Pharmaceutical Co.", company_slug: "amoun" },
          { company_name: "GSK (GlaxoSmithKline)", company_slug: "gsk" },
          { company_name: "Novartis", company_slug: "novartis" },
          { company_name: "Sanofi", company_slug: "sanofi" },
          { company_name: "Merck KGaA", company_slug: "merck" },
          { company_name: "EVA Pharma", company_slug: "eva-pharma" },
          { company_name: "Apex Pharma", company_slug: "apex-pharma" },
          { company_name: "Hikma Pharmaceuticals", company_slug: "hikma" },
          { company_name: "Sigma Pharmaceutical Industries", company_slug: "sigma" },
        ]);
      });
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!companySearchQuery.trim()) return companyList.slice(0, 50);
    const q = companySearchQuery.toLowerCase();
    return companyList.filter((c) => c.company_name.toLowerCase().includes(q)).slice(0, 50);
  }, [companyList, companySearchQuery]);

  const handleSelectCompany = (comp: { company_name: string; company_slug: string }) => {
    setClaimDraft((prev) => ({
      ...prev,
      selectedCompanySlug: comp.company_slug,
      companyName: comp.company_name,
      isCustomCompany: false,
    }));
    setIsPickerOpen(false);
  };

  const handleSelectCustomNewCompany = () => {
    setClaimDraft((prev) => ({
      ...prev,
      selectedCompanySlug: "new_custom_company",
      companyName: "",
      isCustomCompany: true,
    }));
    setIsPickerOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setClaimDraft((prev) => ({
        ...prev,
        proofDocumentName: file.name,
        proofDocumentSize: `${sizeMb} MB`,
      }));
    }
  };

  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!claimDraft.companyName.trim()) {
      setError(t("Please select or enter your company name.", "برجاء اختيار أو إدخال اسم الشركة."));
      return;
    }

    if (!claimDraft.mobilePhone.trim()) {
      setError(t("Please enter a contact phone/mobile number.", "برجاء إدخال رقم الهاتف/المحمول للتواصل."));
      return;
    }

    if (!claimDraft.declaredAuthority) {
      setError(
        t(
          "You must declare authority as an authorized representative of the pharmaceutical entity.",
          "يجب أن تقر بتفويضك كممثل معتمد للمنشأة الدوائية."
        )
      );
      return;
    }

    const workEmail = (claimDraft.workEmail || session?.user?.email || "").trim().toLowerCase();
    const claimSlug = (claimDraft.selectedCompanySlug && claimDraft.selectedCompanySlug !== "new_custom_company")
      ? claimDraft.selectedCompanySlug
      : claimDraft.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";

    const claimRecord = {
      id: `claim_${Date.now()}`,
      company_slug: claimSlug,
      company_name: claimDraft.companyName,
      proposed_company_name: claimDraft.companyName,
      company_type: "pharmaceutical_manufacturer",
      work_email: workEmail,
      user_email: workEmail,
      user_id: session?.user?.id || null,
      mobile_phone: claimDraft.mobilePhone,
      role_title: claimDraft.titleRole || "Company Representative",
      website: claimDraft.websiteUrl,
      notes: claimDraft.documentationNote,
      status: "pending",
      is_approved: false,
      verification_score: 50,
      requested_by: session?.user?.id || workEmail,
      created_at: new Date().toISOString(),
    };

    const persistClaim = async () => {
      try {
        await submitCompanyClaim(claimRecord);
      } catch (err) {
        console.warn("Claim post error notice:", err);
      }
    };

    if (!isAuthenticated) {
      if (!accountPassword || accountPassword.length < 8) {
        setError(
          t(
            "Please create a password (at least 8 characters) to secure your company representative portal.",
            "برجاء إنشاء كلمة مرور (٨ أحرف على الأقل) لتأمين بوابة ممثل الشركة."
          )
        );
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const result = await signUp(
          workEmail,
          accountPassword,
          claimDraft.contactName.trim(),
          claimDraft.mobilePhone.trim()
        );
        await persistClaim();
        if (result.requiresEmailConfirmation) {
          setMessage(
            t(
              "Your representative claim is registered! Check your email to activate your account.",
              "تم تسجيل طلب التوثيق بنجاح! يرجى مراجعة بريدك الإلكتروني لتأكيد الحساب."
            )
          );
        } else {
          setMessage(
            t(
              "Your company representative claim has been submitted to the platform administration for verification.",
              "تم إرسال طلب توثيق ممثل الشركة إلى إدارة المنصة للمراجعة."
            )
          );
          setClaimDraft(DEFAULT_DRAFT);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to initialize company representative account.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await persistClaim();
      setMessage(
        t(
          "Your company representative claim has been submitted to the platform administration for verification.",
          "تم إرسال طلب توثيق ممثل الشركة إلى إدارة المنصة للمراجعة."
        )
      );
      setClaimDraft(DEFAULT_DRAFT);
    } catch (err: any) {
      setError(err?.message || "Failed to submit claim.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 space-y-2 text-center md:text-left">
        <Badge className="bg-emerald-600/90 text-white font-bold mb-2">
          {t("Industry & Brand Representative Portal", "بوابة ممثلي الشركات والشركات الدوائية")}
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t("Pharmaceutical Company Representative Registration", "تسجيل ممثل معتمد لشركة دوائية")}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t(
            "Official registration portal for pharmaceutical manufacturers, brand owners, and toll manufacturing representatives to manage brand portfolios, upload authority verification documents, and publish verified updates.",
            "البوابة الرسمية لمصنعي الأدوية ومملوكي العلامات التجارية لإدارة سجلات المنتجات، تقديم وثائق التوثيق الرسمية، ونشر التحديثات المعتمدة."
          )}
        </p>
      </div>

      <Card className="border-emerald-500/20 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6">
          <CardTitle className="text-xl flex items-center gap-2">
            <Building2 className="h-6 w-6 text-emerald-200" />
            {t("Representative Authorization Application", "طلب توثيق وملاءمة ممثل شركة")}
          </CardTitle>
          <CardDescription className="text-emerald-100 text-xs mt-1">
            {t(
              "Please select your company, upload verification documents, and provide representative contact details.",
              "يرجى تحديد الشركة الدوائية، تحميل وثائق التفويض، وإدخال بيانات التواصل مع الممثل."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleClaimSubmit} className="space-y-6">
            {/* 1. SEARCHABLE COMPANY PICKER WITH ADD NEW OPTION */}
            <div className="space-y-2">
              <Label className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Building2 className="h-4 w-4 text-emerald-600" />
                {t("Pharmaceutical Company", "الشركة الدوائية / المنشأة المصنعة")} *
              </Label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 border rounded-xl bg-card hover:bg-accent/40 text-left transition-colors"
                >
                  <span className="font-semibold text-sm">
                    {claimDraft.companyName
                      ? claimDraft.isCustomCompany
                        ? `✨ Custom: ${claimDraft.companyName}`
                        : claimDraft.companyName
                      : t("-- Select or Search Company --", "-- اختر أو ابحث عن اسم الشركة --")}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {isPickerOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-popover border border-emerald-500/20 rounded-xl shadow-2xl overflow-hidden p-2 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={companySearchQuery}
                        onChange={(e) => setCompanySearchQuery(e.target.value)}
                        placeholder={t("Type company name to filter…", "اكتب اسم الشركة للتصفية…")}
                        className="pl-9 pr-4 py-2 rounded-lg text-xs"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                      {/* ADD NEW COMPANY BUTTON */}
                      <button
                        type="button"
                        onClick={handleSelectCustomNewCompany}
                        className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 text-xs font-bold text-left transition-colors border border-emerald-200 dark:border-emerald-800"
                      >
                        <Plus className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{t("+ Add New Company (Not in directory)", "+ إضافة شركة جديدة (غير مدرجة بالدليل)")}</span>
                      </button>

                      {filteredCompanies.map((comp) => (
                        <button
                          key={comp.company_slug}
                          type="button"
                          onClick={() => handleSelectCompany(comp)}
                          className="w-full text-left p-2 rounded-lg hover:bg-accent text-xs font-medium transition-colors flex items-center justify-between"
                        >
                          <span>{comp.company_name}</span>
                          {claimDraft.companyName === comp.company_name && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      ))}

                      {filteredCompanies.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          {t("No matching company found in catalog.", "لم يتم العثور على شركة مطابقة.")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* INPUT FIELD WHEN "ADD NEW COMPANY" IS SELECTED */}
              {claimDraft.isCustomCompany && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {t("Enter New Company Name", "اسم الشركة الجديدة")} *
                  </Label>
                  <Input
                    value={claimDraft.companyName}
                    onChange={(e) => setClaimDraft({ ...claimDraft, companyName: e.target.value })}
                    placeholder="e.g. Soul Pharma Advanced Biotech"
                    className="rounded-xl border-emerald-500/40 mt-1"
                    required
                  />
                </div>
              )}
            </div>

            {/* 2. REPRESENTATIVE IDENTITY & PHONE NUMBER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{t("Representative Full Name", "اسم الممثل بالكامل")} *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={claimDraft.contactName}
                    onChange={(e) => setClaimDraft({ ...claimDraft, contactName: e.target.value })}
                    placeholder="e.g. Dr. Mina Sami"
                    className="pl-9 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{t("Title / Job Role", "المسمى الوظيفي / الصفة")} *</Label>
                <Input
                  value={claimDraft.titleRole}
                  onChange={(e) => setClaimDraft({ ...claimDraft, titleRole: e.target.value })}
                  placeholder="e.g. Chief Executive Officer / Regulatory Affairs Manager"
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{t("Official Work Email", "البريد الإلكتروني المهني")} *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={claimDraft.workEmail}
                    onChange={(e) => setClaimDraft({ ...claimDraft, workEmail: e.target.value })}
                    placeholder="rep@company.com"
                    className="pl-9 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {t("Contact Mobile / Phone Number", "رقم الهاتف المحمول للتواصل المباشر")} *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                  <Input
                    type="tel"
                    value={claimDraft.mobilePhone}
                    onChange={(e) => setClaimDraft({ ...claimDraft, mobilePhone: e.target.value })}
                    placeholder="+20 100 000 0000"
                    className="pl-9 rounded-xl border-emerald-500/30"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 3. DOCUMENT UPLOAD (PROOF OF RELATION TO COMPANY) */}
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-bold flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-emerald-600" />
                {t("Upload Proof of Authorization Document", "تحميل وثيقة إثبات التفويض أو الصفة بالشركة")} *
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "Upload Commercial Register, EDA Authorization Letter, Company ID badge, or Official Power of Attorney (PDF, PNG, JPG, DOCX).",
                  "أرفق صورة السجل التجاري، ترخيص السجل، بطاقة الشركة، أو خطاب تفويض رسمي من الشركة (PDF, PNG, JPG)."
                )}
              </p>

              <div className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-50/50 dark:bg-slate-900/40 transition-colors">
                {claimDraft.proofDocumentName ? (
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-5 w-5 text-emerald-600" />
                      <div className="text-left">
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-100">{claimDraft.proofDocumentName}</p>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300">{claimDraft.proofDocumentSize}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setClaimDraft({ ...claimDraft, proofDocumentName: "", proofDocumentSize: "" })}
                      className="text-destructive h-7 w-7 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    <UploadCloud className="h-8 w-8 text-emerald-600 animate-bounce" />
                    <span className="text-xs font-bold text-foreground">
                      {t("Click to choose document file or drag & drop here", "اضغط لاختيار ملف الوثيقة أو اسحبه هنا")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">PDF, PNG, JPG or DOCX (Max 10 MB)</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 4. OPTIONAL LICENSES & NOTES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("Commercial Reg / EDA License No.", "رقم السجل التجاري / الترخيص (اختياري)")}</Label>
                <Input
                  value={claimDraft.officialRegNo}
                  onChange={(e) => setClaimDraft({ ...claimDraft, officialRegNo: e.target.value })}
                  placeholder="e.g. CR-884920"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("Official Website URL", "الموقع الإلكتروني للشركة (اختياري)")}</Label>
                <Input
                  type="url"
                  value={claimDraft.websiteUrl}
                  onChange={(e) => setClaimDraft({ ...claimDraft, websiteUrl: e.target.value })}
                  placeholder="https://company.com"
                  className="rounded-xl"
                />
              </div>
            </div>

            {!isAuthenticated && (
              <div className="space-y-1.5 border-t pt-4">
                <Label className="text-xs font-bold">{t("Account Password (8+ characters)", "كلمة المرور لتأمين حسابك")}</Label>
                <Input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl"
                  minLength={8}
                  required
                />
              </div>
            )}

            {/* AUTHORITY DECLARATION */}
            <div className="flex items-start gap-3 border-t pt-4">
              <input
                type="checkbox"
                id="authority_declaration"
                checked={claimDraft.declaredAuthority}
                onChange={(e) => setClaimDraft({ ...claimDraft, declaredAuthority: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500"
                required
              />
              <label htmlFor="authority_declaration" className="text-xs leading-relaxed text-muted-foreground">
                {t(
                  "I hereby declare that I am an official authorized representative/CEO of this pharmaceutical entity, and the provided documents and contact information are authentic.",
                  "أقر بموجبه بأنني ممثل معتمد/رئيس تنفيذي رسمي لهذه المنشأة الدوائية، وأن الوثائق وبيانات التواصل المقدمة صحيحة وموثوقة."
                )}
              </label>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all duration-200"
            >
              {saving ? t("Submitting Application…", "جاري إرسال الطلب…") : t("Submit Representative Application →", "إرسال طلب توثيق ممثل الشركة ←")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
