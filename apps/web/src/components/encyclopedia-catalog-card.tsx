import { FlaskConical, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  alternativesCollectionUrl,
  companyCollectionUrl,
  encyclopediaProductUrl,
  genericCollectionUrl,
  similarsCollectionUrl,
} from "@/lib/catalog-links";
import { useLanguage } from "@/lib/i18n";
import {
  formatCatalogPriceRange,
  formatCatalogTitle,
  type CatalogCardModel,
} from "@/lib/encyclopedia-catalog";
import { PackshotFrame } from "@/components/packshot-frame";
import {
  classifyProductType,
  cleanAttribute,
  type ProductType,
} from "@/lib/product-type";

type View = "grid" | "comfortable" | "list";

function monographHref(item: CatalogCardModel): string {
  const pub = String(item.public_url || "").trim();
  if (pub.startsWith("/medicines")) return pub;
  return encyclopediaProductUrl({
    nameEn: item.name_en || item.name_ar,
    canonicalId: item.canonical_id,
    idSource: item.id_source === "live_db" ? "live_db" : "unknown",
  });
}

function displayImageUrl(url?: string | null): string | null {
  if (!url || !String(url).trim()) return null;
  if (/unsplash\.com|placeholder|via\.placeholder|no_image/i.test(url)) return null;
  return url;
}

function productTypeEmoji(type: ProductType): string {
  switch (type) {
    case "medical_device":
      return "🩺";
    case "cosmetic":
    case "cosmeceutical":
      return "🧴";
    case "fragrance":
      return "🌸";
    case "personal_care":
      return "🧼";
    case "nutrition":
    case "baby_formula":
      return "🥗";
    case "medicine":
      return "💊";
    default:
      return "📦";
  }
}

function inferDeviceEmoji(name: string): string | null {
  const n = name.toLowerCase();
  if (/\b(bandage|gauze|guaze|plaster|dressing)\b/.test(n)) return "🩹";
  if (/\b(condom|condomos)\b/.test(n)) return "🛡️";
  if (/\b(blood|bolood|pressure|wrist|monitor|glucometer|thermometer)\b/.test(n)) return "📟";
  if (/\b(syringe|needle)\b/.test(n)) return "💉";
  if (/\b(mask|glove)\b/.test(n)) return "🧤";
  return null;
}

export function EncyclopediaCatalogCard({
  item,
  view,
  showIngredient,
  showDrugClass,
  showManufacturer,
}: {
  item: CatalogCardModel;
  view: View;
  showIngredient: boolean;
  showDrugClass: boolean;
  showManufacturer: boolean;
}) {
  const { t } = useLanguage();
  const href = monographHref(item);
  const rawTitle = item.name_en || item.name_ar || "";
  const title = formatCatalogTitle(rawTitle) || t("Unnamed product", "منتج بدون اسم");
  const img = displayImageUrl(item.image_url);
  const isList = view === "list";
  const isComfort = view === "comfortable";
  const formLine = [cleanAttribute(item.dosage_form), cleanAttribute(item.strength)]
    .filter(Boolean)
    .join(" · ");
  const inn = cleanAttribute(item.scientific_name);
  const klass = cleanAttribute(item.drug_class);
  const company = cleanAttribute(item.manufacturer);
  const classified = classifyProductType(item);
  const emoji =
    inferDeviceEmoji(rawTitle) || productTypeEmoji(classified.product_type);
  const variantCount = item.variant_count && item.variant_count > 1 ? item.variant_count : 0;
  const priceLabel = formatCatalogPriceRange(
    item.price_min_egp,
    item.price_max_egp,
    item.current_price_egp,
  );
  const showTypeChip =
    classified.product_type !== "medicine" && classified.product_type !== "unknown";

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/70 bg-card shadow-none hover:border-emerald-500/45 hover:shadow-sm transition-all focus-within:ring-2 focus-within:ring-emerald-500/25">
      <div className={isList ? "flex flex-row gap-0 h-full" : "flex flex-col h-full"}>
        <Link href={href} className={isList ? "shrink-0" : "block"}>
          <PackshotFrame
            url={img}
            emoji={emoji}
            variant={isList ? "list" : isComfort ? "comfort" : "card"}
          >
            {variantCount > 0 ? (
              <span className="absolute top-1.5 end-1.5 z-10 rounded-full bg-emerald-700/90 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
                {variantCount} {t("variants", "تنويعات")}
              </span>
            ) : null}
          </PackshotFrame>
        </Link>
        <CardContent
          className={`flex-1 min-w-0 flex flex-col justify-between ${isList ? "py-2 px-2.5" : "p-2.5"} gap-1`}
        >
          <div className="min-w-0 space-y-0.5">
            <Link href={href} className="min-w-0">
              <h4
                className={`font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300 line-clamp-2 leading-snug tracking-tight ${
                  isList || isComfort ? "text-sm" : "text-[13px] sm:text-sm"
                }`}
              >
                {title}
              </h4>
            </Link>
            {item.name_ar && item.name_en && scrubArabicDiffers(item.name_ar, title) ? (
              <p className="text-[10px] text-muted-foreground dir-rtl line-clamp-1">{item.name_ar}</p>
            ) : null}
            {formLine ? (
              <p className="text-[10px] text-muted-foreground line-clamp-1">{formLine}</p>
            ) : null}
            {showTypeChip ? (
              <span className="inline-flex rounded-full bg-teal-50 text-teal-800 border border-teal-100 px-1.5 py-0.5 text-[9px] font-medium">
                {classified.product_type === "medical_device"
                  ? t("Device / supply", "جهاز / مستلزم")
                  : classified.product_type === "personal_care"
                    ? t("Personal care", "عناية شخصية")
                    : classified.product_type === "cosmetic" || classified.product_type === "cosmeceutical"
                      ? t("Cosmetic", "تجميل")
                      : classified.product_type === "fragrance"
                        ? t("Fragrance", "عطر")
                        : classified.product_type === "nutrition" || classified.product_type === "baby_formula"
                          ? t("Nutrition", "تغذية")
                          : t("Product", "منتج")}
              </span>
            ) : null}
            {(showIngredient || showDrugClass || showManufacturer) && (inn || klass || company) ? (
              <div className="mt-0.5 space-y-0.5 text-[10px]">
                {showIngredient && inn ? (
                  <Link
                    href={genericCollectionUrl(inn)}
                    className="block truncate font-mono text-sky-700 hover:underline"
                  >
                    {inn}
                  </Link>
                ) : null}
                {showDrugClass && klass ? (
                  <Link
                    href={alternativesCollectionUrl(klass)}
                    className="block truncate text-sky-700 hover:underline"
                  >
                    {klass}
                  </Link>
                ) : null}
                {showManufacturer && company ? (
                  <Link
                    href={companyCollectionUrl(company)}
                    className="block truncate font-medium text-sky-800 hover:underline"
                  >
                    {company}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="pt-0.5 space-y-1">
            <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums leading-none">
              {priceLabel || t("Price on request", "السعر حسب الطلب")}
            </p>
            {inn || klass ? (
              <div className="flex flex-wrap gap-1">
                {inn ? (
                  <Link
                    href={similarsCollectionUrl(inn)}
                    className="inline-flex items-center gap-0.5 rounded-full border border-sky-200/80 bg-sky-50/80 px-1.5 py-0.5 text-[9px] font-medium text-sky-800 hover:bg-sky-100"
                  >
                    <FlaskConical className="h-2.5 w-2.5" />
                    {t("Similars", "مثائل")}
                  </Link>
                ) : null}
                {klass ? (
                  <Link
                    href={alternativesCollectionUrl(klass)}
                    className="inline-flex items-center gap-0.5 rounded-full border border-teal-200/80 bg-teal-50/80 px-1.5 py-0.5 text-[9px] font-medium text-teal-800 hover:bg-teal-100"
                  >
                    <Layers className="h-2.5 w-2.5" />
                    {t("Alternatives", "بدائل")}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function scrubArabicDiffers(ar: string, enTitle: string): boolean {
  const a = ar.trim();
  if (!a) return false;
  // Avoid repeating Latin junk as "Arabic" subtitle when name_ar mirrors name_en
  if (/^[A-Za-z0-9\s\-–—./]+$/.test(a) && a.toLowerCase().includes(enTitle.slice(0, 8).toLowerCase())) {
    return false;
  }
  return true;
}
