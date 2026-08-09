import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { AlertCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MedicineWebEnrichmentPanel } from "@/components/medicine-web-enrichment-panel";
import { useLanguage } from "@/lib/i18n";
import {
  isNameKeyedCatalogId,
  isPlaceholderCatalogProduct,
  isSyntheticStaticCatalogId,
  parseNameKeyedCatalogId,
} from "@/lib/catalog-links";
import { isLikelyWhoEssential, searchWhoEmlLocal } from "@/lib/medicine-aggregator";
import { scoreProductFields } from "@/lib/arabic-fuzzy-match";
import {
  fetchMedicineByCanonicalId,
  fetchMedicineByName,
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";

type Product = {
  id: string;
  canonical_id?: number;
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  indications?: string | null;
  description?: string | null;
  price_egp?: number | null;
  image_url?: string | null;
  [key: string]: unknown;
};

function fromAppwriteItem(item: MedicineListItem): Product {
  return {
    id: item.$id || String(item.canonical_id),
    canonical_id: item.canonical_id,
    name_en: item.name_en,
    name_ar: item.name_ar,
    scientific_name: item.scientific_name,
    manufacturer: item.manufacturer,
    drug_class: item.drug_class,
    price_egp: item.current_price_egp,
    image_url: item.image_url,
    id_source: item.id_source,
  };
}

/** Resolve product from Appwrite (preferred) then limited legacy catalog API. */
async function resolveCatalogProduct(
  idOrName: string,
): Promise<Product | null> {
  const nameKey = isNameKeyedCatalogId(idOrName)
    ? parseNameKeyedCatalogId(idOrName)
    : null;
  const searchKey = (nameKey || idOrName).trim();
  if (!searchKey) return null;

  // —— Numeric canonical_id: exact equality (never text-search the number)
  if (/^\d+$/.test(searchKey) && !isSyntheticStaticCatalogId(searchKey)) {
    const byId = await fetchMedicineByCanonicalId(Number(searchKey));
    if (byId) {
      const p = fromAppwriteItem(byId);
      if (!isPlaceholderCatalogProduct(p)) return p;
    }
  }

  // —— Name-keyed / free-text via dedicated name resolver
  if (nameKey || !/^\d+$/.test(searchKey)) {
    const byName = await fetchMedicineByName(searchKey);
    if (byName) {
      const p = fromAppwriteItem(byName);
      if (!isPlaceholderCatalogProduct(p)) {
        // Rewrite URL to stable numeric id when live
        if (
          typeof window !== "undefined" &&
          byName.canonical_id &&
          byName.id_source === "live_db" &&
          !isSyntheticStaticCatalogId(String(byName.canonical_id))
        ) {
          const livePath = `/catalog/${byName.canonical_id}`;
          if (!window.location.pathname.endsWith(livePath)) {
            window.history.replaceState(null, "", livePath);
          }
        }
        return p;
      }
    }
    // Fuzzy fallback on search page results
    const page = await fetchMedicinesPage({
      limit: 24,
      filters: { query: searchKey },
    });
    let best: MedicineListItem | null = null;
    let bestScore = 0;
    for (const item of page.items) {
      const { score } = scoreProductFields(searchKey, {
        name_en: item.name_en,
        name_ar: item.name_ar,
        scientific_name: item.scientific_name,
      });
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best && bestScore >= 40) {
      const p = fromAppwriteItem(best);
      if (!isPlaceholderCatalogProduct(p)) return p;
    }
  }

  // —— Legacy limited catalog API (fallback only)
  try {
    const res = await fetch("/api/medicines/catalog?limit=500");
    const data = (await res.json().catch(() => ({}))) as {
      products?: Product[];
    };
    const list = data.products || [];
    let best: Product | null = null;
    let bestScore = 0;
    for (const p of list) {
      if (p.id === idOrName || String(p.id) === searchKey || String(p.canonical_id) === searchKey) {
        best = p;
        bestScore = 100;
        break;
      }
      const { score } = scoreProductFields(searchKey, {
        name_en: p.name_en,
        name_ar: p.name_ar,
        scientific_name: p.scientific_name,
      });
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (
      best &&
      isSyntheticStaticCatalogId(String(best.id || "")) &&
      bestScore < 55 &&
      !nameKey
    ) {
      best = null;
    }
    if (best && isPlaceholderCatalogProduct(best)) best = null;
    if (best && bestScore >= 40) return best;
  } catch {
    /* ignore */
  }

  return null;
}

function useCatalogProduct(idOrName: string | undefined): {
  product: Product | null;
  loading: boolean;
  error: string | null;
} {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!idOrName) {
        setLoading(false);
        setError("Missing product id");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const best = await resolveCatalogProduct(idOrName);
        if (!cancelled) {
          if (!best) {
            setError("Product not found");
            setProduct(null);
          } else {
            setProduct(best);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [idOrName]);

  return { product, loading, error };
}

export default function MedicineDetailPage() {
  const [, p1] = useRoute("/medicines/:id");
  const [, p2] = useRoute("/medicine/:id");
  const [, p3] = useRoute("/catalog/:id");
  const id = p1?.id || p2?.id || p3?.id;
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const { product, loading, error } = useCatalogProduct(id);

  const whoEssential = useMemo(() => {
    if (!product) return false;
    const keys = [
      product.scientific_name,
      product.name_en,
      product.name_ar,
    ].filter(Boolean) as string[];
    for (const k of keys) {
      if (isLikelyWhoEssential(k, 85)) return true;
    }
    return false;
  }, [product]);

  const whoHits = useMemo(() => {
    if (!product) return [];
    const q =
      product.scientific_name || product.name_en || product.name_ar || "";
    return searchWhoEmlLocal(q, 3, 70);
  }, [product]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6" dir={ar ? "rtl" : "ltr"}>
        <p className="text-sm text-muted-foreground">
          {t("Loading…", "جاري التحميل…")}
        </p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6" dir={ar ? "rtl" : "ltr"}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || t("Product not found", "المنتج غير موجود")}
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <a href="/medicines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("Back to encyclopedia", "العودة للموسوعة")}
          </a>
        </Button>
        {id && (
          <p className="text-sm text-muted-foreground">
            <a
              href={`/medicines?q=${encodeURIComponent(
                isNameKeyedCatalogId(id)
                  ? parseNameKeyedCatalogId(id) || id
                  : id,
              )}`}
              className="text-sky-700 underline-offset-4 hover:underline"
            >
              {t("Search encyclopedia for this name", "ابحث في الموسوعة عن هذا الاسم")}
            </a>
          </p>
        )}
      </main>
    );
  }

  const title =
    (ar ? product.name_ar || product.name_en : product.name_en || product.name_ar) ||
    product.scientific_name ||
    product.id;

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-16" dir={ar ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/medicines">
            <ArrowLeft className="h-4 w-4" />
          </a>
        </Button>
        <h1 className="text-xl font-semibold">{title}</h1>
        {whoEssential && (
          <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {t("WHO Essential", "دواء أساسي (WHO)")}
          </Badge>
        )}
      </div>

      {product.image_url && (
        <img
          src={String(product.image_url)}
          alt={title}
          className="max-h-48 rounded-lg border object-contain"
        />
      )}

      <Card>
        <CardContent className="space-y-2 p-4 text-sm">
          {product.scientific_name && (
            <p>
              <span className="text-muted-foreground">{t("INN", "الاسم العلمي")}: </span>
              {product.scientific_name}
            </p>
          )}
          {product.manufacturer && (
            <p>
              <span className="text-muted-foreground">{t("Manufacturer", "الشركة")}: </span>
              {product.manufacturer}
            </p>
          )}
          {product.drug_class && (
            <p>
              <span className="text-muted-foreground">{t("Class", "التصنيف")}: </span>
              {product.drug_class}
            </p>
          )}
          {product.price_egp != null && (
            <p>
              <span className="text-muted-foreground">{t("Price (EGP)", "السعر")}: </span>
              {product.price_egp}
            </p>
          )}
          {(product.indications || product.description) && (
            <p className="pt-2 leading-relaxed">
              {String(product.indications || product.description)}
            </p>
          )}
        </CardContent>
      </Card>

      {whoHits.length > 0 && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <AlertDescription className="text-emerald-900 text-sm">
            {t(
              "Matches WHO Essential Medicines List:",
              "يطابق قائمة الأدوية الأساسية لمنظمة الصحة العالمية:",
            )}{" "}
            {whoHits.map((h) => h.name_en).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <MedicineWebEnrichmentPanel
        product={{
          id: product.id,
          name_en: product.name_en,
          name_ar: product.name_ar,
          scientific_name: product.scientific_name,
          manufacturer: product.manufacturer,
          drug_class: product.drug_class,
          indications: product.indications || product.description,
        }}
      />

      <p className="text-xs text-muted-foreground">
        <a
          href={`/world-search?q=${encodeURIComponent(
            product.scientific_name || product.name_en || "",
          )}`}
          className="text-sky-700 underline-offset-4 hover:underline"
        >
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
