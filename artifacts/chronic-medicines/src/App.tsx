import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import { RoleProvider } from "@/lib/role";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import Portal from "@/pages/portal";
import TrackOrder from "@/pages/track";
import RequestForm from "@/pages/request";
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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public client-facing pages */}
      <Route path="/" component={Landing} />
      <Route path="/track" component={TrackOrder} />
      <Route path="/request" component={RequestForm} />
      <Route path="/clinical-assistant" component={ClinicalAssistant} />

      {/* Staff portal entry */}
      <Route path="/portal" component={Portal} />

      {/* Legacy */}
      <Route path="/login" component={Portal} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/request/:id" component={RequestDetail} />

      {/* Staff role portals */}
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RoleProvider>
          <AuthProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Layout>
                  <Router />
                </Layout>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </RoleProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
