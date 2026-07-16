import { useMemo, useState } from "react";
import { Building2, Database, FileSpreadsheet, Pill, Send, UploadCloud, UserRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

export type ManagedCompany = { id: string; organization_id: string; display_name: string };

const ACCEPTED = ".csv,.xlsx,.xls,.ods,.json,.pdf,.zip";
const ALLOWED = new Set(["text/csv","application/json","application/pdf","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.oasis.opendocument.spreadsheet","application/zip","application/x-zip-compressed"]);

export function MedicineDataContributionHub({ companies = [], compact = false }: { companies?: ManagedCompany[]; compact?: boolean }) {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [kind, setKind] = useState("medicine_addition");
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [title, setTitle] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [manufacturerName, setManufacturerName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rowCount, setRowCount] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedCompany = companies.find((company) => company.id === companyId) || null;
  const isFileSubmission = ["dataset","spreadsheet","database_export"].includes(kind);
  const ready = useMemo(() => title.trim().length >= 3 && (isFileSubmission ? files.length > 0 : medicineName.trim().length >= 2), [title, isFileSubmission, files.length, medicineName]);

  function chooseFiles(list: FileList | null) {
    setError(null);
    const accepted = Array.from(list || []).filter((file) => {
      if (file.size > 25 * 1024 * 1024) { setError(t("Each file must be 25 MB or smaller.", "يجب ألا يزيد كل ملف عن 25 ميجابايت.")); return false; }
      if (!ALLOWED.has(file.type) && !/\.(csv|xlsx?|ods|json|pdf|zip)$/i.test(file.name)) { setError(t("Use CSV, Excel, ODS, JSON, PDF, or ZIP files.", "استخدم ملفات CSV أو Excel أو ODS أو JSON أو PDF أو ZIP.")); return false; }
      return true;
    });
    setFiles(accepted.slice(0, 5));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !ready) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const filePaths: string[] = [];
      for (const file of files) {
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"") || "medicine-data";
        const objectPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
        const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
        await supabaseFetch(`/storage/v1/object/medicine-data-submissions/${encodedPath}`, { method:"POST", headers:{"Content-Type":file.type || "application/octet-stream","x-upsert":"false"}, body:file });
        filePaths.push(objectPath);
      }
      await supabaseFetch("/rest/v1/medicine_catalog_submissions", { method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify({
        submitted_by:session.user.id,
        organization_id:selectedCompany?.organization_id || null,
        company_profile_id:selectedCompany?.id || null,
        submitter_kind:selectedCompany ? "company_representative" : "individual",
        submission_kind:kind,
        title:title.trim(), medicine_name:medicineName.trim() || null, manufacturer_name:manufacturerName.trim() || null,
        description:description.trim() || null, source_url:normalizeUrl(sourceUrl), file_paths:filePaths,
        file_names:files.map((file)=>file.name), declared_row_count:rowCount ? Number(rowCount) : null,
      }) });
      setTitle(""); setMedicineName(""); setManufacturerName(""); setDescription(""); setSourceUrl(""); setRowCount(""); setFiles([]);
      setMessage(t("Submitted for governed review. Nothing is published until an authorized reviewer approves it.", "تم الإرسال للمراجعة المنضبطة، ولن يُنشر شيء قبل موافقة مراجع مخول."));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not submit medicine data.", "تعذر إرسال بيانات الأدوية.")); }
    finally { setBusy(false); }
  }

  return <Card id="contribute-medicine-data" className={compact ? "border-primary/20" : "mt-6 border-primary/30 shadow-sm"}>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />{t("Request a medicine addition or contribute a dataset", "اطلب إضافة دواء أو ساهم بمجموعة بيانات")}</CardTitle><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("Individuals can request one medicine. Verified company representatives can also upload spreadsheets, database exports, or product lists. Every submission enters the same approval queue.", "يمكن للأفراد طلب إضافة دواء واحد، كما يمكن لممثلي الشركات الموثقين رفع جداول أو قواعد بيانات أو قوائم منتجات. تدخل جميع الإرسالات نفس قائمة الموافقة.")}</p></div><Badge variant="outline">{t("Approval required", "تتطلب الموافقة")}</Badge></div></CardHeader>
    <CardContent>
      {!isAuthenticated ? <div className="rounded-xl border bg-muted/30 p-5 text-sm"><p>{t("Create or sign in to a user account so your submission can be tracked.", "أنشئ حساب مستخدم أو سجل الدخول حتى يمكن تتبع إرسالك.")}</p><Button asChild className="mt-3"><a href="/account?next=%2Fmedicines">{t("Sign in to contribute", "سجل الدخول للمساهمة")}</a></Button></div> : <form onSubmit={submit} className="space-y-5">
        {companies.length > 0 && <div><Label>{t("Submit as", "الإرسال بصفة")}</Label><select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={companyId} onChange={(event)=>setCompanyId(event.target.value)}><option value="">{t("Individual", "فرد")}</option>{companies.map((company)=><option key={company.id} value={company.id}>{company.display_name}</option>)}</select><p className="mt-1 text-xs text-muted-foreground">{selectedCompany ? t("This submission will be attributed to your verified company.", "سينسب هذا الإرسال إلى شركتك الموثقة.") : t("This submission will be attributed to your user account.", "سينسب هذا الإرسال إلى حساب المستخدم الخاص بك.")}</p></div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
          ["medicine_addition",Pill,t("Add a medicine","إضافة دواء")], ["medicine_correction",Send,t("Correct a medicine","تصحيح دواء")],
          ["spreadsheet",FileSpreadsheet,t("Excel / CSV","Excel / CSV")], ["dataset",Database,t("Dataset","مجموعة بيانات")], ["database_export",Building2,t("Database export","تصدير قاعدة بيانات")],
        ].map(([value,Icon,label])=><button key={String(value)} type="button" onClick={()=>setKind(String(value))} className={`rounded-xl border p-3 text-left text-sm transition ${kind===value?"border-primary bg-primary/5 ring-1 ring-primary":"hover:border-primary/40 hover:bg-muted/40"}`}><Icon className="mb-2 h-5 w-5" /><span className="font-semibold">{String(label)}</span></button>)}</div>
        <div className="grid gap-4 md:grid-cols-2"><div><Label>{t("Submission title", "عنوان الإرسال")}</Label><Input className="mt-1" value={title} onChange={(event)=>setTitle(event.target.value)} required minLength={3} placeholder={t("What should reviewers know?", "ما الذي يجب أن يعرفه المراجعون؟")} /></div><div><Label>{t("Medicine or product name", "اسم الدواء أو المنتج")}</Label><Input className="mt-1" value={medicineName} onChange={(event)=>setMedicineName(event.target.value)} required={!isFileSubmission} /></div><div><Label>{t("Manufacturer or trademark owner", "المصنع أو مالك العلامة")}</Label><Input className="mt-1" value={manufacturerName} onChange={(event)=>setManufacturerName(event.target.value)} /></div><div><Label>{t("Official source link", "رابط المصدر الرسمي")}</Label><Input className="mt-1" inputMode="url" value={sourceUrl} onChange={(event)=>setSourceUrl(event.target.value)} placeholder="company.com/catalog" /></div></div>
        <div><Label>{t("Description and provenance", "الوصف والمصدر")}</Label><Textarea className="mt-1 min-h-24" value={description} onChange={(event)=>setDescription(event.target.value)} placeholder={t("Describe the columns, jurisdiction, source, update date, and permission to use the data.", "صف الأعمدة والدولة والمصدر وتاريخ التحديث وإذن استخدام البيانات.")} /></div>
        {isFileSubmission && <div className="rounded-xl border border-dashed p-4"><Label className="flex items-center gap-2"><UploadCloud className="h-4 w-4" />{t("Upload data files", "رفع ملفات البيانات")}</Label><Input className="mt-2" type="file" multiple accept={ACCEPTED} onChange={(event)=>chooseFiles(event.target.files)} /><div className="mt-3 flex flex-wrap gap-2">{files.map((file)=><Badge key={`${file.name}-${file.size}`} variant="secondary">{file.name}</Badge>)}</div><div className="mt-3 max-w-48"><Label>{t("Approximate row count", "عدد الصفوف التقريبي")}</Label><Input className="mt-1" type="number" min="0" value={rowCount} onChange={(event)=>setRowCount(event.target.value)} /></div></div>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}{message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
        <Button type="submit" disabled={busy || !ready}><UserRound className="mr-2 h-4 w-4" />{busy?t("Uploading and submitting…","جارٍ الرفع والإرسال…"):t("Submit for approval","إرسال للموافقة")}</Button>
      </form>}
    </CardContent>
  </Card>;
}

function normalizeUrl(value:string){const trimmed=value.trim();if(!trimmed)return null;return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)?trimmed:`https://${trimmed}`;}
