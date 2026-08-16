import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function Manifesto() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const beliefs = isAr
    ? [
        "الرعاية الصحية تتحسّن عندما تتعاون المؤسسات بدل أن تعمل بمعزل عن بعضها.",
        "الشفافية تقوّي الثقة عبر الموافقات والميزانيات والمشتريات وتقارير الأثر.",
        "ينبغي أن توجّه الأدلة القرارات والتحسين المستمر.",
        "الذكاء الاصطناعي يدعم المهنيين—ولا يحل محل الحكم البشري المسؤول.",
        "يجب أن تخدم البيانات المرضى مع احترام الخصوصية والأمان والكرامة الإنسانية.",
        "ينبغي أن تقضي المؤسسات وقتًا أقل في الإدارة المجزأة ووقتًا أكثر في تحسين حياة الناس.",
      ]
    : [
        "Healthcare improves when organizations collaborate rather than operate in isolation.",
        "Transparency strengthens trust across approvals, budgets, procurement, and impact reporting.",
        "Evidence should guide decisions and continuous improvement.",
        "Artificial intelligence should support professionals—not replace accountable human judgment.",
        "Data should serve patients while respecting privacy, security, and human dignity.",
        "Organizations should spend less time managing fragmented administration and more time improving lives.",
      ];

  const principles: [string, string][] = isAr
    ? [
        [
          "المريض أولًا",
          "كل قرار يبدأ بما إذا كان يحسّن تجربة ونتائج الأشخاص الذين تُخدمهم المنصة في النهاية.",
        ],
        [
          "الأدلة قبل الافتراضات",
          "نثمّن النتائج القابلة للقياس والأساليب الشفافة والتعلّم المستمر.",
        ],
        [
          "التشغيل المتبادل لا العزلة",
          "التكامل المدروس والمعايير المفتوحة تصنع منظومات رعاية أقوى.",
        ],
        [
          "الشفافية تبني الثقة",
          "الموافقات والميزانيات والمشتريات وتوصيات الذكاء الاصطناعي ومؤشرات الأثر يجب أن تكون مفهومة وقابلة للتتبع.",
        ],
        [
          "النمو عبر الشراكة",
          "الوصول إلى الدواء يتطلب تعاون الجمعيات ومقدّمي الرعاية والصيدليات والمانحين والحكومات والباحثين وشركاء التقنية.",
        ],
        [
          "ذكاء مسؤول",
          "التوصيات عالية الأثر يجب أن تبقى قابلة للمراجعة والتدقيق وخاضعة لإشراف بشري مناسب.",
        ],
      ]
    : [
        [
          "Patient first",
          "Every decision begins with whether it improves the experience and outcomes of the people ultimately served.",
        ],
        [
          "Evidence before assumptions",
          "We value measurable outcomes, transparent methods, and continuous learning.",
        ],
        [
          "Interoperability over isolation",
          "Thoughtful integration and open standards create stronger healthcare ecosystems.",
        ],
        [
          "Transparency builds trust",
          "Approvals, budgets, procurement, AI recommendations, and impact metrics should be understandable and traceable.",
        ],
        [
          "Scale through partnership",
          "Medicine access requires collaboration among NGOs, providers, pharmacies, donors, governments, researchers, and technology partners.",
        ],
        [
          "Responsible intelligence",
          "High-impact recommendations must remain reviewable, auditable, and subject to appropriate human oversight.",
        ],
      ];

  const businessCommitments: [string, string][] = isAr
    ? [
        [
          "الكرامة قبل اليأس",
          "لا نفرض رسومًا على من هم في أزمة لمجرد طلب مساعدة دوائية، ولا نبيع بيانات المرضى أو المستفيدين.",
        ],
        [
          "الحقيقة قبل المظهر",
          "«موثّق» يجب أن يعني فحصًا حقيقيًا—لا ترتيبًا مدفوعًا. حدود المنصة العامة تبقى ظاهرة بالعربية والإنجليزية.",
        ],
        [
          "من يدفع مهم",
          "ينبغي أن يأتي الإيراد أساسًا من المؤسسات والشركات ذات الميزانية—لا من حجب المعرفة والمسارات الأساسية عن الضعفاء.",
        ],
        [
          "تصحيح علني",
          "عندما تكون بيانات دواء أو شريك خاطئة علنًا، نصحّحها علنًا بقدر ما نستطيع.",
        ],
        [
          "الناس ليسوا وقودًا",
          "الأجر العادل والوتيرة المستدامة واحترام الموظفين والمتعاقدين وشركاء الجمعيات جزء من المنتج—لا إضافات اختيارية.",
        ],
        [
          "الأولوية عند تعارض الأهداف",
          "سلامة المريض وكرامته، ثم الصدق، ثم استدامة العمل، ثم النمو، ثم الربح الشخصي.",
        ],
      ]
    : [
        [
          "Dignity over desperation",
          "We do not charge people in crisis merely to request medicine aid, and we do not sell patient or beneficiary data.",
        ],
        [
          "Truth over theater",
          "“Verified” must mean a real check—not paid placement. Public limits of the platform stay visible in English and Arabic.",
        ],
        [
          "Who pays matters",
          "Revenue should primarily come from institutions and companies with budget—not from locking the vulnerable out of core knowledge and pathways.",
        ],
        [
          "Corrections in the open",
          "When medicine or partner data is wrong in public, we correct it in public as far as we can.",
        ],
        [
          "People are not fuel",
          "Fair pay, sustainable pace, and respect for staff, contractors, and NGO partners are part of the product—not optional extras.",
        ],
        [
          "Priority when goals conflict",
          "Patient safety and dignity, then truth, then sustainability of the work, then growth, then personal profit.",
        ],
      ];

  return (
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-24">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, #2563eb22 0%, transparent 35%), radial-gradient(circle at 85% 75%, #10b98122 0%, transparent 35%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-semibold text-blue-700">
            <Sparkles className="h-4 w-4" />{" "}
            {t("Medicine Support Hub Manifesto", "بيان منصة Medicine Support Hub")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            {t(
              "Medicine access deserves better digital infrastructure.",
              "الوصول إلى الدواء يستحق بنية تحتية رقمية أفضل.",
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
            {t(
              "We are building a trusted digital health platform that helps organizations coordinate medicine support, strengthen clinical and operational workflows, use resources responsibly, and measure impact—without monetizing desperation or dressing marketing up as verification.",
              "نبني منصة صحة رقمية موثوقة تساعد المؤسسات على تنسيق دعم الأدوية، وتقوية سير العمل السريري والتشغيلي، واستخدام الموارد بمسؤولية، وقياس الأثر—دون تحقيق ربح من اليأس أو تقديم التسويق على أنه توثيق.",
            )}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/ngo" className="inline-flex items-center">
                {t("Explore the platform", "استكشف المنصة")}
                <ArrowRight
                  className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`}
                />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/">{t("Return home", "العودة للرئيسية")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              {t("Why we exist", "لماذا نوجد")}
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {t(
                "A systems challenge needs a connected response.",
                "تحدّي المنظومة يحتاج استجابة مترابطة.",
              )}
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-slate-600">
            <p>
              {t(
                "Millions of people know which medicines they need but cannot be certain they will obtain them. Cost, availability, fragmented processes, disconnected systems, and administrative complexity can interrupt treatment.",
                "ملايين الناس يعرفون الأدوية التي يحتاجونها لكنهم لا يضمنون الحصول عليها. التكلفة والتوفر والعمليات المجزأة والأنظمة المنفصلة والتعقيد الإداري قد تقطع العلاج.",
              )}
            </p>
            <p>
              {t(
                "At the same time, NGOs, hospitals, pharmacies, pharmaceutical companies, donors, governments, and researchers work hard to improve access—often with limited visibility across the full journey.",
                "وفي الوقت نفسه تعمل الجمعيات والمستشفيات والصيدليات وشركات الأدوية والمانحون والحكومات والباحثون بجد لتحسين الوصول—غالبًا برؤية محدودة عبر الرحلة كاملة.",
              )}
            </p>
            <p>
              {t(
                "Medicine Support Hub exists to reduce that fragmentation and help organizations coordinate medicine assistance from request to review, budget, procurement, fulfillment, and impact.",
                "توجد منصة Medicine Support Hub لتقليل هذا التجزؤ ومساعدة المؤسسات على تنسيق المساعدة الدوائية من الطلب إلى المراجعة والميزانية والمشتريات والتنفيذ وقياس الأثر.",
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="border-y bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              {t("What we believe", "ما نؤمن به")}
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {t(
                "Technology should strengthen healthcare systems—not complicate them.",
                "التقنية يجب أن تقوّي منظومات الرعاية—لا أن تعقّدها.",
              )}
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {beliefs.map((belief) => (
              <div
                key={belief}
                className="flex gap-3 rounded-2xl border bg-white p-5 shadow-sm"
              >
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
              {t("Our principles", "مبادئنا")}
            </p>
            <h2 className="mt-3 text-3xl font-bold">
              {t(
                "The commitments guiding the platform.",
                "الالتزامات التي توجّه المنصة.",
              )}
            </h2>
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

      <section className="border-t bg-emerald-50/60 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Scale className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {t("How we run this business", "كيف ندير هذا العمل")}
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              {t("Infrastructure with a conscience.", "بنية تحتية بضمير.")}
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              {t(
                "Anyone is welcome to use and partner with the platform. You do not need to share the founder’s faith. These public commitments are how we intend to handle money, truth, and power so the sick are not treated as a product.",
                "الجميع مرحّب بهم لاستخدام المنصة والشراكة معها. لست مضطرًا أن تشارك إيمان المؤسس. هذه الالتزامات العامة هي كيف ننوي التعامل مع المال والحقيقة والسلطة حتى لا يُعامل المرضى كمنتج.",
              )}
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {businessCommitments.map(([title, description]) => (
              <article
                key={title}
                className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-7 text-slate-500">
            {t(
              "Detailed founding rules for the steward—including surplus generosity and accountability—are written in the project’s Faithful Business Covenant (English and Arabic) in the public repository. Hold us to the priority order: dignity and truth before growth and profit.",
              "القواعد التأسيسية التفصيلية للوكيل—بما فيها كرم الفائض والمساءلة—مدوّنة في عهد العمل الأمين (بالعربية والإنجليزية) في المستودع العام. حاسبونا على ترتيب الأولويات: الكرامة والصدق قبل النمو والربح.",
            )}
          </p>
        </div>
      </section>

      <section className="bg-blue-600 px-4 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <HeartHandshake className="mx-auto h-10 w-10" />
          <h2 className="mt-5 text-3xl font-bold">
            {t(
              "An invitation to build better medicine access together.",
              "دعوة لبناء وصول أفضل إلى الدواء معًا.",
            )}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-blue-100">
            {t(
              "We invite healthcare professionals, NGOs, pharmacies, pharmaceutical companies, donors, governments, researchers, and technology partners to help shape infrastructure that is secure, transparent, interoperable, evidence-informed, and designed around the people it serves.",
              "ندعو المهنيين الصحيين والجمعيات والصيدليات وشركات الأدوية والمانحين والحكومات والباحثين وشركاء التقنية للمساعدة في تشكيل بنية تحتية آمنة وشفافة وقابلة للتشغيل المتبادل ومستندة إلى الأدلة ومصمَّمة حول من تخدمهم.",
            )}
          </p>
          <blockquote
            className={`mx-auto mt-10 max-w-3xl text-2xl font-semibold leading-9 ${
              isAr
                ? "border-r-4 border-white/50 pr-6 text-right"
                : "border-l-4 border-white/50 pl-6 text-left"
            }`}
          >
            {t(
              "“We are not building software alone. We are building digital infrastructure that helps organizations deliver medicines—and hope—to the people who need them most.”",
              "«لسنا نبني برمجيات فحسب. نبني بنية تحتية رقمية تساعد المؤسسات على إيصال الأدوية—والرجاء—إلى من هم أشد حاجة إليها.»",
            )}
          </blockquote>
          <div className="mt-10">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-white text-blue-700 hover:bg-blue-50"
            >
              <Link href="/ngos">
                {t("Browse NGO pathways", "تصفّح مسارات الجمعيات")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
