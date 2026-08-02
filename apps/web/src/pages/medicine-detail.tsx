import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ExternalLink,
  Handshake,
  History,
  Send,
  ShieldCheck,
} from "lucide-react";
import { EntitySocialPanel } from "@/components/entity-social-panel";
import { CompanyProductManagementMenu } from "@/components/company-product-management-menu";
import { PublicKnowledgePanel } from "@/components/public-knowledge-panel";
import { ShareContributeActions } from "@/components/share-contribute-actions";
import { MedicineProvenancePanel } from "@/components/medicine-provenance-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import {
  medicineCompanyRoleLabel,
  parseMedicineCompanyParties,
  type MedicineCompanyRole,
} from "@/lib/medicine-companies";
import {
  cleanAttribute,
  classifyProductType,
  productTypeLabel,
  shouldShowEdaVerifiedBadge,
} from "@/lib/product-type";
import {
  encyclopediaSearchUrl,
  isNameKeyedCatalogId,
  normalizeTradeName,
  parseNameKeyedCatalogId,
} from "@/lib/catalog-links";

interface Product {
  canonical_id: number;
  canonical_key: string;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  route: string | null;
  category: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  product_type?: string | null;
  image_url: string | null;
  egyptdwa_source_url: string | null;
  is_discontinued?: boolean;
  current_price_egp?: number | null;
  price_currency?: string;
  min_price_egp?: number | null;
  max_price_egp?: number | null;
  has_verified_dataset?: boolean;
  has_company_verified_source?: boolean;
  completeness_score?: number;
  completeness_percent?: number;
  complete_field_count?: number;
  available_field_count?: number;
  source_record_count?: number;
  source_count?: number;
  source_systems?: string[];
  barcode?: string | null;
  code?: string | null;
  disease_name?: string | null;
}

interface ManufacturerCompany {
  company_name: string;
  company_slug: string;
  relationship_role: MedicineCompanyRole;
  verified_status?: string;
}

interface CompanyEditLog {
  id: string;
  editor_name: string;
  editor_role: string;
  field_name: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

const formatCurrency = (val?: number | null) => {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(val);
};

function pickBestNameMatch(rows: Product[], wanted: string): Product | null {
  if (!rows.length) return null;
  const target = normalizeTradeName(wanted);
  if (!target) return rows[0];

  const exact = rows.find(
    (r) =>
      normalizeTradeName(r.name_en || "") === target ||
      normalizeTradeName(r.name_ar || "") === target,
  );
  if (exact) return exact;

  const starts = rows.find(
    (r) =>
      normalizeTradeName(r.name_en || "").startsWith(target) ||
      normalizeTradeName(r.name_ar || "").startsWith(target),
  );
  if (starts) return starts;

  const includes = rows.find(
    (r) =>
      normalizeTradeName(r.name_en || "").includes(target) ||
      normalizeTradeName(r.name_ar || "").includes(target),
  );
  return includes || rows[0];
}

export default function MedicineDetailPage() {
  const [, params] = useRoute("/catalog/:id");
  const [, paramsMed] = useRoute("/medicines/:id");
  const rawId = decodeURIComponent(
    params?.id || paramsMed?.id || "",
  );
  const { t, language } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [companies, setCompanies] = useState<ManufacturerCompany[]>([]);
  const [editLogs, setEditLogs] = useState<CompanyEditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [proposalType, setProposalType] = useState<string>("price_update");
  const [proposedPrice, setProposedPrice] = useState<string>("");
  const [proposalSummary, setProposalSummary] = useState<string>("");
  const [evidenceUrl, setEvidenceUrl] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawId) {
      setLoading(false);
      setError(t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."));
      return;
    }

    async function loadProductDetail() {
      setLoading(true);
      setError(null);
      try {
        let mainProd: Product | null = null;

        // Name-keyed link: /catalog/n~ARMOWAKE%2050%20MG...
        if (isNameKeyedCatalogId(rawId)) {
          const wanted = parseNameKeyedCatalogId(rawId) || "";
          if (!wanted) {
            setError(t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."));
            return;
          }

          // Prefer exact name_en match from live API
          const exactPath = `/rest/v1/medicines?select=*&name_en=eq.${encodeURIComponent(wanted)}&limit=5`;
          let data = await supabaseFetch<Product[]>(exactPath);
          let rows = Array.isArray(data) ? data : [];

          if (!rows.length) {
            // Broad fetch + client filter (PostgREST ilike may differ on Appwrite bridge)
            const broad = await supabaseFetch<Product[]>(
              `/rest/v1/medicines?select=*&limit=5000`,
            );
            const all = Array.isArray(broad) ? broad : [];
            const tNorm = normalizeTradeName(wanted);
            rows = all.filter((r) => {
              const en = normalizeTradeName(r.name_en || "");
              const ar = normalizeTradeName(r.name_ar || "");
              return (
                en === tNorm ||
                ar === tNorm ||
                en.includes(tNorm) ||
                tNorm.includes(en) ||
                ar.includes(tNorm)
              );
            });
          }

          mainProd = pickBestNameMatch(rows, wanted);

          if (!mainProd) {
            // Send user to search results for that name
            window.location.replace(encyclopediaSearchUrl(wanted));
            return;
          }

          // Canonical clean URL so share links use live id (safe: we matched by name)
          if (
            mainProd.canonical_id &&
            typeof window !== "undefined" &&
            !window.location.pathname.includes(`/catalog/${mainProd.canonical_id}`)
          ) {
            window.history.replaceState(
              null,
              "",
              `/catalog/${mainProd.canonical_id}`,
            );
          }
        } else {
          const canonicalId = parseInt(rawId.replace(/^med_/, ""), 10);
          const isNumeric = !isNaN(canonicalId);

          let queryPath = `/rest/v1/medicines?select=*&limit=1`;
          if (isNumeric) {
            queryPath = `/rest/v1/medicines?select=*&canonical_id=eq.${canonicalId}&limit=1`;
          } else {
            queryPath = `/rest/v1/medicines?select=*&canonical_key=eq.${encodeURIComponent(rawId)}&limit=1`;
          }

          const data = await supabaseFetch<Product[]>(queryPath);
          if (Array.isArray(data) && data.length > 0) {
            mainProd = data[0];
          }
        }

        if (!mainProd) {
          setError(
            t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."),
          );
          return;
        }

        setProduct(mainProd);

        if (mainProd.canonical_id) {
          void supabaseFetch<ManufacturerCompany[]>(
            `/rest/v1/medicine_manufacturer_companies_v1?canonical_id=eq.${mainProd.canonical_id}`,
          )
            .then((comps) => {
              if (Array.isArray(comps)) setCompanies(comps);
            })
            .catch(() => {});

          void supabaseFetch<CompanyEditLog[]>(
            `/rest/v1/medicine_company_edit_logs?canonical_id=eq.${mainProd.canonical_id}&order=created_at.desc&limit=10`,
          )
            .then((logs) => {
              if (Array.isArray(logs)) setEditLogs(logs);
            })
            .catch(() => {});
        }
      } catch (err: any) {
        console.error("Failed to load medicine details:", err);
        setError(
          err?.message ||
            t("Could not load product details.", "تعذر تحميل تفاصيل المنتج."),
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProductDetail();
  }, [rawId, supabaseFetch, t]);

  const title = useMemo(() => {
    if (!product) return t("Medicine Details", "تفاصيل الدواء");
    if (language === "ar")
      return product.name_ar || product.name_en || "دواء بدون عنوان";
    return product.name_en || product.name_ar || "Untitled Medicine";
  }, [product, language, t]);

  const classified = useMemo(() => {
    if (!product) return null;
    return classifyProductType(product);
  }, [product]);

  const isVerified = useMemo(() => {
    if (!product) return false;
    return shouldShowEdaVerifiedBadge(product);
  }, [product]);

  const displayScientificName = useMemo(() => {
    if (!product) return null;
    return cleanAttribute(product.scientific_name);
  }, [product]);

  const displayDrugClass = useMemo(() => {
    if (!product) return null;
    return cleanAttribute(product.drug_class);
  }, [product]);

  const displayDosageForm = useMemo(() => {
    if (!product) return null;
    const df = cleanAttribute(product.dosage_form);
    if (df) return df;
    if (classified?.product_type === "fragrance")
      return t("Spray / Bottle", "بخاخ / زجاجة");
    if (classified?.product_type === "cosmetic")
      return t("Topical Application", "استعمال ظاهري");
    return null;
  }, [product, classified, t]);

  const displayCategory = useMemo(() => {
    if (!product) return null;
    const cat = cleanAttribute(product.category);
    if (cat) return cat;
    if (classified) return productTypeLabel(classified.product_type, t);
    return t("Official Product", "منتج رسمي");
  }, [product, classified, t]);

  const displayRoute = useMemo(() => {
    if (!product) return null;
    const rt = cleanAttribute(product.route);
    if (
      classified?.product_type === "fragrance" ||
      classified?.product_type === "cosmetic" ||
      classified?.product_type === "personal_care"
    ) {
      if (!rt || rt.toLowerCase().includes("oral")) {
        return t("Topical / External", "استعمال ظاهري");
      }
    }
    return rt;
  }, [product, classified, t]);

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (!proposalSummary.trim()) {
      setSubmitError(
        t(
          "Please enter a summary for your update proposal.",
          "يرجى إدخال ملخص لطلب التحديث.",
        ),
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const payload = {
        canonical_id: product.canonical_id,
        contribution_type: proposalType,
        title: `Proposal: ${proposalType} for ${product.name_en || product.canonical_id}`,
        summary: proposalSummary.trim(),
        proposed_price_egp: proposedPrice ? parseFloat(proposedPrice) : null,
        evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
        organization_name: orgName.trim() || null,
        status: "submitted",
        submitted_by: session?.user?.id || "guest",
      };

      await supabaseFetch("/rest/v1/company_medicine_contributions", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubmitSuccess(
        t(
          "Your product update proposal has been submitted to the moderation queue for independent audit.",
          "تم تقديم طلب تحديث بيانات المنتج بنجاح إلى مراجعي المنصة المستقلين.",
        ),
      );
      setProposalSummary("");
      setProposedPrice("");
      setEvidenceUrl("");
    } catch (err: any) {
      setSubmitError(
        err?.message ||
          t("Failed to submit update proposal.", "فشل تقديم طلب التحديث."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          {t(
            "Loading verified encyclopedia product details...",
            "جاري تحميل تفاصيل المنتج المعين...",
          )}
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || t("Product not found.", "لم يتم العثور على المنتج.")}
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <a href="/medicines" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("Return to Medicine Directory", "العودة إلى دليل الأدوية")}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <a
            href="/medicines"
            className="gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Back to Medicine Directory", "العودة لدليل الأدوية")}
          </a>
        </Button>
        <Badge variant="outline" className="text-xs font-semibold">
          Canonical ID: {product.canonical_id}
        </Badge>
      </div>

      <Card className="border-emerald-500/20 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-6 md:p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-900/40 text-emerald-100 border border-white/20">
                  {displayCategory}
                </Badge>
                {classified && classified.product_type !== "medicine" && (
                  <Badge className="bg-purple-900/40 text-purple-100 border border-white/20">
                    {productTypeLabel(classified.product_type, t)}
                  </Badge>
                )}
                {isVerified && (
                  <Badge className="bg-white/20 text-white border border-white/30 gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("EDA Verified", "معتمد رسمياً")}
                  </Badge>
                )}
                {product.is_discontinued && (
                  <Badge variant="destructive">
                    {t("Discontinued", "غير متوفر / ملغى")}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {title}
              </h1>
              {displayScientificName && (
                <p className="text-sm md:text-base text-emerald-100 font-medium leading-relaxed">
                  {displayScientificName}
                </p>
              )}
            </div>

            <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-2xl p-4 text-right border border-white/20 shadow-inner">
              <div className="text-[11px] uppercase tracking-wider text-emerald-100 font-bold">
                {t("Official Tariff Price", "السعر الرسمي المعين")}
              </div>
              <div className="text-2xl md:text-3xl font-black mt-1">
                {formatCurrency(product.current_price_egp)}
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric
              label={t("Dosage Form", "الشكل الصيدلي")}
              value={displayDosageForm || "—"}
            />
            <Metric
              label={t("Strength", "التركيز")}
              value={cleanAttribute(product.strength) || "—"}
            />
            <Metric
              label={t("Drug Class", "الفئة العلاجية")}
              value={displayDrugClass || "—"}
            />
            <Metric
              label={t("Route", "طريقة الاستعمال")}
              value={displayRoute || "—"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
            <Fact label={t("English Name", "الاسم بالإنجليزية")} value={product.name_en} />
            <Fact label={t("Arabic Name", "الاسم بالعربية")} value={product.name_ar} />
            <Fact
              label={t("Scientific Active Ingredient", "المادة الفعالة")}
              value={displayScientificName}
            />
            <MedicineCompanyFields
              companies={companies}
              sourceLabel={product.manufacturer}
              t={t}
            />
            <Fact
              label={t("International Barcode", "الباركود الدولي")}
              value={product.barcode}
            />
            <Fact
              label={t("EDA Registration Code", "كود تسجيل الدواء")}
              value={product.code}
            />
            <Fact
              label={t("Indication / Condition", "دواعي الاستعمال")}
              value={product.disease_name}
            />
            {product.egyptdwa_source_url && (
              <Fact
                label={t("Official Registry Verification", "مصدر التوثيق الرسمي")}
                value={
                  <a
                    href={product.egyptdwa_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    {t("View EDA Record", "سجل هيئة الدواء المصرية")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                }
              />
            )}
          </div>
        </CardContent>
      </Card>

      <MedicineProvenancePanel
        canonicalId={product.canonical_id}
        hasCompanyVerifiedSource={product.has_company_verified_source}
      />

      <ShareContributeActions
        title={title}
        contributionUrl={`/industry?medicine=${product.canonical_id}#participate`}
      />

      {editLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" />
              {t(
                "Verified Company Update Audit Log",
                "سجل التحديثات المعتمدة للشركة",
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between border-b pb-3 text-xs"
              >
                <div>
                  <span className="font-bold text-foreground">
                    {log.editor_name}
                  </span>{" "}
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {log.editor_role}
                  </Badge>
                  <p className="text-muted-foreground mt-0.5">
                    Updated <strong className="text-foreground">{log.field_name}</strong>{" "}
                    from <span className="line-through">{log.old_value || "empty"}</span>{" "}
                    to <strong className="text-emerald-600">{log.new_value}</strong>
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(log.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <PublicKnowledgePanel type="medicine" name={title} />

      <CompanyProductManagementMenu
        canonicalId={product.canonical_id}
        productName={title}
        relationships={companies.map((c) => ({
          company_slug: c.company_slug,
          company_name: c.company_name,
        }))}
      />

      <section className="mt-10">
        <Card className="border-emerald-500/30">
          <CardHeader className="bg-emerald-500/5">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              {t(
                "Submit Evidence-Backed Product Data Proposal",
                "تقديم اقتراح تحديث بيانات مدعوم بالأدلة",
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {submitSuccess && (
              <Alert className="mb-6 border-emerald-500/40 bg-emerald-50 text-emerald-900">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                <AlertDescription>{submitSuccess}</AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {isAuthenticated ? (
              <form onSubmit={handleProposalSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("Proposal Type", "نوع التحديث المُقترح")} *</Label>
                    <select
                      value={proposalType}
                      onChange={(e) => setProposalType(e.target.value)}
                      className="w-full rounded-xl border bg-card px-3 py-2 text-sm font-medium"
                    >
                      <option value="price_update">
                        {t("Official Tariff Price Update", "تحديث السعر الرسمي المعتمد")}
                      </option>
                      <option value="discontinuation_notice">
                        {t(
                          "Discontinuation / Supply Notice",
                          "إشعار التوقف عن الإنتاج أو نقص التوريد",
                        )}
                      </option>
                      <option value="pack_leaflet_update">
                        {t(
                          "Leaflet / Package Insert Link",
                          "رابط النشرة الطبية المعتمدة",
                        )}
                      </option>
                      <option value="company_attribute_update">
                        {t(
                          "Manufacturer & Brand Attribution",
                          "نسب الملكية والمصنع لدى الغير",
                        )}
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      {t("Proposed Price (EGP)", "السعر المقترح (جنيه مصري)")}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={proposedPrice}
                      onChange={(e) => setProposedPrice(e.target.value)}
                      placeholder="e.g. 85.50"
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {t(
                      "Organization / Company Name (Optional)",
                      "اسم المنشأة أو الشركة (اختياري)",
                    )}
                  </Label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {t(
                      "Proposal Summary & Clinical Justification",
                      "ملخص التحديث والمبررات الرسمية",
                    )}{" "}
                    *
                  </Label>
                  <Textarea
                    rows={3}
                    value={proposalSummary}
                    onChange={(e) => setProposalSummary(e.target.value)}
                    className="rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    {t(
                      "Official Evidence / Decree URL",
                      "رابط المستند الرسمي أو القرار (اختياري)",
                    )}
                  </Label>
                  <Input
                    type="url"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                    className="rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl gap-2"
                >
                  <Send className="h-4 w-4" />
                  {submitting
                    ? t("Submitting Proposal...", "جاري التقديم...")
                    : t(
                        "Submit Data Proposal for Moderation →",
                        "إرسال الاقتراح للمراجعة المستقلة ←",
                      )}
                </Button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t(
                    "You must sign in to submit evidence-backed price updates or clinical product information.",
                    "يجب تسجيل الدخول لتقديم اقتراحات تحديث الأسعار أو البيانات الطبية الموثقة.",
                  )}
                </p>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl"
                  asChild
                >
                  <a
                    href={`/patient-auth?next=${encodeURIComponent(`/catalog/${product.canonical_id}`)}`}
                  >
                    {t("Sign in to contribute", "تسجيل الدخول للمساهمة")}
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <EntitySocialPanel
          entityType="medicine"
          entityId={String(product.canonical_id)}
          title={title}
        />
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function MedicineCompanyFields({
  companies,
  sourceLabel,
  t,
}: {
  companies: ManufacturerCompany[];
  sourceLabel: string | null;
  t: (en: string, ar?: string) => string;
}) {
  const parsedParties = parseMedicineCompanyParties(sourceLabel);
  const trademarkOwnerParty =
    parsedParties.find((p) => p.role === "trademark_owner") ||
    parsedParties.find((p) => p.role === "manufacturer");
  const tollManufacturerParty = parsedParties.find(
    (p) => p.role === "toll_manufacturer",
  );

  return (
    <div className="space-y-2 rounded-xl border bg-muted/10 p-3 sm:col-span-2">
      <div className="text-xs font-semibold text-muted-foreground">
        {t("Manufacturer & Brand Entities", "مصنع الدواء والعلامة التجارية")}
      </div>
      <div className="flex flex-wrap gap-2">
        {companies.length > 0 ? (
          companies.map((company) => (
            <a
              key={`${company.company_slug}-${company.relationship_role}`}
              href={`/companies/${encodeURIComponent(company.company_slug)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm hover:bg-muted/40"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{company.company_name}</span>
              <Badge variant="outline" className="ml-1 text-[10px]">
                {medicineCompanyRoleLabel(company.relationship_role, t)}
              </Badge>
            </a>
          ))
        ) : trademarkOwnerParty ? (
          <div className="flex flex-wrap gap-2">
            <a
              href={`/companies/${encodeURIComponent(trademarkOwnerParty.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm hover:bg-muted/40"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{trademarkOwnerParty.companyName}</span>
              <Badge variant="outline" className="ml-1 text-[10px]">
                {t("Trademark Owner", "مالك العلامة التجارية")}
              </Badge>
            </a>
            {tollManufacturerParty && (
              <a
                href={`/companies/${encodeURIComponent(tollManufacturerParty.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}`}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm hover:bg-muted/40"
              >
                <Handshake className="h-3.5 w-3.5" />
                <span>{tollManufacturerParty.companyName}</span>
                <Badge variant="outline" className="ml-1 text-[10px]">
                  {t("Toll Manufacturer", "المصنع لدى الغير")}
                </Badge>
              </a>
            )}
          </div>
        ) : (
          <span className="text-sm font-bold">{sourceLabel || "—"}</span>
        )}
      </div>
    </div>
  );
}
