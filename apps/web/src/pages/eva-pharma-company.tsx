/**
 * Public EVA Pharma company page.
 * Ensures https://medicinesupport.app/companies/eva-pharma always resolves,
 * even when medicine_company_profiles / industry_company_profiles lack a row.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Database,
  ExternalLink,
  Globe2,
  Search,
} from "lucide-react";
import { EntitySocialPanel } from "@/components/entity-social-panel";
import { PublicKnowledgePanel } from "@/components/public-knowledge-panel";
import { ShareContributeActions } from "@/components/share-contribute-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { normalizeCompanyName } from "@/lib/search-engine";
import {
  getFallbackOfficialProfile,
  getFallbackSourceProfile,
} from "@/lib/company-profile-fallbacks";
import { matchesCompanyInDataset } from "@/lib/resolve-public-company";

type ProductRow = {
  id: string;
  product_name: string;
  product_url: string;
  final_price: number | null;
  generic_name: string;
  disease_name: string;
};

export default function EvaPharmaCompanyPage() {
  const { t } = useLanguage();
  const source = getFallbackSourceProfile("eva-pharma")!;
  const official = getFallbackOfficialProfile("eva-pharma")!;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  usePageSeo({
    title: "EVA Pharma Medicines, Portfolio and Company Profile | Medicine Support Hub",
    description:
      official.description ||
      "EVA Pharma company profile and medicine portfolio on Medicine Support Hub.",
    canonicalPath: "/companies/eva-pharma",
    keywords:
      "EVA Pharma, Eva Pharma, Egyptian pharmaceutical company, medicine portfolio",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/data/egyptian-medicines-dataset.json");
        const dataset = await res.json();
        const list = Array.isArray(dataset?.medicines)
          ? dataset.medicines
          : Array.isArray(dataset)
            ? dataset
            : [];
        const matches = list.filter((m: any) =>
          matchesCompanyInDataset("eva-pharma", m, normalizeCompanyName),
        );
        if (!cancelled) {
          setProducts(
            matches.slice(0, 120).map((m: any) => ({
              id: String(m.canonical_id || m.id || m.name_en),
              product_name: m.name_en || m.name || "Medicine",
              product_url: `/catalog/${m.canonical_id || ""}`,
              final_price: m.current_price_egp
                ? Number(m.current_price_egp)
                : null,
              generic_name: m.scientific_name || "",
              disease_name: m.category || m.drug_class || "",
            })),
          );
        }
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? products.filter((p) =>
        `${p.product_name} ${p.generic_name}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : products;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <a
        href="/companies"
        className="inline-flex items-center text-sm font-semibold text-primary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("Back to directory", "العودة إلى الدليل")}
      </a>

      <section
        id="about"
        className="mt-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 via-blue-500/10 to-emerald-500/20 text-2xl font-bold text-primary">
            E
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {t(
                "Healthcare company and medicine portfolio",
                "شركة رعاية صحية ومحفظة أدوية",
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {official.display_name}
              </h1>
              <Badge variant="outline" className="gap-1">
                <Database className="h-3.5 w-3.5" />
                {t("Encyclopedia intelligence", "ذكاء الموسوعة")}
              </Badge>
            </div>
            <p className="mt-2 text-muted-foreground">
              {t("Origin or headquarters", "المنشأ أو المقر")}:{" "}
              {[official.city, official.country].filter(Boolean).join(", ")}
            </p>
            <p className="mt-3 max-w-4xl text-muted-foreground">
              {official.description}
            </p>
            {official.website_url && (
              <a
                href={official.website_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center font-semibold text-primary"
              >
                <Globe2 className="mr-2 h-4 w-4" />
                {t("Company website", "موقع الشركة")}
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mt-4">
        <ShareContributeActions
          title={official.display_name}
          contributionUrl="/industry?company=eva-pharma#participate"
        />
      </div>

      <PublicKnowledgePanel type="company" name={official.display_name} />

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">
          {t(
            "Encyclopedia-derived company intelligence",
            "معلومات الشركة المشتقة من الموسوعة",
          )}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Portfolio sample and therapeutic areas for EVA Pharma. Verified representatives can enrich this profile from their account after admin approval.",
            "عينة من المحفظة والمجالات العلاجية لإيفا فارما. يمكن للممثلين المعتمدين إثراء هذا الملف من حساباتهم بعد موافقة المسؤول.",
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(source.therapeutic_areas || []).map((area) => (
            <Badge key={area} variant="secondary">
              {area}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(source.portfolio_sample || []).map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </div>
      </section>

      <section id="products" className="mt-6">
        <h2 className="text-2xl font-semibold">
          {t("Company medicine portfolio", "محفظة أدوية الشركة")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? t("Loading portfolio…", "جاري تحميل المحفظة…")
            : t(
                `${filtered.length} matching records from the encyclopedia dataset`,
                `${filtered.length} سجل مطابق من بيانات الموسوعة`,
              )}
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "Search this portfolio…",
              "ابحث داخل المحفظة…",
            )}
          />
          <Button type="button" variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  <a href={p.product_url} className="hover:text-primary hover:underline">
                    {p.product_name}
                  </a>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {p.generic_name || p.disease_name || "—"}
                </p>
              </CardHeader>
              <CardContent className="text-sm">
                {p.final_price != null && (
                  <Badge variant="secondary">{p.final_price} EGP</Badge>
                )}
                <a
                  href={p.product_url}
                  className="mt-3 inline-flex items-center font-semibold text-primary"
                >
                  {t("Open medicine page", "فتح صفحة الدواء")}
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </CardContent>
            </Card>
          ))}
          {!loading && filtered.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                {t(
                  "No encyclopedia products matched yet. Upload a stock CSV from a verified company account to enrich this portfolio.",
                  "لا توجد منتجات مطابقة بعد. ارفع ملف مخزون CSV من حساب شركة معتمد لإثراء المحفظة.",
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-dashed p-5">
        <h2 className="text-lg font-semibold">
          {t("Represent this company?", "هل تمثل هذه الشركة؟")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Submit a profile claim. Final ownership requires platform-admin approval before you can edit existing encyclopedia products.",
            "أرسل طلب المطالبة بالملف. تتطلب الملكية النهائية موافقة مسؤول المنصة قبل تعديل أدوية الموسوعة الحالية.",
          )}
        </p>
        <a
          href="/industry?company=eva-pharma#participate"
          className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("Claim and verify this profile", "المطالبة بهذا الملف وتوثيقه")}
        </a>
      </section>

      <EntitySocialPanel
        entityType="company"
        entityKey="eva-pharma"
        companySlug="eva-pharma"
        title={official.display_name}
      />

      <Alert className="mt-8">
        <AlertDescription>
          {t(
            "Dataset-derived company intelligence describes encyclopedia records; it is not an official corporate claim until a verified representative is approved.",
            "تصف معلومات الشركة المشتقة سجلات الموسوعة وليست ادعاءً رسميًا حتى يتم اعتماد ممثل موثق.",
          )}
        </AlertDescription>
      </Alert>
    </main>
  );
}
