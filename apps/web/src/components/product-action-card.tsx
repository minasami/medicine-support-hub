import { Link } from "wouter";
import { Building2, ExternalLink, FlaskConical, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  alternativesCollectionUrl,
  companyCollectionUrl,
  encyclopediaProductUrl,
  genericCollectionUrl,
  similarsCollectionUrl,
} from "@/lib/catalog-links";
import { useLanguage } from "@/lib/i18n";

export type ProductActionFields = {
  name_en?: string | null;
  name_ar?: string | null;
  scientific_name?: string | null;
  manufacturer?: string | null;
  drug_class?: string | null;
  current_price_egp?: number | null;
  price_egp?: number | null;
  canonical_id?: number | string | null;
  id_source?: "live_db" | "static_dataset" | "unknown";
  barcode?: string | null;
  product_type?: string | null;
};

export function ProductActionCard({
  product,
  showMonograph = true,
}: {
  product: ProductActionFields;
  showMonograph?: boolean;
}) {
  const { t } = useLanguage();
  const title = product.name_en || product.name_ar || product.scientific_name || "—";
  const price = product.current_price_egp ?? product.price_egp;
  const inn = String(product.scientific_name || "").trim();
  const company = String(product.manufacturer || "").trim();
  const klass = String(product.drug_class || "").trim();
  const monograph = encyclopediaProductUrl({
    nameEn: product.name_en,
    nameAr: product.name_ar,
    canonicalId: product.canonical_id,
    idSource: product.id_source || "unknown",
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-6">{title}</CardTitle>
        {product.name_ar && product.name_en ? (
          <p className="text-sm text-muted-foreground" dir="rtl">
            {product.name_ar}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          {inn ? (
            <p>
              <span className="text-muted-foreground">{t("Active / generic", "المادة الفعالة")} : </span>
              <Link href={genericCollectionUrl(inn)} className="text-sky-700 underline-offset-4 hover:underline">
                {inn}
              </Link>
            </p>
          ) : null}
          {company ? (
            <p>
              <span className="text-muted-foreground">{t("Company", "الشركة")} : </span>
              <Link href={companyCollectionUrl(company)} className="text-sky-700 underline-offset-4 hover:underline">
                {company}
              </Link>
            </p>
          ) : null}
          {klass ? (
            <p>
              <span className="text-muted-foreground">{t("Class", "التصنيف")} : </span>
              <Link href={alternativesCollectionUrl(klass)} className="text-sky-700 underline-offset-4 hover:underline">
                {klass}
              </Link>
            </p>
          ) : null}
          {price != null ? (
            <Badge className="bg-emerald-600 text-white">{price} EGP</Badge>
          ) : null}
          {product.barcode ? (
            <p className="font-mono text-xs text-muted-foreground">{product.barcode}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="rounded-xl" disabled={!inn}>
            <Link href={inn ? similarsCollectionUrl(inn) : "/medicines"}>
              <FlaskConical className="mr-1 h-4 w-4" />
              {t("Similars", "مثائل")}
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl" disabled={!klass}>
            <Link href={klass ? alternativesCollectionUrl(klass) : "/medicines"}>
              <Layers className="mr-1 h-4 w-4" />
              {t("Alternatives", "بدائل")}
            </Link>
          </Button>
        </div>

        {showMonograph ? (
          <Button asChild className="w-full rounded-xl bg-teal-700 hover:bg-teal-800">
            <Link href={monograph}>
              {t("Open product", "فتح المنتج")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}

        {company ? (
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={companyCollectionUrl(company)}>
              <Building2 className="mr-1 h-4 w-4" />
              {t("Company portfolio", "محفظة الشركة")}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
