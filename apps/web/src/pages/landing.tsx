import { FormEvent, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  HeartHandshake,
  Pill,
  Scan,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";

const POPULAR = [
  { q: "Panadol", ar: "بنادول" },
  { q: "Augmentin", ar: "أوجمنتين" },
  { q: "Concor", ar: "كونكور" },
  { q: "Insulin", ar: "أنسولين" },
  { q: "Vitamin D", ar: "فيتامين د" },
  { q: "Amoxicillin", ar: "أموكسيسيلين" },
];

export default function Landing() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");

  function goSearch(e?: FormEvent, override?: string) {
    e?.preventDefault();
    const term = (override ?? q).trim();
    if (!term) {
      navigate("/medicines");
      return;
    }
    navigate(`/medicines?q=${encodeURIComponent(term)}#q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-emerald-50/80 via-background to-background dark:from-emerald-950/30 px-4 py-14 md:py-20">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t(
              "Egyptian medicines · Official prices · Barcode lookup",
              "أدوية مصر · أسعار رسمية · بحث بالباركود",
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.15]">
            {t(
              "Find any medicine in Egypt — fast, clear, and free.",
              "ابحث عن أي دواء في مصر — بسرعة ووضوح وبالمجان.",
            )}
          </h1>

          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg leading-relaxed">
            {t(
              "Search trade names, active ingredients, barcodes, and manufacturers. Compare official prices. Scan packaging. Companies and NGOs can contribute verified data.",
              "ابحث بالاسم التجاري أو المادة الفعالة أو الباركود أو الشركة. قارن الأسعار الرسمية. امسح العبوة. يمكن للشركات والجمعيات المساهمة ببيانات موثقة.",
            )}
          </p>

          <form
            onSubmit={(e) => goSearch(e)}
            className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t(
                  "Search medicine, INN, company, or barcode…",
                  "ابحث باسم الدواء أو المادة الفعالة أو الشركة أو الباركود…",
                )}
                className="h-12 rounded-xl border-emerald-500/25 pl-10 text-base shadow-sm"
                autoComplete="off"
                enterKeyHint="search"
                aria-label={t("Search medicines", "البحث عن الأدوية")}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-xl bg-emerald-600 px-6 hover:bg-emerald-700"
            >
              {t("Search", "بحث")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("Popular:", "شائع:")}
            </span>
            {POPULAR.map((p) => (
              <button
                key={p.q}
                type="button"
                onClick={() => goSearch(undefined, p.q)}
                className="rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
              >
                {language === "ar" ? p.ar : p.q}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              className="h-11 gap-2 rounded-xl border-emerald-500/30"
              onClick={() => navigate("/scan")}
            >
              <Scan className="h-4 w-4" />
              {t("Scan barcode", "مسح الباركود")}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-11 rounded-xl"
              onClick={() => navigate("/industry")}
            >
              {t("Company / industry portal", "بوابة الشركات والصناعة")}
            </Button>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b bg-emerald-950 text-emerald-50 px-4 py-6">
        <div className="mx-auto grid max-w-5xl gap-4 text-center sm:grid-cols-3">
          <div>
            <div className="text-2xl font-bold">80,000+</div>
            <div className="text-sm text-emerald-200/90">
              {t("Indexed products", "مستحضرات مفهرسة")}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">EN · AR</div>
            <div className="text-sm text-emerald-200/90">
              {t("Bilingual search & names", "بحث وأسماء بالعربية والإنجليزية")}
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {t("Free", "مجاني")}
            </div>
            <div className="text-sm text-emerald-200/90">
              {t("Public encyclopedia · no account required", "موسوعة عامة · بدون حساب")}
            </div>
          </div>
        </div>
      </section>

      {/* Paths */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("Built for every role in the care chain", "مصممة لكل دور في سلسلة الرعاية")}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm md:text-base">
              {t(
                "One platform — different doors. Pick the path that matches what you need today.",
                "منصة واحدة — مداخل مختلفة. اختر المسار الذي يناسب احتياجك اليوم.",
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Pill,
                title: t("Patients & families", "المرضى والعائلات"),
                copy: t(
                  "Look up prices, ingredients, and alternatives. Scan the box in your hand.",
                  "اعرف السعر والمادة الفعالة والبدائل. امسح العبوة التي معك.",
                ),
                href: "/medicines",
                cta: t("Open encyclopedia", "افتح الموسوعة"),
              },
              {
                icon: Stethoscope,
                title: t("Pharmacists & clinicians", "الصيادلة والأطباء"),
                copy: t(
                  "Fast monograph lookup, therapeutic class filters, and barcode identification.",
                  "بحث سريع في السجلات، فلاتر الفئات العلاجية، والتعرّف بالباركود.",
                ),
                href: "/scan",
                cta: t("Scan or search", "امسح أو ابحث"),
              },
              {
                icon: Building2,
                title: t("Pharma companies", "شركات الأدوية"),
                copy: t(
                  "Claim your profile, publish portfolio updates, and keep public data accurate.",
                  "اطلب ملف شركتك، انشر تحديثات المحفظة، وحافظ على دقة البيانات العامة.",
                ),
                href: "/industry",
                cta: t("Industry portal", "بوابة الصناعة"),
              },
              {
                icon: HeartHandshake,
                title: t("NGOs & foundations", "الجمعيات والمؤسسات"),
                copy: t(
                  "Coordinate medicine access, donation exchange, and beneficiary support workflows.",
                  "نسّق إتاحة الدواء، تبادل التبرعات، ومسارات دعم المستفيدين.",
                ),
                href: "/ngos",
                cta: t("NGO network", "شبكة الجمعيات"),
              },
            ].map((card) => (
              <Link
                key={card.href + card.title}
                href={card.href}
                className="group flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-base">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground leading-relaxed">
                  {card.copy}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300 group-hover:gap-2 transition-all">
                  {card.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-muted/30 px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            {t("Three steps to the right product", "ثلاث خطوات للمستحضر الصحيح")}
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "1",
                title: t("Search or scan", "ابحث أو امسح"),
                body: t(
                  "Type a trade name, active ingredient, or company — or open the camera barcode scanner.",
                  "اكتب الاسم التجاري أو المادة الفعالة أو الشركة — أو افتح ماسح الباركود.",
                ),
              },
              {
                n: "2",
                title: t("Review the card", "راجع البطاقة"),
                body: t(
                  "See official price, manufacturer, strength, form, and verified flags at a glance.",
                  "اطّلع فوراً على السعر الرسمي والشركة والتركيز والشكل الدوائي وعلامات التوثيق.",
                ),
              },
              {
                n: "3",
                title: t("Open the monograph", "افتح السجل التفصيلي"),
                body: t(
                  "Go deeper into composition, class, and related products — then share or request support.",
                  "تعمّق في التركيب والفئة والمستحضرات ذات الصلة — ثم شارك أو اطلب الدعم.",
                ),
              },
            ].map((s) => (
              <li key={s.n} className="rounded-2xl border bg-card p-5 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why trust */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-5xl grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">
              {t("Designed for clarity and accountability", "مصممة للوضوح والمساءلة")}
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                t(
                  "Public catalog first — no login required to search or scan.",
                  "الموسوعة العامة أولاً — لا يلزم تسجيل الدخول للبحث أو المسح.",
                ),
                t(
                  "Company representatives can claim profiles and keep portfolios current after admin verification.",
                  "يمكن لممثلي الشركات طلب الملفات وتحديث المحافظ بعد التحقق الإداري.",
                ),
                t(
                  "NGO donation exchange and support workflows sit beside the same product identity.",
                  "تبادل تبرعات الجمعيات ومسارات الدعم بجانب نفس هوية المستحضر.",
                ),
                t(
                  "Clinical decisions stay with qualified professionals — this is information and coordination infrastructure.",
                  "القرارات السريرية تبقى بيد المتخصصين — هذه بنية معلومات وتنسيق.",
                ),
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <Users className="h-4 w-4" />
              {t("Start where you are", "ابدأ من حيث أنت")}
            </div>
            <div className="grid gap-2">
              <Button
                className="justify-between h-11 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => navigate("/medicines")}
              >
                {t("Medicines encyclopedia", "موسوعة الأدوية")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between h-11" onClick={() => navigate("/scan")}>
                {t("Barcode scanner", "ماسح الباركود")}
                <Scan className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="justify-between h-11" onClick={() => navigate("/request")}>
                {t("Request medicine support", "طلب دعم دوائي")}
                <HeartHandshake className="h-4 w-4" />
              </Button>
              <Button variant="ghost" className="justify-between h-11" onClick={() => navigate("/industry")}>
                {t("Contribute as industry", "ساهم كقطاع صناعي")}
                <Building2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-muted/20 px-4 py-8 text-center text-xs text-muted-foreground">
        <p>
          {t(
            "Medicine Support Hub — independent public information & coordination platform for Egyptian medicines access.",
            "منصة دعم الدواء — منصة أهلية مستقلة للمعلومات وتنسيق إتاحة الأدوية في مصر.",
          )}
        </p>
      </footer>
    </div>
  );
}
