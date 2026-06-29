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
import Manifesto from "@/pages/manifesto";
import PublicInfoPage from "@/pages/public-info";
import Portal from "@/pages/portal";
import TrackOrder from "@/pages/patient-track";
import RequestForm from "@/pages/patient-request";
import AccountPage from "@/pages/account";
import Dashboard from "@/pages/dashboard";
import RequestDetail from "@/pages/request-detail";
import ClinicalAssistant from "@/pages/clinical-assistant";
import EmployeePortal from "@/pages/employee";
import ReviewerPortal from "@/pages/reviewer";
import PharmacistPortal from "@/pages/pharmacist";
import PharmacyPortal from "@/pages/pharmacy";
import CoordinatorPortal from "@/pages/coordinator";
import DataEntryPortal from "@/pages/data-entry";
import AdminPortal from "@/pages/admin";
import PhysicianPortal from "@/pages/physician";
import BranchManagerPortal from "@/pages/branch-manager";
import CosmeticianPortal from "@/pages/cosmetician";
import NgoPortal from "@/pages/ngo";
import NgoDashboard from "@/pages/ngo-dashboard";
import { NgoAlternativesPage, NgoBeneficiariesPage, NgoBudgetsPage, NgoImpactPage, NgoPartnersPage, NgoProcurementPage, NgoRequestsPage } from "@/pages/ngo-sections";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return <Switch>
    <Route path="/" component={Landing} />
    <Route path="/manifesto" component={Manifesto} />
    <Route path="/vision" component={PublicInfoPage} />
    <Route path="/platform" component={PublicInfoPage} />
    <Route path="/solutions" component={PublicInfoPage} />
    <Route path="/security" component={PublicInfoPage} />
    <Route path="/research" component={PublicInfoPage} />
    <Route path="/contact" component={PublicInfoPage} />
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
  </Switch>;
}

function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return <QueryClientProvider client={queryClient}><LanguageProvider><RoleProvider><AuthProvider><PatientAuthProvider><TooltipProvider><WouterRouter base={base}><Layout><Router /></Layout></WouterRouter><Toaster /></TooltipProvider></PatientAuthProvider></AuthProvider></RoleProvider></LanguageProvider></QueryClientProvider>;
}

export default App;
