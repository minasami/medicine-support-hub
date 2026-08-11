import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  Globe2,
  Loader2,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ImageIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  autoEnrichIfNeeded,
  buildWorldSourceLinks,
  suggestExternalEnrichment,
  worldSourceLabel,
  type AggregatorHit,
  type LocalMedicineLike,
} from "@/lib/medicine-aggregator";
import {
  applySessionEnrichment,
  getSessionEnrichment,
} from "@/lib/session-medicine-enrichment";
import { useLanguage } from "@/lib/i18n";

type Props = {
  product: LocalMedicineLike;
  onApplied?: (patch: Record<string, string | boolean>) => void;
};

function kindLabel(kind: string, ar: boolean): string {
  const map: Record<string, [string, string]> = {
    who_eml: ["WHO EML", "قائمة الأدوية الأساسية"],
    openfda: ["OpenFDA", "OpenFDA"],
    rxnorm: ["RxNorm", "RxNorm"],
    pubchem: ["PubChem", "PubChem"],
    drugeye: ["DrugEye", "DrugEye"],
    dailymed: ["DailyMed", "DailyMed"],
    local: ["Local", "محلي"],
  };
  const pair = map[kind] || [kind, kind];
  return ar ? pair[1] : pair[0];
}

export function MedicineWebEnrichmentPanel({ product, onApplied }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const t = (en: string, arText: string) => (ar ? arText : en);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<AggregatorHit[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [patch, setPatch] = useState<Record<string, string | boolean>>({});
  const [provenance, setProvenance] = useState<Record<string, string>>({});
  const [whoEssential, setWhoEssential] = useState(false);
  const [structureImageUrl, setStructureImageUrl] = useState<string | null>(null);
  const [structureSourceUrl, setStructureSourceUrl] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const ran = useRef(false);

  const query = useMemo(() => {
    return (
      product.scientific_name ||
      product.name_en ||
      product.name_ar ||
      ""
    ).trim();
  }, [product]);

  const links = useMemo(() => buildWorldSourceLinks(query || "medicine"), [query]);

  const displayImage =
    (typeof product.image_url === "string" && product.image_url.trim()) ||
    structureImageUrl ||
    null;
  const displayImageIsStructure =
    !!(structureImageUrl && displayImage === structureImageUrl);

  useEffect(() => {
    if (ran.current || !query) return;
    ran.current = true;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const existing = getSessionEnrichment({
          id: product.id != null ? String(product.id) : null,
          name_en: product.name_en,
        });
        if (existing && Object.keys(existing).length > 1) {
          setApplied(true);
        }
        const auto = await autoEnrichIfNeeded(product);
        if (cancelled) return;
        setPatch(auto.patch);
        setProvenance(auto.provenance);
        setWhoEssential(Boolean(auto.merged.who_essential));
        if (auto.merged.structure_image_url) {
          setStructureImageUrl(auto.merged.structure_image_url);
          const cid = auto.merged.external_ids?.pubchem;
          setStructureSourceUrl(
            cid
              ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`
              : "https://pubchem.ncbi.nlm.nih.gov/",
          );
        }
        const sug = await suggestExternalEnrichment(query);
        if (cancelled) return;
        setHits(sug.hits);
        setErrors(sug.errors);
        if (!auto.merged.structure_image_url) {
          const pub = sug.hits.find((h) => h.pubchem_cid || h.source === "pubchem");
          if (pub?.pubchem_cid) {
            setStructureImageUrl(
              `https://pubchem.ncbi.nlm.nih.gov/image/imgsrv.fcgi?cid=${pub.pubchem_cid}&t=l`,
            );
            setStructureSourceUrl(
              `https://pubchem.ncbi.nlm.nih.gov/compound/${pub.pubchem_cid}`,
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErrors([e instanceof Error ? e.message : String(e)]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product, query]);

  const handleApply = () => {
    if (!Object.keys(patch).length) return;
    const rxcui = hits.find((h) => h.rxcui)?.rxcui;
    const pubchem = hits.find((h) => h.pubchem_cid)?.pubchem_cid;
    applySessionEnrichment(
      {
        id: product.id != null ? String(product.id) : null,
        name_en: product.name_en,
      },
      {
        ...patch,
        rxcui: rxcui || undefined,
        pubchem_cid: pubchem != null ? String(pubchem) : undefined,
        provenance,
      },
    );
    setApplied(true);
    onApplied?.(patch);
  };

  const whoHits = hits.filter((h) => h.source === "who_eml");
  const otherHits = hits.filter((h) => h.source !== "who_eml");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          {t("Federated enrichment", "إثراء من مصادر عالمية")}
          {whoEssential && (
            <Badge className="bg-emerald-100 text-emerald-900">
              <ShieldCheck className="mr-1 h-3 w-3" />
              WHO
            </Badge>
          )}
          {applied && (
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-800">
              <Check className="mr-1 h-3 w-3" />
              {t("Applied this session", "مُطبَّق لهذه الجلسة")}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          {t(
            "Egyptian local data wins. External sources only fill missing fields with provenance.",
            "البيانات المحلية المصرية لها الأولوية. المصادر الخارجية تملأ الحقول الناقصة فقط مع إثبات المصدر.",
          )}
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("Searching…", "جاري البحث…")}
          </div>
        )}

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{errors.join("; ")}</AlertDescription>
          </Alert>
        )}

        {displayImage && (
          <div className="flex flex-wrap items-start gap-3 rounded-md border bg-muted/30 p-3">
            <img
              src={displayImage}
              alt={product.scientific_name || product.name_en || query}
              className="h-24 w-24 rounded border bg-white object-contain"
              loading="lazy"
            />
            <div className="min-w-0 flex-1 space-y-1 text-xs">
              <p className="flex items-center gap-1 font-medium">
                <ImageIcon className="h-3.5 w-3.5" />
                {displayImageIsStructure
                  ? t("Chemical structure (PubChem)", "التركيب الكيميائي (PubChem)")
                  : t("Product image", "صورة المنتج")}
              </p>
              {displayImageIsStructure && (
                <p className="text-muted-foreground">
                  {t(
                    "Not a commercial packshot — official structure diagram used only when local packaging image is missing.",
                    "ليست صورة عبوة تجارية — مخطط التركيب الرسمي يُستخدم فقط عند غياب صورة التعبئة المحلية.",
                  )}
                </p>
              )}
              {displayImageIsStructure && structureSourceUrl && (
                <a
                  href={structureSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-700 underline"
                >
                  PubChem <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {provenance.image_url && (
                <Badge variant="outline" className="text-[10px]">
                  {provenance.image_url}
                </Badge>
              )}
            </div>
          </div>
        )}

        {Object.keys(patch).length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium">
              {t("Suggested fills for missing fields", "اقتراحات للحقول الناقصة")}
            </p>
            <ul className="space-y-1 text-xs">
              {Object.entries(patch).map(([k, v]) => (
                <li key={k} className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-muted-foreground">{k}</span>:
                  {k === "image_url" && typeof v === "string" ? (
                    <a
                      href={v}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 underline truncate max-w-[12rem]"
                    >
                      {t("structure image", "صورة التركيب")}
                    </a>
                  ) : (
                    <span className="break-all">{String(v)}</span>
                  )}
                  {provenance[k] && (
                    <Badge variant="outline" className="text-[10px]">
                      {provenance[k]}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={handleApply}
              disabled={applied}
            >
              <Check className="h-3.5 w-3.5" />
              {applied
                ? t("Applied for this session", "مُطبَّق لهذه الجلسة")
                : t("Apply suggestions", "تطبيق الاقتراحات")}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {t(
                "Saves to this browser session only. Live Appwrite write-back for admins/reps comes next.",
                "يُحفظ لهذه الجلسة في المتصفح فقط. الكتابة إلى Appwrite للمسؤولين/الممثلين قادمة.",
              )}
            </p>
          </div>
        )}

        {whoHits.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-800">
              <BookOpen className="h-3 w-3" />
              {t("WHO Essential Medicines", "قائمة الأدوية الأساسية")}
            </p>
            <div className="space-y-1">
              {whoHits.map((h, i) => (
                <div
                  key={"who-" + i}
                  className="flex items-center justify-between rounded border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs"
                >
                  <span>{h.name_en}</span>
                  {h.source_url && (
                    <a
                      href={h.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {otherHits.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium">
              {t("Other sources", "مصادر أخرى")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1 pr-2">{t("Source", "المصدر")}</th>
                    <th className="py-1 pr-2">{t("Name", "الاسم")}</th>
                    <th className="py-1">{t("Link", "رابط")}</th>
                  </tr>
                </thead>
                <tbody>
                  {otherHits.slice(0, 8).map((h, i) => (
                    <tr key={h.source + i} className="border-b border-muted/50">
                      <td className="py-1 pr-2">
                        <Badge variant="outline" className="text-[10px]">
                          {kindLabel(h.source, ar)}
                        </Badge>
                      </td>
                      <td className="py-1 pr-2">
                        {h.name_en || h.scientific_name || "—"}
                        {h.pubchem_cid ? (
                          <span className="text-muted-foreground"> · CID {h.pubchem_cid}</span>
                        ) : null}
                      </td>
                      <td className="py-1">
                        {h.source_url && (
                          <a
                            href={h.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-700 underline"
                          >
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
          {links.map((l) => (
            <a
              key={l.source + l.url}
              href={l.url}
              target={l.url.startsWith("/") ? undefined : "_blank"}
              rel={l.url.startsWith("/") ? undefined : "noreferrer"}
              className={
                l.source === "who_eml"
                  ? "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-900"
                  : "rounded-full border px-2 py-0.5 text-[10px] hover:bg-muted"
              }
            >
              {worldSourceLabel(l, ar ? "ar" : "en")}
            </a>
          ))}
        </div>

        {!loading && hits.length === 0 && errors.length === 0 && !displayImage && (
          <div className="text-xs text-muted-foreground">
            {t(
              "No extra suggestions — local fields look complete or no hits.",
              "لا اقتراحات إضافية — البيانات المحلية مكتملة أو لا توجد نتائج.",
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
