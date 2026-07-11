import { lazy, Suspense } from "react";
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

const Landing = lazy(() => import("@/pages/landing"));
const Manifesto = lazy(() => import("@/pages/manifesto"));
const PublicInfoPage = lazy(() => import("@/pages/public-info"));
const BrandPage = lazy(() => import("@/pages/brand"));
const MedicinesEncyclopedia = lazy(() => import("@/pages/medicines-encyclopedia"));
const MedicineDetail = lazy(() => import("@/pages/medicine-detail"));
const EntityDetail = lazy(() => import("@/pages/entity-detail"));
const GenericDirectory = lazy(() => import("@/pages/facet-directory").then((module) => ({ default: module.GenericDirectory })));
const DiseaseDirectory = lazy(() => import("@/pages/facet-directory").then((module) => ({ default: module.DiseaseDirectory })));
const MedicineEnrichmentAdmin = lazy(() => import("@/pages/medicine-enrichment-admin"));
const ItemExportDataSource = lazy(() => import("@/pages/data-source-item-export"));
const VerifiedProductDatabase = lazy(() => import("@/pages/verified-product-database"));
const CompanyProfiles = lazy(() => import("@/pages/company-profiles"));
const IndustryContributionNetwork = lazy(() => import("@/pages/industry-contribution-network"));
const CollaborationExchange = lazy(() => import("@/pages/collaboration-exchange"));
const PlatformNetwork = lazy(() => import("@/pages/platform-network"));
const PlatformSearch = lazy(() => import("@/pages/platform-search"));
const WorkspacePage = lazy(() => import("@/pages/workspace"));
const BeneficiaryDetailPage = lazy(() => import("@/pages/beneficiary-detail"));
const ProgramDetailPage = lazy(() => import("@/pages/program-detail"));
const SupportRequestDetailPage = lazy(() => import("@/pages/support-request-detail"));
const PilotWorkspacePage = lazy(() => import("@/pages/pilot-workspace"));
const PilotReadinessPage = lazy(() => import("@/pages/pilot-readiness"));
const PilotLaunchChecklistPage = lazy(() => import("@/pages/pilot-launch-checklist"));
const PilotExecutiveSummaryPage = lazy(() => import("@/pages/pilot-executive-summary"));
const PilotGovernancePage = lazy(() => import("@/pages/pilot-governance"));
const PilotCommandCenterPage = lazy(() => import("@/pages/pilot-command-center"));
const PilotReportPage = lazy(() => import("@/pages/pilot-report"));
const PartnershipLeadsPage = lazy(() => import("@/pages/partnership-leads"));
const ImpactReportingPage = lazy(() => import("@/pages/impact-reporting"));
const Portal = lazy(() => import("@/pages/portal"));
const TrackOrder = lazy(() => import("@/pages/patient-track"));
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
const PlatformIntegrationHub = lazy(() => import("@/pages/platform-integration-hub"));
const CoordinatorPortal = lazy(() => import("@/pages/coordinator"));
const DataEntryPortal = lazy(() => import("@/pages/data-entry"));
const AdminPortal = lazy(() => import("@/pages/admin"));
const AdminIndustryContributions = lazy(() => import("@/pages/admin-industry-contributions"));
const PhysicianPortal = lazy(() => import("@/pages/physician"));
const BranchManagerPortal = lazy(() => import("@/pages/branch-manager"));
const CosmeticianPortal = lazy(() => import("@/pages/cosmetician"));
const NgoPortal = lazy(() => import("@/pages/ngo"));
const NgoDashboard = lazy(() => import("@/pages/ngo-dashboard"));
const NgoAlternativesPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoAlternativesPage })),
);
const NgoBeneficiariesPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoBeneficiariesPage })),
);
const NgoBudgetsPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoBudgetsPage })),
);
const NgoPartnersPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoPartnersPage })),
);
const NgoProcurementPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoProcurementPage })),
);
const NgoRequestsPage = lazy(() =>
  import("@/pages/ngo-sections").then((module) => ({ default: module.NgoRequestsPage })),
);
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/manifesto" component={Manifesto} />
        <Route path="/vision" component={PublicInfoPage} />
        <Route path="/platform" component={PublicInfoPage} />
        <Route path="/solutions" component={PublicInfoPage} />
        <Route path="/security" component={PublicInfoPage} />
        <Route path="/research" component={PublicInfoPage} />
        <Route path="/contact" component={PublicInfoPage} />
        <Route path="/brand" component={BrandPage} />
        <Route path="/catalog/:id" component={MedicineDetail} />
        <Route path="/medicines/:id" component={MedicineDetail} />
        <Route path="/medicines" component={MedicinesEncyclopedia} />
        <Route path="/verified-products" component={VerifiedProductDatabase} />
        <Route path="/companies/:slug" component={EntityDetail} />
        <Route path="/companies" component={CompanyProfiles} />
        <Route path="/generics/:slug" component={EntityDetail} />
        <Route path="/generics" component={GenericDirectory} />
        <Route path="/diseases/:slug" component={EntityDetail} />
        <Route path="/diseases" component={DiseaseDirectory} />
        <Route path="/industry" component={IndustryContributionNetwork} />
        <Route path="/opportunities" component={CollaborationExchange} />
        <Route path="/network" component={PlatformNetwork} />
        <Route path="/search" component={PlatformSearch} />
        <Route path="/admin/medicine-enrichment" component={MedicineEnrichmentAdmin} />
        <Route path="/admin/industry" component={AdminIndustryContributions} />
        <Route path="/data-sources/item-export-20260501" component={ItemExportDataSource} />
        <Route path="/integrations" component={PlatformIntegrationHub} />
        <Route path="/workspace" component={WorkspacePage} />
        <Route path="/workspace/programs/:id" component={ProgramDetailPage} />
        <Route path="/workspace/beneficiaries/:id" component={BeneficiaryDetailPage} />
        <Route path="/workspace/requests/:id" component={SupportRequestDetailPage} />
        <Route path="/workspace/pilot-command/:id" component={PilotCommandCenterPage} />
        <Route path="/workspace/pilots/:id" component={PilotWorkspacePage} />
        <Route path="/workspace/pilot-readiness/:id" component={PilotReadinessPage} />
        <Route path="/workspace/pilot-launch/:id" component={PilotLaunchChecklistPage} />
        <Route path="/workspace/pilot-executive/:id" component={PilotExecutiveSummaryPage} />
        <Route path="/workspace/pilot-governance/:id" component={PilotGovernancePage} />
        <Route path="/workspace/pilot-report/:id" component={PilotReportPage} />
        <Route path="/admin/leads" component={PartnershipLeadsPage} />
        <Route path="/impact" component={ImpactReportingPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/track" component={TrackOrder} />
        <Route path="/request" component={RequestForm} />
        <Route path="/clinical-assistant" component={ClinicalAssistant} />
        <Route path="/ngo" component={NgoPortal} />
        <Route path="/ngo/dashboard" component={NgoDashboard} />
        <Route path="/ngo/beneficiaries" component={NgoBeneficiariesPage} />
        <Route path="/ngo/requests" component={NgoRequestsPage} />
        <Route path="/ngo/budgets" component={NgoBudgetsPage} />
        <Route path="/ngo/alternatives" component={NgoAlternativesPage} />
        <Route path="/ngo/procurement" component={NgoProcurementPage} />
        <Route path="/ngo/partners" component={NgoPartnersPage} />
        <Route path="/ngo/impact" component={ImpactReportingPage} />
        <Route path="/portal" component={Portal} />
        <Route path="/login" component={Portal} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/dashboard/request/:id" component={RequestDetail} />
        <Route path="/employee" component={EmployeePortal} />
        <Route path="/reviewer" component={ReviewerPortal} />
        <Route path="/physician" component={PhysicianPortal} />
        <Route path="/pharmacist" component={PharmacistPortal} />
        <Route path="/pharmacy" component={PharmacyPortal} />
        <Route path="/pharmacy/finance" component={PharmacyFinance} />
        <Route path="/pharmacy/members" component={PharmacyMembers} />
        <Route path="/pharmacy/inventory" component={PharmacyInventory} />
        <Route path="/pharmacy/purchases" component={PharmacyPurchases} />
        <Route path="/pharmacy/training" component={PharmacyTraining} />
        <Route path="/pharmacy/settings" component={PharmacySettings} />
        <Route path="/pharmacy/sales" component={PharmacySales} />
        <Route path="/pharmacy/reports" component={PharmacyReports} />
        <Route path="/admin-users" component={UserTools} />
        <Route path="/delivery" component={CoordinatorPortal} />
        <Route path="/branch-manager" component={BranchManagerPortal} />
        <Route path="/cosmetician" component={CosmeticianPortal} />
        <Route path="/data-entry" component={DataEntryPortal} />
        <Route path="/admin" component={AdminPortal} />
        <Route path="/platform-admin" component={AdminPortal} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RoleProvider>
          <AuthProvider>
            <PatientAuthProvider>
              <TooltipProvider>
                <WouterRouter base={base}>
                  <RouteSeo />
                  <Layout>
                    <Router />
                  </Layout>
                </WouterRouter>
                <Toaster />
              </TooltipProvider>
            </PatientAuthProvider>
          </AuthProvider>
        </RoleProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
