import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2 } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME, useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { CompanyMedicineAdditionForm } from "../components/company-medicine-addition-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  clearAuthDestination,
  PATIENT_AUTH_NEXT_KEY,
  requestedAuthDestination,
} from "@/lib/auth-return";

const PROVIDER_WORKSPACE =
  /^\/(clinics\/emr|pharmacies\/pms|labs\/lms|radiology\/rms)(?:[/?#]|$)/;

export default function AccountPage() {
  const {
    session,
    isAuthenticated,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    profile,
    updateProfile,
    updateEmail,
    updatePassword,
    supabaseFetch,
  } = usePatientAuth();
  const { activateSession } = useAuth();
  const { role } = useRole();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [nextPath] = useState<string | null>(() =>
    requestedAuthDestination("patient"),
  );
  const providerMode = Boolean(nextPath && PROVIDER_WORKSPACE.test(nextPath));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (role) navigate(ROLE_HOME[role]);
  }, [navigate, role]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    setBirthdate(profile.birthdate ?? "");
    setCity(profile.city ?? "");
  }, [profile]);

  useEffect(() => {
    setNewEmail(session?.user?.email ?? "");
  }, [session?.user?.email]);

  useEffect(() => {
    if (!isAuthenticated || !nextPath) return;
    let cancelled = false;
    const destination = nextPath;
    async function openRequestedDestination() {
      try {
        if (PROVIDER_WORKSPACE.test(destination))
          await supabaseFetch(
            "/rest/v1/rpc/claim_approved_healthcare_entity_access",
            { method: "POST", body: "{}" },
          );
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Provider access could not be synchronized",
            description:
              error instanceof Error
                ? error.message
                : "Open the workspace and contact support if access is not shown.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          clearAuthDestination("patient");
          navigate(destination);
        }
      }
    }
    void openRequestedDestination();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, nextPath, navigate, supabaseFetch, toast]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const nextSession = await signIn(email, password);
        const account = await activateSession(nextSession);
        if (account.isStaff && account.home) {
          toast({
            title: "Signed in",
            description: "Opening the workspace assigned to your account.",
          });
          navigate(account.home);
          return;
        }
      } else {
        await signUp(email, password, fullName, phone);
      }
      toast({ title: mode === "signin" ? "Signed in" : "Account created" });
    } catch (error) {
      toast({
        title: "Authentication failed",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({
        full_name: fullName,
        phone,
        address,
        birthdate: birthdate || null,
        city,
      });
      toast({
        title: "Profile saved",
        description: "Your request forms will now be pre-filled.",
      });
    } catch (error) {
      toast({
        title: "Could not save profile",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    if (!normalized || normalized === session?.user?.email?.toLowerCase())
      return;
    setBusy(true);
    try {
      await updateEmail(
        normalized,
        `${window.location.origin}/account?email-change=confirmed`,
      );
      toast({
        title: "Confirm your new email",
        description:
          "We sent confirmation instructions. Depending on the security settings, both the current and new addresses may need confirmation.",
      });
    } catch (error) {
      toast({
        title: "Could not change email",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: "Use a stronger password",
        description: "The new password must contain at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Re-enter the same new password in both fields.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated" });
    } catch (error) {
      toast({
        title: "Could not change password",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function continueWithGoogle() {
    if (nextPath) sessionStorage.setItem(PATIENT_AUTH_NEXT_KEY, nextPath);
    signInWithGoogle();
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-xl">
        {/* Top Banner for Company Representatives */}
        <div className="mb-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Building2 className="h-5 w-5" />
              Contribute or Correct Company Data
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Represent a pharmaceutical or healthcare company? Submit, claim, or update your official profile and medicine portfolio.
            </p>
          </div>
          <a
            href="#add-medicine"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow hover:bg-blue-50 transition-all duration-200"
          >
            Contribute or correct data
          </a>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {providerMode
                ? mode === "signin"
                  ? "Provider Sign In"
                  : "Create Provider Account"
                : mode === "signin"
                  ? "Account Sign In"
                  : "Create User Account"}
            </CardTitle>
            <CardDescription>
              {providerMode
                ? "Use the exact email submitted with the approved care-network application. You will continue to the private provider workspace after sign-in."
                : "Use your account to save your profile and track all medicine requests."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 text-foreground font-semibold gap-3 shadow-sm transition-all duration-200"
                onClick={continueWithGoogle}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                Continue with Google
              </Button>
              <div className="relative text-center text-xs text-muted-foreground">
                <span className="bg-background px-2 relative z-10">
                  or use email
                </span>
                <div className="absolute left-0 right-0 top-1/2 border-t" />
              </div>
            </div>
            <form onSubmit={handleAuth} className="space-y-4 mt-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button className="w-full" disabled={busy}>
                {busy
                  ? "Please wait..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? providerMode
                    ? "No account yet? Create one with the approved email"
                    : "New here? Create a user account"
                  : "Already have an account? Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (nextPath) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Returning you to where you left off…
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      {/* Top Banner for Company Representatives */}
      <div className="mb-6 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Building2 className="h-5 w-5" />
            Contribute or Correct Company Data
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">
            Are you a pharmaceutical or healthcare company representative? Submit, claim, or update your official profile and medicine portfolio.
          </p>
        </div>
        <a
          href="#add-medicine"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow hover:bg-blue-50 transition-all duration-200"
        >
          Contribute or correct data
        </a>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Account &amp; profile settings</h1>
          <p className="text-muted-foreground">
            Manage your identity, company-representative contact details, and
            security settings.
          </p>
        </div>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal and contact information</CardTitle>
          <CardDescription>
            These details pre-fill medicine, company, and care-network forms.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Birthdate</Label>
                <Input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, building, floor, apartment"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save personal details"}
              </Button>
              <Link href="/requests">
                <Button variant="outline">View medicine requests</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Email address</CardTitle>
            <CardDescription>
              {session?.user?.email
                ? `Current: ${session.user.email}`
                : "Update your account email address"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div className="space-y-2">
                <Label>New email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Updating..." : "Update email address"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Change your password to keep your account safe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Updating..." : "Change password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      <CompanyMedicineAdditionForm />
</div>
    </div>
  );
}
