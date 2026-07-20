import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  FileHeart,
  FlaskConical,
  Pill,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Patient = {
  id: string;
  user_id: string | null;
  full_name: string;
  birthdate: string | null;
  sex_at_birth: string | null;
  gender_identity: string | null;
  city: string | null;
  country_code: string;
  identity_last4: string | null;
  identity_verification_status: string;
  status: string;
};
type TimelineEvent = {
  id: string;
  resource_type: string;
  event_type: string;
  status: string | null;
  title: string;
  summary: string | null;
  occurred_at: string;
};
type Encounter = {
  id: string;
  encounter_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  chief_complaint: string | null;
  clinical_summary: string | null;
  diagnosis_summary: string | null;
  care_plan: string | null;
};
type Prescription = {
  id: string;
  status: string;
  authored_at: string;
  clinical_indication: string | null;
  instructions: string | null;
  valid_until: string | null;
};
type PrescriptionItem = {
  id: string;
  prescription_id: string;
  canonical_medicine_id: number | null;
  medicine_name: string;
  strength: string | null;
  dosage_form: string | null;
  route: string | null;
  dose: string;
  frequency: string;
  duration: string | null;
  dispense_status: string;
};
type ServiceOrder = {
  id: string;
  service_type: string;
  status: string;
  priority: string;
  service_name: string;
  clinical_question: string | null;
  authored_at: string;
  completed_at: string | null;
};
type Result = {
  id: string;
  service_order_id: string;
  result_type: string;
  status: string;
  title: string;
  summary: string | null;
  conclusion: string | null;
  issued_at: string | null;
  report_url: string | null;
};

export default function PatientCareProfile() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const [, params] = useRoute("/profiles/:patientId");
  const patientId = params?.patientId || "";
  const [patient, setPatient] = useState<Patient | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!session?.access_token || !patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const patientRows = await supabaseFetch<Patient[]>(
        `/rest/v1/clinical_patients?select=id,user_id,full_name,birthdate,sex_at_birth,gender_identity,city,country_code,identity_last4,identity_verification_status,status&id=eq.${encodeURIComponent(patientId)}&limit=1`,
      );
      if (!patientRows[0])
        throw new Error(
          t(
            "This patient profile does not exist or your consent scope does not allow access.",
            "ملف المريض غير موجود أو نطاق الموافقة لا يسمح لك بالوصول.",
          ),
        );
      setPatient(patientRows[0]);
      const [
        timelineRows,
        encounterRows,
        prescriptionRows,
        orderRows,
        resultRows,
      ] = await Promise.all([
        supabaseFetch<TimelineEvent[]>(
          `/rest/v1/clinical_patient_timeline_v1?select=id,resource_type,event_type,status,title,summary,occurred_at&patient_id=eq.${patientId}&order=occurred_at.desc&limit=300`,
        ),
        supabaseFetch<Encounter[]>(
          `/rest/v1/clinical_encounters?select=id,encounter_type,status,started_at,ended_at,chief_complaint,clinical_summary,diagnosis_summary,care_plan&patient_id=eq.${patientId}&order=started_at.desc&limit=100`,
        ),
        supabaseFetch<Prescription[]>(
          `/rest/v1/clinical_prescriptions?select=id,status,authored_at,clinical_indication,instructions,valid_until&patient_id=eq.${patientId}&order=authored_at.desc&limit=100`,
        ),
        supabaseFetch<ServiceOrder[]>(
          `/rest/v1/clinical_service_orders?select=id,service_type,status,priority,service_name,clinical_question,authored_at,completed_at&patient_id=eq.${patientId}&order=authored_at.desc&limit=200`,
        ),
        supabaseFetch<Result[]>(
          `/rest/v1/clinical_results?select=id,service_order_id,result_type,status,title,summary,conclusion,issued_at,report_url&patient_id=eq.${patientId}&order=created_at.desc&limit=200`,
        ),
      ]);
      setTimeline(timelineRows);
      setEncounters(encounterRows);
      setPrescriptions(prescriptionRows);
      setOrders(orderRows);
      setResults(resultRows);
      const prescriptionIds = prescriptionRows.map((row) => row.id);
      if (prescriptionIds.length)
        setItems(
          await supabaseFetch<PrescriptionItem[]>(
            `/rest/v1/clinical_prescription_items?select=id,prescription_id,canonical_medicine_id,medicine_name,strength,dosage_form,route,dose,frequency,duration,dispense_status&prescription_id=in.(${prescriptionIds.join(",")})&order=created_at.asc`,
          ),
        );
      else setItems([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load the patient journey.", "تعذر تحميل رحلة المريض."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [patientId, session?.access_token]);

  if (!session?.access_token)
    return (
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            {t(
              "Sign in to open a private patient profile. Public links never reveal clinical data.",
              "سجّل الدخول لفتح ملف مريض خاص. الروابط العامة لا تكشف البيانات السريرية.",
            )}{" "}
            <Link href="/account" className="font-semibold text-primary">
              {t("Open account", "فتح الحساب")}
            </Link>
          </AlertDescription>
        </Alert>
      </main>
    );
  if (loading)
    return (
      <main className="container mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">
        {t(
          "Loading authorized patient journey…",
          "جارٍ تحميل رحلة المريض المصرح بها…",
        )}
      </main>
    );
  if (!patient)
    return (
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || t("Patient profile unavailable.", "ملف المريض غير متاح.")}
          </AlertDescription>
        </Alert>
      </main>
  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-3xl border border-slate-200/50 dark:border-slate-800/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <FileHeart className="h-4 w-4" />
              {t(
                "Consent-scoped longitudinal record",
                "سجل طولي محدد بالموافقة",
              )}
            </p>
            <h1 className="mt-3 text-4xl font-bold">{patient.full_name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{humanize(patient.identity_verification_status)}</Badge>
              <Badge variant="outline">{humanize(patient.status)}</Badge>
              {patient.identity_last4 && (
                <Badge variant="outline">
                  ID •••• {patient.identity_last4}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clinics/emr">
                {t("Clinic workspace", "مساحة العيادة")}
              </Link>
            </Button>
            <Button onClick={() => void load()}>{t("Refresh", "تحديث")}</Button>
          </div>
        </div>
      </section>

      <Alert className="mt-5">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          {t(
            "This page is private and protected by row-level policies. Access does not authorize disclosure, export, diagnosis, prescribing, or emergency use beyond the user's clinical role and the patient's active consent.",
            "هذه الصفحة خاصة ومحمية بسياسات مستوى الصف. الوصول لا يجيز الإفصاح أو التصدير أو التشخيص أو الوصف أو استخدام الطوارئ خارج دور المستخدم وموافقة المريض النشطة.",
          )}
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={Stethoscope}
          label={t("Encounters", "الزيارات")}
          value={encounters.length}
        />
        <Metric
          icon={Pill}
          label={t("Prescriptions", "الوصفات")}
          value={prescriptions.length}
        />
        <Metric
          icon={FlaskConical}
          label={t("Orders", "الطلبات")}
          value={orders.length}
        />
        <Metric
          icon={FileHeart}
          label={t("Results", "النتائج")}
          value={results.length}
        />
        <Metric
          icon={Activity}
          label={t("Journey events", "أحداث الرحلة")}
          value={timeline.length}
        />
      </section>

      <section className="mt-9">
        <h2 className="text-2xl font-bold">
          {t("Clinical encounters", "الزيارات السريرية")}
        </h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {encounters.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <CardTitle>{humanize(row.encounter_type)}</CardTitle>
                  <Badge>{humanize(row.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.started_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Info
                  label={t("Chief complaint", "الشكوى الرئيسية")}
                  value={row.chief_complaint}
                />
                <Info
                  label={t("Clinical summary", "الملخص السريري")}
                  value={row.clinical_summary}
                />
                <Info
                  label={t("Diagnosis summary", "ملخص التشخيص")}
                  value={row.diagnosis_summary}
                />
                <Info
                  label={t("Care plan", "خطة الرعاية")}
                  value={row.care_plan}
                />
              </CardContent>
            </Card>
          ))}
          {!encounters.length && (
            <Empty
              text={t(
                "No encounter is visible in this consent scope.",
                "لا توجد زيارة ظاهرة في نطاق الموافقة.",
              )}
            />
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-2xl font-bold">
          {t("Medicines and prescriptions", "الأدوية والوصفات")}
        </h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {prescriptions.map((prescription) => (
            <Card key={prescription.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <CardTitle>{t("Prescription", "وصفة دوائية")}</CardTitle>
                  <Badge>{humanize(prescription.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(prescription.authored_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info
                  label={t("Indication", "دواعي الاستعمال")}
                  value={prescription.clinical_indication}
                />
                <Info
                  label={t("Instructions", "التعليمات")}
                  value={prescription.instructions}
                />
                {items
                  .filter((item) => item.prescription_id === prescription.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border bg-muted/20 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {item.canonical_medicine_id ? (
                              <Link
                                href={`/catalog/${item.canonical_medicine_id}`}
                                className="text-primary"
                              >
                                {item.medicine_name}
                              </Link>
                            ) : (
                              item.medicine_name
                            )}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {[item.strength, item.dosage_form, item.route]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {humanize(item.dispense_status)}
                        </Badge>
                      </div>
                      <div className="mt-3 text-sm">
                        {item.dose} · {item.frequency}
                        {item.duration ? ` · ${item.duration}` : ""}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
          {!prescriptions.length && (
            <Empty
              text={t(
                "No prescription is visible in this consent scope.",
                "لا توجد وصفة ظاهرة في نطاق الموافقة.",
              )}
            />
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-2xl font-bold">
          {t("Diagnostics and results", "الفحوص والنتائج")}
        </h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <CardTitle>{order.service_name}</CardTitle>
                  <Badge>{humanize(order.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {humanize(order.service_type)} · {humanize(order.priority)} ·{" "}
                  {new Date(order.authored_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Info
                  label={t("Clinical question", "السؤال السريري")}
                  value={order.clinical_question}
                />
                {results
                  .filter((result) => result.service_order_id === order.id)
                  .map((result) => (
                    <div
                      key={result.id}
                      className="rounded-xl border bg-muted/20 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="font-semibold">{result.title}</div>
                        <Badge variant="outline">
                          {humanize(result.status)}
                        </Badge>
                      </div>
                      <Info
                        label={t("Summary", "الملخص")}
                        value={result.summary}
                      />
                      <Info
                        label={t("Conclusion", "الخلاصة")}
                        value={result.conclusion}
                      />
                      {result.report_url && (
                        <a
                          href={result.report_url}
                          className="text-sm font-semibold text-primary"
                        >
                          {t("Open protected report", "فتح التقرير المحمي")}
                        </a>
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
          {!orders.length && (
            <Empty
              text={t(
                "No diagnostic order is visible in this consent scope.",
                "لا يوجد طلب فحص ظاهر في نطاق الموافقة.",
              )}
            />
          )}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-2xl font-bold">
          {t("Immutable journey timeline", "الخط الزمني غير القابل للتلاعب")}
        </h2>
        <div className="mt-4 space-y-3">
          {timeline.map((event) => (
            <Card key={event.id}>
              <CardContent className="grid gap-3 p-4 md:grid-cols-[190px_1fr_auto] md:items-center">
                <div className="text-xs text-muted-foreground">
                  <CalendarDays className="mr-1 inline h-4 w-4" />
                  {new Date(event.occurred_at).toLocaleString()}
                </div>
                <div>
                  <div className="font-semibold">{event.title}</div>
                  {event.summary && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.summary}
                    </p>
                  )}
                </div>
                <Badge variant="outline">
                  {event.status
                    ? humanize(event.status)
                    : humanize(event.event_type)}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {!timeline.length && (
            <Empty
              text={t(
                "No journey event is visible yet.",
                "لا توجد أحداث ظاهرة بعد.",
              )}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
}) {
  return (
    <Card className="transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border border-slate-200/60 dark:border-slate-800/80 bg-gradient-to-br from-card to-primary/5">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</div>
          <div className="text-xs font-medium text-muted-foreground mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm">{value || "—"}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-7 text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
