import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Lock, Mail, Phone, User, ShieldCheck, ArrowRight } from "lucide-react";

export default function PatientAuthPage() {
  const { t } = useLanguage();
  const { signIn, signUp, isAuthenticated } = usePatientAuth();
  const [, setLocation] = useLocation();

  const queryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const nextPath = queryParams.get("next") || "/account";
  const initialTab = queryParams.get("mode") === "signup" ? "signup" : "signin";

  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Sign In state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Sign Up state
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);

  if (isAuthenticated) {
    setLocation(nextPath);
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSignInLoading(true);
    setSignInError(null);
    try {
      await signIn(signInEmail.trim(), signInPassword);
      setLocation(nextPath);
    } catch (err: any) {
      setSignInError(err?.message || t("Sign in failed. Please check your credentials.", "فشل تسجيل الدخول. يرجى التأكد من البيانات."));
    } finally {
      setSignInLoading(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setSignUpLoading(true);
    setSignUpError(null);
    setSignUpSuccess(null);
    try {
      const res = await signUp(signUpEmail.trim(), signUpPassword, signUpFullName.trim(), signUpPhone.trim());
      if (res.requiresEmailConfirmation) {
        setSignUpSuccess(t("Account registered! Please check your email to confirm your account.", "تم إنشاء الحساب! يرجى مراجعة بريدك الإلكتروني للتأكيد."));
      } else {
        setSignUpSuccess(t("Account registered successfully! Redirecting…", "تم إنشاء الحساب بنجاح! جاري التوجيه…"));
        setTimeout(() => setLocation(nextPath), 1200);
      }
    } catch (err: any) {
      setSignUpError(err?.message || t("Failed to register account.", "فشل إنشاء الحساب."));
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-lg px-4 py-16">
      <Card className="border-emerald-500/20 shadow-2xl overflow-hidden bg-card">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t("Medicine Support Hub Portal", "بوابة الدعم الدوائي")}
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            {t(
              "Sign in to manage profile settings, track support, or access company representative features.",
              "سجل الدخول لإدارة إعدادات حسابك، تتبع المساعدات، أو الوصول لبوابة ممثلي الشركات."
            )}
          </p>
        </div>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <TabsTrigger value="signin" className="font-bold text-xs rounded-lg">
                {t("Sign In", "تسجيل الدخول")}
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-bold text-xs rounded-lg">
                {t("Register Account", "إنشاء حساب جديد")}
              </TabsTrigger>
            </TabsList>

            {/* SIGN IN TAB */}
            <TabsContent value="signin" className="space-y-4">
              {signInError && (
                <Alert variant="destructive">
                  <AlertDescription>{signInError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Email Address", "البريد الإلكتروني")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Password", "كلمة المرور")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow transition-all duration-200"
                >
                  {signInLoading ? t("Signing in…", "جاري تسجيل الدخول…") : t("Sign In to Account →", "تسجيل الدخول إلى الحساب ←")}
                </Button>
              </form>

              <div className="border-t pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/industry")}
                  className="text-xs text-emerald-700 hover:underline font-semibold"
                >
                  {t("Are you a Company Representative or CEO? Register here →", "هل أنت ممثل شركة أو رئيس تنفيذي؟ سجل هنا ←")}
                </button>
              </div>
            </TabsContent>

            {/* SIGN UP TAB */}
            <TabsContent value="signup" className="space-y-4">
              {signUpError && (
                <Alert variant="destructive">
                  <AlertDescription>{signUpError}</AlertDescription>
                </Alert>
              )}
              {signUpSuccess && (
                <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <AlertDescription>{signUpSuccess}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Full Name", "الاسم الكامل")}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      placeholder="e.g. Dr. Ahmed Hassan"
                      className="pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Email Address", "البريد الإلكتروني")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Mobile Phone Number", "رقم الهاتف المحمول")}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      placeholder="+20 100 000 0000"
                      className="pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t("Password (8+ characters)", "كلمة المرور (٨ أحرف على الأقل)")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 rounded-xl"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={signUpLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow transition-all duration-200"
                >
                  {signUpLoading ? t("Registering account…", "جاري إنشـاء الحساب…") : t("Create Account →", "إنشـاء حساب جديد ←")}
                </Button>
              </form>

              <div className="border-t pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/industry")}
                  className="text-xs text-emerald-700 hover:underline font-semibold"
                >
                  {t("Register as Authorized Company Representative →", "التسجيل كممثل معتمد لشركة دوائية ←")}
                </button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
