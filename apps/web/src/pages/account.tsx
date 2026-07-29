import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { useRole, ROLE_LABELS, ROLE_HOME, ROLE_COLOR } from "@/lib/role";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CompanyProfileUpdateForm } from "@/components/company-profile-update-form";
import { CompanyMedicineAdditionForm } from "@/components/company-medicine-addition-form";
import { Building2 } from "lucide-react";

export default function AccountPage() {
  const { session, profile, signOut: patientSignOut, supabaseFetch } = usePatientAuth();
  const [, setLocation] = useLocation();

  const [repMembership, setRepMembership] = useState<{
    isRep: boolean;
    companyName: string;
    companySlug: string;
    roleLabel: string;
  } | null>(null);
  const [checkingRepStatus, setCheckingRepStatus] = useState(true);

  // Check if returning from OAuth / sign in
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const nextPath = query.get("next");

  useEffect(() => {
    if (nextPath) {
      setLocation(nextPath);
    }
  }, [nextPath, setLocation]);

  useEffect(() => {
    async function checkCompanyRepStatus() {
      const userId = session?.user?.id;
      const userEmail = (session?.user?.email || "").toLowerCase().trim();
      if (!userId && !userEmail) {
        setRepMembership(null);
        setCheckingRepStatus(false);
        return;
      }

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
        ]);

        if (Array.isArray(memberships) && memberships.length > 0) {
          const activeMem = memberships[0];
          const companyName = activeMem.company_name || activeMem.organizations?.name || "Assigned Company";
          const companySlug = activeMem.company_slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRepMembership({
            isRep: true,
            companyName,
            companySlug: companySlug || "company",
            roleLabel: activeMem.role === "company_ceo" ? "Company CEO" : "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(repClaims) && repClaims.length > 0) {
          const activeClaim = repClaims[0];
          const companyName = activeClaim.company_name || "Assigned Company";
          const companySlug = activeClaim.company_slug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          setRepMembership({
            isRep: true,
            companyName,
            companySlug: companySlug || "company",
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

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

  if (!session?.access_token) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <Card className="border-emerald-500/20 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Account Authentication Required</h2>
            <p className="text-sm text-emerald-100 mt-2 leading-relaxed">
              Please sign in or create an account to view profile settings, access patient features, or manage company products.
            </p>
          </div>
          <CardContent className="p-6 space-y-4 text-center bg-card">
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you are a Company Representative or CEO, sign in with your authorized credentials to access your brand control center.
            </p>
            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                onClick={() => setLocation("/patient-auth")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow transition-all duration-200"
              >
                Sign In or Register Account →
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/industry")}
                className="w-full text-xs font-semibold py-2 rounded-xl"
              >
                Apply as Company Representative
              </Button>
            </div>
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
        <div className="flex gap-2">
          {patientSignOut && (
            <Button
              variant="outline"
              onClick={patientSignOut}
              className="text-xs font-semibold"
            >
              Sign out
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Full Name
              </label>
              <Input
                value={profile?.full_name || ""}
                disabled
                placeholder="Not provided"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Email Address
              </label>
              <Input
                value={session?.user?.email || ""}
                disabled
                placeholder="Not provided"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Phone Number
              </label>
              <Input
                value={profile?.phone || ""}
                disabled
                placeholder="Not provided"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                City / Region
              </label>
              <Input
                value={profile?.city || ""}
                disabled
                placeholder="Not provided"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
