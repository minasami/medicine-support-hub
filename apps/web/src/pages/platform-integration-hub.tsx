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
    description: "Public searchable medicine knowledge base designed to attract traffic and connect interest back to the platform.",
    descriptionAr: "قاعدة معرفة عامة وقابلة للبحث عن الأدوية لجذب الزيارات وربط الاهتمام بالمنصة.",
    status: "Traffic",
    statusAr: "زيارات",
  },
  {
    title: "Verified product database",
    titleAr: "قاعدة المنتجات الموثقة",
    href: "/verified-products",
    description: "Filter the user-verified CSV by product, generic, company, disease area, prescription status, and price while hiding archived lower-price duplicates.",
    descriptionAr: "فلترة ملف CSV الموثق حسب المنتج والمادة والشركة والمجال المرضي والروشتة والسعر مع إخفاء الأسعار الأقل المؤرشفة.",
    status: "CSV",
    statusAr: "CSV",
  },
  {
    title: "Company profiles",
    titleAr: "ملفات الشركات",
    href: "/companies",
    description: "Company intelligence generated from the verified product database: product counts, generics, disease areas, and price ranges.",
    descriptionAr: "معلومات الشركات المولدة من قاعدة المنتجات الموثقة: عدد المنتجات والمواد والمجالات المرضية ونطاقات الأسعار.",
    status: "Profiles",
    statusAr: "ملفات",
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
    description: "Review public-health outcomes, performance indicators, and program impact narrative.",
    descriptionAr: "مراجعة نتائج الصحة العامة ومؤشرات الأداء وسرد أثر البرامج.",
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
  ["Attract public interest through the medicine encyclopedia", "اجذب الاهتمام العام من خلال موسوعة الأدوية"],
  ["Import sourced datasets into the enrichment layer", "استورد ملفات البيانات ذات المصدر داخل طبقة الإثراء"],
  ["Verify and publish source-linked medicine data", "وثّق وانشر بيانات الأدوية المرتبطة بمصدر"],
  ["Connect encyclopedia traffic to pharmacy, program, request, and reporting workflows", "اربط زيارات الموسوعة بالصيدلية والبرامج والطلبات والتقارير"],
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
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t("Integrated command", "القيادة المتكاملة")}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Platform integration hub", "مركز تكامل المنصة")}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {t("A single command page connecting public medicine discovery, verified product intelligence, source aggregation, administration, healthcare programs, pharmacy operations, reporting, and staff access.", "صفحة قيادة واحدة تربط اكتشاف الأدوية للجمهور وذكاء المنتجات الموثقة وتجميع المصادر وإدارة المنصة والبرامج الصحية وعمليات الصيدلية والتقارير ودخول الفريق.")}
          </p>
        </div>
        <a href="/verified-products" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90">
          {t("Open verified products", "فتح المنتجات الموثقة")}
        </a>
      </div>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Metric label={t("Verified source records", "سجلات موثقة بمصدر")} value={totals.records} />
      <Metric label={t("Records with price", "سجلات بها سعر")} value={totals.prices} />
      <Metric label={t("Records with barcode", "سجلات بها باركود")} value={totals.barcodes} />
    </section>

    {coverage.length > 0 && <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{t("Live source coverage", "تغطية المصادر الحية")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("Verified enrichment grouped by source, proving where the encyclopedia data comes from.", "الإثراء الموثق مجمع حسب المصدر لإثبات مصدر بيانات الموسوعة.")}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {coverage.map(row => <Card key={`${row.source_name}-${row.source_type}`}>
          <CardHeader><CardTitle className="text-base">{row.source_name}</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <Info label={t("Type", "النوع")} value={row.source_type} />
            <Info label={t("Verified", "موثق")} value={row.verified_records} />
            <Info label={t("With price", "بها سعر")} value={row.records_with_price} />
            <Info label={t("With barcode", "بها باركود")} value={row.records_with_barcode} />
          </CardContent>
        </Card>)}
      </div>
    </section>}

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => <a key={area.href} href={area.href} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary">{t(area.title, area.titleAr)}</h2>
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">{t(area.status, area.statusAr)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(area.description, area.descriptionAr)}</p>
        <span className="mt-5 inline-flex text-sm font-semibold text-primary">{t("Open area →", "فتح القسم ←")}</span>
      </a>)}
    </section>

    <section className="mt-6 rounded-2xl border bg-muted/40 p-5">
      <h2 className="text-lg font-semibold">{t("Best integrated operating flow", "أفضل مسار تشغيل متكامل")}</h2>
      <ol className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
        {flows.map(([en, ar], index) => <li key={en} className="rounded-xl bg-background p-4">{index + 1}. {t(en, ar)}</li>)}
      </ol>
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold text-foreground">{value ? String(value) : "—"}</div></div>;
}
