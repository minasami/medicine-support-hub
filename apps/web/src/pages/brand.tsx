import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Network, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function BrandPage() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const colors = [
    [t("Infrastructure Navy", "كحلي البنية التحتية"), "#0B1F33"],
    [t("Health Blue", "أزرق الصحة"), "#0EA5E9"],
    [t("Access Green", "أخضر الوصول"), "#10B981"],
    [t("Slate", "رمادي"), "#3C5268"],
    [t("Cloud", "سحابي"), "#F5F9FC"],
    [t("White", "أبيض"), "#FFFFFF"],
  ];

  return (
    <main className="bg-white text-slate-900">
      <section className="border-b bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-cyan-700">
              <Sparkles className="h-4 w-4" />
              {t("Visual identity", "الهوية البصرية")}
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              {t(
                "A connected identity for medicine access.",
                "هوية مترابطة لتيسير الوصول إلى الدواء.",
              )}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {t(
                "The Medicine Support Hub identity combines a medicine capsule, healthcare cross, and connected network to represent trusted digital infrastructure linking organizations around the people they serve.",
                "تجمع هوية منصة دعم الدواء بين كبسولة الدواء وصليب الرعاية الصحية وشبكة مترابطة لتمثيل بنية رقمية موثوقة تربط المنظمات حول من تخدمهم.",
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/platform">
                  {t("Explore the platform", "استكشف المنصة")}
                  <ArrowRight className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/brand/logo-horizontal.svg" download>
                  {t("Download wordmark", "تحميل الشعار الكتابي")}
                </a>
              </Button>
            </div>
          </div>
          <div className="rounded-[2rem] border bg-white p-8 shadow-xl shadow-slate-200/60">
            <img
              src="/brand/logo-mark.svg"
              alt={t("Medicine Support Hub logo mark", "علامة شعار منصة دعم الدواء")}
              className="mx-auto w-64 max-w-full"
            />
            <div className="mt-6 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0B1F33]">
                {t("Medicine Support Hub", "منصة دعم الدواء")}
              </h2>
              <p className="mt-2 text-sm font-medium text-cyan-700">
                {t(
                  "Digital Health Infrastructure for Medicine Access",
                  "بنية رقمية صحية للوصول إلى الدواء",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              {t("Logo system", "نظام الشعار")}
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {t(
                "Flexible across product, social, and enterprise use.",
                "مرن للمنتج والتواصل والاستخدام المؤسسي.",
              )}
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border p-6 lg:col-span-2">
              <img
                src="/brand/logo-horizontal.svg"
                alt={t(
                  "Medicine Support Hub horizontal logo",
                  "شعار منصة دعم الدواء الأفقي",
                )}
                className="w-full"
              />
            </div>
            <div className="rounded-2xl border bg-[#0B1F33] p-8">
              <img
                src="/brand/logo-mark.svg"
                alt={t("Medicine Support Hub icon", "أيقونة منصة دعم الدواء")}
                className="mx-auto w-48"
              />
              <p className="mt-5 text-center text-sm font-medium text-white">
                {t("Icon and dark-background usage", "الأيقونة والاستخدام على خلفية داكنة")}
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
                {t("Color palette", "لوحة الألوان")}
              </p>
              <h2 className="mt-3 text-3xl font-bold">
                {t(
                  "Built for trust, clarity, and momentum.",
                  "مبنية للثقة والوضوح والزخم.",
                )}
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                {t(
                  "Navy provides stability, blue communicates technology and healthcare, while green signals access, progress, and positive impact.",
                  "يوفر الكحلي الاستقرار، ويعبّر الأزرق عن التقنية والرعاية الصحية، بينما يشير الأخضر إلى الوصول والتقدم والأثر الإيجابي.",
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {colors.map(([name, hex]) => (
                <div key={hex} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="h-24 rounded-xl border" style={{ backgroundColor: hex }} />
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
            <h3 className="mt-4 text-xl font-bold">
              {t("Connected network", "شبكة مترابطة")}
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              {t(
                "The surrounding nodes represent NGOs, healthcare teams, pharmacies, partners, donors, and public-health programs working through one coordinated hub.",
                "تمثّل العقد المحيطة الجمعيات وفرق الرعاية والصيدليات والشركاء والمانحين وبرامج الصحة العامة ضمن مركز تنسيق واحد.",
              )}
            </p>
          </article>
          <article className="rounded-2xl border p-6">
            <ShieldCheck className="h-7 w-7 text-cyan-600" />
            <h3 className="mt-4 text-xl font-bold">
              {t("Trust and security", "الثقة والأمان")}
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              {t(
                "The stable form and navy foundation support a credible enterprise identity suitable for sensitive healthcare operations.",
                "الشكل المستقر والأساس الكحلي يدعمان هوية مؤسسية موثوقة مناسبة لعمليات الرعاية الحساسة.",
              )}
            </p>
          </article>
          <article className="rounded-2xl border p-6">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            <h3 className="mt-4 text-xl font-bold">
              {t("Medicine access", "الوصول إلى الدواء")}
            </h3>
            <p className="mt-3 leading-7 text-slate-600">
              {t(
                "The capsule and cross keep the platform’s purpose visible: helping organizations coordinate medicine support effectively.",
                "تُبقي الكبسولة والصليب غرض المنصة واضحًا: مساعدة المنظمات على تنسيق دعم الأدوية بفعالية.",
              )}
            </p>
          </article>
        </div>
      </section>

      <section className="bg-[#0B1F33] px-4 py-16 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              {t("Brand statement", "بيان العلامة")}
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {t(
                "One operating platform from medicine request to measurable impact.",
                "منصة تشغيل واحدةحدة من طلب الدواء إلى أثر قابل للقياس.",
              )}
            </h2>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">{t("Partner with us", "شاركنا")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
