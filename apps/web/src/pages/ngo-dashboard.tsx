import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, ClipboardList, Pill, ShoppingCart, Users, Wallet } from "lucide-react";

const stats = [
  { label: "Beneficiaries", value: "0", icon: Users },
  { label: "Pending requests", value: "0", icon: ClipboardList },
  { label: "Monthly committed", value: "0 EGP", icon: Wallet },
  { label: "Procurement items", value: "0", icon: ShoppingCart },
];

const nextModules = [
  "Create NGO workspace table and membership roles",
  "Add beneficiary registry and profiles",
  "Add NGO chronic medicine request workflow",
  "Add budget allocation and request cost review",
  "Add medicine alternative comparison by active ingredient",
  "Add procurement, tenders, and partner pharmacy workflows",
];

export default function NgoDashboard() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">NGO Module</Badge>
          <h1 className="text-3xl font-bold">NGO Chronic Medicine Support Dashboard</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            This dashboard will become the NGO command center for beneficiaries, requests, budgets, procurement, partnerships, and impact reporting.
          </p>
        </div>
        <Button variant="outline">Configure workspace</Button>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Phase 1 workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {["Beneficiary intake", "Medicine request", "Medical review", "Cost and budget review", "Approval", "Fulfillment tracking"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{index + 1}</div>
                  <div className="font-medium">{step}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Build roadmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nextModules.map((item) => (
                <div key={item} className="flex gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <div className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />
                  <div>{item}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> Alternatives</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Future active-ingredient and cheaper-equivalent comparison.</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Budgets</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Future total budget, committed spend, and beneficiary allocation tracking.</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Procurement</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Future supplier tenders, discounts, purchase orders, and partner pharmacies.</CardContent></Card>
      </div>
    </div>
  );
}
