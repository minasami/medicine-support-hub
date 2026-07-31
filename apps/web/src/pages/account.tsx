import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  FileSpreadsheet,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  Package,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Upload,
  User,
  UserCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyStockCsvImport } from "@/components/company-stock-csv-import";
import { CompanyMedicineAdditionForm } from "@/components/company-medicine-addition-form";

type CompanyRepMembership = {
  isRep: boolean;
  isApproved: boolean;
  companyName: string;
  companySlug: string;
  roleLabel: string;
};

export default function AccountPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { session, profile, isAuthenticated, signOut, updatePassword, supabaseFetch } = usePatientAuth();

  const [repMembership, setRepMembership] = useState<CompanyRepMembership | null>(null);
  const [checkingRepStatus, setCheckingRepStatus] = useState(true);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Check if current user is an authorized/registered Company Representative or CEO
  useEffect(() => {
    async function checkCompanyRepStatus() {
      setCheckingRepStatus(true);
      const userId = session?.user?.id;
      const userEmail = (session?.user?.email || "").toLowerCase().trim();
      if (!userId && !userEmail) {
        setRepMembership(null);
        setCheckingRepStatus(false);
        return;
      }

      try {
        // Clean up legacy mock "Med Care" or "MedCare" entries from localStorage for non-Soul-Pharma emails
        if (typeof window !== "undefined" && userEmail && !userEmail.includes("soulpharma") && userEmail !== "soulpharmasite@gmail.com") {
          try {
            const keysToPurge = ["msh_organization_memberships_v1", "msh_company_claims_v1", "msh_user_roles_v1"];
            for (const k of keysToPurge) {
              const cachedRaw = localStorage.getItem(k);
              if (cachedRaw && /med\s*care|medcare/i.test(cachedRaw)) {
                const parsed = JSON.parse(cachedRaw);
                if (Array.isArray(parsed)) {
                  const cleaned = parsed.filter(
                    (item: any) =>
                      !/med\s*care|medcare/i.test(item.company_name || item.proposed_company_name || "") ||
                      (item.user_email && item.user_email.toLowerCase().includes("soulpharma"))
                  );
                  localStorage.setItem(k, JSON.stringify(cleaned));
                }
              }
            }
          } catch {}
        }

        const normalizeCompany = (rawName: string | undefined, rawSlug: string | undefined) => {
          let name = String(rawName || "").trim();
          // Handle "MEDCARE > SOUL PHARMA" or "MEDCARE / SOUL PHARMA" toll hierarchy
          if (name.includes(">") || name.includes("/")) {
            const parts = name.split(/\s*(?:>|\/)\s*/).map(p => p.trim()).filter(Boolean);
            if (parts.length > 1) name = parts[parts.length - 1];
          }

          // Strip placeholder/toll names ("Med Care", "MedCare", "Assigned Company")
          if (/^(med\s*care|medcare|assigned\s*company|official\s*company)$/i.test(name)) {
            if (userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma")) {
              name = "SOUL PHARMA";
            } else {
              name = "";
            }
          }

          // Infer Eva Pharma for armanious foundation or eva pharma emails
          if (!name && (userEmail.includes("armanious") || userEmail.includes("evapharma") || userEmail.includes("eva-pharma"))) {
            name = "Eva Pharma";
          }

          if (!name) name = "Eva Pharma";

          const slug = (rawSlug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "eva-pharma";
          return { companyName: name, companySlug: slug };
        };

        // Priority 0: Known Soul Pharma CEO credentials ONLY
        if (userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma")) {
          setRepMembership({
            isRep: true,
            isApproved: true,
            companyName: "SOUL PHARMA",
            companySlug: "soulpharma",
            roleLabel: "Company CEO",
          });
          setCheckingRepStatus(false);
          return;
        }

        const matchesUser = (item: any) => {
          if (!item) return false;
          return (
            (userId && item.user_id === userId) ||
            (userEmail && item.user_email && item.user_email.toLowerCase() === userEmail) ||
            (userEmail && item.work_email && item.work_email.toLowerCase() === userEmail) ||
            (userEmail && item.email && item.email.toLowerCase() === userEmail) ||
            (userEmail && item.requested_by && String(item.requested_by).toLowerCase() === userEmail)
          );
        };

        // 1. Check local storage cache of memberships and claims
        if (typeof window !== "undefined") {
          try {
            const keys = ["msh_company_claims_v1", "msh_representative_claims_v1", "msh_industry_claims_v1", "msh_organization_memberships_v1"];
            for (const k of keys) {
              const cachedRaw = localStorage.getItem(k);
              if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const found = list.find(matchesUser);

                if (found) {
                  const { companyName, companySlug } = normalizeCompany(
                    found.company_name || found.proposed_company_name || found.organizations?.name,
                    found.company_slug
                  );

                  // Explicit approval check: requires status === 'approved' or is_approved === true
                  const isApproved = found.status === "approved" || found.is_approved === true;
                  const roleLabel = found.role === "company_ceo" || found.role_title?.toLowerCase().includes("ceo") 
                    ? (isApproved ? "Company CEO" : "Company Representative")
                    : found.role_title || "Company Representative";

                  setRepMembership({
                    isRep: true,
                    isApproved,
                    companyName,
                    companySlug,
                    roleLabel,
                  });
                  setCheckingRepStatus(false);
                  return;
                }
              }
            }
          } catch {}
        }

        // 2. Query Database organization_memberships, company_area_representatives & company_profile_claims
        const [membershipsById, membershipsByEmail, repClaims, profileClaims] = await Promise.all([
          supabaseFetch<any[]>(`/rest/v1/organization_memberships?user_id=eq.${userId}&is_active=eq.true`).catch(() => []),
          userEmail ? supabaseFetch<any[]>(`/rest/v1/organization_memberships?user_id=eq.${userEmail}&is_active=eq.true`).catch(() => []) : Promise.resolve([]),
          supabaseFetch<any[]>(`/rest/v1/company_area_representatives?user_id=eq.${userId}&is_active=eq.true`).catch(() => []),
          userEmail ? supabaseFetch<any[]>(`/rest/v1/company_profile_claims?work_email=eq.${userEmail}&order=created_at.desc`).catch(() => []) : Promise.resolve([]),
        ]);

        const memberships = [...(Array.isArray(membershipsById) ? membershipsById : []), ...(Array.isArray(membershipsByEmail) ? membershipsByEmail : [])];

        if (memberships.length > 0) {
          const activeMem = memberships[0];
          const { companyName, companySlug } = normalizeCompany(
            activeMem.company_name || activeMem.organizations?.name,
            activeMem.company_slug
          );
          const isApproved = activeMem.status === "approved" || activeMem.is_approved === true;
          setRepMembership({
            isRep: true,
            isApproved,
            companyName,
            companySlug,
            roleLabel: activeMem.role === "company_ceo" && isApproved ? "Company CEO" : "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(profileClaims) && profileClaims.length > 0) {
          const claim = profileClaims[0];
          const { companyName, companySlug } = normalizeCompany(
            claim.proposed_company_name || claim.company_name,
            claim.company_slug
          );
          const isApproved = claim.status === "approved" || claim.is_approved === true;
          setRepMembership({
            isRep: true,
            isApproved,
            companyName,
            companySlug,
            roleLabel: claim.role_title || "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(repClaims) && repClaims.length > 0) {
          const activeClaim = repClaims[0];
          const { companyName, companySlug } = normalizeCompany(
            activeClaim.company_name,
            activeClaim.company_slug
          );
          const isApproved = activeClaim.status === "approved" || activeClaim.is_approved === true;
          setRepMembership({
            isRep: true,
            isApproved,
            companyName,
            companySlug,
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        // 3. Eva Pharma domain heuristic fallback
        if (userEmail.includes("armanious") || userEmail.includes("evapharma") || userEmail.includes("eva-pharma")) {
          setRepMembership({
            isRep: true,
            isApproved: false,
            companyName: "Eva Pharma",
            companySlug: "eva-pharma",
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        // 4. Role fallback
        if (profile?.role && ["company_ceo", "pharma_rep", "company_admin", "pharma_company"].includes(profile.role)) {
          const defaultCompany = (userEmail.includes("soulpharma")) ? "SOUL PHARMA" : "Eva Pharma";
          const defaultSlug = defaultCompany === "SOUL PHARMA" ? "soulpharma" : "eva-pharma";
          const isApproved = userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma");
          setRepMembership({
            isRep: true,
            isApproved,
            companyName: defaultCompany,
            companySlug: defaultSlug,
            roleLabel: profile.role === "company_ceo" && isApproved ? "Company CEO" : "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        setRepMembership(null);
      } catch (err) {
        console.warn("Company rep check error:", err);
        setRepMembership(null);
      } finally {
        setCheckingRepStatus(false);
      }
    }

    void checkCompanyRepStatus();
  }, [session?.user?.id, session?.user?.email, profile?.role, supabaseFetch]);

  // Handle query parameter redirect if present (e.g. ?next=/account)
  const queryParams = new URLSearchParams(window.location.search);
  const nextPath = queryParams.get("next");

  if (nextPath) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Card className="border-emerald-500/30 text-center">
          <CardHeader>
            <CardTitle>{t("Redirecting...", "جاري التحويل...")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={() => setLocation(nextPath)}
            >
              {t("Continue to Page", "متابعة إلى الصفحة")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="border-emerald-500/20 shadow-xl text-center">
          <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
            <CardTitle className="text-xl flex items-center justify-center gap-2">
              <User className="h-6 w-6" />
              {t("Account Portal Sign In Required", "تسجيل الدخول مطلوب للوصول للحساب")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                "Please sign in with your email to view account details, manage company portfolios, or upload inventory.",
                "يرجى تسجيل الدخول بالبريد الإلكتروني للوصول إلى تفاصيل الحساب وإدارة مخزون ومحفظة المنتجات."
              )}
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow"
              onClick={() => setLocation("/patient-auth?next=/account")}
            >
              {t("Sign In / Create Account", "تسجيل الدخول / إنشاء حساب")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordErr(null);

    if (newPassword.length < 8) {
      setPasswordErr(t("Password must be at least 8 characters long.", "كلمة المرور يجب أن تكون ٨ أحرف على الأقل."));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErr(t("Passwords do not match.", "كلمتا المرور غير متطابقتين."));
      return;
    }

    setUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      setPasswordMsg(t("Your account password has been updated successfully.", "تم تحديث كلمة المرور بنجاح."));
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordErr(err?.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const userEmailDisplay = session?.user?.email || "user@medicinesupport.app";
  const userNameDisplay = profile?.full_name || userEmailDisplay.split("@")[0];

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 space-y-8">
      {/* Account Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">{userNameDisplay}</h1>
            {repMembership?.isRep && (
              <Badge className="bg-emerald-600 text-white font-bold gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {repMembership.roleLabel}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail className="h-4 w-4 text-emerald-600 shrink-0" />
            {userEmailDisplay}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void signOut()}
          className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl gap-2 font-semibold self-start md:self-auto"
        >
          <LogOut className="h-4 w-4" />
          {t("Sign Out", "تسجيل الخروج")}
        </Button>
      </div>

      {/* Verified Company Representative Portal Banner & Managed Actions */}
      {checkingRepStatus ? (
        <Card className="border-emerald-500/20 p-6 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-xs text-muted-foreground mt-2">{t("Checking company representative verification status…", "جاري التحقق من حالة توثيق ممثل الشركة…")}</p>
        </Card>
      ) : repMembership?.isRep ? (
        <section className="space-y-6">
          <Card className="border-emerald-500/30 shadow-lg bg-gradient-to-r from-emerald-950/20 via-teal-950/10 to-transparent">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Badge className="bg-emerald-900/60 text-emerald-100 border border-white/20">
                    {t("Official Corporate Portal", "البوابة الرسمية للمصنعين")}
                  </Badge>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-emerald-200" />
                    {t(
                      `Verified Company Representative Portal (${repMembership.roleLabel})`,
                      `بوابة ممثل الشركة المعتمد (${repMembership.roleLabel})`
                    )}
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs"
                  onClick={() => setLocation(`/companies/${repMembership.companySlug}`)}
                >
                  <Globe className="h-3.5 w-3.5 mr-1" />
                  {t("View Public Page", "عرض الصفحة العامة")}
                </Button>
              </div>
              <CardDescription className="text-emerald-100 text-xs mt-2">
                {t(
                  `Signed in as official representative for ${repMembership.companyName} (${userEmailDisplay}). Manage public details, submit brand product portfolios, and publish verified updates.`,
                  `تم تسجيل الدخول كممثل رسمي لشركة ${repMembership.companyName} (${userEmailDisplay}). إدارة البيانات العامة، تقديم محفظة المنتجات، ونشر التحديثات المعتمدة.`
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {repMembership.isApproved ? (
            <div className="space-y-6">
              <CompanyStockCsvImport
                companySlug={repMembership.companySlug}
                companyName={repMembership.companyName}
                defaultOrgCode={repMembership.companyName?.toUpperCase().includes("SOUL") ? "SOUL" : repMembership.companyName?.toUpperCase().includes("EVA") ? "EVA" : undefined}
              />

              <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 text-white shadow-xl space-y-3">
                <div className="flex items-center gap-2.5 font-bold text-xl">
                  <AlertCircle className="h-6 w-6 text-amber-200" />
                  {t("Pending Representative Verification", "في انتظار توثيق ممثل الشركة")}
                </div>
                <p className="text-sm text-amber-50 leading-relaxed">
                  {t(
                    `Your account isn't approved yet, you can submit new products one by one or bulk, but you can't edit the ${repMembership.companyName} already available products at the medicines encyclopedia until the admin approves that you are verified company representative of the company.`,
                    `حسابك لم يتم اعتماده بعد، يمكنك تقديم منتجات جديدة واحدة تلو الأخرى أو بالجملة، ولكن لا يمكنك تعديل أدوية ${repMembership.companyName} المتاحة حاليًا في موسوعة الأدوية حتى يوافق المسؤول على أنك ممثل معتمد للشركة.`
                  )}
                </p>
              </div>

              <CompanyStockCsvImport
                companySlug={repMembership.companySlug}
                companyName={repMembership.companyName}
                defaultOrgCode={repMembership.companyName?.toUpperCase().includes("SOUL") ? "SOUL" : repMembership.companyName?.toUpperCase().includes("EVA") ? "EVA" : undefined}
              />

              <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />
            </div>
          )}
        </section>
      ) : (
        <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100 flex items-center gap-2 justify-center md:justify-start">
                <Building2 className="h-5 w-5 text-emerald-600" />
                {t("Are you a Pharmaceutical Manufacturer or Brand Owner?", "هل أنت ممثل لشركة أدوية أو مالك علامة تجارية؟")}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                {t(
                  "Claim and verify your company profile to access bulk batch stock uploading, product portfolio management, and direct regulatory updates.",
                  "وثق حساب منشأتك الدوائية للحصول على صلاحيات التحديث المباشر للمنتجات، رفوعات مخزون التشغيلات، وإدارة العلامة التجارية."
                )}
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shrink-0"
              onClick={() => setLocation("/industry")}
            >
              {t("Register as Company Rep →", "تسجيل كممثل شركة ←")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security & Password Management Section */}
      <Card className="border-emerald-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            {t("Account Security & Password", "أمان الحساب وكلمة المرور")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("Update your password to keep your portal access secure.", "تحديث كلمة المرور لتأمين الوصول للبوابة.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordMsg && (
            <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>{passwordMsg}</AlertDescription>
            </Alert>
          )}

          {passwordErr && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{passwordErr}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("New Password", "كلمة المرور الجديدة")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl"
                minLength={8}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("Confirm New Password", "تأكيد كلمة المرور الجديدة")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl"
                minLength={8}
                required
              />
            </div>

            <div className="md:col-span-2 pt-2">
              <Button
                type="submit"
                disabled={updatingPassword}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 py-2"
              >
                {updatingPassword ? t("Updating Password…", "جاري التحديث…") : t("Update Password", "تحديث كلمة المرور")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
