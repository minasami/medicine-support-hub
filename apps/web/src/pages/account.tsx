import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const AUTH_NEXT_KEY = "medicine_support_auth_next";
const PROVIDER_WORKSPACE = /^\/(clinics\/emr|pharmacies\/pms|labs\/lms|radiology\/rms)(?:[/?#]|$)/;

function requestedNextPath() {
  const fromQuery = new URLSearchParams(window.location.search).get("next");
  const fromSession = sessionStorage.getItem(AUTH_NEXT_KEY);
  const candidate = fromQuery || fromSession || "";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || !PROVIDER_WORKSPACE.test(candidate)) return null;
  return candidate;
}

export default function AccountPage() {
  const { isAuthenticated, signIn, signUp, signInWithGoogle, signOut, profile, updateProfile, supabaseFetch } = usePatientAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [nextPath] = useState<string | null>(() => requestedNextPath());
  const providerMode = Boolean(nextPath);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    setBirthdate(profile.birthdate ?? "");
    setCity(profile.city ?? "");
  }, [profile]);

  useEffect(() => {
    if (!isAuthenticated || !nextPath) return;
    let cancelled = false;
    const destination = nextPath;
    async function openProviderWorkspace() {
      try {
        await supabaseFetch("/rest/v1/rpc/claim_approved_healthcare_entity_access", {
          method: "POST",
          body: "{}",
        });
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Provider access could not be synchronized",
            description: error instanceof Error ? error.message : "Open the workspace and contact support if access is not shown.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          sessionStorage.removeItem(AUTH_NEXT_KEY);
          navigate(destination);
        }
      }
    }
    void openProviderWorkspace();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, nextPath, navigate, supabaseFetch, toast]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password, fullName, phone);
      toast({ title: mode === "signin" ? "Signed in" : "Account created" });
    } catch (error) {
      toast({ title: "Authentication failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile({ full_name: fullName, phone, address, birthdate: birthdate || null, city });
      toast({ title: "Profile saved", description: "Your request forms will now be pre-filled." });
    } catch (error) {
      toast({ title: "Could not save profile", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function continueWithGoogle() {
    if (nextPath) sessionStorage.setItem(AUTH_NEXT_KEY, nextPath);
    signInWithGoogle();
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>
              {providerMode
                ? mode === "signin" ? "Provider Sign In" : "Create Provider Account"
                : mode === "signin" ? "Patient Sign In" : "Create User Account"}
            </CardTitle>
            <CardDescription>
              {providerMode
                ? "Use the exact email submitted with the approved care-network application. You will continue to the private provider workspace after sign-in."
                : "Use your account to save your profile and track all medicine requests."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button type="button" variant="outline" className="w-full" onClick={continueWithGoogle}>
                Continue with Google
              </Button>
              <div className="relative text-center text-xs text-muted-foreground">
                <span className="bg-background px-2 relative z-10">or use email</span>
                <div className="absolute left-0 right-0 top-1/2 border-t" />
              </div>
            </div>
            <form onSubmit={handleAuth} className="space-y-4 mt-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button className="w-full" disabled={busy}>{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin"
                  ? providerMode ? "No account yet? Create one with the approved email" : "New patient? Create an account"
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
            Opening your approved provider workspace…
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Patient Profile</h1>
          <p className="text-muted-foreground">This information will pre-fill your medicine requests.</p>
        </div>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Birthdate</Label><Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, building, floor, apartment" /></div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button disabled={busy}>{busy ? "Saving..." : "Save profile"}</Button>
              <Button asChild type="button" variant="secondary"><Link href="/request">Request medicines</Link></Button>
              <Button asChild type="button" variant="outline"><Link href="/track">Track my requests</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
