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
import type { MedicineListItem } from "@/lib/medicines-appwrite-page";

type View = "grid" | "comfortable" | "list";

function monographHref(item: MedicineListItem): string {
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

export function EncyclopediaCatalogCard({
  item,
  view,
  showIngredient,
  showDrugClass,
  showManufacturer,
}: {
  item: MedicineListItem;
  view: View;
  showIngredient: boolean;
  showDrugClass: boolean;
  showManufacturer: boolean;
}) {
  const { t } = useLanguage();
  const href = monographHref(item);
  const title = item.name_en || item.name_ar || "Unnamed Medicine";
  const img = displayImageUrl(item.image_url);
  const isList = view === "list";
  const isComfort = view === "comfortable";
  const formLine = [item.dosage_form, item.strength].filter(Boolean).join(" · ");
  const inn = String(item.scientific_name || "").trim();
  const klass = String(item.drug_class || "").trim();
  const company = String(item.manufacturer || "").trim();

  return (
    <Card className="group overflow-hidden rounded-2xl border-border/70 shadow-none hover:border-emerald-500/35 hover:shadow-sm transition-all">
      <div className={isList ? "flex flex-row gap-0 h-full" : "flex flex-col h-full"}>
        <Link href={href} className={isList ? "shrink-0" : "block"}>
          <div
            className={
              isList
                ? "relative w-14 h-14 sm:w-16 sm:h-16 bg-muted/30 overflow-hidden"
                : isComfort
                  ? "relative w-full aspect-[2/1] max-h-[100px] bg-muted/30 overflow-hidden"
                  : "relative w-full aspect-[5/4] max-h-[96px] sm:max-h-[110px] bg-muted/30 overflow-hidden"
            }
          >
            {img ? (
              <img src={img} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                <span className="text-xl">💊</span>
              </div>
            )}
          </div>
        </Link>
        <CardContent className={`flex-1 min-w-0 flex flex-col justify-between ${isList ? "py-2 px-2.5" : "p-2.5"} gap-1`}>
          <div className="min-w-0">
            <Link href={href} className="min-w-0">
              <h4
                className={`font-semibold text-foreground group-hover:text-emerald-700 line-clamp-2 leading-snug ${
                  isList || isComfort ? "text-sm" : "text-[12px] sm:text-sm"
                }`}
              >
                {title}
              </h4>
            </Link>
            {item.name_ar && item.name_en ? (
              <p className="text-[10px] text-muted-foreground dir-rtl mt-0.5 line-clamp-1">{item.name_ar}</p>
            ) : null}
            {formLine ? (
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{formLine}</p>
            ) : null}
            {(showIngredient || showDrugClass || showManufacturer) && (
              <div className="mt-1 space-y-0.5 text-[10px]">
                {showIngredient && inn ? (
                  <Link href={genericCollectionUrl(inn)} className="block truncate font-mono text-sky-700 hover:underline">
                    {inn}
                  </Link>
                ) : null}
                {showDrugClass && klass ? (
                  <Link href={alternativesCollectionUrl(klass)} className="block truncate text-sky-700 hover:underline">
                    {klass}
                  </Link>
                ) : null}
                {showManufacturer && company ? (
                  <Link href={companyCollectionUrl(company)} className="block truncate font-medium text-sky-800 hover:underline">
                    {company}
                  </Link>
                ) : null}
              </div>
            )}
          </div>
          <p className="text-[13px] font-bold text-emerald-600 tabular-nums leading-none pt-0.5">
            {item.current_price_egp
              ? `${Number(item.current_price_egp).toFixed(2)} EGP`
              : t("Price on request", "السعر حسب الطلب")}
          </p>
          {inn || klass ? (
            <div className="flex flex-wrap gap-1">
              {inn ? (
                <Link
                  href={similarsCollectionUrl(inn)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-800 hover:bg-sky-100"
                >
                  <FlaskConical className="h-2.5 w-2.5" />
                  {t("Similars", "مثائل")}
                </Link>
              ) : null}
              {klass ? (
                <Link
                  href={alternativesCollectionUrl(klass)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[9px] font-medium text-teal-800 hover:bg-teal-100"
                >
                  <Layers className="h-2.5 w-2.5" />
                  {t("Alternatives", "بدائل")}
                </Link>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </div>
    </Card>
  );
}
