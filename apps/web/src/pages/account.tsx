import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import type { CompanyRepMembership } from "@/lib/resolve-company-rep";
import { mapAppwriteUserToAccess, type AppwriteUserAccess } from "@/lib/map-appwrite-user-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyStockCsvImport } from "@/components/company-stock-csv-import";
import { CompanyMedicineAdditionForm } from "@/components/company-medicine-addition-form";
import { CompanyTeamInvite } from "@/components/company-team-invite";

export default function AccountPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { session, profile, isAuthenticated, signOut, updatePassword, supabaseFetch } = usePatientAuth();

  const [repMembership, setRepMembership] = useState<CompanyRepMembership | null>(null);
  const [userAccess, setUserAccess] = useState<AppwriteUserAccess | null>(null);
  const [checkingRepStatus, setCheckingRepStatus] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    async function checkCompanyRepStatus() {
      setCheckingRepStatus(true);
      try {
        const access = await mapAppwriteUserToAccess({
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          profileRole: profile?.role,
          supabaseFetch,
        });
        setUserAccess(access);
        setRepMembership(access.companyRep);
      } catch (err) {
        console.warn("Company rep check error:", err);
        setRepMembership(null);
        setUserAccess(null);
      } finally {
        setCheckingRepStatus(false);
      }
    }

    void checkCompanyRepStatus();
  }, [session?.user?.id, session?.user?.email, profile?.role, supabaseFetch]);

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
                "يرجى تسجيل الدخول بالبريد الإلكتروني للوصول إلى تفاصيل الحساب وإدارة مخزون ومحفظة المنتجات.",
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

    if (!currentPassword) {
      setPasswordErr(t("Please enter your current password.", "يرجى إدخال كلمة المرور الحالية."));
      return;
    }

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
      await updatePassword(currentPassword, newPassword);
      setPasswordMsg(t("Your account password has been updated successfully.", "تم تحديث كلمة المرور بنجاح."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordErr(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const userEmailDisplay = session?.user?.email || "user@medicinesupport.app";
  const userNameDisplay = profile?.full_name || userEmailDisplay.split("@")[0];

  const orgCode = (() => {
    const n = (userAccess?.effectiveCompanyName || repMembership?.companyName || "").toUpperCase();
    if (n.includes("SOUL")) return "SOUL";
    if (n.includes("EVA")) return "EVA";
    if (n.includes("MED") && n.includes("CARE")) return "MEDCARE";
    return undefined;
  })();

  const teamActorRole =
    repMembership?.roleLabel?.toLowerCase().includes("ceo")
      ? ("company_ceo" as const)
      : ("product_manager" as const);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 space-y-8">
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
            {userAccess?.isPlatformAdmin && (
              <Badge className="bg-rose-600 text-white font-bold gap-1">Platform Admin</Badge>
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

      {checkingRepStatus ? (
        <Card className="border-emerald-500/20 p-6 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-xs text-muted-foreground mt-2">
            {t("Checking company representative verification status…", "جاري التحقق من حالة توثيق ممثل الشركة…")}
          </p>
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
                      `بوابة ممثل الشركة المعتمد (${repMembership.roleLabel})`,
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
                  `تم تسجيل الدخول كممثل رسمي لشركة ${repMembership.companyName} (${userEmailDisplay}). إدارة البيانات العامة، تقديم محفظة المنتجات، ونشر التحديثات المعتمدة.`,
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {repMembership.isApproved || userAccess?.canEditCompanyEncyclopedia ? (
            <div className="space-y-6">
              <CompanyStockCsvImport
                companySlug={userAccess?.effectiveCompanySlug || repMembership.companySlug}
                companyName={userAccess?.effectiveCompanyName || repMembership.companyName}
                defaultOrgCode={orgCode}
              />
              <CompanyTeamInvite
                companySlug={userAccess?.effectiveCompanySlug || repMembership.companySlug}
                companyName={userAccess?.effectiveCompanyName || repMembership.companyName}
                actorEmail={userEmailDisplay}
                actorRole={teamActorRole}
                claimApproved={repMembership.isApproved}
              />
              <CompanyMedicineAdditionForm
                companySlug={userAccess?.effectiveCompanySlug || repMembership.companySlug}
                companyName={userAccess?.effectiveCompanyName || repMembership.companyName}
              />
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
                    `Your account isn't approved yet. You may draft new products for ${repMembership.companyName}, but you cannot edit products already in the medicines encyclopedia until an admin verifies you as the official company representative.`,
                    `حسابك لم يُعتمد بعد. يمكنك اقتراح منتجات جديدة لـ ${repMembership.companyName}، لكن لا يمكنك تعديل المنتجات الموجودة في موسوعة الأدوية حتى يوثّق المسؤول أنك الممثل الرسمي للشركة.`,
                  )}
                </p>
              </div>

              {userAccess?.canSubmitCompanyProducts !== false && (
                <>
                  <CompanyStockCsvImport
                    companySlug={userAccess?.effectiveCompanySlug || repMembership.companySlug}
                    companyName={userAccess?.effectiveCompanyName || repMembership.companyName}
                    defaultOrgCode={orgCode}
                  />
                  <CompanyMedicineAdditionForm
                    companySlug={userAccess?.effectiveCompanySlug || repMembership.companySlug}
                    companyName={userAccess?.effectiveCompanyName || repMembership.companyName}
                  />
                </>
              )}
            </div>
          )}
        </section>
      ) : (
        <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="space-y-1">
              <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100 flex items-center gap-2 justify-center md:justify-start">
                <Building2 className="h-5 w-5 text-emerald-600" />
                {t(
                  "Are you a Pharmaceutical Manufacturer or Brand Owner?",
                  "هل أنت ممثل لشركة أدوية أو مالك علامة تجارية؟",
                )}
              </h3>
              <p className="text-xs text-muted-foreground max-w-xl">
                {t(
                  "Claim and verify your company profile to access bulk batch stock uploading, product portfolio management, and direct regulatory updates.",
                  "وثق حساب منشأتك الدوائية للحصول على صلاحيات التحديث المباشر للمنتجات، رفوعات مخزون التشغيلات، وإدارة العلامة التجارية.",
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
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">{t("Current Password", "كلمة المرور الحالية")} *</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl"
                required
              />
            </div>

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
                {updatingPassword
                  ? t("Updating Password…", "جاري التحديث…")
                  : t("Update Password", "تحديث كلمة المرور")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
