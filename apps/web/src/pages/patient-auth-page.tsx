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
import { Lock, Mail, Phone, User } from "lucide-react";

export default function PatientAuthPage() {
  const { t } = useLanguage();
  const { signIn, signUp, signInWithGoogle, isAuthenticated } = usePatientAuth();
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
    <div className="container mx-auto max-w-lg px-4 py-10 sm:py-16">
      <Card className="border-emerald-500/20 shadow-xl overflow-hidden bg-card">
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-700 p-6 sm:p-8 text-white text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
            <img src="/medicine-support-hub-logo.png" alt="" className="h-12 w-12 rounded-2xl object-cover" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {t("Welcome back", "مرحبًا بعودتك")}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-50/95 mt-1.5 leading-relaxed">
            {t(
              "Sign in to save your profile, track support requests, or open company tools.",
              "سجّل الدخول لحفظ ملفك، تتبع طلبات الدعم، أو فتح أدوات الشركة."
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

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 gap-2 rounded-xl border-border bg-background font-semibold shadow-sm"
                onClick={() => signInWithGoogle(nextPath)}
                aria-label={t("Continue with Google", "المتابعة عبر Google")}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
                  <path fill="#34A853" d="M6.6 14.3l-.5.4-2.7 2.1C5.1 19.5 8.3 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z" />
                  <path fill="#4A90E2" d="M3.4 7.2C2.7 8.6 2.3 10.2 2.3 12s.4 3.4 1.1 4.8l3.2-2.5c-.2-.6-.3-1.2-.3-2.3s.1-1.7.3-2.3L3.4 7.2z" />
                  <path fill="#FBBC05" d="M12 4.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 1.7 14.7.7 12 .7 8.3.7 5.1 2.7 3.4 5.9l3.2 2.5C7 6.7 9.3 4.8 12 4.8z" />
                </svg>
                {t("Continue with Google", "المتابعة عبر Google")}
              </Button>

              <div className="relative text-center text-[11px] text-muted-foreground">
                <span className="relative z-10 bg-card px-3">
                  {t("or continue with email", "أو المتابعة بالبريد")}
                </span>
                <div className="absolute inset-x-0 top-1/2 border-t border-border/70" />
              </div>

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
                      className="h-11 pl-9 rounded-xl"
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
                      className="h-11 pl-9 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={signInLoading}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition-all duration-200"
                >
                  {signInLoading ? t("Signing in…", "جاري تسجيل الدخول…") : t("Sign in", "تسجيل الدخول")}
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
                      className="h-11 pl-9 rounded-xl"
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
                      className="h-11 pl-9 rounded-xl"
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
                      className="h-11 pl-9 rounded-xl"
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
                      className="h-11 pl-9 rounded-xl"
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
