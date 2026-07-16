import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME, useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
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
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>
              {providerMode
                ? mode === "signin"
                  ? "Provider Sign In"
                  : "Create Provider Account"
                : mode === "signin"
                  ? "Patient Sign In"
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
                className="w-full"
                onClick={continueWithGoogle}
              >
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
              <Button disabled={busy}>
                {busy ? "Saving..." : "Save profile"}
              </Button>
              <Button asChild type="button" variant="secondary">
                <Link href="/request">Request medicines</Link>
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/track">Track my requests</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email address</CardTitle>
            <CardDescription>
              Changing your sign-in email requires verification before it
              becomes active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-email">Sign-in and work email</Label>
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  required
                />
              </div>
              <Button
                disabled={
                  busy ||
                  !newEmail.trim() ||
                  newEmail.trim().toLowerCase() ===
                    session?.user?.email?.toLowerCase()
                }
              >
                Send email-change verification
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password and security</CardTitle>
            <CardDescription>
              Use a unique password with at least 8 characters. Google-only
              accounts can continue using Google sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
              <Button
                disabled={busy || !currentPassword || newPassword.length < 8}
              >
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-primary/20">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Company representative workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage verified company profiles, services, capabilities,
              products, and applications.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/industry">Open company workspace</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
