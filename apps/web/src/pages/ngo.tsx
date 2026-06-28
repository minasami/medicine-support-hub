import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Users, ClipboardCheck, Wallet, ShoppingCart, BarChart3, Building2, Pill, ArrowRight } from "lucide-react";

const MODULES = [
  {
    title: "Beneficiary Registry",
    description: "Manage beneficiary profiles, chronic conditions, prescriptions, eligibility notes, and support history.",
    icon: Users,
  },
  {
    title: "Request Review",
    description: "Receive chronic medicine support requests and route them through eligibility, medical, and budget review.",
    icon: ClipboardCheck,
  },
  {
    title: "Medicine Alternatives",
    description: "Compare brands and generics by active ingredient, strength, dosage form, availability, and cost.",
    icon: Pill,
  },
  {
    title: "Budget Control",
    description: "Assign project budgets, beneficiary budgets, committed monthly costs, and remaining balance alerts.",
    icon: Wallet,
  },
  {
    title: "Procurement",
    description: "Handle supplier tenders, discount offers, purchase orders, deliveries, and pharmacy partnerships.",
    icon: ShoppingCart,
  },
  {
    title: "Impact Reporting",
    description: "Track treatment months funded, disease categories, donor reports, and public-health impact assumptions.",
    icon: BarChart3,
  },
];

const WORKFLOW = ["Beneficiary", "Request", "Medical Review", "Budget Review", "Procurement", "Delivery", "Impact"];

export default function NgoPortal() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-slate-50">
      <section className="bg-gradient-to-br from-emerald-700 via-teal-700 to-sky-700 px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
            <HeartHandshake className="h-4 w-4" /> NGO Chronic Medicine Support
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                Manage medicine support programs with clinical, financial, and public-health discipline.
              </h1>
              <p className="mt-5 max-w-3xl text-lg text-emerald-50">
                A dedicated workspace for NGOs to manage beneficiaries, chronic medicine requests, alternatives, budgets, procurement, partnerships, and impact reporting.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50" onClick={() => navigate("/ngo/dashboard")}>
                  Open NGO Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10" onClick={() => navigate("/portal")}>
                  NGO Staff Sign In
                </Button>
              </div>
            </div>
            <Card className="border-white/20 bg-white/10 text-white shadow-2xl backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Program Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/10 p-4"><div className="text-2xl font-bold">0</div><div className="text-sm text-emerald-50">Beneficiaries</div></div>
                  <div className="rounded-xl bg-white/10 p-4"><div className="text-2xl font-bold">0</div><div className="text-sm text-emerald-50">Pending requests</div></div>
                  <div className="rounded-xl bg-white/10 p-4"><div className="text-2xl font-bold">0 EGP</div><div className="text-sm text-emerald-50">Committed budget</div></div>
                  <div className="rounded-xl bg-white/10 p-4"><div className="text-2xl font-bold">0</div><div className="text-sm text-emerald-50">Treatment months</div></div>
                </div>
                <p className="text-sm text-emerald-50">Live numbers will appear after the NGO database module is activated.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Phase 1 MVP</Badge>
            <h2 className="text-3xl font-bold text-slate-900">Start with the core operating workflow</h2>
            <p className="mt-2 max-w-3xl text-slate-500">The first version should focus on beneficiaries, requests, review decisions, and budget visibility before advanced tenders and impact modeling.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-7">
            {WORKFLOW.map((step, index) => (
              <div key={step} className="rounded-xl border bg-white p-4 text-center shadow-sm">
                <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{index + 1}</div>
                <div className="text-sm font-semibold text-slate-800">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <Card key={module.title} className="border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <module.icon className="h-5 w-5" />
                </div>
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-500">{module.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
