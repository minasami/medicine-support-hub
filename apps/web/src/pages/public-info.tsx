import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Building2,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useMemo } from "react";

const icons = [Building2, Network, ShieldCheck];

export default function PublicInfoPage() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [location] = useLocation();

  const pages = useMemo(
    () =>
      ({
        "/vision": {
          eyebrow: t("Vision", "الرؤية"),
          title: t(
            "Trusted digital infrastructure for medicine access.",
            "بنية رقمية موثوقة للوصول إلى الدواء.",
          ),
          intro: t(
            "Medicine Support Hub is being built to help organizations coordinate medicine assistance with greater speed, transparency, accountability, and measurable impact.",
            "تُبنى منصة دعم الدواء لمساعدة المنظمات على تنسيق المساعدات الدوائية بسرعة وشفافية ومساءلة وأثر قابل للقياس.",
          ),
          sections: [
            [
              t("The future we are building", "المستقبل الذي نبنيه"),
              t(
                "A connected ecosystem where patients, NGOs, healthcare teams, pharmacies, suppliers, donors, pharmaceutical companies, and public-sector programs can work through secure and interoperable workflows.",
                "منظومة مترابطة يعمل فيها المرضى والجمعيات وفرق الرعاية والصيدليات والموردون والمانحون وشركات الأدوية والبرامج الحكومية عبر سير عمل آمن ومتوافق.",
              ),
            ],
            [
              t("Our mission", "مهمتنا"),
              t(
                "Provide a scalable platform for beneficiary enrollment, review, budgeting, procurement, fulfillment, reporting, and continuous improvement.",
                "توفير منصة قابلة للتوسع لتسجيل المستفيدين والمراجعة والميزانيات والمشتريات والتنفيذ والتقارير والتحسين المستمر.",
              ),
            ],
            [
              t("Our north star", "نجم الشمال"),
              t(
                "Help organizations deliver more timely, transparent, and effective medicine support.",
                "مساعدة المنظمات على تقديم دعم دوائي أكثر سرعة وشفافية وفعالية.",
              ),
            ],
          ],
        },
        "/platform": {
          eyebrow: t("Platform", "المنصة"),
          title: t(
            "One operating platform from request to impact.",
            "منصة تشغيل واحدةحدة من الطلب إلى الأثر.",
          ),
          intro: t(
            "The platform connects organization management, programs, beneficiaries, requests, clinical review, pharmacy operations, procurement, budgets, partnerships, analytics, and responsible AI.",
            "تربط المنصة إدارة المنظمات والبرامج والمستفيدين والطلبات والمراجعة السريرية وعمليات الصيدليات والمشتريات والميزانيات والشراكات والتحليلات والذكاء الاصطناعي المسؤول.",
          ),
          sections: [
            [
              t("Organization Workspace", "مساحة عمل المنظمة"),
              t(
                "A digital headquarters for each organization, including teams, programs, settings, budgets, partners, and reports.",
                "مقر رقمي لكل منظمة يشمل الفرق والبرامج والإعدادات والميزانيات والشركاء والتقارير.",
              ),
            ],
            [
              t("Program Management", "إدارة البرامج"),
              t(
                "Configure eligibility, timelines, budgets, medicines, partners, workflows, and KPIs for each medicine support program.",
                "ضبط الأهلية والجداول والميزانيات والأدوية والشركاء وسير العمل ومؤشرات الأداء لكل برنامج دعم دوائي.",
              ),
            ],
            [
              t("Beneficiary CRM", "إدارة علاقات المستفيدين"),
              t(
                "Maintain a longitudinal, role-appropriate record of beneficiaries, requests, documents, conditions, medicines, and outcomes.",
                "الحفاظ على سجل طولي مناسب للدور للمستفيدين والطلبات والمستندات والحالات والأدوية والنتائج.",
              ),
            ],
          ],
        },
        "/solutions": {
          eyebrow: t("Solutions", "الحلول"),
          title: t(
            "Designed for the medicine access ecosystem.",
            "مصممة لمنظومة الوصول إلى الدواء.",
          ),
          intro: t(
            "Medicine Support Hub supports organizations with different responsibilities while preserving clear data boundaries and accountable workflows.",
            "تدعم منصة دعم الدواء منظمات بمسؤوليات مختلفة مع الحفاظ على حدود بيانات واضحة وسير عمل قابل للمساءلة.",
          ),
          sections: [
            [
              t("NGOs and foundations", "الجمعيات والمؤسسات"),
              t(
                "Manage beneficiaries, medicine programs, reviews, budgets, procurement, pharmacy partners, and donor reporting.",
                "إدارة المستفيدين وبرامج الأدوية والمراجعات والميزانيات والمشتريات وشركاء الصيدليات وتقارير المانحين.",
              ),
            ],
            [
              t("Pharmacies and providers", "الصيدليات ومقدمو الخدمة"),
              t(
                "Coordinate verification, dispensing, fulfillment, treatment continuity, and operational reporting.",
                "تنسيق التحقق والصرف والتنفيذ واستمرارية العلاج والتقارير التشغيلية.",
              ),
            ],
            [
              t("Pharmaceutical companies and donors", "شركات الأدوية والمانحون"),
              t(
                "Support patient programs, medicine donations, partnerships, funding visibility, and evidence-informed impact reporting.",
                "دعم برامج المرضى وتبرعات الأدوية والشراكات ووضوح التمويل وتقارير الأثر المبنية على الأدلة.",
              ),
            ],
          ],
        },
        "/security": {
          eyebrow: t("Security", "الأمان"),
          title: t("Trust is a platform capability.", "الثقة قدرة من المنصة."),
          intro: t(
            "Medicine Support Hub is being designed around authentication, role-based access, organization scoping, row-level security, auditability, responsible data use, and human oversight.",
            "تُصمَّم منصة دعم الدواء حول المصادقة والوصول حسب الدور ونطاق المنظمة وأمان مستوى الصف والقابلية للتدقيق والاستخدام المسؤول للبيانات والإشراف البشري.",
          ),
          sections: [
            [
              t("Tenant isolation", "عزل المستأجرين"),
              t(
                "Organization-scoped records and database policies are intended to prevent inappropriate cross-organization access.",
                "سجلات محددة بالمنظمة وسياسات قاعدة البيانات تهدف لمنع الوصول غير المناسب بين المنظمات.",
              ),
            ],
            [
              t("Least privilege", "أقل صلاحية"),
              t(
                "Users receive access based on their role, organization membership, and operational responsibility.",
                "يحصل المستخدمون على الوصول حسب دورهم وعضويتهم في المنظمة ومسؤوليتهم التشغيلية.",
              ),
            ],
            [
              t("Responsible AI", "ذكاء اصطناعي مسؤول"),
              t(
                "High-impact recommendations should remain explainable, reviewable, auditable, and subject to appropriate human judgment.",
                "يجب أن تبقى التوصيات عالية الأثر قابلة للتفسير والمراجعة والتدقيق وخاضعة لحكم بشري مناسب.",
              ),
            ],
          ],
        },
        "/research": {
          eyebrow: t("Research", "البحث"),
          title: t(
            "Building evidence, not only software.",
            "نبني الأدلة وليس البرمجيات فقط.",
          ),
          intro: t(
            "The long-term research agenda focuses on medicine access, treatment continuity, procurement efficiency, health equity, digital health adoption, and transparent impact measurement.",
            "يركز جدول البحث طويل الأمد على الوصول إلى الدواء واستمرارية العلاج وكفاءة المشتريات والعدالة الصحية وتبنّي الصحة الرقمية وقياس الأثر بشفافية.",
          ),
          sections: [
            [
              t("Operational evidence", "أدلة تشغيلية"),
              t(
                "Measure review time, fulfillment time, continuity, budget utilization, and procurement performance.",
                "قياس زمن المراجعة وزمن التنفيذ والاستمرارية واستخدام الميزانية وأداء المشتريات.",
              ),
            ],
            [
              t("Public-health learning", "تعلم الصحة العامة"),
              t(
                "Explore disease burden, coverage, geographic equity, treatment months, and outcome indicators with clear assumptions.",
                "استكشاف عبء المرض والتغطية والعدالة الجغرافية وأشهر العلاج ومؤشرات النتائج بافتراضات واضحة.",
              ),
            ],
            [
              t("Responsible collaboration", "تعاون مسؤول"),
              t(
                "Research use should follow appropriate privacy, ethics, governance, and de-identification requirements.",
                "يجب أن يتبع الاستخدام البحثي متطلبات الخصوصية والأخلاقيات والحوكمة وإزالة الهوية المناسبة.",
              ),
            ],
          ],
        },
        "/contact": {
          eyebrow: t("Contact", "تواصل"),
          title: t(
            "Build better medicine access with us.",
            "ابنِ وصولًا أفضل إلى الدواء معنا.",
          ),
          intro: t(
            "We welcome conversations with pilot organizations, healthcare professionals, NGOs, pharmacies, pharmaceutical companies, donors, researchers, and technology partners.",
            "نرحب بالحوار مع منظمات تجريبية والمهنيين الصحيين والجمعيات والصيدليات وشركات الأدوية والمانحين والباحثين وشركاء التقنية.",
          ),
          sections: [
            [
              t("Pilot partnerships", "شراكات تجريبية"),
              t(
                "Help shape the product through a focused medicine assistance program pilot.",
                "ساعد في تشكيل المنتج عبر تجربة مركزة لبرنامج مساعدة دوائية.",
              ),
            ],
            [
              t("Research and public health", "البحث والصحة العامة"),
              t(
                "Collaborate on evidence, measurement frameworks, workflows, and responsible data use.",
                "تعاون على الأدلة وأطر القياس وسير العمل والاستخدام المسؤول للبيانات.",
              ),
            ],
            [
              t("Technology and implementation", "التقنية والتنفيذ"),
              t(
                "Contribute to architecture, security, interoperability, product design, and deployment.",
                "ساهم في البنية والأمان والتوافق وتصميم المنتج والنشر.",
              ),
            ],
          ],
        },
      }) as const,
    [t],
  );

  const page = pages[location as keyof typeof pages] ?? pages["/platform"];

  return (
    <main className="bg-white text-slate-900">
      <section className="border-b bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            <Globe2 className="h-4 w-4" />
            {page.eyebrow}
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
            {page.title}
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 md:text-xl">
            {page.intro}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link href="/ngo">
                {t("Explore NGO platform", "استكشف منصة الجمعيات")}
                <ArrowRight className={`h-4 w-4 ${isAr ? "mr-2 rotate-180" : "ml-2"}`} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/manifesto">{t("Read the manifesto", "اقرأ البيان")}</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {page.sections.map(([title, body], index) => {
            const Icon = icons[index] ?? HeartHandshake;
            return (
              <article key={title} className="rounded-2xl border p-6 shadow-sm">
                <Icon className="h-7 w-7 text-blue-600" />
                <h2 className="mt-4 text-xl font-bold">{title}</h2>
                <p className="mt-3 leading-7 text-slate-600">{body}</p>
              </article>
            );
          })}
        </div>
      </section>
      <section className="border-y bg-slate-50 px-4 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 md:justify-start">
              <LockKeyhole className="h-4 w-4" />
              {t(
                "Secure, accountable, and partnership-driven",
                "آمنة وقابلة للمساءلة ومدفوعة بالشراكة",
              )}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {t(
                "Medicine access is a systems challenge. We are building a systems platform.",
                "الوصول إلى الدواء تحدٍ منظومي. نحن نبني منصة منظومية.",
              )}
            </h2>
          </div>
          <Button asChild size="lg">
            <Link href="/contact">{t("Start a conversation", "ابدأ حوارًا")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
