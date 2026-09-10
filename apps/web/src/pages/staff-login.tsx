import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useRole, ROLE_HOME } from "@/lib/role";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertCircle } from "lucide-react";

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M6.6 14.3l-.5.4-2.7 2.1C5.1 19.5 8.3 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z" />
      <path fill="#4A90E2" d="M3.4 7.2C2.7 8.6 2.3 10.2 2.3 12s.4 3.4 1.1 4.8l3.2-2.5c-.2-.6-.3-1.2-.3-2.3s.1-1.7.3-2.3L3.4 7.2z" />
      <path fill="#FBBC05" d="M12 4.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 1.7 14.7.7 12 .7 8.3.7 5.1 2.7 3.4 5.9l3.2 2.5C7 6.7 9.3 4.8 12 4.8z" />
    </svg>
  );
}

import {
  clearAuthDestination,
  requestedAuthDestination,
} from "@/lib/auth-return";

export default function StaffLogin() {
  const { t } = useLanguage();
  const { login, loginWithGoogle, loading } = useAuth();
  const { role, user } = useRole();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nextPath] = useState<string | null>(() =>
    requestedAuthDestination("staff"),
  );

  useEffect(() => {
    if (!role) return;
    const destination =
      nextPath && !["/portal", "/login"].includes(nextPath)
        ? nextPath
        : ROLE_HOME[role];
    clearAuthDestination("staff");
    navigate(destination);
  }, [role, nextPath, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await login(email, password);
    setBusy(false);
    if (!result.ok) {
      const errText = String(result.error || "");
      if (
        errText.includes("Unexpected token") ||
        errText.includes("upstream connect")
      ) {
        return;
      }
      setError(result.error ?? t("Login failed", "فشل تسجيل الدخول"));
      return;
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1F33] relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(14,165,233,.15), transparent 45%), radial-gradient(circle at 85% 25%, rgba(16,185,129,.12), transparent 45%)",
        }}
      />

      <Card className="w-full max-w-md border-white/10 bg-slate-900/70 backdrop-blur-2xl shadow-2xl text-slate-100 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            {t("Platform Sign In", "تسجيل دخول المنصة")}
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm mt-1.5">
            {t(
              "Sign in to open your staff workspace. Your role is applied from your account profile.",
              "سجّل الدخول لفتح مساحة عمل الفريق. يُطبَّق دورك من ملف الحساب.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {user && role && (
            <Alert className="bg-emerald-950/50 border-emerald-500/30 text-emerald-300">
              <AlertDescription>
                {t("Signed in as", "تم تسجيل الدخول باسم")} {user.displayName}.{" "}
                {t("Redirecting...", "جاري التوجيه...")}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert
              variant="destructive"
              className="bg-rose-950/50 border-rose-500/30 text-rose-300"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2 border-slate-600/80 bg-white text-slate-900 hover:bg-slate-100 font-semibold shadow-sm transition-all duration-200"
            onClick={() => loginWithGoogle(nextPath ?? undefined)}
            disabled={loading || busy}
            aria-label={t("Continue with Google", "المتابعة عبر Google")}
          >
            <GoogleGlyph className="h-5 w-5" />
            {t("Continue with Google", "المتابعة عبر Google")}
          </Button>

          <div className="relative text-center text-xs text-slate-500">
            <span className="relative z-10 bg-slate-900 px-3">
              {t("or use email", "أو استخدم البريد")}
            </span>
            <div className="absolute left-0 right-0 top-1/2 border-t border-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                {t("Email", "البريد الإلكتروني")}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="name@example.com"
                className="h-11 bg-slate-950/40 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                {t("Password", "كلمة المرور")}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11 bg-slate-950/40 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-200"
              />
            </div>
            <Button
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all duration-200 shadow-md shadow-emerald-500/20"
              disabled={loading || busy}
            >
              {busy
                ? t("Signing in...", "جاري تسجيل الدخول...")
                : t("Sign in", "تسجيل الدخول")}
            </Button>
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            {nextPath
              ? t(
                  "After sign-in, you will return to the exact page where you left off.",
                  "بعد تسجيل الدخول ستعود إلى الصفحة التي غادرتها.",
                )
              : t(
                  "Access follows the role on your account profile. Admins open the Admin Dashboard automatically.",
                  "يُحدد الوصول حسب الدور في ملف حسابك. حسابات الإدارة تُفتح على لوحة الإدارة تلقائيًا.",
                )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
