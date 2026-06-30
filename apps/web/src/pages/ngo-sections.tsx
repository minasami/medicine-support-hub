import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Handshake, Pill, ShoppingCart, Users, Wallet } from "lucide-react";
import SupportRequestsPage from "@/pages/support-requests";

type SectionProps = {
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
  next: string;
};

function NgoSectionPage({ title, badge, description, icon: Icon, items, next }: SectionProps) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{badge}</Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold"><Icon className="h-8 w-8 text-emerald-700" /> {title}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline"><Link href="/ngo/dashboard">Back to NGO dashboard</Link></Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card><CardHeader><CardTitle>Phase 1 capabilities</CardTitle></CardHeader><CardContent className="space-y-3">{items.map((item, index) => <div key={item} className="flex gap-3 rounded-lg border p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{index + 1}</div><div className="text-sm font-medium">{item}</div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Build note</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>{next}</p><p>These pages are scaffolds. The next engineering step is connecting them to NGO-specific Supabase tables with workspace-based access control.</p></CardContent></Card>
      </div>
    </div>
  );
}

export function NgoBeneficiariesPage() {
  return <NgoSectionPage title="Beneficiary Registry" badge="NGO Beneficiaries" icon={Users} description="Manage beneficiary profiles, eligibility data, chronic conditions, prescriptions, and support history." items={["Create beneficiary profiles", "Record household and eligibility data", "Track chronic conditions", "Attach prescription documents", "View medicine support history"]} next="Start by building CRUD for beneficiaries, because every request, budget allocation, and impact report depends on a clean beneficiary record." />;
}

export function NgoRequestsPage() {
  return <SupportRequestsPage />;
}

export function NgoBudgetsPage() {
  return <NgoSectionPage title="Budgets" badge="NGO Finance" icon={Wallet} description="Assign program budgets, allocate support by beneficiary or disease area, and track committed monthly costs." items={["Create project budget", "Allocate budget by beneficiary or disease", "Track committed monthly medicine cost", "Show remaining balance", "Warn when requests exceed available budget"]} next="Budget logic should be simple and auditable before adding advanced donor restrictions or complex forecasting." />;
}

export function NgoAlternativesPage() {
  return <NgoSectionPage title="Medicine Alternatives" badge="NGO Clinical Cost Review" icon={Pill} description="Compare cheaper alternatives using active ingredient, strength, dosage form, availability, and reviewer approval." items={["Match by active ingredient", "Check strength and dosage form", "Compare unit cost", "Show supplier availability", "Require medical reviewer confirmation"]} next="The system should suggest alternatives, not automatically substitute medicines." />;
}

export function NgoProcurementPage() {
  return <NgoSectionPage title="Procurement" badge="NGO Supply Chain" icon={ShoppingCart} description="Manage suppliers, tender requests, discounts, pharmacy partnerships, purchase orders, and delivery tracking." items={["Register suppliers and pharmacy partners", "Create tender requests", "Compare supplier offers", "Track purchase orders", "Monitor deliveries and fulfillment"]} next="Procurement should come after budget review, because approved demand defines what needs to be sourced." />;
}

export function NgoPartnersPage() {
  return <NgoSectionPage title="Partners" badge="NGO Partnerships" icon={Handshake} description="Manage local pharmacies, pharmaceutical companies, suppliers, donors, and support partners." items={["Register partner organizations", "Record discount or donation terms", "Track assigned fulfillment tasks", "Monitor partner performance", "Prepare partnership reports"]} next="Keep partner access limited to assigned tenders or fulfillment tasks when partner portals are added." />;
}

export function NgoImpactPage() {
  return <NgoSectionPage title="Impact Reporting" badge="NGO Public Health" icon={BarChart3} description="Review treatment months funded, disease categories, budget use, and transparent health-impact assumptions." items={["Beneficiaries supported by disease", "Treatment months funded", "Cost per beneficiary", "Support continuity indicators", "Donor-facing reports with assumptions"]} next="Impact reporting should be transparent and conservative. Every estimate should show its assumptions." />;
}
