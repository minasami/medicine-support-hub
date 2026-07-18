import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const colors = [
  ["Infrastructure Navy", "#0B1F33"],
  ["Health Blue", "#0EA5E9"],
  ["Access Green", "#10B981"],
  ["Slate", "#3C5268"],
  ["Cloud", "#F5F9FC"],
  ["White", "#FFFFFF"],
];

export default function BrandPage() {
  return (
    <main className="bg-white text-slate-900">
      <section className="border-b bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-cyan-700">
              <Sparkles className="h-4 w-4" />
              Visual identity
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              A connected identity for medicine access.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              The Medicine Support Hub identity combines people, a protective
              hand, a medical cross, and a heart to represent connected,
              compassionate infrastructure linking organizations around the
              people they serve.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Link href="/platform">
                  Explore the platform <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/medicine-support-hub-logo.png" download>
                  Download platform logo
                </a>
              </Button>
            </div>
          </div>
          <div className="rounded-[2rem] border bg-white p-8 shadow-xl shadow-slate-200/60">
            <img
              src="/medicine-support-hub-logo.png"
              alt="Medicine Support Hub logo mark"
              className="mx-auto w-64 max-w-full"
            />
            <div className="mt-6 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0B1F33]">
                Medicine Support Hub
              </h2>
              <p className="mt-2 text-sm font-medium text-cyan-700">
                Digital Health Infrastructure for Medicine Access
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Logo system
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              Flexible across product, social, and enterprise use.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border p-6 lg:col-span-2">
              <img
                src="/medicine-support-hub-logo.png"
                alt="Medicine Support Hub platform logo"
                className="mx-auto w-72 max-w-full"
              />
            </div>
            <div className="rounded-2xl border bg-[#0B1F33] p-8">
              <img
                src="/medicine-support-hub-logo.png"
                alt="Medicine Support Hub icon"
                className="mx-auto w-48 rounded-2xl bg-white"
              />
              <p className="mt-5 text-center text-sm font-medium text-white">
                Icon and dark-background usage
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Color palette
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                Built for trust, clarity, and momentum.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Navy provides stability, blue communicates technology and
                healthcare, while green signals access, progress, and positive
                impact.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {colors.map(([name, hex]) => (
                <div
                  key={hex}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <div
                    className="h-24 rounded-xl border"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="mt-3 font-semibold">{name}</div>
                  <code className="text-sm text-slate-500">{hex}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <article className="rounded-2xl border p-6">
            <Network className="h-7 w-7 text-cyan-600" />
            <h3 className="mt-4 text-xl font-bold">Connected network</h3>
            <p className="mt-3 leading-7 text-slate-600">
              The surrounding nodes represent NGOs, healthcare teams,
              pharmacies, partners, donors, and public-health programs working
              through one coordinated hub.
            </p>
          </article>
          <article className="rounded-2xl border p-6">
            <ShieldCheck className="h-7 w-7 text-cyan-600" />
            <h3 className="mt-4 text-xl font-bold">Trust and security</h3>
            <p className="mt-3 leading-7 text-slate-600">
              The stable form and navy foundation support a credible enterprise
              identity suitable for sensitive healthcare operations.
            </p>
          </article>
          <article className="rounded-2xl border p-6">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            <h3 className="mt-4 text-xl font-bold">Medicine access</h3>
            <p className="mt-3 leading-7 text-slate-600">
              The capsule and cross keep the platform’s purpose visible: helping
              organizations coordinate medicine support effectively.
            </p>
          </article>
        </div>
      </section>

      <section className="bg-[#0B1F33] px-4 py-16 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Brand statement
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              One operating platform from medicine request to measurable impact.
            </h2>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">Partner with us</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
