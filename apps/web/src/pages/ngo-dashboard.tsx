import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, ClipboardList, Handshake, Pill, ShoppingCart, Users, Wallet } from "lucide-react";

const stats = [
  { label: "Beneficiaries", value: "0", icon: Users },
  { label: "Pending requests", value: "0", icon: ClipboardList },
  { label: "Monthly committed", value: "0 EGP", icon: Wallet },
  { label: "Procurement items", value: "0", icon: ShoppingCart },
];

const modules = [
  { label: "Beneficiaries", href: "/ngo/beneficiaries", icon: Users, description: "Profiles, eligibility, conditions, prescriptions, and support history." },
  { label: "Requests", href: "/ngo/requests", icon: ClipboardList, description: "Request intake, medical review, budget review, and approval workflow." },
  { label: "Budgets", href: "/ngo/budgets", icon: Wallet, description: "Project budget, beneficiary allocations, committed spend, and alerts." },
  { label: "Alternatives", href: "/ngo/alternatives", icon: Pill, description: "Generic/brand alternatives by active ingredient and cost." },
  { label: "Procurement", href: "/ngo/procurement", icon: ShoppingCart, description: "Suppliers, tenders, discounts, purchase orders, and deliveries." },
  { label: "Partners", href: "/ngo/partners", icon: Handshake, description: "Pharmacies, pharmaceutical companies, suppliers, and donors." },
  { label: "Impact", href: "/ngo/impact", icon: BarChart3, description: "Treatment months, disease mix, cost indicators, and donor reports." },
];

export default function NgoDashboard() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">NGO Module</Badge>
          <h1 className="text-3xl font-bold">NGO Chronic Medicine Support Dashboard</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Command center for beneficiaries, requests, budgets, alternatives, procurement, partnerships, and impact reporting.
          </p>
        </div>
        <Button asChild variant="outline"><Link href="/ngo">NGO landing</Link></Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.href} className="transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><module.icon className="h-5 w-5 text-emerald-700" /> {module.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{module.description}</p>
              <Button asChild size="sm" variant="secondary"><Link href={module.href}>Open module</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Phase 1 workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {["Beneficiary intake", "Medicine request", "Medical review", "Cost and budget review", "Approval", "Fulfillment tracking"].map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{index + 1}</div>
                <div className="font-medium">{step}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
