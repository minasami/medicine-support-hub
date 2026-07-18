import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileCheck2,
  HeartHandshake,
  Layers3,
  Mail,
  MapPin,
  Network,
  PackageCheck,
  Phone,
  Pill,
  Radar,
  Route,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Truck,
  Users,
  Workflow,
} from "lucide-react";

const BUILT = [
  {
    icon: ShieldCheck,
    title: "Platform Administration",
    description:
      "Organization, role, membership, and enterprise-data visibility for platform operations.",
  },
  {
    icon: Building2,
    title: "Enterprise Workspace",
    description:
      "Organization-scoped programs, beneficiaries, budgets, and operational records.",
  },
  {
    icon: Layers3,
    title: "Program Management",
    description:
      "Objectives, KPIs, dates, status, target beneficiaries, budgets, spend, milestones, and activity.",
  },
  {
    icon: Users,
    title: "Beneficiary 360°",
    description:
      "Editable beneficiary records, program assignment, consent, risk, status, and longitudinal support history.",
  },
  {
    icon: ClipboardList,
    title: "Support Request Workflow",
    description:
      "Structured intake through eligibility, medical review, cost review, approval, procurement, dispensing, and delivery.",
  },
  {
    icon: ClipboardCheck,
    title: "Request 360°",
    description:
      "Decision notes, approved cost, reviewer context, workflow status, and audit timeline.",
  },
  {
    icon: BarChart3,
    title: "Impact Reporting",
    description:
      "Beneficiaries, treatment months, request pipeline, approved support value, and budget utilization.",
  },
  {
    icon: Database,
    title: "Secure Data Foundation",
    description:
      "Supabase-backed data with organization relationships, audit events, indexes, and row-level security.",
  },
];

const ROADMAP = [
  {
    icon: ShoppingCart,
    title: "Procurement & sourcing",
    description:
      "Supplier registry, tenders, offers, purchase orders, discounts, and fulfillment coordination.",
  },
  {
    icon: Pill,
    title: "Medicine alternatives",
    description:
      "Active-ingredient, strength, dosage-form, availability, and cost comparison with clinical approval.",
  },
  {
    icon: HeartHandshake,
    title: "Partner network",
    description:
      "Pharmacies, pharmaceutical companies, donors, NGOs, suppliers, and assigned partner workflows.",
  },
  {
    icon: FileCheck2,
    title: "Documents & evidence",
    description:
      "Prescription, eligibility, invoice, delivery, and approval document workflows.",
  },
  {
    icon: Radar,
    title: "Notifications & service levels",
    description:
      "Reminders, escalations, turnaround-time tracking, and operational exception alerts.",
  },
  {
    icon: Activity,
    title: "Advanced analytics",
    description:
      "Continuity indicators, cost per beneficiary, disease-area reporting, forecasting, and transparent assumptions.",
  },
  {
    icon: Network,
    title: "Integrations",
    description:
      "Forms, email, pharmacy systems, ERP, CRM, reporting, and partner-data connections.",
  },
  {
    icon: Route,
    title: "Pilot rollout",
    description:
      "Controlled onboarding, governance, measurement, feedback, and phased expansion with partner organizations.",
  },
];

const WORKFLOW_STEPS = [
  ["01", "Enroll", "Create the beneficiary record and program context."],
  [
    "02",
    "Request",
    "Capture medicine needs, clinical notes, duration, cost, and priority.",
  ],
  ["03", "Review", "Run eligibility, medical, cost, and governance checks."],
  [
    "04",
    "Approve",
    "Record the decision, approved support, and accountable audit trail.",
  ],
  ["05", "Fulfil", "Coordinate sourcing, dispensing, delivery, and closure."],
  [
    "06",
    "Measure",
    "Track operational performance, treatment months, budgets, and impact indicators.",
  ],
];

const AUDIENCES = [
  {
    icon: Building2,
    title: "NGOs & foundations",
    copy: "Operate medicine-access programs with consistent workflows and transparent records.",
  },
  {
    icon: Stethoscope,
    title: "Clinical reviewers",
    copy: "Review medicine support safely without replacing professional judgment.",
  },
  {
    icon: PackageCheck,
    title: "Pharmacies & suppliers",
    copy: "Receive clear demand, fulfillment tasks, and traceable operational context.",
  },
  {
    icon: CircleDollarSign,
    title: "Donors & sponsors",
    copy: "Understand where funds are committed and what operational support was delivered.",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-white text-[#0B1F33]">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#F5F9FC] px-4 py-20 md:py-28">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(14,165,233,.13), transparent 30%), radial-gradient(circle at 85% 25%, rgba(16,185,129,.12), transparent 30%), linear-gradient(rgba(11,31,51,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,31,51,.035) 1px, transparent 1px)",
            backgroundSize: "auto, auto, 36px 36px, 36px 36px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
          <div>
            <img
              src="/medicine-support-hub-logo.png"
              alt="Medicine Support Hub"
              className="mb-8 h-16 w-16 rounded-2xl border bg-white object-cover shadow-sm"
            />
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-[#0EA5E9] shadow-sm">
              <Network className="h-4 w-4" />
              Digital Health Infrastructure for Medicine Access
            </div>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
              One operating platform from{" "}
              <span className="text-[#0EA5E9]">medicine request</span> to{" "}
              <span className="text-[#10B981]">measurable impact.</span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#3C5268] md:text-xl">
              Medicine Support Hub helps organizations coordinate beneficiaries,
              programs, medicine requests, clinical and cost reviews, approvals,
              fulfillment, budgets, and impact records in one accountable
              workflow.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 bg-[#0EA5E9] px-7 hover:bg-sky-600"
                onClick={() => navigate("/portal")}
              >
                Open Platform Portal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-[#0B1F33]/20 px-7"
                onClick={() => navigate("/ngo")}
              >
                Explore NGO Solution
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-5 text-[#0B1F33]"
                onClick={() => navigate("/brand")}
              >
                View Identity Kit
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#3C5268]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                Enterprise workspace live
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                Supabase RLS foundation
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" />
                Vercel cloud deployment
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-sky-200/60 to-emerald-200/50 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-300/40 md:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.2em] text-[#0EA5E9]">
                    Platform overview
                  </div>
                  <div className="mt-1 text-xl font-bold">
                    Connected medicine support operations
                  </div>
                </div>
                <div className="rounded-2xl bg-[#0B1F33] p-3">
                  <img
                    src="/medicine-support-hub-logo.png"
                    alt=""
                    className="h-8 w-8 rounded-lg bg-white object-cover"
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: Users,
                    label: "Beneficiary 360°",
                    value: "Profile + timeline",
                  },
                  { icon: Layers3, label: "Programs", value: "Budget + KPIs" },
                  {
                    icon: Workflow,
                    label: "Requests",
                    value: "Review + fulfillment",
                  },
                  {
                    icon: BarChart3,
                    label: "Impact",
                    value: "Operational metrics",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-[#F5F9FC] p-4"
                  >
                    <item.icon className="h-5 w-5 text-[#0EA5E9]" />
                    <div className="mt-3 font-semibold">{item.label}</div>
                    <div className="mt-1 text-xs text-[#3C5268]">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-[#0B1F33] p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                  <Sparkles className="h-4 w-4" />
                  Built for accountable coordination
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold">RLS</div>
                    <div className="text-[11px] text-slate-300">
                      Scoped access
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">360°</div>
                    <div className="text-[11px] text-slate-300">
                      Full context
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">Audit</div>
                    <div className="text-[11px] text-slate-300">
                      Traceable events
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1F33] px-4 py-8 text-white">
        <div className="mx-auto grid max-w-7xl gap-5 text-center sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["8", "Core enterprise modules"],
            ["360°", "Beneficiary and request context"],
            ["RLS", "Organization-scoped security"],
            ["Live", "Cloud preview and production pipeline"],
          ].map((item) => (
            <div
              key={item[1]}
              className="rounded-xl border border-white/10 px-4 py-3"
            >
              <div className="text-2xl font-bold text-sky-300">{item[0]}</div>
              <div className="mt-1 text-sm text-slate-300">{item[1]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[#0EA5E9]">
              What is live now
            </div>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              A working enterprise foundation, not just a concept.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#3C5268]">
              The current platform connects administration, programs,
              beneficiaries, support requests, review decisions, and impact
              records through a shared Supabase data foundation.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {BUILT.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50">
                  <item.icon className="h-5 w-5 text-[#0EA5E9]" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3C5268]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#F5F9FC] px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[#0EA5E9]">
              End-to-end workflow
            </div>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              One connected operating model
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#3C5268]">
              Each step keeps the beneficiary, organization, program, request,
              decision, and fulfillment context connected.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {WORKFLOW_STEPS.map((step, index) => (
              <div
                key={step[0]}
                className="relative rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="text-sm font-bold text-[#0EA5E9]">
                  {step[0]}
                </div>
                <h3 className="mt-3 font-semibold">{step[1]}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3C5268]">
                  {step[2]}
                </p>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-white text-slate-300 xl:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <div className="text-xs font-bold uppercase tracking-[.22em] text-[#10B981]">
                Future plan
              </div>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Build the full medicine-access network in deliberate phases.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[#3C5268]">
                The next phase focuses on fulfillment infrastructure, partner
                participation, evidence workflows, automation, analytics, and a
                controlled real-world pilot.
              </p>
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <ShieldCheck className="h-5 w-5" />
                  Responsible expansion
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-900/75">
                  Clinical decisions remain with qualified professionals.
                  External impact figures should be published only with reviewed
                  definitions and transparent assumptions.
                </p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {ROADMAP.map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                      <item.icon className="h-5 w-5 text-[#10B981]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Next {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#3C5268]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1F33] px-4 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.22em] text-sky-300">
                Trust by design
              </div>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Structured data, scoped access, visible decisions.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                The platform is being built around organization membership,
                role-aware access, row-level security, operational timelines,
                and explicit review records.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "Access control",
                  text: "Organization and platform-admin access follows authenticated Supabase policies.",
                },
                {
                  icon: Database,
                  title: "Connected records",
                  text: "Programs, beneficiaries, requests, events, and impact metrics share a relational foundation.",
                },
                {
                  icon: FileCheck2,
                  title: "Auditability",
                  text: "Status changes, review decisions, and beneficiary updates create visible operational history.",
                },
                {
                  icon: Truck,
                  title: "Operational continuity",
                  text: "The roadmap extends the same traceability into procurement, dispensing, and delivery.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <item.icon className="h-5 w-5 text-[#10B981]" />
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[.22em] text-[#0EA5E9]">
              Designed for collaboration
            </div>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Different partners, one shared operating picture.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((item) => (
              <div key={item.title} className="rounded-2xl bg-[#F5F9FC] p-6">
                <item.icon className="h-6 w-6 text-[#0EA5E9]" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#3C5268]">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0EA5E9] to-[#10B981] p-8 text-white shadow-xl md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[.2em] text-white/75">
                Medicine Support Hub
              </div>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                Help organizations deliver more timely, transparent, and
                effective medicine support.
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-white/85">
                Explore the working platform, review the visual identity, or
                discuss a controlled pilot with an NGO, foundation, pharmacy
                network, or healthcare partner.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-7 text-[#0B1F33]"
                onClick={() => navigate("/portal")}
              >
                Open Platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/40 bg-transparent px-7 text-white hover:bg-white/10"
                onClick={() => navigate("/contact")}
              >
                Discuss a Pilot
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#F5F9FC] px-4 py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-[#3C5268] md:flex-row md:items-center md:justify-between">
          <img
            src="/medicine-support-hub-logo.png"
            alt="Medicine Support Hub"
            className="h-10 w-10 rounded-xl border bg-white object-cover"
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              className="flex items-center gap-2 hover:text-[#0EA5E9]"
              href="mailto:jesussavedmina@gmail.com"
            >
              <Mail className="h-4 w-4" />
              jesussavedmina@gmail.com
            </a>
            <a
              className="flex items-center gap-2 hover:text-[#0EA5E9]"
              href="tel:+201284590503"
            >
              <Phone className="h-4 w-4" />
              +20 128 459 0503
            </a>
            <a
              className="flex items-center gap-2 hover:text-[#0EA5E9]"
              href="https://minasami.github.io/"
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-4 w-4" />
              Mina Samy Tawfik Saad
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
