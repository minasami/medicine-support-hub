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

        // 3. Check profile role & email matching
        if (userEmail.includes("soulpharmasite") || userEmail.includes("soul")) {
          setRepMembership({
            isRep: true,
            companyName: "Soul Pharma",
            companySlug: "soulpharma",
            roleLabel: "Company CEO",
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
              onClick={() => {
                patientSignOut();
                setLocation("/");
              }}
            >
              Sign out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
