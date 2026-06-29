import { Link } from "wouter";
import { ArrowRight, CheckCircle2, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const beliefs = [
  "Healthcare improves when organizations collaborate rather than operate in isolation.",
  "Transparency strengthens trust across approvals, budgets, procurement, and impact reporting.",
  "Evidence should guide decisions and continuous improvement.",
  "Artificial intelligence should support professionals—not replace accountable human judgment.",
  "Data should serve patients while respecting privacy, security, and human dignity.",
  "Organizations should spend less time managing fragmented administration and more time improving lives.",
];

const principles = [
  ["Patient first", "Every decision begins with whether it improves the experience and outcomes of the people ultimately served."],
  ["Evidence before assumptions", "We value measurable outcomes, transparent methods, and continuous learning."],
  ["Interoperability over isolation", "Thoughtful integration and open standards create stronger healthcare ecosystems."],
  ["Transparency builds trust", "Approvals, budgets, procurement, AI recommendations, and impact metrics should be understandable and traceable."],
  ["Scale through partnership", "Medicine access requires collaboration among NGOs, providers, pharmacies, donors, governments, researchers, and technology partners."],
  ["Responsible intelligence", "High-impact recommendations must remain reviewable, auditable, and subject to appropriate human oversight."],
];

export default function Manifesto() {
  return (
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-24">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, #2563eb22 0%, transparent 35%), radial-gradient(circle at 85% 75%, #10b98122 0%, transparent 35%)" }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700">
            <Sparkles className="h-4 w-4" /> Medicine Support Hub Manifesto
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">Medicine access deserves better digital infrastructure.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
            We are building a trusted digital health platform that helps organizations coordinate medicine support, strengthen clinical and operational workflows, use resources responsibly, and measure impact.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700"><Link href="/ngo">Explore the platform <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/">Return home</Link></Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Why we exist</p>
            <h2 className="mt-3 text-3xl font-bold">A systems challenge needs a connected response.</h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-slate-600">
            <p>Millions of people know which medicines they need but cannot be certain they will obtain them. Cost, availability, fragmented processes, disconnected systems, and administrative complexity can interrupt treatment.</p>
            <p>At the same time, NGOs, hospitals, pharmacies, pharmaceutical companies, donors, governments, and researchers work hard to improve access—often with limited visibility across the full journey.</p>
            <p>Medicine Support Hub exists to reduce that fragmentation and help organizations coordinate medicine assistance from request to review, budget, procurement, fulfillment, and impact.</p>
          </div>
        </div>
      </section>

      <section className="border-y bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">What we believe</p>
            <h2 className="mt-3 text-3xl font-bold">Technology should strengthen healthcare systems—not complicate them.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {beliefs.map((belief) => (
              <div key={belief} className="flex gap-3 rounded-2xl border bg-white p-5 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="leading-7 text-slate-700">{belief}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Our principles</p>
            <h2 className="mt-3 text-3xl font-bold">The commitments guiding the platform.</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {principles.map(([title, description]) => (
              <article key={title} className="rounded-2xl border p-6 shadow-sm">
                <ShieldCheck className="h-7 w-7 text-blue-600" />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 px-4 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <HeartHandshake className="mx-auto h-10 w-10" />
          <h2 className="mt-5 text-3xl font-bold">An invitation to build better medicine access together.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-blue-100">
            We invite healthcare professionals, NGOs, pharmacies, pharmaceutical companies, donors, governments, researchers, and technology partners to help shape infrastructure that is secure, transparent, interoperable, evidence-informed, and designed around the people it serves.
          </p>
          <blockquote className="mx-auto mt-10 max-w-3xl border-l-4 border-white/50 pl-6 text-left text-2xl font-semibold leading-9">
            “We are not building software alone. We are building digital infrastructure that helps organizations deliver medicines—and hope—to the people who need them most.”
          </blockquote>
        </div>
      </section>
    </main>
  );
}
