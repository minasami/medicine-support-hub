import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteSeo } from "@/components/route-seo";
import { LanguageProvider } from "@/lib/i18n";
import { RoleProvider } from "@/lib/role";
import { AuthProvider } from "@/lib/auth";
import { PatientAuthProvider } from "@/lib/patient-auth";
import { Layout } from "@/components/layout";
import { JourneyContinuity } from "@/components/journey-continuity";
import { client as appwriteClient } from "@/lib/appwrite";
import { startAdaptiveBeacon } from "@/lib/adaptive";

const Landing = lazy(() => import("@/pages/landing"));
const Manifesto = lazy(() => import("@/pages/manifesto"));
const PublicInfoPage = lazy(() => import("@/pages/public-info"));
const BrandPage = lazy(() => import("@/pages/brand"));
const LearningCenter = lazy(() => import("@/pages/learning-center"));
const HealthcareJourney = lazy(() => import("@/pages/healthcare-journey"));
const MedicinesEncyclopedia = lazy(
  () => import("@/pages/medicines-encyclopedia"),
);
const MedicineDetail = lazy(() => import("@/pages/medicine-detail"));
const MedicineWorldSearch = lazy(
  () => import("@/pages/medicine-world-search"),
);
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const ManufacturerTerms = lazy(() => import("@/pages/manufacturer-terms"));
const MedicineMarketplace = lazy(() => import("@/pages/medicine-marketplace"));
const EntityDetail = lazy(() => import("@/pages/entity-detail"));
const EvaPharmaCompanyPage = lazy(() => import("@/pages/eva-pharma-company"));
const GenericDirectory = lazy(() =>
  import("@/pages/facet-directory").then((module) => ({
    default: module.GenericDirectory,
  })),
);
const DiseaseDirectory = lazy(() =>
  import("@/pages/facet-directory").then((module) => ({
    default: module.DiseaseDirectory,
  })),
);
const TherapeuticCategories = lazy(
  () => import("@/pages/therapeutic-categories"),
);
const MedicineEnrichmentAdmin = lazy(
  () => import("@/pages/medicine-enrichment-admin"),
);
const AdminPackshotQueue = lazy(() => import("@/pages/admin-packshot-queue"));
const ItemExportDataSource = lazy(
  () => import("@/pages/data-source-item-export"),
);
const VerifiedProductDatabase = lazy(
  () => import("@/pages/verified-product-database"),
);
const CompanyProfiles = lazy(() => import("@/pages/company-profiles"));
const PatientAuthPage = lazy(() => import("@/pages/patient-auth-page"));
const IndustryContributionNetwork = lazy(
  () => import("@/pages/industry-contribution-network"),
);
const IndustryOpportunityMarketplace = lazy(
  () => import("@/pages/industry-opportunity-marketplace"),
);
const ProfessionalJobs = lazy(() => import("@/pages/professional-jobs"));
const CompanyWorkspace = lazy(() => import("@/pages/company-workspace"));
const PlatformNetwork = lazy(() => import("@/pages/platform-network"));
const PlatformSearch = lazy(() => import("@/pages/platform-search"));
const WorkspacePage = lazy(() => import("@/pages/workspace"));
const BeneficiaryDetailPage = lazy(() => import("@/pages/beneficiary-detail"));
const ProgramDetailPage = lazy(() => import("@/pages/program-detail"));
const SupportRequestDetailPage = lazy(
  () => import("@/pages/support-request-detail"),
);
const PilotWorkspacePage = lazy(() => import("@/pages/pilot-workspace"));
const PilotReadinessPage = lazy(() => import("@/pages/pilot-readiness"));
const PilotLaunchChecklistPage = lazy(
  () => import("@/pages/pilot-launch-checklist"),
);
const PilotExecutiveSummaryPage = lazy(
  () => import("@/pages/pilot-executive-summary"),
);
const PilotGovernancePage = lazy(() => import("@/pages/pilot-governance"));
const PilotCommandCenterPage = lazy(
  () => import("@/pages/pilot-command-center"),
);
const PilotReportPage = lazy(() => import("@/pages/pilot-report"),
);
const PartnershipLeadsPage = lazy(() => import("@/pages/partnership-leads"));
const ImpactReportingPage = lazy(() => import("@/pages/impact-reporting"));
const Portal = lazy(() => import("@/pages/portal"));
const TrackOrder = lazy(() => import("@/pages/patient-track"));
const NgoDirectoryPage = lazy(() => import("@/pages/ngo-directory"));
const PspDirectoryPage = lazy(() => import("@/pages/psp-directory"));
const BabyFormulasPage = lazy(() => import("@/pages/baby-formulas"));
const RequestForm = lazy(() => import("@/pages/patient-request"));
const AccountPage = lazy(() => import("@/pages/account"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const RequestDetail = lazy(() => import("@/pages/request-detail"));
const ClinicalAssistant = lazy(() => import("@/pages/clinical-assistant"));
const EmployeePortal = lazy(() => import("@/pages/employee"));
const ReviewerPortal = lazy(() => import("@/pages/reviewer"));
const PharmacistPortal = lazy(() => import("@/pages/pharmacist"));
const PharmacyPortal = lazy(() => import("@/pages/pharmacy"));
const PharmacyFinance = lazy(() => import("@/pages/pharmacy-finance"));
const PharmacyMembers = lazy(() => import("@/pages/pharmacy-members"));
const PharmacyInventory = lazy(() => import("@/pages/pharmacy-inventory"));
const PharmacyPurchases = lazy(() => import("@/pages/pharmacy-purchases"));
const PharmacyTraining = lazy(() => import("@/pages/pharmacy-training"));
const PharmacySettings = lazy(() => import("@/pages/pharmacy-settings"));
const PharmacySales = lazy(() => import("@/pages/pharmacy-sales"));
const PharmacyReports = lazy(() => import("@/pages/pharmacy-reports"));
const UserTools = lazy(() => import("@/pages/platform-admin-users"));
const PlatformIntegrationHub = lazy(
  () => import("@/pages/platform-integration-hub"),
);
const CoordinatorPortal = lazy(() => import("@/pages/coordinator"));
const DataEntryPortal = lazy(() => import("@/pages/data-entry"));
const AdminPortal = lazy(() => import("@/pages/admin"));
const AdminCommandHub = lazy(() => import("@/pages/admin-command-hub"));
const AdminControlCenter = lazy(() => import("@/pages/admin-control-center"));
const AdminAutomation = lazy(() => import("@/pages/admin-automation"));
const AdminIndustryContributions = lazy(
  () => import("@/pages/admin-industry-contributions"),
);
const AdminMarketplace = lazy(() => import("@/pages/admin-marketplace"));
const AdminNotifications = lazy(() => import("@/pages/admin-notifications"));
const AdminCommunity = lazy(() => import("@/pages/admin-community"));
const MappingAccuracyDashboard = lazy(
  () => import("@/pages/mapping-accuracy-dashboard"),
);
const PhysicianPortal = lazy(() => import("@/pages/physician"));
const BranchManagerPortal = lazy(() => import("@/pages/branch-manager"));
const CosmeticianPortal = lazy(() => import("@/pages/cosmetician"));
const NgoPortal = lazy(() => import("@/pages/ngo"));
const NgoDashboard = lazy(() => import("@/pages/ngo-dashboard"));
const NgoDonationsPage = lazy(() => import("@/pages/ngo-donations"));
const NgoAlternativesPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoAlternativesPage,
  })),
);
const NgoBeneficiariesPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoBeneficiariesPage,
  })),
);
const NgoBudgetsPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoBudgetsPage,
  })),
);
const NgoPartnersPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoPartnersPage,
  })),
);
const NgoProcurementPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoProcurementPage,
  })),
);
const NgoRequestsPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({
    default: module.NgoRequestsPage,
  })),
);
const NotFound = lazy(() => import("@/pages/not-found"));
const NotificationCenter = lazy(() => import("@/pages/notification-center"));
const MonetizationDisclosure = lazy(
  () => import("@/pages/monetization-disclosure"),
);
const AdminHealthcareNetwork = lazy(
  () => import("@/pages/admin-healthcare-network"),
);
const BarcodeScanPage = lazy(() => import("@/pages/barcode-scan"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/manifesto" component={Manifesto} />
        <Route path="/about" component={PublicInfoPage} />
        <Route path="/brand" component={BrandPage} />
        <Route path="/learn" component={LearningCenter} />
        <Route path="/journey" component={HealthcareJourney} />
        <Route path="/medicines" component={MedicinesEncyclopedia} />
        <Route path="/medicines/:id" component={MedicineDetail} />
        <Route path="/world-search" component={MedicineWorldSearch} />
        <Route path="/catalog/:id" component={MedicineDetail} />
        <Route path="/medicine/:id" component={MedicineDetail} />
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/privacy-policy" component={PrivacyPolicy} />
        <Route path="/terms" component={ManufacturerTerms} />
        <Route path="/manufacturer-terms" component={ManufacturerTerms} />
        <Route path="/marketplace" component={MedicineMarketplace} />
        <Route path="/scan" component={BarcodeScanPage} />
        <Route path="/barcode" component={BarcodeScanPage} />
        <Route path="/companies/eva-pharma" component={EvaPharmaCompanyPage} />
        <Route path="/companies/:slug" component={EntityDetail} />
        <Route path="/companies" component={CompanyProfiles} />
        <Route path="/generics" component={GenericDirectory} />
        <Route path="/diseases" component={DiseaseDirectory} />
        <Route path="/categories" component={TherapeuticCategories} />
        <Route path="/verified-database" component={VerifiedProductDatabase} />
        <Route path="/industry" component={IndustryContributionNetwork} />
        <Route
          path="/industry/opportunities"
          component={IndustryOpportunityMarketplace}
        />
        <Route path="/company-workspace" component={CompanyWorkspace} />
        <Route path="/industry/workspace" component={CompanyWorkspace} />
        <Route path="/ngos/:slug" component={NgoDirectoryPage} />
        <Route path="/ngos" component={NgoDirectoryPage} />
        <Route path="/psps/:slug" component={PspDirectoryPage} />
        <Route path="/psps" component={PspDirectoryPage} />
        <Route path="/formulas" component={BabyFormulasPage} />
        <Route path="/patient-auth" component={PatientAuthPage} />
        <Route path="/login" component={PatientAuthPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/jobs" component={ProfessionalJobs} />
        <Route path="/network" component={PlatformNetwork} />
        <Route path="/search" component={PlatformSearch} />
        <Route path="/notifications" component={NotificationCenter} />
        <Route path="/disclosures" component={MonetizationDisclosure} />
        <Route path="/admin/control-center" component={AdminControlCenter} />
        <Route path="/admin/automation" component={AdminAutomation} />
        <Route path="/admin/notifications" component={AdminNotifications} />
        <Route path="/admin/community" component={AdminCommunity} />
        <Route
          path="/admin/mapping-accuracy"
          component={MappingAccuracyDashboard}
        />
        <Route
          path="/admin/medicine-enrichment"
          component={MedicineEnrichmentAdmin}
        />
        <Route path="/admin/packshot-queue" component={AdminPackshotQueue} />
        <Route path="/admin/industry" component={AdminIndustryContributions} />
        <Route path="/admin/marketplace" component={AdminMarketplace} />
        <Route
          path="/admin/healthcare-network"
          component={AdminHealthcareNetwork}
        />
        <Route
          path="/data-sources/item-export-20260501"
          component={ItemExportDataSource}
        />
        <Route path="/integrations" component={PlatformIntegrationHub} />
        <Route path="/workspace" component={WorkspacePage} />
        <Route path="/workspace/programs/:id" component={ProgramDetailPage} />
        <Route
          path="/workspace/beneficiaries/:id"
          component={BeneficiaryDetailPage}
        />
        <Route
          path="/workspace/requests/:id"
          component={SupportRequestDetailPage}
        />
        <Route
          path="/workspace/pilot-command/:id"
          component={PilotCommandCenterPage}
        />
        <Route path="/workspace/pilots/:id" component={PilotWorkspacePage} />
        <Route
          path="/workspace/pilot-readiness/:id"
          component={PilotReadinessPage}
        />
        <Route
          path="/workspace/pilot-launch/:id"
          component={PilotLaunchChecklistPage}
        />
        <Route
          path="/workspace/pilot-executive/:id"
          component={PilotExecutiveSummaryPage}
        />
        <Route
          path="/workspace/pilot-governance/:id"
          component={PilotGovernancePage}
        />
        <Route path="/workspace/pilot-report/:id" component={PilotReportPage} />
        <Route path="/admin/leads" component={PartnershipLeadsPage} />
        <Route path="/impact" component={ImpactReportingPage} />
        <Route path="/track" component={TrackOrder} />
        <Route path="/request" component={RequestForm} />
        <Route path="/clinical-assistant" component={ClinicalAssistant} />
        <Route path="/ngo" component={NgoPortal} />
        <Route path="/ngo/dashboard" component={NgoDashboard} />
        <Route path="/ngo/donations" component={NgoDonationsPage} />
        <Route path="/ngo/beneficiaries" component={NgoBeneficiariesPage} />
        <Route path="/ngo/requests" component={NgoRequestsPage} />
        <Route path="/ngo/alternatives" component={NgoAlternativesPage} />
        <Route path="/ngo/partners" component={NgoPartnersPage} />
        <Route path="/ngo/procurement" component={NgoProcurementPage} />
        <Route path="/ngo/budgets" component={NgoBudgetsPage} />
        <Route path="/portal" component={Portal} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/requests/:id" component={RequestDetail} />
        <Route path="/employee" component={EmployeePortal} />
        <Route path="/reviewer" component={ReviewerPortal} />
        <Route path="/pharmacist" component={PharmacistPortal} />
        <Route path="/pharmacy" component={PharmacyPortal} />
        <Route path="/pharmacy/sales" component={PharmacySales} />
        <Route path="/pharmacy/purchases" component={PharmacyPurchases} />
        <Route path="/pharmacy/inventory" component={PharmacyInventory} />
        <Route path="/pharmacy/finance" component={PharmacyFinance} />
        <Route path="/pharmacy/reports" component={PharmacyReports} />
        <Route path="/pharmacy/members" component={PharmacyMembers} />
        <Route path="/pharmacy/training" component={PharmacyTraining} />
        <Route path="/pharmacy/settings" component={PharmacySettings} />
        <Route path="/physician" component={PhysicianPortal} />
        <Route path="/branch-manager" component={BranchManagerPortal} />
        <Route path="/cosmetician" component={CosmeticianPortal} />
        <Route path="/admin/hub" component={AdminCommandHub} />
        <Route path="/admin/legacy" component={AdminPortal} />
        <Route path="/admin" component={AdminCommandHub} />
        <Route path="/admin/users" component={UserTools} />
        <Route path="/data-entry" component={DataEntryPortal} />
        <Route path="/coordinator" component={CoordinatorPortal} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    if (import.meta.env.VITE_APPWRITE_PROJECT_ID) {
      try {
        appwriteClient.setEndpoint(
          import.meta.env.VITE_APPWRITE_ENDPOINT ||
            "https://fra.cloud.appwrite.io/v1",
        );
        appwriteClient.setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);
      } catch (e) {
        console.warn("Appwrite Client initialization notice:", e);
      }
    }
    return startAdaptiveBeacon(120_000);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <RoleProvider>
            <AuthProvider>
              <PatientAuthProvider>
                <WouterRouter>
                  <RouteSeo />
                  <Layout>
                    <Router />
                    <JourneyContinuity />
                  </Layout>
                </WouterRouter>
              </PatientAuthProvider>
            </AuthProvider>
          </RoleProvider>
        </LanguageProvider>
      </TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
