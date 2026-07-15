import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileHeart,
  FlaskConical,
  Hospital,
  Pill,
  Radio,
  RefreshCw,
  Route,
  ShieldCheck,
  Stethoscope,
  Users,
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

type WorkspaceKind = "clinic" | "pharmacy" | "laboratory" | "radiology";
type Membership = { organization_id: string; role: string; is_active: boolean };
type Provider = {
  id: string;
  organization_id: string;
  display_name: string;
  entity_type: string;
  verification_status: string;
  is_public: boolean;
};
type Patient = {
  patient_id: string;
  full_name: string;
  birthdate: string | null;
  phone: string | null;
  city: string | null;
  identity_verification_status: string;
};
type Appointment = {
  id: string;
  patient_id: string | null;
  appointment_type: string;
  requested_start: string;
  scheduled_start: string | null;
  reason: string;
  status: string;
};
type QueueEntry = {
  id: string;
  patient_id: string;
  queue_number: number | null;
  priority: string;
  status: string;
  created_at: string;
};
type RoutingRequest = {
  id: string;
  patient_id: string;
  prescription_id: string | null;
  service_order_id: string | null;
  selection_method: string;
  status: string;
  created_at: string;
};
type ServiceOrder = {
  id: string;
  patient_id: string;
  service_type: string;
  service_name: string;
  clinical_question: string | null;
  priority: string;
  status: string;
  authored_at: string;
};
type RoutingCandidate = {
  id: string;
  organization_id: string;
  display_name: string;
  entity_type: string;
  city: string | null;
};

const WORKSPACES = {
  clinic: {
    title: "Clinic and EMR workspace",
    titleAr: "مساحة العيادة والسجل الطبي",
    directory: "/clinics",
    types: ["physician", "clinic", "polyclinic", "hospital"],
    icon: Stethoscope,
  },
  pharmacy: {
    title: "Pharmacy management system",
    titleAr: "نظام إدارة الصيدلية",
    directory: "/pharmacies",
    types: ["pharmacy"],
    icon: Pill,
  },
  laboratory: {
    title: "Laboratory management system",
    titleAr: "نظام إدارة المعمل",
    directory: "/labs",
    types: ["laboratory"],
    icon: FlaskConical,
  },
  radiology: {
    title: "Radiology and examination management",
    titleAr: "نظام إدارة الأشعة والفحوص",
    directory: "/radiology",
    types: ["radiology_center", "diagnostic_center"],
    icon: Radio,
  },
};

export default function CareWorkspace() {
  const { t } = useLanguage();
  const { session, supabaseFetch } = usePatientAuth();
  const kind = workspaceKind();
  const config = WORKSPACES[kind];
  const Icon = config.icon;
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [routes, setRoutes] = useState<RoutingRequest[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [routingCandidates, setRoutingCandidates] = useState<
    RoutingCandidate[]
  >([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [composer, setComposer] = useState<
    | "patient"
    | "encounter"
    | "prescription"
    | "laboratory"
    | "radiology"
    | "result"
    | null
  >(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeProviders = useMemo(
    () =>
      providers.filter((provider) =>
        config.types.includes(provider.entity_type),
      ),
    [providers, config.types],
  );
  const provider =
    activeProviders.find((row) => row.organization_id === organizationId) ||
    null;

  async function loadIdentity() {
    if (!session?.user?.id) {
      setMemberships([]);
      setProviders([]);
      setOrganizationId("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const memberRows = await supabaseFetch<Membership[]>(
        `/rest/v1/organization_members?select=organization_id,role,is_active&user_id=eq.${session.user.id}&is_active=eq.true&order=created_at.asc`,
      );
      setMemberships(memberRows);
      if (!memberRows.length) {
        setProviders([]);
        setOrganizationId("");
        return;
      }
      const ids = memberRows.map((row) => row.organization_id).join(",");
      const profileRows = await supabaseFetch<Provider[]>(
        `/rest/v1/healthcare_entity_profiles?select=id,organization_id,display_name,entity_type,verification_status,is_public&organization_id=in.(${ids})&order=display_name.asc`,
      );
      setProviders(profileRows);
      const first = profileRows.find((row) =>
        config.types.includes(row.entity_type),
      );
      setOrganizationId((current) => current || first?.organization_id || "");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspace() {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      if (kind === "clinic") {
        const [appointmentRows, queueRows, candidateRows] = await Promise.all([
          supabaseFetch<Appointment[]>(
            `/rest/v1/healthcare_appointments?select=id,patient_id,appointment_type,requested_start,scheduled_start,reason,status&organization_id=eq.${organizationId}&order=requested_start.asc&limit=200`,
          ),
          supabaseFetch<QueueEntry[]>(
            `/rest/v1/clinical_queue_entries?select=id,patient_id,queue_number,priority,status,created_at&organization_id=eq.${organizationId}&status=in.(scheduled,checked_in,waiting,called,roomed,with_clinician)&order=created_at.asc&limit=200`,
          ),
          supabaseFetch<RoutingCandidate[]>(
            "/rest/v1/healthcare_provider_directory_v1?select=id,organization_id,display_name,entity_type,city&entity_type=in.(pharmacy,laboratory,radiology_center,diagnostic_center)&order=display_name.asc&limit=500",
          ),
        ]);
        setAppointments(appointmentRows);
        setQueue(queueRows);
        setRoutingCandidates(candidateRows);
        await searchPatients("");
      } else {
        const routeRows = await supabaseFetch<RoutingRequest[]>(
          `/rest/v1/healthcare_routing_requests?select=id,patient_id,prescription_id,service_order_id,selection_method,status,created_at&destination_organization_id=eq.${organizationId}&order=created_at.asc&limit=300`,
        );
        setRoutes(routeRows);
        if (kind !== "pharmacy") {
          const orderRows = await supabaseFetch<ServiceOrder[]>(
            `/rest/v1/clinical_service_orders?select=id,patient_id,service_type,service_name,clinical_question,priority,status,authored_at&destination_organization_id=eq.${organizationId}&order=authored_at.asc&limit=300`,
          );
          setOrders(orderRows);
        }
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadIdentity();
  }, [session?.user?.id, kind]);
  useEffect(() => {
    void loadWorkspace();
  }, [organizationId, kind]);

  async function searchPatients(value = patientQuery) {
    if (!organizationId) return;
    try {
      const rows = await supabaseFetch<Patient[]>(
        "/rest/v1/rpc/clinical_search_accessible_patients",
        {
          method: "POST",
          body: JSON.stringify({
            p_organization_id: organizationId,
            p_query: value.trim(),
            p_limit: 50,
          }),
        },
      );
      setPatients(rows);
    } catch (cause) {
      if (value) setError(messageOf(cause));
    }
  }

  async function createPatient(event: FormEvent) {
    event.preventDefault();
    if (!organizationId) return;
    setBusy("patient");
    setError(null);
    setNotice(null);
    try {
      const rows = await supabaseFetch<
        Array<{ patient_id: string; claim_code: string }>
      >("/rest/v1/rpc/clinical_create_patient", {
        method: "POST",
        body: JSON.stringify({
          p_organization_id: organizationId,
          p_full_name: draft.fullName,
          p_birthdate: draft.birthdate || null,
          p_phone: draft.phone || null,
          p_email: draft.email || null,
          p_city: draft.city || null,
          p_country_code: "EG",
          p_identity_type: "national_id",
          p_identity_value: draft.identity || null,
          p_sex_at_birth: draft.sex || null,
          p_consent_basis: "treatment",
        }),
      });
      const created = rows[0];
      setNotice(
        t(
          `Patient record created. Give the patient this private 7-day claim code: ${created?.claim_code || "unavailable"}`,
          `تم إنشاء سجل المريض. أعطِ المريض رمز المطالبة الخاص لمدة 7 أيام: ${created?.claim_code || "غير متاح"}`,
        ),
      );
      setComposer(null);
      setDraft({});
      await searchPatients("");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function createClinicalResource(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !selectedPatient || !session?.user?.id || !composer)
      return;
    setBusy(composer);
    setError(null);
    setNotice(null);
    try {
      if (composer === "encounter") {
        await supabaseFetch("/rest/v1/clinical_encounters", {
          method: "POST",
          body: JSON.stringify({
            patient_id: selectedPatient.patient_id,
            organization_id: organizationId,
            practitioner_user_id: session.user.id,
            encounter_type: draft.encounterType || "outpatient",
            status: "in_progress",
            chief_complaint: draft.chiefComplaint || null,
            clinical_summary: draft.summary || null,
            diagnosis_summary: draft.diagnosis || null,
            care_plan: draft.carePlan || null,
          }),
        });
      } else if (composer === "prescription") {
        const prescriptions = await supabaseFetch<Array<{ id: string }>>(
          "/rest/v1/clinical_prescriptions?select=id",
          {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              patient_id: selectedPatient.patient_id,
              organization_id: organizationId,
              prescriber_user_id: session.user.id,
              status: "active",
              clinical_indication: draft.indication || null,
              instructions: draft.instructions || null,
            }),
          },
        );
        await supabaseFetch("/rest/v1/clinical_prescription_items", {
          method: "POST",
          body: JSON.stringify({
            prescription_id: prescriptions[0].id,
            patient_id: selectedPatient.patient_id,
            canonical_medicine_id: draft.canonicalId
              ? Number(draft.canonicalId)
              : null,
            medicine_name: draft.medicineName,
            strength: draft.strength || null,
            dosage_form: draft.dosageForm || null,
            route: draft.route || null,
            dose: draft.dose,
            frequency: draft.frequency,
            duration: draft.duration || null,
            quantity: draft.quantity ? Number(draft.quantity) : null,
            quantity_unit: draft.quantityUnit || null,
            indication: draft.indication || null,
            instructions: draft.instructions || null,
          }),
        });
        await createRoutingRequest(prescriptions[0].id, null, "pharmacy");
      } else if (composer === "laboratory" || composer === "radiology") {
        const destination = selectedRoutingCandidate();
        const orders = await supabaseFetch<Array<{ id: string }>>(
          "/rest/v1/clinical_service_orders?select=id",
          {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              patient_id: selectedPatient.patient_id,
              ordering_organization_id: organizationId,
              ordering_practitioner_user_id: session.user.id,
              destination_organization_id:
                destination && draft.consent === "true"
                  ? destination.organization_id
                  : null,
              service_type: composer,
              status: "active",
              priority: draft.priority || "routine",
              service_name: draft.serviceName,
              clinical_question: draft.clinicalQuestion || null,
              instructions: draft.instructions || null,
            }),
          },
        );
        await createRoutingRequest(
          null,
          orders[0].id,
          destination?.entity_type ||
            (composer === "laboratory" ? "laboratory" : "radiology_center"),
        );
      }
      setNotice(
        t(
          "Clinical resource saved to the patient journey.",
          "تم حفظ المورد السريري في رحلة المريض.",
        ),
      );
      setComposer(null);
      setDraft({});
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  function selectedRoutingCandidate() {
    return (
      routingCandidates.find(
        (candidate) => candidate.id === draft.destinationProfileId,
      ) || null
    );
  }

  async function createRoutingRequest(
    prescriptionId: string | null,
    serviceOrderId: string | null,
    fallbackType: string,
  ) {
    const destination = selectedRoutingCandidate();
    if (
      !destination ||
      draft.consent !== "true" ||
      !selectedPatient ||
      !session?.user?.id
    )
      return;
    await supabaseFetch("/rest/v1/healthcare_routing_requests", {
      method: "POST",
      body: JSON.stringify({
        patient_id: selectedPatient.patient_id,
        source_organization_id: organizationId,
        prescription_id: prescriptionId,
        service_order_id: serviceOrderId,
        destination_type: destination.entity_type || fallbackType,
        destination_profile_id: destination.id,
        destination_organization_id: destination.organization_id,
        selection_method: draft.selectionMethod || "patient_selected",
        consent_confirmed: true,
        status: "offered",
        requested_by: session.user.id,
      }),
    });
  }

  async function saveResult(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !selectedOrder || !session?.user?.id) return;
    setBusy("result");
    setError(null);
    setNotice(null);
    try {
      await supabaseFetch("/rest/v1/clinical_results", {
        method: "POST",
        body: JSON.stringify({
          service_order_id: selectedOrder.id,
          patient_id: selectedOrder.patient_id,
          performing_organization_id: organizationId,
          result_type:
            kind === "laboratory" ? "laboratory_result" : "radiology_report",
          status: draft.final === "true" ? "final" : "preliminary",
          title: draft.title,
          summary: draft.summary || null,
          conclusion: draft.conclusion || null,
          structured_data: {},
          issued_at: new Date().toISOString(),
          verified_by: draft.final === "true" ? session.user.id : null,
          verified_at: draft.final === "true" ? new Date().toISOString() : null,
          created_by: session.user.id,
        }),
      });
      await supabaseFetch(
        `/rest/v1/clinical_service_orders?id=eq.${selectedOrder.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "completed",
            completed_at: new Date().toISOString(),
          }),
        },
      );
      setNotice(
        t(
          "Result saved and returned to the authorized patient journey.",
          "تم حفظ النتيجة وإعادتها إلى رحلة المريض المصرح بها.",
        ),
      );
      setComposer(null);
      setSelectedOrder(null);
      setDraft({});
      await loadWorkspace();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function updateAppointment(row: Appointment, status: string) {
    setBusy(row.id);
    setError(null);
    try {
      const body: Record<string, unknown> = { status };
      if (status === "confirmed") body.scheduled_start = row.requested_start;
      await supabaseFetch(`/rest/v1/healthcare_appointments?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (status === "checked_in" && row.patient_id && session?.user?.id) {
        await supabaseFetch("/rest/v1/clinical_queue_entries", {
          method: "POST",
          body: JSON.stringify({
            appointment_id: row.id,
            patient_id: row.patient_id,
            organization_id: organizationId,
            priority: "routine",
            status: "checked_in",
            checked_in_at: new Date().toISOString(),
            created_by: session.user.id,
          }),
        });
      }
      await loadWorkspace();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  async function updateRoute(row: RoutingRequest, status: string) {
    setBusy(row.id);
    setError(null);
    try {
      await supabaseFetch(
        `/rest/v1/healthcare_routing_requests?id=eq.${row.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            ...(status === "accepted"
              ? {
                  accepted_by: session?.user?.id,
                  accepted_at: new Date().toISOString(),
                }
              : {}),
            ...(status === "fulfilled"
              ? { fulfilled_at: new Date().toISOString() }
              : {}),
          }),
        },
      );
      await loadWorkspace();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(null);
    }
  }

  if (!session?.access_token)
    return (
      <Gate
        title={t(config.title, config.titleAr)}
        text={t(
          "Sign in through the staff portal. Database policies will then verify your approved organization membership.",
          "سجّل الدخول عبر بوابة الفريق، ثم تتحقق سياسات قاعدة البيانات من عضويتك المعتمدة.",
        )}
      />
    );
  if (!loading && activeProviders.length === 0)
    return (
      <Gate
        title={t(config.title, config.titleAr)}
        text={t(
          "No approved provider profile is linked to your account yet. Claim an existing profile or submit a licensed entity for administrator approval.",
          "لا يوجد ملف مقدم خدمة معتمد مرتبط بحسابك بعد. طالب بملف قائم أو أرسل جهة مرخصة لاعتماد المسؤول.",
        )}
        directory={config.directory}
      />
    );

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
              <Icon className="h-4 w-4" />
              {t(
                "Private role-scoped operations",
                "عمليات خاصة محددة الصلاحيات",
              )}
            </p>
            <h1 className="mt-3 text-4xl font-bold">
              {t(config.title, config.titleAr)}
            </h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">
              {provider?.display_name ||
                t("Select an approved organization", "اختر جهة معتمدة")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeProviders.length > 1 && (
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              >
                {activeProviders.map((row) => (
                  <option key={row.id} value={row.organization_id}>
                    {row.display_name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              onClick={() => void loadWorkspace()}
              disabled={loading}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {t("Refresh", "تحديث")}
            </Button>
            <Button asChild variant="outline">
              <Link href={config.directory}>
                {t("Public directory", "الدليل العام")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <Alert className="mt-5">
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          {t(
            "Every read and write is restricted by patient consent, organization membership, resource scope, and audit events. Do not enter emergency instructions, use another person's account, or treat routing as clinical approval.",
            "كل قراءة وكتابة مقيدة بموافقة المريض وعضوية الجهة ونطاق المورد وسجل التدقيق. لا تدخل تعليمات طوارئ ولا تستخدم حساب شخص آخر ولا تعتبر التوجيه اعتمادًا سريريًا.",
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

      {kind === "clinic" ? (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={CalendarDays}
              label={t("Appointments", "المواعيد")}
              value={appointments.length}
            />
            <Metric
              icon={Users}
              label={t("Active queue", "قائمة الانتظار")}
              value={queue.length}
            />
            <Metric
              icon={FileHeart}
              label={t("Accessible patients", "المرضى المتاحون")}
              value={patients.length}
            />
            <Metric
              icon={Activity}
              label={t("Selected patient", "المريض المحدد")}
              value={selectedPatient ? 1 : 0}
            />
          </section>
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">
                {t(
                  "Appointments and reception queue",
                  "المواعيد وقائمة الاستقبال",
                )}
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setComposer("patient");
                  setDraft({});
                }}
              >
                {t("Create consented patient record", "إنشاء سجل مريض بموافقة")}
              </Button>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {appointments.map((row) => (
                <Card key={row.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {new Date(
                            row.scheduled_start || row.requested_start,
                          ).toLocaleString()}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {row.reason}
                        </p>
                      </div>
                      <Badge>{humanize(row.status)}</Badge>
                    </div>
                    <div className="flex gap-2">
                      {row.status === "requested" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            void updateAppointment(row, "confirmed")
                          }
                          disabled={busy === row.id}
                        >
                          {t("Confirm", "تأكيد")}
                        </Button>
                      )}
                      {["confirmed", "offered"].includes(row.status) && (
                        <Button
                          size="sm"
                          onClick={() =>
                            void updateAppointment(row, "checked_in")
                          }
                          disabled={busy === row.id || !row.patient_id}
                        >
                          {t("Check in", "تسجيل الحضور")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void updateAppointment(row, "declined")}
                        disabled={busy === row.id}
                      >
                        {t("Decline", "رفض")}
                      </Button>
                    </div>
                    {!row.patient_id && (
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "The patient's account is not yet linked to a clinical record, so check-in remains disabled.",
                          "حساب المريض غير مرتبط بسجل سريري بعد، لذلك تسجيل الحضور غير متاح.",
                        )}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {appointments.length === 0 && (
                <Empty
                  text={t(
                    "No appointment requests for this organization.",
                    "لا توجد طلبات مواعيد لهذه الجهة.",
                  )}
                />
              )}
            </div>
          </section>
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  {t("Authorized patient records", "سجلات المرضى المصرح بها")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "Search only records for which this organization has active consent.",
                    "ابحث فقط في السجلات التي تملك الجهة موافقة نشطة عليها.",
                  )}
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchPatients();
                }}
                className="flex gap-2"
              >
                <Input
                  value={patientQuery}
                  onChange={(event) => setPatientQuery(event.target.value)}
                  placeholder={t("Patient name", "اسم المريض")}
                />
                <Button type="submit">{t("Search", "بحث")}</Button>
              </form>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {patients.map((patient) => (
                <Card
                  key={patient.patient_id}
                  className={
                    selectedPatient?.patient_id === patient.patient_id
                      ? "border-primary bg-primary/5"
                      : ""
                  }
                >
                  <CardContent className="p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(patient)}
                      aria-pressed={
                        selectedPatient?.patient_id === patient.patient_id
                      }
                      className="block w-full text-left"
                    >
                      <span className="font-semibold">{patient.full_name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {[patient.birthdate, patient.city]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline">
                        {humanize(patient.identity_verification_status)}
                      </Badge>
                      <Link
                        href={`/profiles/${patient.patient_id}`}
                        className="text-xs font-semibold text-primary"
                      >
                        {t("Longitudinal profile", "الملف المتكامل")}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedPatient && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setComposer("encounter");
                    setDraft({ encounterType: "outpatient" });
                  }}
                >
                  <Stethoscope className="mr-2 h-4 w-4" />
                  {t("Start encounter", "بدء زيارة")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setComposer("prescription");
                    setDraft({});
                  }}
                >
                  <Pill className="mr-2 h-4 w-4" />
                  {t("Prescribe medicine", "وصف دواء")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setComposer("laboratory");
                    setDraft({ priority: "routine" });
                  }}
                >
                  <FlaskConical className="mr-2 h-4 w-4" />
                  {t("Order laboratory test", "طلب تحليل")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setComposer("radiology");
                    setDraft({ priority: "routine" });
                  }}
                >
                  <Radio className="mr-2 h-4 w-4" />
                  {t("Order examination", "طلب فحص")}
                </Button>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <Metric
              icon={Route}
              label={t("Routed requests", "الطلبات الموجهة")}
              value={routes.length}
            />
            <Metric
              icon={ClipboardList}
              label={t("Diagnostic orders", "طلبات التشخيص")}
              value={orders.length}
            />
            <Metric
              icon={ShieldCheck}
              label={t("Approved organization", "جهة معتمدة")}
              value={provider ? 1 : 0}
            />
          </section>
          <section className="mt-8">
            <h2 className="text-2xl font-bold">
              {kind === "pharmacy"
                ? t("Prescription fulfillment queue", "قائمة تنفيذ الوصفات")
                : t("Diagnostic fulfillment queue", "قائمة تنفيذ الفحوص")}
            </h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {routes.map((row) => (
                <Card key={row.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {row.prescription_id
                            ? t("Prescription routing", "توجيه وصفة")
                            : t("Diagnostic routing", "توجيه فحص")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()} ·{" "}
                          {humanize(row.selection_method)}
                        </div>
                      </div>
                      <Badge>{humanize(row.status)}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.status === "offered" && (
                        <Button
                          size="sm"
                          onClick={() => void updateRoute(row, "accepted")}
                          disabled={busy === row.id}
                        >
                          {t("Accept", "قبول")}
                        </Button>
                      )}
                      {["accepted", "scheduled", "in_progress"].includes(
                        row.status,
                      ) && (
                        <Button
                          size="sm"
                          onClick={() => void updateRoute(row, "fulfilled")}
                          disabled={busy === row.id}
                        >
                          {t("Mark fulfilled", "اكتمل التنفيذ")}
                        </Button>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/profiles/${row.patient_id}`}>
                          {t("Authorized patient profile", "ملف المريض المصرح")}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {routes.length === 0 && (
                <Empty
                  text={t(
                    "No consented request is routed to this organization.",
                    "لا يوجد طلب بموافقة موجّه إلى هذه الجهة.",
                  )}
                />
              )}
            </div>
          </section>
          {kind !== "pharmacy" && (
            <section className="mt-8">
              <h2 className="text-2xl font-bold">
                {t("Orders awaiting diagnostic results", "طلبات تنتظر النتائج")}
              </h2>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {order.service_name}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {order.clinical_question ||
                              t(
                                "No clinical question published to this order.",
                                "لا يوجد سؤال سريري منشور في هذا الطلب.",
                              )}
                          </p>
                        </div>
                        <Badge>{humanize(order.status)}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setComposer("result");
                            setDraft({
                              title: `${order.service_name} result`,
                              final: "false",
                            });
                          }}
                        >
                          {t("Record result", "تسجيل النتيجة")}
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/profiles/${order.patient_id}`}>
                            {t("Patient journey", "رحلة المريض")}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {orders.length === 0 && (
                  <Empty
                    text={t(
                      "No diagnostic order is assigned to this organization.",
                      "لا يوجد طلب فحص مسند إلى هذه الجهة.",
                    )}
                  />
                )}
              </div>
            </section>
          )}
        </>
      )}

      {composer && (
        <Composer
          kind={composer}
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          routingCandidates={routingCandidates}
          onClose={() => {
            setComposer(null);
            setSelectedOrder(null);
            setDraft({});
          }}
          onSubmit={
            composer === "patient"
              ? createPatient
              : composer === "result"
                ? saveResult
                : createClinicalResource
          }
          t={t}
        />
      )}
    </main>
  );
}

function Composer({
  kind,
  draft,
  setDraft,
  busy,
  routingCandidates,
  onClose,
  onSubmit,
  t,
}: {
  kind: string;
  draft: Record<string, string>;
  setDraft: (value: Record<string, string>) => void;
  busy: string | null;
  routingCandidates: RoutingCandidate[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  t: (en: string, ar: string) => string;
}) {
  const field = (key: string, label: string, required = false) => (
    <Field label={label}>
      <Input
        value={draft[key] || ""}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        required={required}
      />
    </Field>
  );
  const routingType =
    kind === "prescription"
      ? ["pharmacy"]
      : kind === "laboratory"
        ? ["laboratory"]
        : kind === "radiology"
          ? ["radiology_center", "diagnostic_center"]
          : [];
  const candidates = routingCandidates.filter((candidate) =>
    routingType.includes(candidate.entity_type),
  );
  return (
    <section className="mt-8 rounded-3xl border bg-muted/30 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">{humanize(kind)}</h2>
        <Button variant="ghost" onClick={onClose}>
          {t("Close", "إغلاق")}
        </Button>
      </div>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        {kind === "patient" ? (
          <>
            {field("fullName", t("Full name", "الاسم الكامل"), true)}
            <Field label={t("Birthdate", "تاريخ الميلاد")}>
              <Input
                type="date"
                value={draft.birthdate || ""}
                onChange={(event) =>
                  setDraft({ ...draft, birthdate: event.target.value })
                }
              />
            </Field>
            {field("phone", t("Phone", "الهاتف"))}
            {field("email", t("Email", "البريد"))}
            {field("city", t("City", "المدينة"))}
            {field(
              "identity",
              t(
                "National ID (stored only as protected match)",
                "الرقم القومي (يُحفظ كبصمة مطابقة محمية فقط)",
              ),
            )}
            <Field label={t("Sex at birth", "الجنس عند الميلاد")}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.sex || ""}
                onChange={(event) =>
                  setDraft({ ...draft, sex: event.target.value })
                }
              >
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="intersex">Intersex</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
          </>
        ) : kind === "encounter" ? (
          <>
            {field(
              "chiefComplaint",
              t("Chief complaint", "الشكوى الرئيسية"),
              true,
            )}
            <LongField
              keyName="summary"
              label={t("Clinical summary", "الملخص السريري")}
              draft={draft}
              setDraft={setDraft}
            />
            <LongField
              keyName="diagnosis"
              label={t("Diagnosis summary", "ملخص التشخيص")}
              draft={draft}
              setDraft={setDraft}
            />
            <LongField
              keyName="carePlan"
              label={t("Care plan", "خطة الرعاية")}
              draft={draft}
              setDraft={setDraft}
            />
          </>
        ) : kind === "prescription" ? (
          <>
            {field("medicineName", t("Medicine name", "اسم الدواء"), true)}
            {field(
              "canonicalId",
              t("Encyclopedia medicine ID", "رقم الدواء في الموسوعة"),
            )}
            {field("strength", t("Strength", "التركيز"))}
            {field("dosageForm", t("Dosage form", "الشكل الدوائي"))}
            {field("route", t("Route", "طريقة الاستخدام"))}
            {field("dose", t("Dose", "الجرعة"), true)}
            {field("frequency", t("Frequency", "التكرار"), true)}
            {field("duration", t("Duration", "المدة"))}
            {field("quantity", t("Quantity", "الكمية"))}
            {field("quantityUnit", t("Quantity unit", "وحدة الكمية"))}
            {field("indication", t("Indication", "دواعي الاستعمال"))}
            <LongField
              keyName="instructions"
              label={t("Instructions", "التعليمات")}
              draft={draft}
              setDraft={setDraft}
            />
          </>
        ) : kind === "result" ? (
          <>
            {field("title", t("Result title", "عنوان النتيجة"), true)}
            <LongField
              keyName="summary"
              label={t("Result summary", "ملخص النتيجة")}
              draft={draft}
              setDraft={setDraft}
            />
            <LongField
              keyName="conclusion"
              label={t("Conclusion", "الخلاصة")}
              draft={draft}
              setDraft={setDraft}
            />
            <Field label={t("Result status", "حالة النتيجة")}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.final || "false"}
                onChange={(event) =>
                  setDraft({ ...draft, final: event.target.value })
                }
              >
                <option value="false">Preliminary</option>
                <option value="true">Final and verified</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            {field(
              "serviceName",
              t("Service or test name", "اسم الخدمة أو الفحص"),
              true,
            )}
            {field(
              "clinicalQuestion",
              t("Clinical question", "السؤال السريري"),
            )}
            <Field label={t("Priority", "الأولوية")}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.priority || "routine"}
                onChange={(event) =>
                  setDraft({ ...draft, priority: event.target.value })
                }
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="asap">ASAP</option>
                <option value="stat">STAT</option>
              </select>
            </Field>
            <LongField
              keyName="instructions"
              label={t("Instructions", "التعليمات")}
              draft={draft}
              setDraft={setDraft}
            />
          </>
        )}
        {routingType.length > 0 && (
          <>
            <Field
              label={t(
                "Optional patient-selected destination",
                "وجهة اختيارية يحددها المريض",
              )}
            >
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.destinationProfileId || ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    destinationProfileId: event.target.value,
                  })
                }
              >
                <option value="">
                  {t("Keep unassigned", "اتركه بلا تعيين")}
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.display_name}
                    {candidate.city ? ` · ${candidate.city}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Selection method", "طريقة الاختيار")}>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={draft.selectionMethod || "patient_selected"}
                onChange={(event) =>
                  setDraft({ ...draft, selectionMethod: event.target.value })
                }
              >
                <option value="patient_selected">Patient selected</option>
                <option value="nearest">Nearest</option>
                <option value="connected">Connected</option>
                <option value="contracted">Contracted</option>
                <option value="manual">Manual</option>
              </select>
            </Field>
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border bg-background p-4 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.consent === "true"}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    consent: event.target.checked ? "true" : "false",
                  })
                }
              />
              <span>
                {t(
                  "The patient consented to send this order to the single selected destination. Without this confirmation the clinical resource is saved but is not routed.",
                  "وافق المريض على إرسال هذا الطلب إلى الوجهة المحددة فقط. دون هذا التأكيد يُحفظ المورد السريري ولا يتم توجيهه.",
                )}
              </span>
            </label>
          </>
        )}
        <div className="md:col-span-2">
          <Button
            disabled={
              Boolean(busy) ||
              Boolean(draft.destinationProfileId && draft.consent !== "true")
            }
          >
            {t("Save securely", "حفظ آمن")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function LongField({
  keyName,
  label,
  draft,
  setDraft,
}: {
  keyName: string;
  label: string;
  draft: Record<string, string>;
  setDraft: (value: Record<string, string>) => void;
}) {
  return (
    <div className="md:col-span-2">
      <Field label={label}>
        <Textarea
          value={draft[keyName] || ""}
          onChange={(event) =>
            setDraft({ ...draft, [keyName]: event.target.value })
          }
        />
      </Field>
    </div>
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
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
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
function Gate({
  title,
  text,
  directory,
}: {
  title: string;
  text: string;
  directory?: string;
}) {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{text}</p>
          <div className="mt-5 flex gap-2">
            <Button asChild>
              <Link href="/portal">Open staff portal</Link>
            </Button>
            {directory && (
              <Button asChild variant="outline">
                <Link href={directory}>Open public directory</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function messageOf(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "The requested operation could not be completed.";
}
function workspaceKind(): WorkspaceKind {
  const path = window.location.pathname;
  if (path.includes("pharmacies")) return "pharmacy";
  if (path.includes("/labs")) return "laboratory";
  if (path.includes("radiology")) return "radiology";
  return "clinic";
}
