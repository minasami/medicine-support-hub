import { Link, useLocation } from "wouter";
import { ArrowRight, Building2, FlaskConical, Globe2, HeartHandshake, LockKeyhole, Network, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGES = {
  "/vision": {
    eyebrow: "Vision",
    title: "Trusted digital infrastructure for medicine access.",
    intro: "Medicine Support Hub is being built to help organizations coordinate medicine assistance with greater speed, transparency, accountability, and measurable impact.",
    sections: [
      ["The future we are building", "A connected ecosystem where patients, NGOs, healthcare teams, pharmacies, suppliers, donors, pharmaceutical companies, and public-sector programs can work through secure and interoperable workflows."],
      ["Our mission", "Provide a scalable platform for beneficiary enrollment, review, budgeting, procurement, fulfillment, reporting, and continuous improvement."],
      ["Our north star", "Help organizations deliver more timely, transparent, and effective medicine support."],
    ],
  },
  "/platform": {
    eyebrow: "Platform",
    title: "One operating platform from request to impact.",
    intro: "The platform connects organization management, programs, beneficiaries, requests, clinical review, pharmacy operations, procurement, budgets, partnerships, analytics, and responsible AI.",
    sections: [
      ["Organization Workspace", "A digital headquarters for each organization, including teams, programs, settings, budgets, partners, and reports."],
      ["Program Management", "Configure eligibility, timelines, budgets, medicines, partners, workflows, and KPIs for each medicine support program."],
      ["Beneficiary CRM", "Maintain a longitudinal, role-appropriate record of beneficiaries, requests, documents, conditions, medicines, and outcomes."],
    ],
  },
  "/solutions": {
    eyebrow: "Solutions",
    title: "Designed for the medicine access ecosystem.",
    intro: "Medicine Support Hub supports organizations with different responsibilities while preserving clear data boundaries and accountable workflows.",
    sections: [
      ["NGOs and foundations", "Manage beneficiaries, medicine programs, reviews, budgets, procurement, pharmacy partners, and donor reporting."],
      ["Pharmacies and providers", "Coordinate verification, dispensing, fulfillment, treatment continuity, and operational reporting."],
      ["Pharmaceutical companies and donors", "Support patient programs, medicine donations, partnerships, funding visibility, and evidence-informed impact reporting."],
    ],
  },
  "/security": {
    eyebrow: "Security",
    title: "Trust is a platform capability.",
    intro: "Medicine Support Hub is being designed around authentication, role-based access, organization scoping, row-level security, auditability, responsible data use, and human oversight.",
    sections: [
      ["Tenant isolation", "Organization-scoped records and database policies are intended to prevent inappropriate cross-organization access."],
      ["Least privilege", "Users receive access based on their role, organization membership, and operational responsibility."],
      ["Responsible AI", "High-impact recommendations should remain explainable, reviewable, auditable, and subject to appropriate human judgment."],
    ],
  },
  "/research": {
    eyebrow: "Research",
    title: "Building evidence, not only software.",
    intro: "The long-term research agenda focuses on medicine access, treatment continuity, procurement efficiency, health equity, digital health adoption, and transparent impact measurement.",
    sections: [
      ["Operational evidence", "Measure review time, fulfillment time, continuity, budget utilization, and procurement performance."],
      ["Public-health learning", "Explore disease burden, coverage, geographic equity, treatment months, and outcome indicators with clear assumptions."],
      ["Responsible collaboration", "Research use should follow appropriate privacy, ethics, governance, and de-identification requirements."],
    ],
  },
  "/contact": {
    eyebrow: "Contact",
    title: "Build better medicine access with us.",
    intro: "We welcome conversations with pilot organizations, healthcare professionals, NGOs, pharmacies, pharmaceutical companies, donors, researchers, and technology partners.",
    sections: [
      ["Pilot partnerships", "Help shape the product through a focused medicine assistance program pilot."],
      ["Research and public health", "Collaborate on evidence, measurement frameworks, workflows, and responsible data use."],
      ["Technology and implementation", "Contribute to architecture, security, interoperability, product design, and deployment."],
    ],
  },
} as const;

const icons = [Building2, Network, ShieldCheck];

export default function PublicInfoPage() {
  const [location] = useLocation();
  const page = PAGES[location as keyof typeof PAGES] ?? PAGES["/platform"];
  return (
    <main className="bg-white text-slate-900">
      <section className="border-b bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-blue-700"><Globe2 className="h-4 w-4" />{page.eyebrow}</div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">{page.title}</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">{page.intro}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700"><Link href="/ngo">Explore NGO platform <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/manifesto">Read the manifesto</Link></Button>
          </div>
        </div>
      </section>
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {page.sections.map(([title, body], index) => {
            const Icon = icons[index] ?? HeartHandshake;
            return <article key={title} className="rounded-2xl border p-6 shadow-sm"><Icon className="h-7 w-7 text-blue-600" /><h2 className="mt-4 text-xl font-bold">{title}</h2><p className="mt-3 leading-7 text-slate-600">{body}</p></article>;
          })}
        </div>
      </section>
      <section className="border-y bg-slate-50 px-4 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div><div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 md:justify-start"><LockKeyhole className="h-4 w-4" />Secure, accountable, and partnership-driven</div><h2 className="mt-2 text-2xl font-bold">Medicine access is a systems challenge. We are building a systems platform.</h2></div>
          <Button asChild size="lg"><Link href="/contact">Start a conversation</Link></Button>
        </div>
      </section>
    </main>
  );
}
