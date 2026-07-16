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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle>Platform Sign In</CardTitle>
          <CardDescription>
            Use your Supabase account. Your workspace is selected from your
            profile role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && role && (
            <Alert>
              <AlertDescription>
                Signed in as {user.displayName}. Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => loginWithGoogle(nextPath ?? undefined)}
            disabled={loading || busy}
          >
            Continue with Google
          </Button>

          <div className="relative text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-background px-2">
              or use email
            </span>
            <div className="absolute left-0 right-0 top-1/2 border-t" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button className="w-full" disabled={loading || busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            {nextPath
              ? "After sign-in, you will return to the exact page where you left off."
              : "Platform access is controlled by the role in your Supabase profile. Admin accounts go to the Admin Dashboard automatically."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
