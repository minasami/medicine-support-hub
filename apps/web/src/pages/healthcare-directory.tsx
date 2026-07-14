import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  Hospital,
  MapPin,
  MessageCircle,
  Radio,
  Search,
  Share2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type EntityType =
  | "physician"
  | "clinic"
  | "polyclinic"
  | "hospital"
  | "pharmacy"
  | "laboratory"
  | "radiology_center"
  | "diagnostic_center";
type DirectoryConfig = {
  key: "clinics" | "pharmacies" | "labs" | "radiology";
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  types: EntityType[];
  workspace: string;
  workspaceLabel: string;
  icon: typeof Stethoscope;
  appointmentType: "outpatient" | "diagnostic" | "pharmacy_consultation";
};
type Provider = {
  id: string;
  organization_id: string;
  slug: string;
  entity_type: EntityType;
  display_name: string;
  summary: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  public_email: string | null;
  public_phone: string | null;
  website_url: string | null;
  specialties: string[];
  services: string[];
  languages: string[];
  appointment_modes: string[];
  accepting_patients: boolean;
  license_authority: string | null;
  license_expiry: string | null;
};

const CONFIGS: Record<string, DirectoryConfig> = {
  clinics: {
    key: "clinics",
    title: "Clinics, physicians, and hospitals",
    titleAr: "العيادات والأطباء والمستشفيات",
    description:
      "Discover reviewed care providers, contact their public page, request an appointment, or claim and build an approved organization profile.",
    descriptionAr:
      "اكتشف مقدمي الرعاية المراجعين وتواصل معهم واطلب موعدًا أو طالب بملكية جهة منشورة وأنشئ ملفًا معتمدًا.",
    types: ["physician", "clinic", "polyclinic", "hospital"],
    workspace: "/clinics/emr",
    workspaceLabel: "Open clinic & EMR workspace",
    icon: Stethoscope,
    appointmentType: "outpatient",
  },
  pharmacies: {
    key: "pharmacies",
    title: "Pharmacies",
    titleAr: "الصيدليات",
    description:
      "Find reviewed pharmacies and route one consented prescription to the patient-selected, connected, nearest, or contracted provider.",
    descriptionAr:
      "اعثر على صيدليات مراجعة ووجّه وصفة بموافقة المريض إلى الجهة المختارة أو المتصلة أو الأقرب أو المتعاقدة.",
    types: ["pharmacy"],
    workspace: "/pharmacies/pms",
    workspaceLabel: "Open pharmacy management",
    icon: Building2,
    appointmentType: "pharmacy_consultation",
  },
  labs: {
    key: "labs",
    title: "Laboratories",
    titleAr: "المعامل",
    description:
      "Find reviewed laboratories and coordinate consented diagnostic orders and structured results with the authorized care team.",
    descriptionAr:
      "اعثر على معامل مراجعة ونسّق طلبات الفحوص والنتائج المنظمة بموافقة المريض مع فريق الرعاية المصرح له.",
    types: ["laboratory"],
    workspace: "/labs/lms",
    workspaceLabel: "Open laboratory management",
    icon: FlaskConical,
    appointmentType: "diagnostic",
  },
  radiology: {
    key: "radiology",
    title: "Radiology and examination centers",
    titleAr: "مراكز الأشعة والفحوص",
    description:
      "Discover reviewed radiology and diagnostic centers and coordinate a single consented examination destination.",
    descriptionAr:
      "اكتشف مراكز الأشعة والتشخيص المراجعة ونسّق وجهة فحص واحدة بموافقة المريض.",
    types: ["radiology_center", "diagnostic_center"],
    workspace: "/radiology/rms",
    workspaceLabel: "Open radiology management",
    icon: Radio,
    appointmentType: "diagnostic",
  },
};

const DIRECTORY_LINKS = [
  { href: "/clinics", label: "Clinics", labelAr: "العيادات" },
  { href: "/pharmacies", label: "Pharmacies", labelAr: "الصيدليات" },
  { href: "/labs", label: "Laboratories", labelAr: "المعامل" },
  { href: "/radiology", label: "Radiology", labelAr: "الأشعة" },
];

const emptyApplication = {
  entityType: "clinic" as EntityType,
  name: "",
  email: "",
  phone: "",
  country: "Egypt",
  city: "",
  address: "",
  website: "",
  licenseAuthority: "",
  licenseNumber: "",
  licenseExpiry: "",
  specialties: "",
  services: "",
  evidence: "",
  notes: "",
};
const emptyMessage = { subject: "", message: "", email: "", phone: "" };
const emptyAppointment = { requestedStart: "", reason: "" };

export default function HealthcareDirectory() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const key =
    window.location.pathname.split("/").filter(Boolean)[0] || "clinics";
  const config = CONFIGS[key] || CONFIGS.clinics;
  const Icon = config.icon;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [action, setAction] = useState<
    "message" | "appointment" | "claim" | "create" | null
  >(null);
  const [application, setApplication] = useState({
    ...emptyApplication,
    entityType: config.types[0],
  });
  const [messageDraft, setMessageDraft] = useState(emptyMessage);
  const [appointmentDraft, setAppointmentDraft] = useState(emptyAppointment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const types = config.types.join(",");
      const rows = await supabaseFetch<Provider[]>(
        `/rest/v1/healthcare_provider_directory_v1?select=*&entity_type=in.(${types})&order=display_name.asc&limit=500`,
      );
      setProviders(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              "Could not load the provider directory.",
              "تعذر تحميل دليل مقدمي الخدمة.",
            ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [config.key]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const cityNeedle = city.trim().toLocaleLowerCase();
    return providers.filter((provider) => {
      const searchable = [
        provider.display_name,
        provider.summary,
        ...provider.specialties,
        ...provider.services,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (!cityNeedle ||
          String(provider.city || "")
            .toLocaleLowerCase()
            .includes(cityNeedle))
      );
    });
  }, [providers, query, city]);

  function openAction(provider: Provider | null, next: typeof action) {
    setSelected(provider);
    setAction(next);
    setError(null);
    setNotice(null);
    if (next === "claim" && provider)
      setApplication({
        ...emptyApplication,
        entityType: provider.entity_type,
        name: provider.display_name,
        city: provider.city || "",
        country: provider.country || "Egypt",
        website: provider.website_url || "",
      });
    if (next === "create")
      setApplication({ ...emptyApplication, entityType: config.types[0] });
  }

  async function submitApplication(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/healthcare_entity_applications", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          application_type: selected ? "claim_existing" : "create_new",
          target_profile_id: selected?.id || null,
          entity_type: selected?.entity_type || application.entityType,
          requested_name: application.name.trim(),
          work_email: application.email.trim(),
          contact_phone: application.phone.trim() || null,
          country: application.country.trim() || null,
          city: application.city.trim() || null,
          address: application.address.trim() || null,
          website_url: application.website.trim() || null,
          license_authority: application.licenseAuthority.trim() || null,
          license_number: application.licenseNumber.trim(),
          license_expiry: application.licenseExpiry || null,
          specialties: splitList(application.specialties),
          services: splitList(application.services),
          evidence_urls: splitList(application.evidence),
          notes: application.notes.trim() || null,
          status: "pending",
          submitted_by: session.user.id,
        }),
      });
      setNotice(
        t(
          "Application submitted for platform-admin verification.",
          "تم إرسال الطلب لمراجعة مسؤول المنصة.",
        ),
      );
      setAction(null);
      setSelected(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the application.", "تعذر إرسال الطلب."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/healthcare_entity_messages", {
        method: "POST",
        body: JSON.stringify({
          profile_id: selected.id,
          organization_id: selected.organization_id,
          sender_user_id: session.user.id,
          subject: messageDraft.subject.trim(),
          message: messageDraft.message.trim(),
          reply_email: messageDraft.email.trim() || null,
          reply_phone: messageDraft.phone.trim() || null,
          status: "submitted",
        }),
      });
      setMessageDraft(emptyMessage);
      setAction(null);
      setNotice(
        t(
          "Your private message was sent to the provider.",
          "تم إرسال رسالتك الخاصة إلى مقدم الخدمة.",
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not send the message.", "تعذر إرسال الرسالة."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitAppointment(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/healthcare_appointments", {
        method: "POST",
        body: JSON.stringify({
          profile_id: selected.id,
          organization_id: selected.organization_id,
          patient_user_id: session.user.id,
          appointment_type: config.appointmentType,
          requested_start: new Date(
            appointmentDraft.requestedStart,
          ).toISOString(),
          reason: appointmentDraft.reason.trim(),
          status: "requested",
        }),
      });
      setAppointmentDraft(emptyAppointment);
      setAction(null);
      setNotice(
        t(
          "Appointment request sent. The provider must confirm a time.",
          "تم إرسال طلب الموعد ويجب على مقدم الخدمة تأكيد الوقت.",
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not request the appointment.", "تعذر طلب الموعد."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function share(provider: Provider) {
    const url = `${window.location.origin}${window.location.pathname}?provider=${encodeURIComponent(provider.slug)}`;
    if (navigator.share)
      await navigator.share({
        title: provider.display_name,
        text: provider.summary || config.title,
        url,
      });
    else {
      await navigator.clipboard.writeText(url);
      setNotice(t("Profile link copied.", "تم نسخ رابط الملف."));
    }
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border bg-card p-6 shadow-sm md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <Icon className="h-4 w-4" />
              {t("Reviewed healthcare network", "شبكة رعاية صحية مراجعة")}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              {t(config.title, config.titleAr)}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
              {t(config.description, config.descriptionAr)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={config.workspace}>
                {t(config.workspaceLabel, "فتح مساحة الإدارة")}
              </Link>
            </Button>
            <Button onClick={() => openAction(null, "create")}>
              <Building2 className="mr-2 h-4 w-4" />
              {t("Create approved profile", "إنشاء ملف معتمد")}
            </Button>
          </div>
        </div>
      </section>
      <nav
        aria-label={t("Healthcare directories", "أدلة الرعاية الصحية")}
        className="mt-4 flex flex-wrap gap-2"
      >
        {DIRECTORY_LINKS.map((item) => (
          <Button
            key={item.href}
            asChild
            size="sm"
            variant={item.href === `/${config.key}` ? "default" : "outline"}
          >
            <Link href={item.href}>{t(item.label, item.labelAr)}</Link>
          </Button>
        ))}
      </nav>
      <Alert className="mt-5">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          {t(
            "Public profiles require administrator approval. Appointments and messages are private. Clinical records are visible only to the patient and explicitly authorized care teams. This is not an emergency service.",
            "تتطلب الملفات العامة موافقة المسؤول. المواعيد والرسائل خاصة، والسجلات السريرية لا يراها إلا المريض وفريق الرعاية المصرح له. هذه ليست خدمة طوارئ.",
          )}
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="mt-5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <section className="sticky top-2 z-20 mt-6 grid gap-3 rounded-2xl border bg-card/95 p-4 shadow-lg backdrop-blur md:grid-cols-[1fr_260px_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(
              "Search name, specialty, or service",
              "ابحث بالاسم أو التخصص أو الخدمة",
            )}
          />
        </label>
        <Input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder={t("City", "المدينة")}
        />
        <Badge variant="outline" className="justify-center py-2">
          {loading
            ? t("Loading…", "جارٍ التحميل…")
            : `${visible.length} ${t("profiles", "ملف")}`}
        </Badge>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((provider) => (
          <Card key={provider.id} className="flex h-full flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                {provider.logo_url ? (
                  <img
                    src={provider.logo_url}
                    alt=""
                    className="h-14 w-14 rounded-xl border object-contain"
                  />
                ) : (
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <Icon className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0">
                  <CardTitle>{provider.display_name}</CardTitle>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{humanize(provider.entity_type)}</Badge>
                    <Badge variant="outline">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {t("Reviewed", "مراجع")}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4">
              <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                {provider.summary ||
                  t(
                    "Provider description pending a reviewed update.",
                    "وصف مقدم الخدمة قيد التحديث والمراجعة.",
                  )}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {[provider.city, provider.country].filter(Boolean).join(", ") ||
                  t("Location not published", "الموقع غير منشور")}
              </div>
              <div className="flex flex-wrap gap-1">
                {[...provider.specialties, ...provider.services]
                  .slice(0, 8)
                  .map((value) => (
                    <Badge key={value} variant="secondary">
                      {value}
                    </Badge>
                  ))}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => openAction(provider, "message")}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  {t("Message", "رسالة")}
                </Button>
                {provider.accepting_patients && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAction(provider, "appointment")}
                  >
                    <CalendarDays className="mr-1 h-4 w-4" />
                    {t("Appointment", "موعد")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openAction(provider, "claim")}
                >
                  {t("Claim", "مطالبة")}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void share(provider)}
                  aria-label={t("Share", "مشاركة")}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && visible.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <CardContent className="p-10 text-center">
              <Hospital className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">
                {t(
                  "No approved profile matches yet",
                  "لا يوجد ملف معتمد مطابق بعد",
                )}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "Submit a licensed entity for administrator review; it will remain private until approved.",
                  "أرسل جهة مرخصة لمراجعة المسؤول وستظل خاصة حتى اعتمادها.",
                )}
              </p>
              <Button
                className="mt-4"
                onClick={() => openAction(null, "create")}
              >
                {t("Submit an entity", "إرسال جهة")}
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {action && (
        <section className="mt-8 rounded-3xl border bg-muted/30 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">
                {action === "message"
                  ? t("Private provider message", "رسالة خاصة لمقدم الخدمة")
                  : action === "appointment"
                    ? t("Request an appointment", "طلب موعد")
                    : action === "claim"
                      ? t(
                          "Claim this published entity",
                          "المطالبة بهذه الجهة المنشورة",
                        )
                      : t(
                          "Create a new provider entity",
                          "إنشاء جهة مقدمة خدمة جديدة",
                        )}
              </h2>
              {selected && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.display_name}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setAction(null);
                setSelected(null);
              }}
            >
              {t("Close", "إغلاق")}
            </Button>
          </div>
          {!isAuthenticated ? (
            <Alert>
              <AlertDescription>
                {t(
                  "Sign in before messaging, booking, claiming, or creating an entity.",
                  "سجّل الدخول قبل المراسلة أو الحجز أو المطالبة أو إنشاء جهة.",
                )}{" "}
                <Link href="/account" className="font-semibold text-primary">
                  {t("Open account", "فتح الحساب")}
                </Link>
              </AlertDescription>
            </Alert>
          ) : action === "message" ? (
            <form
              onSubmit={submitMessage}
              className="grid gap-4 md:grid-cols-2"
            >
              <Field label={t("Subject", "الموضوع")}>
                <Input
                  value={messageDraft.subject}
                  onChange={(e) =>
                    setMessageDraft({
                      ...messageDraft,
                      subject: e.target.value,
                    })
                  }
                  required
                  minLength={2}
                />
              </Field>
              <Field label={t("Reply email", "بريد الرد")}>
                <Input
                  type="email"
                  value={messageDraft.email}
                  onChange={(e) =>
                    setMessageDraft({ ...messageDraft, email: e.target.value })
                  }
                />
              </Field>
              <Field label={t("Reply phone", "هاتف الرد")}>
                <Input
                  value={messageDraft.phone}
                  onChange={(e) =>
                    setMessageDraft({ ...messageDraft, phone: e.target.value })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <Field label={t("Message", "الرسالة")}>
                  <Textarea
                    value={messageDraft.message}
                    onChange={(e) =>
                      setMessageDraft({
                        ...messageDraft,
                        message: e.target.value,
                      })
                    }
                    required
                    minLength={10}
                  />
                </Field>
              </div>
              <Button disabled={busy}>
                {t("Send private message", "إرسال رسالة خاصة")}
              </Button>
            </form>
          ) : action === "appointment" ? (
            <form
              onSubmit={submitAppointment}
              className="grid gap-4 md:grid-cols-2"
            >
              <Field
                label={t("Preferred date and time", "التاريخ والوقت المفضل")}
              >
                <Input
                  type="datetime-local"
                  value={appointmentDraft.requestedStart}
                  onChange={(e) =>
                    setAppointmentDraft({
                      ...appointmentDraft,
                      requestedStart: e.target.value,
                    })
                  }
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <Field label={t("Reason for visit", "سبب الزيارة")}>
                  <Textarea
                    value={appointmentDraft.reason}
                    onChange={(e) =>
                      setAppointmentDraft({
                        ...appointmentDraft,
                        reason: e.target.value,
                      })
                    }
                    required
                    minLength={5}
                  />
                </Field>
              </div>
              <Button disabled={busy}>
                {t("Send appointment request", "إرسال طلب الموعد")}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={submitApplication}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {!selected && (
                <Field label={t("Entity type", "نوع الجهة")}>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={application.entityType}
                    onChange={(e) =>
                      setApplication({
                        ...application,
                        entityType: e.target.value as EntityType,
                      })
                    }
                  >
                    {config.types.map((type) => (
                      <option key={type} value={type}>
                        {humanize(type)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={t("Published name", "الاسم المنشور")}>
                <Input
                  value={application.name}
                  onChange={(e) =>
                    setApplication({ ...application, name: e.target.value })
                  }
                  required
                  readOnly={Boolean(selected)}
                />
              </Field>
              <Field label={t("Work email", "بريد العمل")}>
                <Input
                  type="email"
                  value={application.email}
                  onChange={(e) =>
                    setApplication({ ...application, email: e.target.value })
                  }
                  required
                />
              </Field>
              <Field label={t("Contact phone", "هاتف التواصل")}>
                <Input
                  value={application.phone}
                  onChange={(e) =>
                    setApplication({ ...application, phone: e.target.value })
                  }
                />
              </Field>
              <Field label={t("License number", "رقم الترخيص")}>
                <Input
                  value={application.licenseNumber}
                  onChange={(e) =>
                    setApplication({
                      ...application,
                      licenseNumber: e.target.value,
                    })
                  }
                  required
                  minLength={3}
                />
              </Field>
              <Field label={t("License authority", "جهة الترخيص")}>
                <Input
                  value={application.licenseAuthority}
                  onChange={(e) =>
                    setApplication({
                      ...application,
                      licenseAuthority: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={t("License expiry", "انتهاء الترخيص")}>
                <Input
                  type="date"
                  value={application.licenseExpiry}
                  onChange={(e) =>
                    setApplication({
                      ...application,
                      licenseExpiry: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={t("Country", "الدولة")}>
                <Input
                  value={application.country}
                  onChange={(e) =>
                    setApplication({ ...application, country: e.target.value })
                  }
                />
              </Field>
              <Field label={t("City", "المدينة")}>
                <Input
                  value={application.city}
                  onChange={(e) =>
                    setApplication({ ...application, city: e.target.value })
                  }
                />
              </Field>
              <Field label={t("Address", "العنوان")}>
                <Input
                  value={application.address}
                  onChange={(e) =>
                    setApplication({ ...application, address: e.target.value })
                  }
                />
              </Field>
              <Field label={t("Website", "الموقع")}>
                <Input
                  type="url"
                  value={application.website}
                  onChange={(e) =>
                    setApplication({ ...application, website: e.target.value })
                  }
                />
              </Field>
              <Field label={t("Specialties", "التخصصات")}>
                <Input
                  value={application.specialties}
                  onChange={(e) =>
                    setApplication({
                      ...application,
                      specialties: e.target.value,
                    })
                  }
                  placeholder={t("Comma separated", "مفصولة بفواصل")}
                />
              </Field>
              <Field label={t("Services", "الخدمات")}>
                <Input
                  value={application.services}
                  onChange={(e) =>
                    setApplication({ ...application, services: e.target.value })
                  }
                  placeholder={t("Comma separated", "مفصولة بفواصل")}
                />
              </Field>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label={t("Evidence URLs", "روابط الأدلة")}>
                  <Textarea
                    value={application.evidence}
                    onChange={(e) =>
                      setApplication({
                        ...application,
                        evidence: e.target.value,
                      })
                    }
                    placeholder={t(
                      "License, official directory, or registration URLs — one per line",
                      "روابط الترخيص أو الدليل الرسمي أو التسجيل — رابط بكل سطر",
                    )}
                  />
                </Field>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label={t("Review notes", "ملاحظات المراجعة")}>
                  <Textarea
                    value={application.notes}
                    onChange={(e) =>
                      setApplication({ ...application, notes: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Button disabled={busy}>
                {t("Submit for admin approval", "إرسال لاعتماد المسؤول")}
              </Button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
