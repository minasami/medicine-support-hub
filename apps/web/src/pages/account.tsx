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
import { CompanyStockCsvImport } from "@/components/company-stock-csv-import";
import { AlertCircle, Building2 } from "lucide-react";

export default function AccountPage() {
  const { t } = useLanguage();
  const { session, profile, signOut: patientSignOut, supabaseFetch } = usePatientAuth();
  const [, setLocation] = useLocation();

  const [repMembership, setRepMembership] = useState<{
    isRep: boolean;
    isApproved: boolean;
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
        const normalizeCompany = (rawName: string | undefined, rawSlug: string | undefined) => {
          let name = String(rawName || "").trim();
          // Handle "MEDCARE > SOUL PHARMA" or "MEDCARE / SOUL PHARMA" toll hierarchy
          if (name.includes(">") || name.includes("/")) {
            const parts = name.split(/\s*(?:>|\/)\s*/).map(p => p.trim()).filter(Boolean);
            if (parts.length > 1) name = parts[parts.length - 1];
          }

          // Only default to SOUL PHARMA if user email is specifically soulpharmasite@gmail.com or contains soulpharma
          if ((!name || /^(med\s*care|medcare|assigned\s*company|official\s*company)$/i.test(name)) && (userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma"))) {
            name = "SOUL PHARMA";
          }

          // Infer Eva Pharma for armanious foundation or eva pharma emails
          if (!name && (userEmail.includes("armanious") || userEmail.includes("evapharma") || userEmail.includes("eva-pharma"))) {
            name = "Eva Pharma";
          }

          if (!name) name = "Pharma Company";

          const slug = (rawSlug || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
          return { companyName: name, companySlug: slug };
        };

        // Priority 0: Known Soul Pharma CEO credentials
        if (userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma")) {
          setRepMembership({
            isRep: true,
            isApproved: true,
            companyName: "SOUL PHARMA",
            companySlug: "soulpharma",
            roleLabel: "Company CEO",
          });
          setCheckingRepStatus(false);
          return;
        }

        const matchesUser = (item: any) => {
          if (!item) return false;
          return (
            (userId && item.user_id === userId) ||
            (userEmail && item.user_email && item.user_email.toLowerCase() === userEmail) ||
            (userEmail && item.work_email && item.work_email.toLowerCase() === userEmail) ||
            (userEmail && item.email && item.email.toLowerCase() === userEmail) ||
            (userEmail && item.requested_by && String(item.requested_by).toLowerCase() === userEmail)
          );
        };

        // 1. Check local storage cache of memberships and claims
        if (typeof window !== "undefined") {
          try {
            const keys = ["msh_organization_memberships_v1", "msh_company_claims_v1", "msh_industry_claims_v1", "msh_representative_claims_v1"];
            for (const k of keys) {
              const cachedRaw = localStorage.getItem(k);
              if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const found = list.find(matchesUser);

                if (found) {
                  const { companyName, companySlug } = normalizeCompany(
                    found.company_name || found.proposed_company_name || found.organizations?.name,
                    found.company_slug
                  );

                  const isApproved = found.status === "approved" || found.is_approved === true || found.is_active === true;
                  const roleLabel = found.role === "company_ceo" || found.role_title?.toLowerCase().includes("ceo") 
                    ? "Company CEO" 
                    : found.role_title || "Company Representative";

                  setRepMembership({
                    isRep: true,
                    isApproved,
                    companyName,
                    companySlug,
                    roleLabel,
                  });
                  setCheckingRepStatus(false);
                  return;
                }
              }
            }
          } catch {}
        }

        // 2. Query Database organization_memberships, company_area_representatives & company_profile_claims
        const [membershipsById, membershipsByEmail, repClaims, profileClaims] = await Promise.all([
          supabaseFetch<any[]>(`/rest/v1/organization_memberships?user_id=eq.${userId}&is_active=eq.true`).catch(() => []),
          userEmail ? supabaseFetch<any[]>(`/rest/v1/organization_memberships?user_id=eq.${userEmail}&is_active=eq.true`).catch(() => []) : Promise.resolve([]),
          supabaseFetch<any[]>(`/rest/v1/company_area_representatives?user_id=eq.${userId}&is_active=eq.true`).catch(() => []),
          userEmail ? supabaseFetch<any[]>(`/rest/v1/company_profile_claims?work_email=eq.${userEmail}&order=created_at.desc`).catch(() => []) : Promise.resolve([]),
        ]);

        const memberships = [...(Array.isArray(membershipsById) ? membershipsById : []), ...(Array.isArray(membershipsByEmail) ? membershipsByEmail : [])];

        if (memberships.length > 0) {
          const activeMem = memberships[0];
          const { companyName, companySlug } = normalizeCompany(
            activeMem.company_name || activeMem.organizations?.name,
            activeMem.company_slug
          );
          const isApproved = activeMem.status === "approved" || activeMem.is_active !== false;
          setRepMembership({
            isRep: true,
            isApproved,
            companyName,
            companySlug,
            roleLabel: activeMem.role === "company_ceo" ? "Company CEO" : "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(profileClaims) && profileClaims.length > 0) {
          const claim = profileClaims[0];
          const { companyName, companySlug } = normalizeCompany(
            claim.proposed_company_name || claim.company_name,
            claim.company_slug
          );
          const isApproved = claim.status === "approved" || claim.is_approved === true;
          setRepMembership({
            isRep: true,
            isApproved,
            companyName,
            companySlug,
            roleLabel: claim.role_title || "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        if (Array.isArray(repClaims) && repClaims.length > 0) {
          const activeClaim = repClaims[0];
          const { companyName, companySlug } = normalizeCompany(
            activeClaim.company_name,
            activeClaim.company_slug
          );
          setRepMembership({
            isRep: true,
            isApproved: true,
            companyName,
            companySlug,
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        // 3. Eva Pharma domain heuristic fallback
        if (userEmail.includes("armanious") || userEmail.includes("evapharma") || userEmail.includes("eva-pharma")) {
          setRepMembership({
            isRep: true,
            isApproved: false,
            companyName: "Eva Pharma",
            companySlug: "eva-pharma",
            roleLabel: "Company Representative",
          });
          setCheckingRepStatus(false);
          return;
        }

        // 4. Role fallback
        if (profile?.role && ["company_ceo", "pharma_rep", "company_admin", "pharma_company"].includes(profile.role)) {
          const defaultCompany = (userEmail.includes("soulpharma")) ? "SOUL PHARMA" : (userEmail.includes("armanious") || userEmail.includes("eva")) ? "Eva Pharma" : "Pharma Company";
          const defaultSlug = defaultCompany === "SOUL PHARMA" ? "soulpharma" : defaultCompany === "Eva Pharma" ? "eva-pharma" : "company";
          const isApproved = userEmail === "soulpharmasite@gmail.com" || userEmail.includes("soulpharma");
          setRepMembership({
            isRep: true,
            isApproved,
            companyName: defaultCompany,
            companySlug: defaultSlug,
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
      {/* Top Banner for Company Representatives */}
      {repMembership?.isRep ? (
        repMembership.isApproved ? (
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
            <CompanyStockCsvImport
              companySlug={repMembership.companySlug}
              companyName={repMembership.companyName}
              defaultOrgCode={repMembership.companyName?.toUpperCase().includes("EVA") ? "EVA" : undefined}
            />
            <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />
            <CompanyProfileUpdateForm companySlug={repMembership.companySlug} />
          </>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 text-white shadow-xl space-y-3">
              <div className="flex items-center gap-2.5 font-bold text-xl">
                <AlertCircle className="h-6 w-6 text-amber-200" />
                {t("Pending Representative Verification", "في انتظار توثيق ممثل الشركة")}
              </div>
              <p className="text-sm text-amber-50 leading-relaxed">
                {t(
                  `Your account isn't approved yet, you can submit new products one by one or bulk, but you can't edit the ${repMembership.companyName} already available products at the medicines encyclopedia until the admin approves that you are verified company representative of the company.`,
                  `حسابك لم يتم اعتماده بعد، يمكنك تقديم منتجات جديدة واحدة تلو الأخرى أو بالجملة، ولكن لا يمكنك تعديل أدوية ${repMembership.companyName} المتاحة حاليًا في موسوعة الأدوية حتى يوافق المسؤول على أنك ممثل معتمد للشركة.`
                )}
              </p>
            </div>

            <CompanyStockCsvImport
              companySlug={repMembership.companySlug}
              companyName={repMembership.companyName}
              defaultOrgCode={repMembership.companyName?.toUpperCase().includes("EVA") ? "EVA" : undefined}
            />
            <CompanyMedicineAdditionForm companySlug={repMembership.companySlug} />
          </>
        )
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
