import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MedicineWebEnrichmentPanel } from "@/components/medicine-web-enrichment-panel";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import {
  encyclopediaSearchUrl,
  isNameKeyedCatalogId,
  isPlaceholderCatalogProduct,
  isSyntheticStaticCatalogId,
  normalizeTradeName,
  parseNameKeyedCatalogId,
} from "@/lib/catalog-links";

type Product = {
  canonical_id: number;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  drug_class: string | null;
  route: string | null;
  category: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  current_price_egp?: number | null;
  has_verified_dataset?: boolean;
  image_url?: string | null;
};

function nameMatchScore(wantedNorm: string, candidateName: string | null | undefined): number {
  const en = normalizeTradeName(candidateName || "");
  if (!wantedNorm || !en) return 0;
  if (en === wantedNorm) return 100;
  if (en.length >= 4 && wantedNorm.length >= 4) {
    if (en.startsWith(wantedNorm) || wantedNorm.startsWith(en)) return 90;
    if (en.includes(wantedNorm) || wantedNorm.includes(en)) return 70;
  }
  const w0 = wantedNorm.split(" ")[0] || "";
  const e0 = en.split(" ")[0] || "";
  if (w0.length >= 4 && e0.length >= 4 && (w0 === e0 || w0.startsWith(e0) || e0.startsWith(w0))) {
    return 50;
  }
  return 0;
}

function pickBestNameMatch(rows: Product[], wanted: string): Product | null {
  if (!rows.length) return null;
  const tNorm = normalizeTradeName(wanted);
  if (!tNorm) return null;
  let best: Product | null = null;
  let bestScore = 0;
  for (const r of rows) {
    const score = Math.max(nameMatchScore(tNorm, r.name_en), nameMatchScore(tNorm, r.name_ar));
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (bestScore < 50) return null;
  return best;
}

function rowMatchesWantedName(row: Product, tNorm: string): boolean {
  return nameMatchScore(tNorm, row.name_en) >= 50 || nameMatchScore(tNorm, row.name_ar) >= 50;
}

export default function MedicineDetailPage() {
  const { t } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [, params] = useRoute("/catalog/:id");
  const [, paramsMed] = useRoute("/medicines/:id");
  const rawId = decodeURIComponent(params?.id || paramsMed?.id || "");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawId) {
      setError(t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."));
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let mainProd: Product | null = null;

        if (isNameKeyedCatalogId(rawId)) {
          const wanted = parseNameKeyedCatalogId(rawId) || "";
          if (!wanted) {
            setError(t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."));
            return;
          }
          const exactPath = `/rest/v1/medicines?select=*&name_en=eq.${encodeURIComponent(wanted)}&limit=5`;
          let data = await supabaseFetch<Product[]>(exactPath);
          let rows = Array.isArray(data) ? data : [];
          if (rows.length) {
            const strict = pickBestNameMatch(rows, wanted);
            rows = strict ? [strict] : [];
          }
          if (!rows.length) {
            const broad = await supabaseFetch<Product[]>(`/rest/v1/medicines?select=*&limit=5000`);
            const all = Array.isArray(broad) ? broad : [];
            const tNorm = normalizeTradeName(wanted);
            rows = all.filter((r) => rowMatchesWantedName(r, tNorm));
          }
          mainProd = pickBestNameMatch(rows, wanted);
          if (!mainProd) {
            try {
              const dsRes = await fetch("/data/egyptian-medicines-dataset.json");
              if (dsRes.ok) {
                const ds = await dsRes.json();
                const meds = ds.medicines || ds || [];
                const tNorm = normalizeTradeName(wanted);
                const candidates = (Array.isArray(meds) ? meds : []).filter((row: Product) =>
                  rowMatchesWantedName(row, tNorm),
                );
                const hit = pickBestNameMatch(candidates as Product[], wanted);
                if (hit) mainProd = hit as Product;
              }
            } catch {
              /* ignore */
            }
          }
          if (!mainProd) {
            window.location.replace(encyclopediaSearchUrl(wanted));
            return;
          }
          if (
            mainProd.canonical_id &&
            !isSyntheticStaticCatalogId(mainProd.canonical_id) &&
            !isPlaceholderCatalogProduct(mainProd)
          ) {
            window.history.replaceState(null, "", `/catalog/${mainProd.canonical_id}`);
          }
        } else {
          const canonicalId = parseInt(rawId.replace(/^med_/, ""), 10);
          const isNumeric = !isNaN(canonicalId);
          let queryPath = `/rest/v1/medicines?select=*&limit=1`;
          if (isNumeric) {
            queryPath = `/rest/v1/medicines?select=*&canonical_id=eq.${canonicalId}&limit=1`;
          }
          const data = await supabaseFetch<Product[]>(queryPath);
          if (Array.isArray(data) && data.length > 0) mainProd = data[0];

          if (
            mainProd &&
            (isPlaceholderCatalogProduct(mainProd) || isSyntheticStaticCatalogId(canonicalId))
          ) {
            try {
              const dsRes = await fetch("/data/egyptian-medicines-dataset.json");
              if (dsRes.ok) {
                const ds = await dsRes.json();
                const meds = ds.medicines || ds || [];
                const staticHit = (Array.isArray(meds) ? meds : []).find(
                  (row: { canonical_id?: number }) =>
                    Number(row.canonical_id) === Number(canonicalId),
                );
                if (staticHit?.name_en) {
                  mainProd = { ...mainProd, ...staticHit } as Product;
                  window.history.replaceState(
                    null,
                    "",
                    `/catalog/n~${encodeURIComponent(String(staticHit.name_en))}`,
                  );
                }
              }
            } catch {
              /* ignore */
            }
          }

          if (mainProd && isPlaceholderCatalogProduct(mainProd)) {
            setError(
              t(
                "This catalog ID points to a placeholder entry. Search by product name instead.",
                "معرّف الكتالوج يشير إلى سجل مؤقت. ابحث باسم المنتج بدلاً من ذلك.",
              ),
            );
            setProduct(null);
            return;
          }
        }

        if (!mainProd) {
          setError(t("Medicine product not found.", "لم يتم العثور على المنتج الدوائي."));
          return;
        }
        setProduct(mainProd);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : t("Could not load product details.", "تعذر تحميل تفاصيل المنتج."),
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [rawId, supabaseFetch, t]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <p className="text-muted-foreground">{t("Loading…", "جاري التحميل…")}</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-10 space-y-4">
        <Button variant="ghost" asChild>
          <a href="/medicines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("Back to Medicine Directory", "العودة إلى دليل الأدوية")}
          </a>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || t("Not found", "غير موجود")}</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <a href="/medicines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("Back to Medicine Directory", "العودة إلى دليل الأدوية")}
          </a>
        </Button>
        <Badge variant="outline">Canonical ID: {product.canonical_id}</Badge>
      </div>

      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 space-y-2">
          <div className="flex flex-wrap gap-2">
            {product.has_verified_dataset && (
              <Badge className="bg-white/20 text-white border-0">EDA Verified</Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">{product.name_en || "—"}</h1>
          {product.name_ar && <p className="opacity-90">{product.name_ar}</p>}
          <p className="text-sm opacity-90">{product.scientific_name || "—"}</p>
          <div className="pt-2">
            <div className="text-xs uppercase tracking-wide opacity-80">
              {t("Official tariff price", "السعر الرسمي")}
            </div>
            <div className="text-2xl font-extrabold">
              {product.current_price_egp != null
                ? `EGP ${Number(product.current_price_egp).toFixed(2)}`
                : "—"}
            </div>
          </div>
        </div>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">{t("Manufacturer", "الشركة")}</div>
            <div className="font-medium">{product.manufacturer || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("Drug class", "التصنيف")}</div>
            <div className="font-medium">{product.drug_class || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("Route", "طريقة الاستخدام")}</div>
            <div className="font-medium">{product.route || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("Category", "الفئة")}</div>
            <div className="font-medium">{product.category || "—"}</div>
          </div>
        </CardContent>
      </Card>

      <MedicineWebEnrichmentPanel
        product={{
          name_en: product.name_en,
          name_ar: product.name_ar,
          scientific_name: product.scientific_name,
          manufacturer: product.manufacturer,
          drug_class: product.drug_class,
          current_price_egp: product.current_price_egp,
          image_url: product.image_url,
        }}
      />

      <p className="text-center text-xs text-muted-foreground">
        <a href="/world-search" className="text-sky-700 underline-offset-4 hover:underline">
          {t("World medicine search", "بحث عالمي عن الأدوية")}
        </a>
        {" · "}
        <a href="/medicines" className="text-sky-700 underline-offset-4 hover:underline">
          {t("Local encyclopedia", "الموسوعة المحلية")}
        </a>
      </p>
    </main>
  );
}
