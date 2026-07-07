import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { RoleProvider } from "@/lib/role";
import { AuthProvider } from "@/lib/auth";
import { PatientAuthProvider } from "@/lib/patient-auth";
import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import { NgoAlternativesPage, NgoBeneficiariesPage, NgoBudgetsPage, NgoImpactPage, NgoPartnersPage, NgoProcurementPage, NgoRequestsPage } from "@/pages/ngo-sections";

const Manifesto = lazy(() => import("@/pages/manifesto"));
const PublicInfoPage = lazy(() => import("@/pages/public-info"));
const BrandPage = lazy(() => import("@/pages/brand"));
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
const CoordinatorPortal = lazy(() => import("@/pages/coordinator"));
const DataEntryPortal = lazy(() => import("@/pages/data-entry"));
const AdminPortal = lazy(() => import("@/pages/admin"));
const PhysicianPortal = lazy(() => import("@/pages/physician"));
const BranchManagerPortal = lazy(() => import("@/pages/branch-manager"));
const CosmeticianPortal = lazy(() => import("@/pages/cosmetician"));
const NgoPortal = lazy(() => import("@/pages/ngo"));
const NgoDashboard = lazy(() => import("@/pages/ngo-dashboard"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">Loading workspace…</div>;
}

function Router() {
  return <Suspense fallback={<RouteFallback />}>
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
      <Route path="/ngo/impact" component={NgoImpactPage} />
      <Route path="/portal" component={Portal} />
      <Route path="/login" component={Portal} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/request/:id" component={RequestDetail} />
      <Route path="/employee" component={EmployeePortal} />
      <Route path="/reviewer" component={ReviewerPortal} />
      <Route path="/physician" component={PhysicianPortal} />
      <Route path="/pharmacist" component={PharmacistPortal} />
      <Route path="/pharmacy" component={PharmacyPortal} />
      <Route path="/delivery" component={CoordinatorPortal} />
      <Route path="/branch-manager" component={BranchManagerPortal} />
      <Route path="/cosmetician" component={CosmeticianPortal} />
      <Route path="/data-entry" component={DataEntryPortal} />
      <Route path="/admin" component={AdminPortal} />
      <Route path="/platform-admin" component={AdminPortal} />
      <Route component={NotFound} />
    </Switch>
  </Suspense>;
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <RoleProvider>
        <AuthProvider>
          <PatientAuthProvider>
            <TooltipProvider>
              <WouterRouter base={base}>
                <Layout><Router /></Layout>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </PatientAuthProvider>
        </AuthProvider>
      </RoleProvider>
    </LanguageProvider>
  </QueryClientProvider>;
}
