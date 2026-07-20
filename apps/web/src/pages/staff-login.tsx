import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useRole, ROLE_HOME } from "@/lib/role";
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
import {
  clearAuthDestination,
  requestedAuthDestination,
} from "@/lib/auth-return";

export default function StaffLogin() {
  const { login, loginWithGoogle, loading } = useAuth();
  const { role, user } = useRole();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("jesussavedmina@gmail.com");
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
      setError(result.error ?? "Login failed");
      return;
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1F33] relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Dynamic background decoration */}
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, rgba(14,165,233,.15), transparent 45%), radial-gradient(circle at 85% 25%, rgba(16,185,129,.12), transparent 45%)" }} />
      
      <Card className="w-full max-w-md border-white/10 bg-slate-900/70 backdrop-blur-2xl shadow-2xl text-slate-100 relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Platform Sign In</CardTitle>
          <CardDescription className="text-slate-400 text-sm mt-1.5">
            Use your Supabase account. Your workspace is selected from your
            profile role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {user && role && (
            <Alert className="bg-emerald-950/50 border-emerald-500/30 text-emerald-300">
              <AlertDescription>
                Signed in as {user.displayName}. Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="bg-rose-950/50 border-rose-500/30 text-rose-300">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800 hover:text-white transition-all duration-200"
            onClick={() => loginWithGoogle(nextPath ?? undefined)}
            disabled={loading || busy}
          >
            Continue with Google
          </Button>

          <div className="relative text-center text-xs text-slate-500">
            <span className="relative z-10 bg-slate-900 px-3">
              or use email
            </span>
            <div className="absolute left-0 right-0 top-1/2 border-t border-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="bg-slate-950/40 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="bg-slate-950/40 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all duration-200"
              />
            </div>
            <Button className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold transition-all duration-200 shadow-md shadow-sky-500/10" disabled={loading || busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            {nextPath
              ? "After sign-in, you will return to the exact page where you left off."
              : "Platform access is controlled by the role in your Supabase profile. Admin accounts go to the Admin Dashboard automatically."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
