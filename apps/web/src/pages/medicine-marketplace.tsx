import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Filter,
  Handshake,
  PackageSearch,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePageSeo } from "@/components/route-seo";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Seller = {
  id: string;
  seller_slug: string;
  display_name: string;
  seller_type: string;
  description: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  service_areas: string[];
  fulfillment_modes: string[];
  advantages: string[];
  payment_terms: string[];
  license_authority: string | null;
  license_expiry: string | null;
  verified_at: string | null;
  approved_offer_count: number;
  medicine_count: number;
  lowest_offer_price_egp: number | null;
};

type Offer = {
  id: string;
  canonical_id: number;
  seller_profile_id: string;
  seller_slug: string;
  seller_name: string;
  seller_type: string;
  seller_logo_url: string | null;
  seller_country: string | null;
  seller_city: string | null;
  service_areas: string[];
  fulfillment_modes: string[];
  seller_advantages: string[];
  seller_sku: string | null;
  offer_title: string | null;
  unit_price_egp: number;
  list_price_egp: number | null;
  minimum_order_quantity: number;
  packaging: string | null;
  stock_status: string;
  lead_time_days: number | null;
  minimum_expiry_months: number | null;
  delivery_scope: string[];
  advantages: string[];
  payment_terms: string[];
  cold_chain_supported: boolean;
  prescription_handling: string;
  published_at: string;
  name_en: string | null;
  name_ar: string | null;
  scientific_name: string | null;
  manufacturer: string | null;
  encyclopedia_price_egp: number | null;
  price_difference_percent: number | null;
};

type Application = {
  id: string;
  business_name: string;
  seller_type: string;
  status: string;
  review_notes: string | null;
  created_at: string;
  seller_profile_id: string | null;
};

type OwnProfile = {
  id: string;
  organization_id: string;
  seller_slug: string;
  display_name: string;
  seller_type: string;
  verification_status: string;
  is_public: boolean;
};

type OwnOffer = {
  id: string;
  canonical_id: number;
  seller_profile_id: string;
  organization_id: string;
  seller_sku: string | null;
  offer_title: string | null;
  unit_price_egp: number;
  status: string;
  review_notes: string | null;
  updated_at: string;
};

type Quote = {
  id: string;
  offer_id: string;
  canonical_id: number;
  seller_profile_id: string;
  buyer_organization_name: string | null;
  requested_quantity: number;
  delivery_city: string | null;
  contact_email: string;
  status: string;
  created_at: string;
};

type ApplicationDraft = {
  businessName: string;
  sellerType: string;
  country: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  licenseNumber: string;
  licenseAuthority: string;
  licenseExpiry: string;
  evidenceUrls: string;
  serviceAreas: string;
  advantages: string;
  notes: string;
};

type OfferDraft = {
  profileId: string;
  canonicalId: string;
  sku: string;
  title: string;
  price: string;
  listPrice: string;
  minimumOrder: string;
  packaging: string;
  stockStatus: string;
  leadTime: string;
  expiryMonths: string;
  deliveryScope: string;
  advantages: string;
  paymentTerms: string;
  coldChain: boolean;
};

type QuoteDraft = {
  offerId: string;
  quantity: string;
  organizationName: string;
  buyerType: string;
  country: string;
  city: string;
  email: string;
  message: string;
};

const emptyApplication: ApplicationDraft = {
  businessName: "",
  sellerType: "pharmacy",
  country: "Egypt",
  city: "",
  address: "",
  email: "",
  phone: "",
  website: "",
  licenseNumber: "",
  licenseAuthority: "",
  licenseExpiry: "",
  evidenceUrls: "",
  serviceAreas: "",
  advantages: "",
  notes: "",
};

const emptyOffer: OfferDraft = {
  profileId: "",
  canonicalId: "",
  sku: "",
  title: "",
  price: "",
  listPrice: "",
  minimumOrder: "1",
  packaging: "",
  stockStatus: "in_stock",
  leadTime: "",
  expiryMonths: "",
  deliveryScope: "",
  advantages: "",
  paymentTerms: "",
  coldChain: false,
};

const emptyQuote: QuoteDraft = {
  offerId: "",
  quantity: "1",
  organizationName: "",
  buyerType: "pharmacy",
  country: "Egypt",
  city: "",
  email: "",
  message: "",
};

const splitList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const price = (value: number | null) =>
  value == null ? "—" : `${Number(value).toLocaleString()} EGP`;

function initialMarketplaceQuery() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || params.get("query") || "";
}

export default function MedicineMarketplace() {
  const [, sellerParams] = useRoute("/marketplace/sellers/:slug");
  const [manageRoute] = useRoute("/marketplace/manage");
  const sellerSlug = sellerParams?.slug ? decodeURIComponent(sellerParams.slug) : null;
  const { t, language } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [ownProfiles, setOwnProfiles] = useState<OwnProfile[]>([]);
  const [ownOffers, setOwnOffers] = useState<OwnOffer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [query, setQuery] = useState(initialMarketplaceQuery);
  const [sellerType, setSellerType] = useState("");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [application, setApplication] = useState<ApplicationDraft>(emptyApplication);
  const [offerDraft, setOfferDraft] = useState<OfferDraft>(emptyOffer);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(emptyQuote);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  usePageSeo({
    title: sellerSlug
      ? `${sellers.find((seller) => seller.seller_slug === sellerSlug)?.display_name || "Verified medicine seller"} | Medicine Marketplace`
      : "Verified B2B Medicine Marketplace | Medicine Support Hub",
    description:
      "Compare approved medicine offers from verified pharmacies, warehouses, and distribution companies, then request accountable B2B quotations linked to the medicine encyclopedia.",
    canonicalPath: sellerSlug
      ? `/marketplace/sellers/${encodeURIComponent(sellerSlug)}`
      : "/marketplace",
    keywords:
      "medicine marketplace, pharmacy suppliers, medicine warehouses, pharmaceutical distributors, B2B medicine quotes",
  });

  async function loadPublicMarketplace() {
    const [publicSellers, publicOffers] = await Promise.all([
      supabaseFetch<Seller[]>(
        "/rest/v1/marketplace_public_sellers_v1?select=*&order=approved_offer_count.desc,display_name.asc&limit=200",
      ),
      supabaseFetch<Offer[]>(
        "/rest/v1/marketplace_public_offers_v1?select=*&order=unit_price_egp.asc,published_at.desc&limit=300",
      ),
    ]);
    setSellers(publicSellers);
    setOffers(publicOffers);
  }

  async function loadManagementData() {
    if (!isAuthenticated || !session?.user?.id) {
      setApplications([]);
      setOwnProfiles([]);
      setOwnOffers([]);
      setQuotes([]);
      return;
    }

    const [nextApplications, nextProfiles, nextOffers, nextQuotes] = await Promise.all([
      supabaseFetch<Application[]>(
        "/rest/v1/marketplace_seller_applications?select=id,business_name,seller_type,status,review_notes,created_at,seller_profile_id&order=created_at.desc&limit=30",
      ),
      supabaseFetch<OwnProfile[]>(
        "/rest/v1/marketplace_seller_profiles?select=id,organization_id,seller_slug,display_name,seller_type,verification_status,is_public&order=display_name.asc&limit=20",
      ),
      supabaseFetch<OwnOffer[]>(
        "/rest/v1/marketplace_medicine_offers?select=id,canonical_id,seller_profile_id,organization_id,seller_sku,offer_title,unit_price_egp,status,review_notes,updated_at&order=updated_at.desc&limit=100",
      ),
      supabaseFetch<Quote[]>(
        "/rest/v1/marketplace_quote_requests?select=id,offer_id,canonical_id,seller_profile_id,buyer_organization_name,requested_quantity,delivery_city,contact_email,status,created_at&order=created_at.desc&limit=100",
      ),
    ]);

    setApplications(nextApplications);
    setOwnProfiles(nextProfiles);
    setOwnOffers(nextOffers);
    setQuotes(nextQuotes);
    setOfferDraft((current) =>
      current.profileId || !nextProfiles[0]
        ? current
        : { ...current, profileId: nextProfiles[0].id },
    );
  }

  async function load() {
    setLoading(true);
    setError(null);
    setManagementError(null);

    try {
      await loadPublicMarketplace();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load the marketplace.", "تعذر تحميل السوق."),
      );
    }

    try {
      await loadManagementData();
    } catch (cause) {
      setManagementError(
        cause instanceof Error
          ? cause.message
          : t("Could not load seller workspace data.", "تعذر تحميل بيانات مساحة البائع."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, session?.user?.id]);

  const visibleOffers = useMemo(
    () =>
      offers.filter((offer) => {
        if (sellerSlug && offer.seller_slug !== sellerSlug) return false;
        if (sellerType && offer.seller_type !== sellerType) return false;
        if (
          city &&
          ![offer.seller_city, ...offer.delivery_scope, ...offer.service_areas]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(city.toLowerCase()))
        )
          return false;
        if (maxPrice && offer.unit_price_egp > Number(maxPrice)) return false;
        if (query) {
          const haystack = [
            offer.name_en,
            offer.name_ar,
            offer.scientific_name,
            offer.manufacturer,
            offer.seller_name,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [offers, sellerSlug, sellerType, city, maxPrice, query],
  );

  const activeSeller = sellerSlug
    ? sellers.find((seller) => seller.seller_slug === sellerSlug) || null
    : null;

  async function submitApplication(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await supabaseFetch("/rest/v1/marketplace_seller_applications", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          business_name: application.businessName.trim(),
          seller_type: application.sellerType,
          country: application.country.trim() || null,
          city: application.city.trim() || null,
          address: application.address.trim() || null,
          work_email: application.email.trim(),
          contact_phone: application.phone.trim() || null,
          website_url: application.website.trim() || null,
          license_number: application.licenseNumber.trim(),
          license_authority: application.licenseAuthority.trim() || null,
          license_expiry: application.licenseExpiry || null,
          evidence_urls: splitList(application.evidenceUrls),
          service_areas: splitList(application.serviceAreas),
          advantages: splitList(application.advantages),
          notes: application.notes.trim() || null,
          status: "pending",
          submitted_by: session.user.id,
        }),
      });
      setApplication(emptyApplication);
      setMessage(
        t(
          "Seller application submitted for license and identity review.",
          "تم إرسال طلب البائع لمراجعة الترخيص والهوية.",
        ),
      );
      await loadManagementData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the seller application.", "تعذر إرسال طلب البائع."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitOffer(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    const profile = ownProfiles.find((row) => row.id === offerDraft.profileId);
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await supabaseFetch("/rest/v1/marketplace_medicine_offers", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          seller_profile_id: profile.id,
          organization_id: profile.organization_id,
          canonical_id: Number(offerDraft.canonicalId),
          seller_sku: offerDraft.sku.trim() || null,
          offer_title: offerDraft.title.trim() || null,
          unit_price_egp: Number(offerDraft.price),
          list_price_egp: offerDraft.listPrice ? Number(offerDraft.listPrice) : null,
          minimum_order_quantity: Number(offerDraft.minimumOrder || 1),
          packaging: offerDraft.packaging.trim() || null,
          stock_status: offerDraft.stockStatus,
          lead_time_days: offerDraft.leadTime ? Number(offerDraft.leadTime) : null,
          minimum_expiry_months: offerDraft.expiryMonths
            ? Number(offerDraft.expiryMonths)
            : null,
          delivery_scope: splitList(offerDraft.deliveryScope),
          advantages: splitList(offerDraft.advantages),
          payment_terms: splitList(offerDraft.paymentTerms),
          cold_chain_supported: offerDraft.coldChain,
          prescription_handling: "licensed_b2b_only",
          status: "submitted",
          submitted_by: session.user.id,
        }),
      });
      setOfferDraft({ ...emptyOffer, profileId: profile.id });
      setMessage(t("Offer submitted for marketplace review.", "تم إرسال العرض لمراجعة السوق."));
      await loadManagementData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the offer.", "تعذر إرسال العرض."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitQuote(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    const selected = offers.find((row) => row.id === quoteDraft.offerId);
    if (!selected) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await supabaseFetch("/rest/v1/marketplace_quote_requests", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          offer_id: selected.id,
          canonical_id: selected.canonical_id,
          seller_profile_id: selected.seller_profile_id,
          buyer_id: session.user.id,
          buyer_organization_name: quoteDraft.organizationName.trim() || null,
          buyer_type: quoteDraft.buyerType,
          requested_quantity: Number(quoteDraft.quantity),
          delivery_country: quoteDraft.country.trim() || null,
          delivery_city: quoteDraft.city.trim() || null,
          contact_email: quoteDraft.email.trim(),
          message: quoteDraft.message.trim(),
          status: "submitted",
        }),
      });
      setQuoteDraft(emptyQuote);
      setMessage(
        t(
          "Quotation request sent privately to the verified seller.",
          "تم إرسال طلب عرض السعر بشكل خاص إلى البائع الموثق.",
        ),
      );
      await loadManagementData();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the quote request.", "تعذر إرسال طلب عرض السعر."),
      );
    } finally {
      setSaving(false);
    }
  }

  const showManagement = !sellerSlug && (manageRoute || isAuthenticated);

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.14em] text-primary">
              <Store className="h-4 w-4" />
              {t("Verified B2B medicine marketplace", "سوق أدوية موثق بين المؤسسات")}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              {activeSeller
                ? activeSeller.display_name
                : t(
                    "Compare trusted offers and connect the medicine supply cycle",
                    "قارن العروض الموثوقة واربط دورة إمداد الدواء",
                  )}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              {activeSeller
                ? activeSeller.description ||
                  t(
                    "Verified seller shop connected to canonical medicine products.",
                    "متجر بائع موثق مرتبط بمنتجات الأدوية الموحدة.",
                  )
                : t(
                    "Licensed pharmacies, warehouses, and distributors can build verified shops, publish reviewed medicine offers, and receive private quotation requests from accountable healthcare buyers.",
                    "يمكن للصيدليات والمخازن وشركات التوزيع المرخصة إنشاء متاجر موثقة ونشر عروض أدوية مراجعة واستقبال طلبات أسعار خاصة من جهات رعاية صحية معروفة.",
                  )}
            </p>
          </div>
          <div className="grid gap-3">
            <Value
              icon={ShieldCheck}
              title={t("Licensed sellers", "بائعون مرخصون")}
              text={t(
                "Profiles remain private until identity and licensing evidence are approved.",
                "تظل الملفات خاصة حتى اعتماد أدلة الهوية والترخيص.",
              )}
            />
            <Value
              icon={PackageSearch}
              title={t("Medicine-linked offers", "عروض مرتبطة بالأدوية")}
              text={t(
                "Every offer points to one canonical encyclopedia product.",
                "يرتبط كل عرض بمنتج دوائي موحد في الموسوعة.",
              )}
            />
            <Value
              icon={Handshake}
              title={t("Private B2B quotations", "عروض أسعار خاصة")}
              text={t(
                "No anonymous checkout; buyers and sellers collaborate through accountable quote requests.",
                "لا يوجد شراء مجهول؛ يتعاون المشترون والبائعون عبر طلبات أسعار موثقة.",
              )}
            />
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {managementError && isAuthenticated && (
        <Alert variant="destructive" className="mt-5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{managementError}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mt-5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {!activeSeller && (
        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_repeat(4,minmax(0,.35fr))]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t(
                  "Medicine, scientific name, manufacturer, or seller...",
                  "دواء أو اسم علمي أو شركة أو بائع...",
                )}
              />
            </label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={sellerType}
              onChange={(event) => setSellerType(event.target.value)}
            >
              <option value="">{t("All seller types", "كل أنواع البائعين")}</option>
              <option value="pharmacy">{t("Pharmacies", "صيدليات")}</option>
              <option value="warehouse">{t("Warehouses", "مخازن")}</option>
              <option value="distributor">{t("Distributors", "موزعون")}</option>
            </select>
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder={t("City or service area", "المدينة أو منطقة الخدمة")}
            />
            <Input
              inputMode="decimal"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={t("Maximum unit price", "أقصى سعر للوحدة")}
            />
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setSellerType("");
                setCity("");
                setMaxPrice("");
                if (typeof window !== "undefined" && window.location.search) {
                  window.history.replaceState({}, "", window.location.pathname);
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("Reset", "إعادة ضبط")}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            {visibleOffers.length.toLocaleString()} {t("approved offers", "عرض معتمد")}
          </div>
        </section>
      )}

      {activeSeller && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={t("Approved offers", "العروض المعتمدة")} value={activeSeller.approved_offer_count} />
          <Metric label={t("Medicines", "الأدوية")} value={activeSeller.medicine_count} />
          <Metric label={t("Seller type", "نوع البائع")} value={humanize(activeSeller.seller_type)} />
          <Metric
            label={t("Location", "الموقع")}
            value={[activeSeller.city, activeSeller.country].filter(Boolean).join(", ") || "—"}
          />
        </section>
      )}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOffers.map((offer) => (
          <Card key={offer.id} className="h-full shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg leading-7">
                    <a href={`/catalog/${offer.canonical_id}`} className="hover:text-primary">
                      {language === "ar"
                        ? offer.name_ar || offer.name_en
                        : offer.name_en || offer.name_ar}
                    </a>
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {offer.scientific_name || offer.manufacturer || "—"}
                  </p>
                </div>
                <BadgeCheck className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-xl border bg-primary/5 p-4">
                <div className="text-3xl font-bold">{price(offer.unit_price_egp)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("Minimum order", "الحد الأدنى للطلب")}: {Number(offer.minimum_order_quantity).toLocaleString()} {offer.packaging || t("units", "وحدات")}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{humanize(offer.stock_status)}</Badge>
                {offer.lead_time_days != null && (
                  <Badge variant="outline">
                    <Truck className="mr-1 h-3 w-3" />
                    {offer.lead_time_days} {t("days", "يوم")}
                  </Badge>
                )}
                {offer.cold_chain_supported && (
                  <Badge variant="secondary">{t("Cold chain", "سلسلة تبريد")}</Badge>
                )}
              </div>
              <div>
                <div className="font-semibold">
                  <a className="text-primary" href={`/marketplace/sellers/${encodeURIComponent(offer.seller_slug)}`}>
                    {offer.seller_name}
                  </a>
                </div>
                <div className="text-xs text-muted-foreground">
                  {humanize(offer.seller_type)} · {[offer.seller_city, offer.seller_country].filter(Boolean).join(", ")}
                </div>
              </div>
              {offer.advantages.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {offer.advantages.slice(0, 4).map((item) => (
                    <Badge variant="outline" key={item}>{item}</Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={`/catalog/${offer.canonical_id}`}>{t("Product evidence", "أدلة المنتج")}</a>
                </Button>
                {isAuthenticated ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setQuoteDraft((current) => ({
                        ...current,
                        offerId: offer.id,
                        email: current.email || session?.user?.email || "",
                      }))
                    }
                  >
                    {t("Request quote", "اطلب عرض سعر")}
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <a href="/account">{t("Sign in to request", "سجل للدخول والطلب")}</a>
                  </Button>
                )}
              </div>

              {quoteDraft.offerId === offer.id && (
                <form onSubmit={submitQuote} className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label={t("Quantity", "الكمية")}
                      value={quoteDraft.quantity}
                      onChange={(value) => setQuoteDraft((current) => ({ ...current, quantity: value }))}
                    />
                    <Field
                      label={t("Contact email", "البريد للتواصل")}
                      value={quoteDraft.email}
                      onChange={(value) => setQuoteDraft((current) => ({ ...current, email: value }))}
                    />
                    <Field
                      label={t("Organization", "الجهة")}
                      value={quoteDraft.organizationName}
                      onChange={(value) => setQuoteDraft((current) => ({ ...current, organizationName: value }))}
                    />
                    <Field
                      label={t("Delivery city", "مدينة التسليم")}
                      value={quoteDraft.city}
                      onChange={(value) => setQuoteDraft((current) => ({ ...current, city: value }))}
                    />
                  </div>
                  <Textarea
                    value={quoteDraft.message}
                    onChange={(event) => setQuoteDraft((current) => ({ ...current, message: event.target.value }))}
                    placeholder={t(
                      "Describe the request, schedule, documentation, and delivery requirements.",
                      "اشرح الطلب والجدول والمستندات ومتطلبات التسليم.",
                    )}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={saving || Number(quoteDraft.quantity) <= 0 || quoteDraft.message.trim().length < 10}
                  >
                    {t("Send private request", "إرسال طلب خاص")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}

        {!loading && visibleOffers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t("No approved offers match these filters yet.", "لا توجد عروض معتمدة تطابق هذه الفلاتر حتى الآن.")}
            </CardContent>
          </Card>
        )}
      </section>

      {!sellerSlug && !isAuthenticated && (
        <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">{t("Join the verified marketplace", "انضم إلى السوق الموثق")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Sign in to apply as a licensed pharmacy, warehouse, or distributor, or to request a private quotation.",
              "سجل الدخول للتقديم كصيدلية أو مخزن أو موزع مرخص أو لطلب عرض سعر خاص.",
            )}
          </p>
          <Button asChild className="mt-4"><a href="/account">{t("Sign in", "تسجيل الدخول")}</a></Button>
        </section>
      )}

      {showManagement && (
        <section className="mt-10 grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t("Create a verified seller shop", "أنشئ متجر بائع موثق")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitApplication} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("Business name", "اسم المنشأة")} value={application.businessName} onChange={(value) => setApplication((current) => ({ ...current, businessName: value }))} />
                  <div>
                    <Label>{t("Seller type", "نوع البائع")}</Label>
                    <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={application.sellerType} onChange={(event) => setApplication((current) => ({ ...current, sellerType: event.target.value }))}>
                      <option value="pharmacy">{t("Pharmacy", "صيدلية")}</option>
                      <option value="warehouse">{t("Medicine warehouse", "مخزن أدوية")}</option>
                      <option value="distributor">{t("Distribution company", "شركة توزيع")}</option>
                    </select>
                  </div>
                  <Field label={t("Work email", "بريد العمل")} value={application.email} onChange={(value) => setApplication((current) => ({ ...current, email: value }))} />
                  <Field label={t("License number", "رقم الترخيص")} value={application.licenseNumber} onChange={(value) => setApplication((current) => ({ ...current, licenseNumber: value }))} />
                  <Field label={t("License authority", "جهة الترخيص")} value={application.licenseAuthority} onChange={(value) => setApplication((current) => ({ ...current, licenseAuthority: value }))} />
                  <Field label={t("City", "المدينة")} value={application.city} onChange={(value) => setApplication((current) => ({ ...current, city: value }))} />
                </div>
                <div>
                  <Label>{t("License and identity evidence URLs", "روابط أدلة الترخيص والهوية")}</Label>
                  <Textarea className="mt-1" value={application.evidenceUrls} onChange={(event) => setApplication((current) => ({ ...current, evidenceUrls: event.target.value }))} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t("Service areas", "مناطق الخدمة")}</Label>
                    <Textarea className="mt-1" value={application.serviceAreas} onChange={(event) => setApplication((current) => ({ ...current, serviceAreas: event.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("Business advantages", "مزايا المنشأة")}</Label>
                    <Textarea className="mt-1" value={application.advantages} onChange={(event) => setApplication((current) => ({ ...current, advantages: event.target.value }))} />
                  </div>
                </div>
                <Button type="submit" disabled={saving || application.businessName.trim().length < 2 || application.licenseNumber.trim().length < 3 || !application.email.includes("@") || splitList(application.evidenceUrls).length === 0}>
                  {t("Submit for verification", "إرسال للتوثيق")}
                </Button>
              </form>

              {applications.length > 0 && (
                <div className="mt-5 space-y-2">
                  {applications.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-semibold">{row.business_name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</div>
                      </div>
                      <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>{humanize(row.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5" />
                {t("Publish a medicine offer", "انشر عرض دواء")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ownProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("A verified seller profile is required before offers can be submitted.", "يلزم وجود ملف بائع موثق قبل إرسال العروض.")}
                </p>
              ) : (
                <form onSubmit={submitOffer} className="space-y-4">
                  <div>
                    <Label>{t("Seller shop", "متجر البائع")}</Label>
                    <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={offerDraft.profileId} onChange={(event) => setOfferDraft((current) => ({ ...current, profileId: event.target.value }))}>
                      {ownProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("Canonical medicine ID", "معرّف الدواء الموحد")} value={offerDraft.canonicalId} onChange={(value) => setOfferDraft((current) => ({ ...current, canonicalId: value }))} />
                    <Field label={t("Unit price EGP", "سعر الوحدة بالجنيه")} value={offerDraft.price} onChange={(value) => setOfferDraft((current) => ({ ...current, price: value }))} />
                    <Field label={t("Minimum order", "الحد الأدنى للطلب")} value={offerDraft.minimumOrder} onChange={(value) => setOfferDraft((current) => ({ ...current, minimumOrder: value }))} />
                    <Field label={t("Packaging", "التعبئة")} value={offerDraft.packaging} onChange={(value) => setOfferDraft((current) => ({ ...current, packaging: value }))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>{t("Delivery scope", "نطاق التوصيل")}</Label>
                      <Textarea className="mt-1" value={offerDraft.deliveryScope} onChange={(event) => setOfferDraft((current) => ({ ...current, deliveryScope: event.target.value }))} />
                    </div>
                    <div>
                      <Label>{t("Offer advantages", "مزايا العرض")}</Label>
                      <Textarea className="mt-1" value={offerDraft.advantages} onChange={(event) => setOfferDraft((current) => ({ ...current, advantages: event.target.value }))} />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving || !Number.isSafeInteger(Number(offerDraft.canonicalId)) || Number(offerDraft.price) <= 0}>
                    {t("Submit offer for review", "إرسال العرض للمراجعة")}
                  </Button>
                </form>
              )}

              {ownOffers.length > 0 && (
                <div className="mt-5 space-y-2">
                  {ownOffers.slice(0, 8).map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <a href={`/catalog/${row.canonical_id}`} className="font-semibold text-primary">#{row.canonical_id}</a>
                        <div className="text-xs text-muted-foreground">{price(row.unit_price_egp)}</div>
                      </div>
                      <Badge variant={row.status === "approved" ? "default" : row.status === "rejected" ? "destructive" : "secondary"}>{humanize(row.status)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {isAuthenticated && quotes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">{t("Private quotation activity", "نشاط طلبات الأسعار الخاصة")}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quotes.slice(0, 12).map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <a className="font-semibold text-primary" href={`/catalog/${row.canonical_id}`}>#{row.canonical_id}</a>
                      <div className="mt-1 text-sm text-muted-foreground">{Number(row.requested_quantity).toLocaleString()} · {row.delivery_city || "—"}</div>
                    </div>
                    <Badge variant="outline">{humanize(row.status)}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Alert className="mt-10">
        <AlertDescription>
          {t(
            "This marketplace supports accountable B2B discovery and quotation requests. It does not replace licensing, procurement controls, prescription validation, regulatory approval, quality inspection, or a binding commercial contract.",
            "يدعم هذا السوق اكتشاف العروض وطلبات الأسعار بين الجهات المعروفة، ولا يستبدل الترخيص أو ضوابط الشراء أو التحقق من الوصفات أو الاعتماد التنظيمي أو فحص الجودة أو العقد التجاري الملزم.",
          )}
        </AlertDescription>
      </Alert>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}

function Value({ icon: Icon, title, text }: { icon: typeof Store; title: string; text: string }) {
  return (
    <Card className="border-primary/15">
      <CardContent className="flex gap-3 p-4">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      </CardContent>
    </Card>
  );
}
