import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductActionCard } from "@/components/product-action-card";
import { useLanguage } from "@/lib/i18n";
import {
  fetchMedicinesPage,
  type MedicineListItem,
} from "@/lib/medicines-appwrite-page";

type Mode = "similars" | "alternatives" | "company";

function decodeParam(value: string | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

export default function RelatedProductsPage() {
  const [, similars] = useRoute("/similars/:value");
  const [, alternatives] = useRoute("/alternatives/:value");
  const [, company] = useRoute("/company-products/:value");
  const mode: Mode = similars
    ? "similars"
    : alternatives
      ? "alternatives"
      : "company";
  const value = decodeParam(
    similars?.value || alternatives?.value || company?.value,
  );
  const { t } = useLanguage();
  const [items, setItems] = useState<MedicineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (mode === "similars") {
      return t(`Similars · ${value}`, `مثائل · ${value}`);
    }
    if (mode === "alternatives") {
      return t(`Alternatives · ${value}`, `بدائل · ${value}`);
    }
    return t(`Company · ${value}`, `الشركة · ${value}`);
  }, [mode, t, value]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!value) {
        setLoading(false);
        setError("Missing filter");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const filters =
          mode === "similars"
            ? { scientificName: value }
            : mode === "alternatives"
              ? { drugClass: value }
              : { manufacturer: value };
        const exact = await fetchMedicinesPage({ limit: 60, filters });
        let rows = exact.items || [];
        if (!rows.length) {
          const fallback = await fetchMedicinesPage({
            limit: 60,
            filters: { query: value },
          });
          rows = (fallback.items || []).filter((row) => {
            if (mode === "similars") {
              return String(row.scientific_name || "")
                .toLowerCase()
                .includes(value.toLowerCase());
            }
            if (mode === "alternatives") {
              return String(row.drug_class || "")
                .toLowerCase()
                .includes(value.toLowerCase());
            }
            return String(row.manufacturer || "")
              .toLowerCase()
              .includes(value.toLowerCase());
          });
        }
        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load products");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, value]);

  return (
    <main className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/medicines">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "similars"
              ? t(
                  "Products that share the same active ingredient (INN). Not a substitution instruction.",
                  "منتجات تشارك نفس المادة الفعالة. ليست تعليمة إحلال.",
                )
              : mode === "alternatives"
                ? t(
                    "Products in the same medication class. Confirm indication and dose with a licensed pharmacist.",
                    "منتجات في نفس التصنيف الدوائي. راجع الدواعي والجرعة مع صيدلي مرخص.",
                  )
                : t(
                    "Products listed under this company name in the encyclopedia.",
                    "منتجات مسجلة باسم هذه الشركة في الموسوعة.",
                  )}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("Loading…", "جاري التحميل…")}</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error ? (
        <p className="text-xs text-muted-foreground">
          {items.length} {t("products", "منتج")}
        </p>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <ProductActionCard
            key={`${item.canonical_id}-${item.name_en}`}
            product={{
              name_en: item.name_en,
              name_ar: item.name_ar,
              scientific_name: item.scientific_name,
              manufacturer: item.manufacturer,
              drug_class: item.drug_class,
              current_price_egp: item.current_price_egp,
              canonical_id: item.canonical_id,
              id_source: item.id_source,
              barcode: item.barcode,
              product_type: item.product_type,
            }}
          />
        ))}
      </div>
    </main>
  );
}
