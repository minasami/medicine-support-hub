import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2 } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useAuth } from "@/lib/auth";
import { ROLE_HOME, useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { CompanyMedicineAdditionForm } from "../components/company-medicine-addition-form";
import { CompanyProfileUpdateForm } from "@/components/company-profile-update-form";
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
  const [nextPath, setNextPath] = useState<string | null>(() =>
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
          setNextPath(null);
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
        try {
          const account = await activateSession(nextSession);
          if (account.isStaff && account.home) {
            toast({
              title: "Signed in",
              description: "Opening the workspace assigned to your account.",
            });
            navigate(account.home);
            return;
          }
        } catch {
          // Continue gracefully
        }
      } else {
        await signUp(email, password, fullName, phone);
      }
      toast({ title: mode === "signin" ? "Signed in" : "Account created" });
    } catch (error: any) {
      const msg = typeof error === "string" ? error : String(error?.message || JSON.stringify(error || {}));
      if (msg.includes("Invalid email") || msg.includes("already exists") || msg.includes("password")) {
        toast({
          title: "Authentication failed",
          description: msg.includes("already exists") 
            ? "An account with this email address already exists." 
            : "Invalid email or password.",
          variant: "destructive",
        });
      } else {
        toast({
          title: mode === "signin" ? "Sign-in failed" : "Sign-up failed",
          description: msg || "Please verify credentials and try again.",
          variant: "destructive",
        });
      }
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
        birthdate,
        city,
      });
      toast({ title: "Personal profile updated" });
    } catch (error) {
      toast({
        title: "Could not update profile",
        description:
          error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateEmail(newEmail);
      toast({
        title: "Email update requested",
        description: "Check your inbox to confirm your new email address.",
      });
    } catch (error) {
      toast({
        title: "Could not update email",
        description:
          error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please enter matching passwords.",
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
        title: "Could not update password",
        description:
          error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "signin"
                ? providerMode
                  ? "Sign in to open healthcare workspace"
                  : "Sign in to your account"
                : providerMode
                  ? "Create account for healthcare workspace"
                  : "Create a user account"}
            </CardTitle>
            <CardDescription>
              {providerMode
                ? "Access clinical EMR, pharmacy PMS, lab LMS, or radiology RMS workspaces with one login."
                : "Manage saved medicines, track pricing, and access user features."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone number</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+201000000000"
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "Processing..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Button>
              <div className="relative my-2 text-center text-xs text-muted-foreground uppercase">
                <span className="bg-background px-2">or</span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={signInWithGoogle}
              >
                Continue with Google
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

  const [repMembership, setRepMembership] = useState<{
    isRep: boolean;
    companyName: string;
    companySlug: string;
    roleLabel: string;
  } | null>(null);
  const [checkingRepStatus, setCheckingRepStatus] = useState(true);

  useEffect(() => {
    async function checkCompanyRepStatus() {
      if (!session?.user?.id && !session?.user?.email) {
        setRepMembership(null);
        setCheckingRepStatus(false);
        return;
      }

      setCheckingRepStatus(true);
      const userEmail = (session.user.email || "").toLowerCase();
      const userId = session.user.id;

      try {
        // 1. Check local storage cache of memberships assigned by Admin
        if (typeof window !== "undefined") {
          try {
            const cachedRaw = localStorage.getItem("msh_organization_memberships_v1");
            if (cachedRaw) {
              const list = JSON.parse(cachedRaw);
              if (Array.isArray(list)) {
                const found = list.find(
                  (m: any) =>
                    m.is_active !== false &&
                    (m.user_id === userId || (m.user_email && m.user_email.toLowerCase() === userEmail) || (m.profiles?.email && m.profiles.email.toLowerCase() === userEmail)) &&
                    ["company_ceo", "pharma_rep", "company_admin", "pharma_company", "line_manager", "editor", "employee", "admin", "platform_admin"].includes(m.role)
                );

                if (found) {
                  const companyName = found.company_name || found.organizations?.name || "Assigned Company";
                  const companySlug = found.company_slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  setRepMembership({
                    isRep: true,
                    companyName,
                    companySlug: companySlug || "company",
                    roleLabel: found.role === "company_ceo" ? "Company CEO" : "Company Representative",
                  });
                  setCheckingRepStatus(false);
                  return;
                }
              }
            }
          } catch {}
        }

        // 2. Query Database organization_memberships & company_area_representatives
        const [memberships, repClaims] = await Promise.all([
          supabaseFetch<any[]>(`/rest/v1/organization_memberships?user_id=eq.${userId}&is_active=eq.true`),
          supabaseFetch<any[]>(`/rest/v1/company_area_representatives?user_id=eq.${userId}&is_active=eq.true`),
        ]).catch(() => [[], []]);

        if (Array.isArray(memberships) && memberships.length > 0) {
          const m = memberships[0];
          const companyName = m.company_name || m.organizations?.name || "Assigned Company";
          const companySlug = m.company_slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRepMembership({
            isRep: true,
            companyName,
            companySlug: companySlug || "company",
            roleLabel: m.role === "company_ceo" ? "Company CEO" : "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(repClaims) && repClaims.length > 0) {
          const r = repClaims[0];
          const companyName = r.company_name || "Assigned Company";
          const companySlug = r.company_slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRepMembership({
            isRep: true,
            companyName,
            companySlug: companySlug || "company",
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        // 3. Check profile role
        if (profile?.role && ["company_ceo", "pharma_rep", "company_admin", "pharma_company", "platform_admin", "admin"].includes(profile.role)) {
          setRepMembership({
            isRep: true,
            companyName: "Official Company",
            companySlug: "company",
            roleLabel: profile.role === "company_ceo" ? "Company CEO" : "Company Representative",
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
      {/* Top Banner for Verified Company Representatives */}
      {repMembership?.isRep ? (
        <>
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xl">
                <Building2 className="h-6 w-6 text-emerald-200" />
                Verified Company Representative Portal ({repMembership.roleLabel})
              </div>
              <p className="text-sm text-emerald-100 leading-relaxed max-w-2xl">
                Signed in as official representative for <strong className="underline underline-offset-2">{repMembership.companyName}</strong> ({session?.user?.email}). Manage public details, submit brand product portfolios, and publish verified updates.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/companies/${repMembership.companySlug}`}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 shadow hover:bg-emerald-50 transition-all duration-200"
              >
                Edit {repMembership.companyName} Public Profile →
              </Link>
              <button
                onClick={() => document.getElementById("add-medicine")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-emerald-900/40 border border-white/30 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-900/60 transition-all duration-200"
              >
                Add Products &amp; Medicines
              </button>
            </div>
          </div>
          <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />
          <CompanyProfileUpdateForm companySlug={repMembership.companySlug} />
        </>
      ) : (
        <Card className="mb-6 border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">Standard User Account</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You are currently signed in as a standard user. Company representative portal privileges and product editing access must be assigned by a Platform Administrator or Company CEO through the Admin Control Center.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
      </div>
    </div>
  );
}
