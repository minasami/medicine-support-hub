import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type SourceCoverage = {
  source_name: string;
  source_type: string;
  verified_records: number;
  records_with_price: number;
  records_with_barcode: number;
  records_with_manufacturer: number;
  records_with_active_ingredient: number;
  latest_update: string | null;
};

const areas = [
  {
    title: "Medicines encyclopedia",
    titleAr: "موسوعة الأدوية",
    href: "/medicines",
    description: "Public source-backed medicine knowledge connected to products, companies, pharmacies, support requests, and evidence.",
    descriptionAr: "معرفة دوائية عامة مدعومة بالمصادر ومتصلة بالمنتجات والشركات والصيدليات وطلبات الدعم والأدلة.",
    status: "Discovery",
    statusAr: "اكتشاف",
  },
  {
    title: "Verified product database",
    titleAr: "قاعدة المنتجات الموثقة",
    href: "/verified-products",
    description: "Filter verified products by product, generic, company, disease area, prescription status, and observed source price.",
    descriptionAr: "فلترة المنتجات الموثقة حسب المنتج والمادة والشركة والمجال المرضي والروشتة وسعر المصدر المرصود.",
    status: "Evidence",
    statusAr: "أدلة",
  },
  {
    title: "Connected company profiles",
    titleAr: "ملفات الشركات المترابطة",
    href: "/companies",
    description: "Combine independent product intelligence with verified official profiles, capabilities, support programs, and reviewed contributions.",
    descriptionAr: "دمج ذكاء المنتجات المستقل مع الملفات الرسمية الموثقة والقدرات وبرامج الدعم والمساهمات المراجعة.",
    status: "Network",
    statusAr: "شبكة",
  },
  {
    title: "Industry contribution network",
    titleAr: "شبكة مساهمات الشركات",
    href: "/industry",
    description: "Let pharmaceutical, medical-product, device, diagnostics, biotech, supplier, and healthcare companies claim profiles and contribute evidence safely.",
    descriptionAr: "تمكين شركات الأدوية والمنتجات والأجهزة الطبية والتشخيص والتكنولوجيا الحيوية والموردين والرعاية الصحية من المطالبة بالملفات والمساهمة بالأدلة بأمان.",
    status: "Contribute",
    statusAr: "مساهمة",
  },
  {
    title: "Industry review console",
    titleAr: "لوحة مراجعة الشركات",
    href: "/admin/industry",
    description: "Verify company identity and moderate product, evidence, correction, education, patient-support, and partnership submissions.",
    descriptionAr: "توثيق هوية الشركات ومراجعة مساهمات المنتجات والأدلة والتصحيحات والتعليم ودعم المرضى والشراكات.",
    status: "Trust",
    statusAr: "ثقة",
  },
  {
    title: "Medicine enrichment",
    titleAr: "إثراء الأدوية",
    href: "/admin/medicine-enrichment",
    description: "Run source-backed enrichment, review imported data, and publish only verified medicine records.",
    descriptionAr: "تشغيل الإثراء المدعوم بالمصادر ومراجعة البيانات المستوردة ونشر السجلات الموثقة فقط.",
    status: "Admin",
    statusAr: "إدارة",
  },
  {
    title: "Data source registry",
    titleAr: "سجل مصادر البيانات",
    href: "/data-sources/item-export-20260501",
    description: "Document imported datasets and explain which fields are used in the public encyclopedia.",
    descriptionAr: "توثيق ملفات البيانات المستوردة وشرح الحقول المستخدمة داخل الموسوعة العامة.",
    status: "Sources",
    statusAr: "مصادر",
  },
  {
    title: "Platform admin",
    titleAr: "إدارة المنصة",
    href: "/admin-users",
    description: "Manage users, roles, activation status, and account details from one controlled dashboard.",
    descriptionAr: "إدارة المستخدمين والأدوار وحالة التفعيل وبيانات الحساب من لوحة واحدة محكومة.",
    status: "Control",
    statusAr: "تحكم",
  },
  {
    title: "Pharmacy operations",
    titleAr: "عمليات الصيدلية",
    href: "/pharmacy",
    description: "Run sales, inventory, purchases, branch access, finance, training, and settings.",
    descriptionAr: "تشغيل المبيعات والمخزون والمشتريات وصلاحيات الفروع والمالية والتدريب والإعدادات.",
    status: "Operations",
    statusAr: "تشغيل",
  },
  {
    title: "Pharmacy reports",
    titleAr: "تقارير الصيدلية",
    href: "/pharmacy/reports",
    description: "Open finance, stock, reorder, movement, purchase, supplier, sales, and access reports.",
    descriptionAr: "فتح تقارير المالية والمخزون وإعادة الطلب والحركات والمشتريات والموردين والمبيعات والصلاحيات.",
    status: "Reports",
    statusAr: "تقارير",
  },
  {
    title: "Program workspace",
    titleAr: "مساحة البرامج",
    href: "/workspace",
    description: "Manage healthcare programs, beneficiaries, requests, pilots, decisions, meetings, and evidence.",
    descriptionAr: "إدارة البرامج الصحية والمستفيدين والطلبات والتجارب والقرارات والاجتماعات والأدلة.",
    status: "Programs",
    statusAr: "برامج",
  },
  {
    title: "Impact reporting",
    titleAr: "تقارير الأثر",
    href: "/impact",
    description: "Connect medicine support, company partnerships, beneficiary outcomes, program delivery, and evidence into impact reporting.",
    descriptionAr: "ربط دعم الدواء وشراكات الشركات ونتائج المستفيدين وتنفيذ البرامج والأدلة بتقارير الأثر.",
    status: "Impact",
    statusAr: "أثر",
  },
  {
    title: "Staff portal",
    titleAr: "بوابة الفريق",
    href: "/portal",
    description: "Sign in and route staff to the right operational workspace based on role.",
    descriptionAr: "تسجيل الدخول وتوجيه الفريق إلى مساحة العمل المناسبة حسب الدور.",
    status: "Access",
    statusAr: "دخول",
  },
];

const flows = [
  ["People discover medicines, products, companies, and support options", "يكتشف الناس الأدوية والمنتجات والشركات وخيارات الدعم"],
  ["Companies claim verified profiles and submit attributable evidence", "تطالب الشركات بملفات موثقة وترسل أدلة منسوبة إليها"],
  ["Reviewers validate identity, evidence, limitations, and publication safety", "يتحقق المراجعون من الهوية والأدلة والقيود وسلامة النشر"],
  ["Approved knowledge connects to the encyclopedia and company network", "ترتبط المعرفة المعتمدة بالموسوعة وشبكة الشركات"],
  ["Pharmacies, NGOs, clinicians, and programs use connected intelligence", "تستخدم الصيدليات والمؤسسات والأطباء والبرامج الذكاء المترابط"],
  ["Requests, procurement, delivery, outcomes, and impact close the cycle", "تغلق الطلبات والمشتريات والتوصيل والنتائج والأثر دورة الرعاية"],
];

export default function PlatformIntegrationHub() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [coverage, setCoverage] = useState<SourceCoverage[]>([]);

  useEffect(() => {
    supabaseFetch<SourceCoverage[]>("/rest/v1/medicine_enrichment_source_coverage?select=source_name,source_type,verified_records,records_with_price,records_with_barcode,records_with_manufacturer,records_with_active_ingredient,latest_update&order=verified_records.desc")
      .then(setCoverage)
      .catch(() => setCoverage([]));
  }, [supabaseFetch]);

  const totals = useMemo(() => coverage.reduce((acc, row) => ({
    records: acc.records + Number(row.verified_records || 0),
    prices: acc.prices + Number(row.records_with_price || 0),
    barcodes: acc.barcodes + Number(row.records_with_barcode || 0),
  }), { records: 0, prices: 0, barcodes: 0 }), [coverage]);

  return <main className="container mx-auto max-w-6xl px-4 py-8">
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Integrated healthcare cycle", "دورة الرعاية الصحية المتكاملة")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div><h1 className="text-3xl font-bold tracking-tight">{t("Platform integration hub", "مركز تكامل المنصة")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("A single command page connecting public medicine discovery, verified product intelligence, official company participation, evidence moderation, pharmacy operations, patient support, healthcare programs, procurement, reporting, and staff access.", "صفحة قيادة واحدة تربط اكتشاف الأدوية وذكاء المنتجات الموثقة ومشاركة الشركات الرسمية ومراجعة الأدلة وعمليات الصيدلية ودعم المرضى والبرامج الصحية والمشتريات والتقارير ودخول الفريق.")}</p></div>
        <a href="/industry" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">{t("Open industry network", "فتح شبكة الشركات")}</a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3"><Metric label={t("Verified source records", "سجلات موثقة بمصدر")} value={totals.records} /><Metric label={t("Records with price", "سجلات بها سعر")} value={totals.prices} /><Metric label={t("Records with barcode", "سجلات بها باركود")} value={totals.barcodes} /></section>

    {coverage.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-lg font-semibold">{t("Live source coverage", "تغطية المصادر الحية")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Independent verified enrichment remains distinguishable from official company contributions.", "يظل الإثراء المستقل الموثق مميزًا بوضوح عن مساهمات الشركات الرسمية.")}</p><div className="mt-4 grid gap-3 md:grid-cols-2">{coverage.map((row) => <Card key={`${row.source_name}-${row.source_type}`}><CardHeader><CardTitle className="text-base">{row.source_name}</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><Info label={t("Type", "النوع")} value={row.source_type} /><Info label={t("Verified", "موثق")} value={row.verified_records} /><Info label={t("With price", "بها سعر")} value={row.records_with_price} /><Info label={t("With barcode", "بها باركود")} value={row.records_with_barcode} /></CardContent></Card>)}</div></section>}

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{areas.map((area) => <a key={area.href} href={area.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{t(area.title, area.titleAr)}</h2><span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{t(area.status, area.statusAr)}</span></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{t(area.description, area.descriptionAr)}</p><span className="mt-5 inline-flex text-sm font-semibold text-primary">{t("Open area →", "فتح القسم ←")}</span></a>)}</section>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5"><h2 className="text-lg font-semibold">{t("Connected healthcare operating cycle", "دورة تشغيل الرعاية الصحية المترابطة")}</h2><ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">{flows.map(([en, ar], index) => <li key={en} className="rounded-xl bg-background p-4"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>{t(en, ar)}</li>)}</ol></section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold text-foreground">{value ? String(value) : "—"}</div></div>;
}
