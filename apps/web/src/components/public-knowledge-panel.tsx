import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Knowledge = {
  title: string;
  extract: string;
  pageUrl: string;
  imageUrl: string | null;
  attribution: string;
};

type CompanyContact = {
  display_name: string;
  country: string | null;
  city: string | null;
  full_address: string | null;
  contact_email: string | null;
  mobile_phone: string | null;
  whatsapp_same_as_mobile: boolean | null;
  whatsapp_phone: string | null;
  website_url: string | null;
};

function currentCompanySlug() {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/companies\/([^/?#]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function digits(value: string | null | undefined) {
  return String(value || "").replace(/\D+/g, "");
}

export function PublicKnowledgePanel({
  type,
  name,
}: {
  type: "company" | "generic" | "therapeutic-category" | "medicine";
  name: string;
}) {
  const { t, language } = useLanguage();
  const { supabaseFetch } = usePatientAuth();
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [companyContact, setCompanyContact] = useState<CompanyContact | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/public-knowledge?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&language=${language === "ar" ? "ar" : "en"}`,
      { signal: controller.signal },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setKnowledge(data?.result || null))
      .catch(() => undefined);
    return () => controller.abort();
  }, [type, name, language]);

  useEffect(() => {
    if (type !== "company") {
      setCompanyContact(null);
      return;
    }
    const sourceSlug = currentCompanySlug();
    if (!sourceSlug) return;
    let cancelled = false;

    async function loadCompanyContact() {
      try {
        const resolutionRows = await supabaseFetch<Array<{ canonical_company_slug: string }>>(
          `/rest/v1/company_directory_resolutions_v1?select=canonical_company_slug&source_company_slug=eq.${encodeURIComponent(sourceSlug)}&limit=1`,
        );
        const canonicalSlug = resolutionRows?.[0]?.canonical_company_slug || sourceSlug;
        const select =
          "display_name,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,website_url";
        const rows = await supabaseFetch<CompanyContact[]>(
          `/rest/v1/industry_company_profiles?select=${select}&company_slug=eq.${encodeURIComponent(canonicalSlug)}&verification_status=eq.verified&is_public=eq.true&limit=1`,
        );
        if (!cancelled) setCompanyContact(Array.isArray(rows) ? rows[0] || null : null);
      } catch {
        if (!cancelled) setCompanyContact(null);
      }
    }

    void loadCompanyContact();
    return () => {
      cancelled = true;
    };
  }, [type, name, supabaseFetch]);

  if (!knowledge && !companyContact) return null;
  const whatsapp = companyContact?.whatsapp_same_as_mobile
    ? companyContact.mobile_phone
    : companyContact?.whatsapp_phone;

  return (
    <div className="mt-6 space-y-4">
      {companyContact && (
        <Card className="border-primary/25 bg-primary/5">
          <CardContent className="p-5">
            <h2 className="text-xl font-semibold">
              {t("Verified company contact and address", "بيانات التواصل والعنوان الموثقة للشركة")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "Maintained by an approved company representative and governed by the platform.",
                "يتم تحديثها بواسطة ممثل شركة معتمد وتخضع لحوكمة المنصة.",
              )}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(companyContact.full_address || companyContact.city || companyContact.country) && (
                <ContactItem
                  icon={MapPin}
                  label={t("Address", "العنوان")}
                  value={
                    companyContact.full_address ||
                    [companyContact.city, companyContact.country].filter(Boolean).join(", ")
                  }
                />
              )}
              {companyContact.contact_email && (
                <ContactItem
                  icon={Mail}
                  label={t("Email", "البريد الإلكتروني")}
                  value={companyContact.contact_email}
                  href={`mailto:${companyContact.contact_email}`}
                />
              )}
              {companyContact.mobile_phone && (
                <ContactItem
                  icon={Phone}
                  label={t("Mobile", "الهاتف المحمول")}
                  value={companyContact.mobile_phone}
                  href={`tel:${companyContact.mobile_phone}`}
                />
              )}
              {whatsapp && digits(whatsapp) && (
                <ContactItem
                  icon={MessageCircle}
                  label={t("WhatsApp", "واتساب")}
                  value={whatsapp}
                  href={`https://wa.me/${digits(whatsapp)}`}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {knowledge && (
        <Card className="overflow-hidden">
          <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <BookOpen className="h-4 w-4" />
                {t("Public encyclopedia context", "سياق من الموسوعة العامة")}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{knowledge.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {knowledge.extract}
              </p>
              <a
                href={knowledge.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center text-sm font-semibold text-primary"
              >
                {t("Read and verify on Wikipedia", "اقرأ وتحقق على ويكيبيديا")}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
              <p className="mt-3 text-xs text-muted-foreground">
                {knowledge.attribution}{" "}
                {t(
                  "General context only—not medical advice or a verified platform claim.",
                  "سياق عام فقط وليس نصيحة طبية أو ادعاءً موثقًا من المنصة.",
                )}
              </p>
            </div>
            {knowledge.imageUrl && (
              <img
                src={knowledge.imageUrl}
                alt={knowledge.title}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="max-h-56 w-full rounded-xl border bg-muted/20 object-contain"
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className="mt-2 block break-words text-sm font-medium">{value}</span>
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="rounded-xl border bg-background p-4 hover:border-primary/50">
      {content}
    </a>
  ) : (
    <div className="rounded-xl border bg-background p-4">{content}</div>
  );
}
