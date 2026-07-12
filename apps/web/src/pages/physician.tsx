import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Flag, ShieldCheck, UserCog } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile = { id: string; role: string; is_active: boolean; full_name?: string | null };
type RequestStatus = "pending" | "approved" | "rejected";
type RequestedMedicine = {
  catalog_product_id?: number | null;
  medicine_id?: number | null;
  name_en?: string | null;
  name_ar?: string | null;
  quantity?: number | string | null;
  notes?: string | null;
};
type MedicineRequest = {
  id: string;
  patient_name: string;
  phone: string;
  email: string | null;
  address: string;
  medicines: unknown;
  status: RequestStatus | string;
  priority: string;
  notes: string | null;
  created_at: string;
};

const REVIEW_ROLES = new Set(["reviewer", "admin", "platform_admin", "super_admin"]);
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : []);

class PhysicianBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error("physician-page-render", error); }
  render() {
    if (this.state.failed) {
      return <main className="container mx-auto max-w-xl px-4 py-10"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>The physician workspace could not render safely. Refresh the page; if the issue continues, open the healthcare journey or staff portal.</AlertDescription></Alert><div className="mt-4 flex gap-2"><Button asChild><Link href="/portal">Staff portal</Link></Button><Button asChild variant="outline"><Link href="/journey">Healthcare journey</Link></Button></div></main>;
    }
    return this.props.children;
  }
}

export default function PhysicianPortal() {
  return <PhysicianBoundary><PhysicianPortalContent /></PhysicianBoundary>;
}

function PhysicianPortalContent() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { session, supabaseFetch } = usePatientAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => ({
    pending: requests.filter(row => row.status === "pending"),
    approved: requests.filter(row => row.status === "approved"),
    rejected: requests.filter(row => row.status === "rejected"),
  }), [requests]);
  const canReview = Boolean(profile?.is_active && REVIEW_ROLES.has(profile.role));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const userId = session?.user?.id;
      if (!userId) { setProfile(null); setRequests([]); return; }
      const profileResult = await supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,role,is_active,full_name&id=eq.${encodeURIComponent(userId)}&limit=1`);
      const nextProfile = asArray<Profile>(profileResult)[0] || null;
      setProfile(nextProfile);
      if (!nextProfile?.is_active || !REVIEW_ROLES.has(nextProfile.role)) {
        setRequests([]);
        return;
      }
      const rows = await supabaseFetch<MedicineRequest[]>("/rest/v1/medicine_requests?select=id,patient_name,phone,email,address,medicines,status,priority,notes,created_at&status=in.(pending,approved,rejected)&order=created_at.asc&limit=300");
      setRequests(asArray<MedicineRequest>(rows));
    } catch (cause) {
      setRequests([]);
      setError(cause instanceof Error ? cause.message : t("Could not load the clinical review queue.", "تعذر تحميل قائمة المراجعة السريرية."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session?.user?.id]);

  async function handleDecision(request: MedicineRequest, decision: "approved" | "rejected") {
    const reviewerNote = (reviewNotes[request.id] || "").trim();
    if (decision === "rejected" && !reviewerNote) {
      toast({ title: t("A review note is required to reject a request.", "ملاحظة المراجعة مطلوبة لرفض الطلب."), variant: "destructive" });
      return;
    }
    setSaving(request.id);
    setError(null);
    try {
      const auditNote = reviewerNote ? `[Clinical review ${new Date().toISOString()}] ${reviewerNote}` : null;
      const nextNotes = [request.notes?.trim(), auditNote].filter(Boolean).join("\n\n") || null;
      await supabaseFetch(`/rest/v1/medicine_requests?id=eq.${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: decision, notes: nextNotes }),
      });
      setReviewNotes(current => { const next = { ...current }; delete next[request.id]; return next; });
      toast({ title: decision === "approved" ? t("Request approved", "تمت الموافقة على الطلب") : t("Request rejected", "تم رفض الطلب") });
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t("The review could not be saved.", "تعذر حفظ المراجعة.");
      setError(message);
      toast({ title: message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  if (!session?.access_token) {
    return <main className="container mx-auto max-w-xl px-4 py-10"><Alert><ShieldCheck className="h-4 w-4"/><AlertDescription>{t("Sign in through the staff portal to open the physician and clinical-review workspace.", "سجّل الدخول من بوابة الموظفين لفتح مساحة الطبيب والمراجعة السريرية.")}</AlertDescription></Alert><Button asChild className="mt-4"><Link href="/portal">{t("Open staff portal", "فتح بوابة الموظفين")}</Link></Button></main>;
  }

  if (!loading && !canReview) {
    return <main className="container mx-auto max-w-2xl px-4 py-10"><Alert><ShieldCheck className="h-4 w-4"/><AlertDescription>{t("This account does not currently have organization-scoped clinical-review access. Patient requests have not been exposed globally to physician accounts. An administrator must grant an approved reviewer role or configure the future clinical assignment workflow.", "هذا الحساب لا يملك حاليًا صلاحية مراجعة سريرية ضمن نطاق المؤسسة. لم يتم كشف طلبات المرضى لجميع حسابات الأطباء. يجب على المسؤول منح دور مراجع معتمد أو إعداد مسار التكليف السريري القادم.")}</AlertDescription></Alert><div className="mt-4 flex flex-wrap gap-2"><Button asChild><Link href="/journey">{t("Open healthcare journey", "فتح رحلة الرعاية الصحية")}</Link></Button><Button asChild variant="outline"><Link href="/learning">{t("Open training", "فتح التدريب")}</Link></Button></div></main>;
  }

  return <main className="container mx-auto max-w-5xl px-4 py-8">
    <section className="rounded-3xl border bg-card p-6 shadow-sm md:p-8"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Physician and reviewer workspace", "مساحة الطبيب والمراجع")}</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold"><UserCog className="h-7 w-7 text-blue-600"/>{t("Medicine request clinical review", "المراجعة السريرية لطلبات الدواء")}</h1><p className="mt-3 max-w-3xl text-muted-foreground">{t("Review medicine-support requests within the permissions granted to your account. Approval here is an operational request decision, not an electronic prescription, diagnosis, or regulatory authorization.", "راجع طلبات دعم الدواء ضمن الصلاحيات الممنوحة لحسابك. الموافقة هنا قرار تشغيلي للطلب وليست وصفة إلكترونية أو تشخيصًا أو اعتمادًا تنظيميًا.")}</p></section>
    {loading && <div className="mt-6 space-y-3"><Skeleton className="h-24 w-full"/><Skeleton className="h-48 w-full"/></div>}
    {error && <Alert variant="destructive" className="mt-5"><AlertCircle className="h-4 w-4"/><AlertDescription>{error}</AlertDescription></Alert>}
    {!loading && canReview && <>
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"><Metric label={t("Pending", "قيد الانتظار")} value={grouped.pending.length}/><Metric label={t("Approved", "تمت الموافقة")} value={grouped.approved.length}/><Metric label={t("Rejected", "مرفوض")} value={grouped.rejected.length}/></section>
      <Tabs defaultValue="pending" className="mt-6"><TabsList><TabsTrigger value="pending">{t("Pending", "قيد الانتظار")} ({grouped.pending.length})</TabsTrigger><TabsTrigger value="approved">{t("Approved", "تمت الموافقة")} ({grouped.approved.length})</TabsTrigger><TabsTrigger value="rejected">{t("Rejected", "مرفوض")} ({grouped.rejected.length})</TabsTrigger></TabsList>
        <RequestTab rows={grouped.pending} empty={t("No requests await review.", "لا توجد طلبات تنتظر المراجعة.")} render={row => <RequestCard key={row.id} request={row} language={language} note={reviewNotes[row.id] || ""} setNote={value => setReviewNotes(current => ({ ...current, [row.id]: value }))} saving={saving === row.id} onApprove={() => void handleDecision(row, "approved")} onReject={() => void handleDecision(row, "rejected")} canAct/>}/>
        <RequestTab value="approved" rows={grouped.approved} empty={t("No approved requests.", "لا توجد طلبات تمت الموافقة عليها.")} render={row => <RequestCard key={row.id} request={row} language={language}/>}/>
        <RequestTab value="rejected" rows={grouped.rejected} empty={t("No rejected requests.", "لا توجد طلبات مرفوضة.")} render={row => <RequestCard key={row.id} request={row} language={language}/>}/>
      </Tabs>
    </>}
  </main>;
}

function RequestTab({ value = "pending", rows, empty, render }: { value?: string; rows: MedicineRequest[]; empty: string; render: (row: MedicineRequest) => ReactNode }) {
  return <TabsContent value={value} className="space-y-3">{rows.length ? rows.map(render) : <Card><CardContent className="p-10 text-center text-sm text-muted-foreground"><CheckCircle className="mx-auto mb-2 h-9 w-9 text-emerald-500"/>{empty}</CardContent></Card>}</TabsContent>;
}

function RequestCard({ request, language, note = "", setNote, saving = false, onApprove, onReject, canAct = false }: { request: MedicineRequest; language: string; note?: string; setNote?: (value: string) => void; saving?: boolean; onApprove?: () => void; onReject?: () => void; canAct?: boolean }) {
  const medicines = asArray<RequestedMedicine>(request.medicines);
  const urgent = ["critical", "urgent", "high"].includes(String(request.priority || "").toLowerCase());
  return <Card className={`border-l-4 ${urgent ? "border-l-red-500" : "border-l-blue-500"}`}><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-bold">Request {request.id.slice(0, 8)}</span><Badge variant={urgent ? "destructive" : "secondary"}>{request.priority || "normal"}</Badge></div><div className="mt-1 font-medium">{request.patient_name || "Patient"}</div><div className="text-xs text-muted-foreground">{request.phone || "No phone recorded"}</div></div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5"/>{safeDate(request.created_at)}</div></div>
    <div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requested medicines</div>{medicines.length ? <div className="space-y-2">{medicines.map((medicine, index) => { const name = language === "ar" ? medicine.name_ar || medicine.name_en : medicine.name_en || medicine.name_ar; return <div key={`${medicine.catalog_product_id || medicine.medicine_id || index}`} className="flex items-start justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm"><div><a href={medicine.catalog_product_id ? `/catalog/${medicine.catalog_product_id}` : "/medicines"} className="font-semibold text-primary hover:underline">{name || `Medicine ${index + 1}`}</a>{medicine.notes && <div className="mt-1 text-xs text-muted-foreground">{medicine.notes}</div>}</div><span className="text-xs text-muted-foreground">×{medicine.quantity ?? 1}</span></div>;})}</div> : <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No structured medicine lines were stored for this request.</div>}</div>
    {request.notes && <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap">{request.notes}</div>}
    {canAct && <><Textarea value={note} onChange={event => setNote?.(event.target.value)} placeholder="Add an accountable review note. A note is required for rejection."/><div className="flex flex-wrap gap-2"><Button onClick={onApprove} disabled={saving}><CheckCircle className="mr-2 h-4 w-4"/>Approve request</Button><Button variant="destructive" onClick={onReject} disabled={saving || !note.trim()}><Flag className="mr-2 h-4 w-4"/>Reject with note</Button></div></>}
    {urgent && <div className="flex items-center gap-2 text-xs font-medium text-red-700"><AlertTriangle className="h-4 w-4"/>Priority requires timely human review.</div>}
  </CardContent></Card>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5 text-center"><div className="text-3xl font-bold">{value.toLocaleString()}</div><div className="mt-1 text-sm text-muted-foreground">{label}</div></CardContent></Card>; }
function safeDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString(); }
