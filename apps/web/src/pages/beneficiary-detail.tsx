import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  HeartPulse,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";

type Session = { access_token: string; user?: { id: string } };
type Beneficiary = {
  id: string;
  organization_id: string;
  program_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  birthdate: string | null;
  city: string | null;
  primary_condition: string | null;
  risk_level: string;
  consent_status: string;
  status: string;
  programs?: { id: string; name: string } | null;
};
type Program = { id: string; name: string };
type Event = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
};

const EVENT_TYPES = [
  "enrollment",
  "eligibility_review",
  "medical_review",
  "approval",
  "dispensing",
  "delivery",
  "follow_up",
  "outcome",
  "note",
];
const RISK_LEVELS = ["standard", "elevated", "high", "critical"];
const CONSENT_STATUSES = ["pending", "granted", "withdrawn", "not_required"];
const BENEFICIARY_STATUSES = ["active", "inactive", "graduated", "archived"];

const EVENT_AR: Record<string, string> = {
  enrollment: "تسجيل",
  eligibility_review: "مراجعة الأهلية",
  medical_review: "مراجعة طبية",
  approval: "موافقة",
  dispensing: "صرف",
  delivery: "تسليم",
  follow_up: "متابعة",
  outcome: "نتيجة",
  note: "ملاحظة",
};
const RISK_AR: Record<string, string> = {
  standard: "عادي",
  elevated: "مرتفع",
  high: "عالٍ",
  critical: "حرج",
};
const CONSENT_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  granted: "ممنوح",
  withdrawn: "مسحوب",
  not_required: "غير مطلوب",
};
const STATUS_AR: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  graduated: "مكتمل",
  archived: "مؤرشف",
};

function loadPlatformSession(): Session | null {
  try {
    return JSON.parse(
      localStorage.getItem("medicine_support_staff_session") ||
        localStorage.getItem("medicine_support_patient_session") ||
        "null",
    );
  } catch {
    return null;
  }
}
function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}
async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok)
    throw new Error(data?.message || data?.error || "Request failed");
  return data as T;
}

export default function BeneficiaryDetailPage() {
  const { t } = useLanguage();
  const [, params] = useRoute("/workspace/beneficiaries/:id");
  const beneficiaryId = params?.id;
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [draft, setDraft] = useState({ event_type: "note", title: "", description: "" });
  const [editDraft, setEditDraft] = useState({
    full_name: "",
    phone: "",
    email: "",
    birthdate: "",
    city: "",
    primary_condition: "",
    risk_level: "standard",
    consent_status: "pending",
    status: "active",
    program_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const label = (key: string, map: Record<string, string>) =>
    t(key.replaceAll("_", " "), map[key] || key);

  function syncEditDraft(current: Beneficiary) {
    setEditDraft({
      full_name: current.full_name || "",
      phone: current.phone || "",
      email: current.email || "",
      birthdate: current.birthdate || "",
      city: current.city || "",
      primary_condition: current.primary_condition || "",
      risk_level: current.risk_level || "standard",
      consent_status: current.consent_status || "pending",
      status: current.status || "active",
      program_id: current.program_id || "",
    });
  }

  async function load() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!beneficiaryId) throw new Error(t("Beneficiary ID is missing.", "معرّف المستفيد مفقود."));
      const session = loadPlatformSession();
      if (!session?.access_token)
        throw new Error(
          t("Sign in from the platform portal first.", "سجّل الدخول من بوابة المنصة أولًا."),
        );
      const beneficiaryRows = await api<Beneficiary[]>(
        `/rest/v1/beneficiaries?select=id,organization_id,program_id,full_name,phone,email,birthdate,city,primary_condition,risk_level,consent_status,status,programs(id,name)&id=eq.${beneficiaryId}&limit=1`,
        session,
      );
      const current = beneficiaryRows[0] ?? null;
      if (!current)
        throw new Error(
          t("Beneficiary not found or access denied.", "المستفيد غير موجود أو الوصول مرفوض."),
        );
      setBeneficiary(current);
      syncEditDraft(current);
      const [programRows, eventRows] = await Promise.all([
        api<Program[]>(
          `/rest/v1/programs?select=id,name&organization_id=eq.${current.organization_id}&order=name.asc`,
          session,
        ),
        api<Event[]>(
          `/rest/v1/beneficiary_events?select=id,event_type,title,description,event_date&beneficiary_id=eq.${beneficiaryId}&order=event_date.desc`,
          session,
        ),
      ]);
      setPrograms(programRows);
      setEvents(eventRows);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to load beneficiary.", "تعذّر تحميل المستفيد."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [beneficiaryId]);

  async function saveBeneficiary() {
    if (!beneficiary || !editDraft.full_name.trim()) return;
    const session = loadPlatformSession();
    if (!session?.access_token) {
      setError(t("Sign in from the platform portal first.", "سجّل الدخول من بوابة المنصة أولًا."));
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/rest/v1/beneficiaries?id=eq.${beneficiary.id}`, session, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          full_name: editDraft.full_name.trim(),
          phone: editDraft.phone.trim() || null,
          email: editDraft.email.trim() || null,
          birthdate: editDraft.birthdate || null,
          city: editDraft.city.trim() || null,
          primary_condition: editDraft.primary_condition.trim() || null,
          risk_level: editDraft.risk_level,
          consent_status: editDraft.consent_status,
          status: editDraft.status,
          program_id: editDraft.program_id || null,
          updated_at: new Date().toISOString(),
        }),
      });
      await api(`/rest/v1/beneficiary_events`, session, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: beneficiary.organization_id,
          beneficiary_id: beneficiary.id,
          program_id: editDraft.program_id || null,
          event_type: "note",
          title: t("Beneficiary data updated", "تم تحديث بيانات المستفيد"),
          description: t(
            "Profile data was edited from Beneficiary 360°.",
            "تم تعديل بيانات الملف من شاشة المستفيد 360°.",
          ),
        }),
      });
      setMessage(t("Beneficiary data updated.", "تم تحديث بيانات المستفيد."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to update beneficiary.", "تعذّر تحديث المستفيد."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function addEvent() {
    if (!beneficiary || !draft.title.trim()) return;
    const session = loadPlatformSession();
    if (!session?.access_token) {
      setError(t("Sign in from the platform portal first.", "سجّل الدخول من بوابة المنصة أولًا."));
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/rest/v1/beneficiary_events`, session, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: beneficiary.organization_id,
          beneficiary_id: beneficiary.id,
          program_id: beneficiary.program_id,
          event_type: draft.event_type,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
        }),
      });
      setDraft({ event_type: "note", title: "", description: "" });
      setMessage(t("Timeline event added.", "تمت إضافة حدث في الجدول الزمني."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to add timeline event.", "تعذّر إضافة الحدث."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 -ml-3">
            <Link href="/workspace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("Back to workspace", "العودة إلى مساحة العمل")}
            </Link>
          </Button>
          <Badge className="mb-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            {t("Beneficiary 360°", "المستفيد 360°")}
          </Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <UserRound className="h-8 w-8 text-emerald-700" />
            {beneficiary?.full_name ?? t("Beneficiary profile", "ملف المستفيد")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t(
              "Longitudinal profile, editable beneficiary data, and support timeline.",
              "ملف طولي وبيانات قابلة للتعديل وجدول زمني للدعم.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh", "تحديث")}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {beneficiary && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HeartPulse className="h-4 w-4" />
                  {t("Primary condition", "الحالة الأساسية")}
                </div>
                <div className="mt-2 font-semibold">
                  {beneficiary.primary_condition || t("Not recorded", "غير مسجّل")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />
                  {t("Program", "البرنامج")}
                </div>
                <div className="mt-2 font-semibold">
                  {beneficiary.programs?.name || t("Unassigned", "غير مُسند")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  {t("Risk level", "مستوى الخطر")}
                </div>
                <div className="mt-2">
                  <Badge variant="secondary">
                    {label(beneficiary.risk_level, RISK_AR)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {t("Status", "الحالة")}
                </div>
                <div className="mt-2 font-semibold">
                  {label(beneficiary.status, STATUS_AR)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {t("Phone", "الهاتف")}
                </div>
                <div className="mt-2 font-medium">
                  {beneficiary.phone || t("Not recorded", "غير مسجّل")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {t("City", "المدينة")}
                </div>
                <div className="mt-2 font-medium">
                  {beneficiary.city || t("Not recorded", "غير مسجّل")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">
                  {t("Consent", "الموافقة")}
                </div>
                <div className="mt-2 font-medium">
                  {label(beneficiary.consent_status, CONSENT_AR)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t("Edit beneficiary data", "تعديل بيانات المستفيد")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>{t("Full name", "الاسم بالكامل")}</Label>
                  <Input
                    value={editDraft.full_name}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, full_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Phone", "الهاتف")}</Label>
                  <Input
                    value={editDraft.phone}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Email", "البريد الإلكتروني")}</Label>
                  <Input
                    type="email"
                    value={editDraft.email}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Birthdate", "تاريخ الميلاد")}</Label>
                  <Input
                    type="date"
                    value={editDraft.birthdate}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, birthdate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("City", "المدينة")}</Label>
                  <Input
                    value={editDraft.city}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Primary condition", "الحالة الأساسية")}</Label>
                  <Input
                    value={editDraft.primary_condition}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        primary_condition: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("Program", "البرنامج")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editDraft.program_id}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, program_id: e.target.value })
                    }
                  >
                    <option value="">{t("Unassigned", "غير مُسند")}</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Risk level", "مستوى الخطر")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editDraft.risk_level}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, risk_level: e.target.value })
                    }
                  >
                    {RISK_LEVELS.map((x) => (
                      <option key={x} value={x}>
                        {label(x, RISK_AR)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Consent", "الموافقة")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editDraft.consent_status}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        consent_status: e.target.value,
                      })
                    }
                  >
                    {CONSENT_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {label(x, CONSENT_AR)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Status", "الحالة")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={editDraft.status}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, status: e.target.value })
                    }
                  >
                    {BENEFICIARY_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {label(x, STATUS_AR)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                onClick={() => void saveBeneficiary()}
                disabled={saving || !editDraft.full_name.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                {t("Save beneficiary", "حفظ المستفيد")}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t("Add timeline event", "إضافة حدث زمني")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("Event type", "نوع الحدث")}</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.event_type}
                    onChange={(e) =>
                      setDraft({ ...draft, event_type: e.target.value })
                    }
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {label(type, EVENT_AR)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("Title", "العنوان")}</Label>
                  <Input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={t("Eligibility approved", "تمت الموافقة على الأهلية")}
                  />
                </div>
                <div>
                  <Label>{t("Description", "الوصف")}</Label>
                  <Textarea
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder={t(
                      "Add the relevant operational or clinical context.",
                      "أضف السياق التشغيلي أو السريري ذي الصلة.",
                    )}
                  />
                </div>
                <Button
                  onClick={() => void addEvent()}
                  disabled={saving || !draft.title.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("Add event", "إضافة حدث")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("Support timeline", "الجدول الزمني للدعم")}</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("No timeline events yet.", "لا توجد أحداث بعد.")}
                  </p>
                ) : (
                  <div className="space-y-5">
                    {events.map((event, index) => (
                      <div key={event.id} className="relative pl-8">
                        <div className="absolute left-1 top-1.5 h-3 w-3 rounded-full bg-emerald-600" />
                        {index < events.length - 1 && (
                          <div className="absolute left-[9px] top-5 h-[calc(100%+0.75rem)] w-px bg-border" />
                        )}
                        <div className="flex flex-col gap-1 rounded-lg border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">{event.title}</div>
                            <Badge variant="outline">
                              {label(event.event_type, EVENT_AR)}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground">
                              {event.description}
                            </p>
                          )}
                          <time className="text-xs text-muted-foreground">
                            {new Date(event.event_date).toLocaleString()}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
