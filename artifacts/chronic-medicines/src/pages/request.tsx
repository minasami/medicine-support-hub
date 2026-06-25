import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateRequest,
  useListMedicines,
  useExtractMedicines,
} from "@workspace/api-client-react";
import {
  Plus,
  Trash2,
  Upload,
  Loader2,
  Sparkles,
  Search,
  X,
  Check,
  ChevronDown,
  AlertTriangle,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Highlight matching text ───────────────────────────────────────────────────
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Cardiovascular":    "bg-red-100 text-red-700",
  "Diabetes":          "bg-amber-100 text-amber-700",
  "Respiratory":       "bg-sky-100 text-sky-700",
  "Neurology":         "bg-violet-100 text-violet-700",
  "Gastrointestinal":  "bg-green-100 text-green-700",
  "Psychiatry":        "bg-purple-100 text-purple-700",
  "Endocrinology":     "bg-orange-100 text-orange-700",
  "Rheumatology":      "bg-rose-100 text-rose-700",
  "Nephrology":        "bg-blue-100 text-blue-700",
  "Hematology":        "bg-pink-100 text-pink-700",
  "Oncology":          "bg-slate-100 text-slate-700",
};

function categoryColor(cat?: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? "bg-slate-100 text-slate-600") : "";
}

// ── Per-row MedicineSearch component ─────────────────────────────────────────
interface Medicine {
  id: number;
  name_en: string;
  name_ar: string;
  dosage_form: string;
  strength?: string | null;
  category?: string | null;
}

interface MedicineSearchProps {
  value: string;
  onChange: (med: { medicine_id: number; name_en: string; name_ar: string } | { name_en: string }) => void;
  onClear: () => void;
  language: "en" | "ar";
  t: (en: string, ar: string) => string;
  testId?: string;
}

function MedicineSearch({ value, onChange, onClear, language, t, testId }: MedicineSearchProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const debouncedQuery = useDebounce(inputValue, 250);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Reset input when popover closes
  useEffect(() => {
    if (!open) setInputValue("");
  }, [open]);

  const { data: results, isLoading } = useListMedicines(
    { search: debouncedQuery || undefined, limit: 12 },
    { query: { enabled: open, queryKey: ["medicines", debouncedQuery] } }
  );

  const grouped = results?.reduce<Record<string, Medicine[]>>((acc, med) => {
    const cat = med.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(med as Medicine);
    return acc;
  }, {});

  function handleSelect(med: Medicine) {
    onChange({ medicine_id: med.id, name_en: med.name_en, name_ar: med.name_ar });
    setOpen(false);
  }

  function handleCustom() {
    if (!inputValue.trim()) return;
    onChange({ name_en: inputValue.trim() });
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && inputValue.trim() && (!results?.length || debouncedQuery)) {
      e.preventDefault();
      handleCustom();
    }
  }

  const hasValue = !!value;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        data-testid={testId}
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "w-full flex items-center justify-between gap-2 h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background",
          "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors",
          !hasValue && "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1 text-left">
          <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">
            {hasValue ? value : t("Search medicine...", "ابحث عن الدواء...")}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); } }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[280px] rounded-lg border bg-popover shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("Type to search...", "اكتب للبحث...")}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {inputValue && (
              <button type="button" onClick={() => setInputValue("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {isLoading && !results ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("Searching...", "جاري البحث...")}
              </div>
            ) : results?.length === 0 ? (
              <div className="py-6 text-center">
                <div className="text-sm text-muted-foreground mb-2">{t("No medicine found", "لم يتم العثور على دواء")}</div>
                {inputValue.trim() && (
                  <button
                    type="button"
                    onClick={handleCustom}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {t(`Use "${inputValue}" as custom name`, `استخدم "${inputValue}" كاسم مخصص`)}
                  </button>
                )}
              </div>
            ) : grouped ? (
              Object.entries(grouped).map(([category, meds]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 sticky top-0">
                    {category}
                  </div>
                  {meds.map(med => {
                    const displayName = language === "en" ? med.name_en : (med.name_ar || med.name_en);
                    const isSelected = value === med.name_en;
                    return (
                      <button
                        key={med.id}
                        type="button"
                        onClick={() => handleSelect(med)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-accent hover:text-accent-foreground transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              <HighlightMatch text={displayName} query={inputValue} />
                            </span>
                            {med.category && (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", categoryColor(med.category))}>
                                {med.dosage_form}
                              </span>
                            )}
                          </div>
                          {med.strength && (
                            <div className="text-xs text-muted-foreground mt-0.5">{med.strength}</div>
                          )}
                          {language === "en" && med.name_ar && (
                            <div className="text-xs text-muted-foreground mt-0.5" dir="rtl">{med.name_ar}</div>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : null}

            {/* Custom name option when typing */}
            {inputValue.trim() && results && results.length > 0 && (
              <div className="border-t">
                <button
                  type="button"
                  onClick={handleCustom}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  {t(`Add "${inputValue}" as custom`, `إضافة "${inputValue}" كاسم مخصص`)}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form schema ───────────────────────────────────────────────────────────────
const formSchema = z.object({
  requester_name: z.string().min(2),
  requester_phone: z.string().min(5),
  is_for_relative: z.boolean().default(false),
  patient_name: z.string().optional(),
  patient_relation: z.string().optional(),
  employee_department: z.string().optional(),
  urgency: z.enum(["normal", "critical"]).default("normal"),
  wet_signature_required: z.boolean().default(false),
  prescription_url: z.string().optional(),
  medicines: z.array(z.object({
    medicine_id: z.number().optional().nullable(),
    name_en: z.string().min(1),
    name_ar: z.string().optional().nullable(),
    quantity: z.number().min(1),
    notes: z.string().optional().nullable(),
  })).min(1),
}).refine(data => {
  if (data.is_for_relative) return !!data.patient_name && !!data.patient_relation;
  return true;
}, {
  message: "Patient name and relation are required when requesting for a relative",
  path: ["patient_name"],
});

type FormValues = z.infer<typeof formSchema>;

// ── Main form ─────────────────────────────────────────────────────────────────
export default function RequestForm() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const createRequest = useCreateRequest();
  const extractMedicines = useExtractMedicines();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requester_name: "",
      requester_phone: "",
      is_for_relative: false,
      patient_name: "",
      patient_relation: "",
      employee_department: "",
      urgency: "normal",
      wet_signature_required: false,
      prescription_url: "",
      medicines: [{ name_en: "", quantity: 1, notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "medicines" });
  const isForRelative = form.watch("is_for_relative");
  const urgency = form.watch("urgency");

  const onSubmit = (values: FormValues) => {
    createRequest.mutate({ data: values as any }, {
      onSuccess: () => {
        toast({
          title: t("Request Submitted", "تم تقديم الطلب"),
          description: t("Your medicine request has been received.", "تم استلام طلب الأدوية الخاص بك."),
        });
        setLocation("/");
      },
      onError: () => {
        toast({
          title: t("Error", "خطأ"),
          description: t("Failed to submit request.", "فشل في تقديم الطلب."),
          variant: "destructive",
        });
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreviewImage(base64);
      form.setValue("prescription_url", base64);
    };
    reader.readAsDataURL(file);
  };

  const handleOcrExtract = () => {
    if (!previewImage) return;
    const base64Data = previewImage.split(",")[1];
    if (!base64Data) return;
    extractMedicines.mutate({ data: { image_base64: base64Data } }, {
      onSuccess: (data) => {
        if (data.medicines?.length) {
          data.medicines.forEach(med => append({ name_en: med, quantity: 1, notes: t("Extracted from prescription", "مستخرج من الوصفة") }));
          toast({
            title: t("Extraction Complete", "اكتمل الاستخراج"),
            description: t(`Found ${data.medicines.length} medicine(s).`, `تم العثور على ${data.medicines.length} دواء.`),
          });
        }
      },
      onError: () => toast({ title: t("Extraction Failed", "فشل الاستخراج"), variant: "destructive" }),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {t("Request Chronic Medicines", "طلب أدوية الأمراض المزمنة")}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm md:text-base">
          {t("Fill out the form below to request your recurring prescriptions.", "املأ النموذج أدناه لطلب وصفاتك الطبية المتكررة.")}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Requester info ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("Requester Information", "معلومات مقدم الطلب")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="requester_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Full Name", "الاسم الكامل")}</FormLabel>
                    <FormControl><Input {...field} placeholder={t("Ahmed Al-Rashidi", "أحمد الراشدي")} data-testid="input-requester-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="requester_phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("Phone Number", "رقم الهاتف")}</FormLabel>
                    <FormControl><Input {...field} placeholder="+966 5X XXX XXXX" data-testid="input-requester-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="employee_department" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Department (optional)", "القسم (اختياري)")}</FormLabel>
                  <FormControl><Input {...field} placeholder={t("e.g. Finance, HR, Operations", "مثال: المالية، الموارد البشرية")} /></FormControl>
                </FormItem>
              )} />

              {/* Urgency */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => form.setValue("urgency", "normal")}
                  className={cn(
                    "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all",
                    urgency === "normal"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", urgency === "normal" ? "bg-primary/15" : "bg-muted")}>
                    <Check className={cn("w-4 h-4", urgency === "normal" ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t("Standard", "عادي")}</div>
                    <div className="text-xs text-muted-foreground">{t("Regular 30–60 day prescription refill", "تجديد وصفة 30–60 يوم")}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("urgency", "critical")}
                  className={cn(
                    "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all",
                    urgency === "critical"
                      ? "border-red-500 bg-red-50"
                      : "border-border hover:border-red-200"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", urgency === "critical" ? "bg-red-100" : "bg-muted")}>
                    <AlertTriangle className={cn("w-4 h-4", urgency === "critical" ? "text-red-600" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className={cn("text-sm font-semibold", urgency === "critical" && "text-red-700")}>{t("Critical Care Urgent", "رعاية حرجة عاجلة")}</div>
                    <div className="text-xs text-muted-foreground">{t("Escalated review — mark only if medically urgent", "مراجعة مُصعَّدة — للحالات العاجلة طبياً فقط")}</div>
                  </div>
                </button>
              </div>

              {/* Wet signature */}
              <FormField control={form.control} name="wet_signature_required" render={({ field }) => (
                <FormItem>
                  <div className={cn(
                    "flex items-start gap-3 p-3.5 rounded-lg border transition-colors",
                    field.value ? "border-orange-300 bg-orange-50" : "border-border"
                  )}>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                    </FormControl>
                    <div>
                      <div className="flex items-center gap-2">
                        <PenLine className={cn("w-3.5 h-3.5", field.value ? "text-orange-600" : "text-muted-foreground")} />
                        <span className={cn("text-sm font-medium", field.value && "text-orange-800")}>
                          {t("Wet Signature Required", "يلزم توقيع فعلي")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("Check if this prescription requires physical signature validation.", "ضع علامة إذا كانت الوصفة تستلزم توقيعاً فعلياً.")}
                      </p>
                    </div>
                  </div>
                </FormItem>
              )} />

              {/* For relative */}
              <FormField control={form.control} name="is_for_relative" render={({ field }) => (
                <FormItem>
                  <div className={cn(
                    "flex items-start gap-3 p-3.5 rounded-lg border transition-colors",
                    field.value ? "border-blue-300 bg-blue-50" : "border-border"
                  )}>
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" data-testid="checkbox-for-relative" />
                    </FormControl>
                    <div className="leading-none">
                      <span className="text-sm font-medium">{t("This request is for a relative", "هذا الطلب لأحد الأقارب")}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("Spouse, Child, Parent, or other covered family member", "الزوج/الزوجة، الأبناء، الوالدان، أو أفراد الأسرة المؤمَّن عليهم")}
                      </p>
                    </div>
                  </div>
                </FormItem>
              )} />

              {isForRelative && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50/60 rounded-lg border border-blue-200">
                  <FormField control={form.control} name="patient_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Patient Name", "اسم المريض")}</FormLabel>
                      <FormControl><Input {...field} data-testid="input-patient-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="patient_relation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Relation", "صلة القرابة")}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t("e.g. Spouse, Child, Mother", "مثال: الزوجة، الابن، الأم")} data-testid="input-patient-relation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Prescription upload ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("Prescription", "الوصفة الطبية")}</CardTitle>
              <CardDescription className="text-xs">
                {t("Upload a photo to auto-fill medicines via OCR (optional).", "قم بتحميل صورة للملء التلقائي عبر التعرف الضوئي (اختياري).")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-full sm:w-1/2">
                  <label className={cn(
                    "flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[140px]",
                    previewImage ? "border-primary/40 bg-primary/5" : "border-muted-foreground/25 bg-muted/20 hover:bg-muted/40"
                  )}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="sr-only"
                      data-testid="input-prescription-file"
                    />
                    <Upload className={cn("w-7 h-7", previewImage ? "text-primary" : "text-muted-foreground")} />
                    <div className="text-center">
                      <p className="text-sm font-medium">{previewImage ? t("Replace image", "تغيير الصورة") : t("Click or drag image here", "انقر أو اسحب الصورة هنا")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t("JPG, PNG — up to 10MB", "JPG، PNG — حتى 10 ميغابايت")}</p>
                    </div>
                  </label>
                </div>

                {previewImage && (
                  <div className="w-full sm:w-1/2 space-y-3">
                    <div className="rounded-xl overflow-hidden border aspect-video bg-muted">
                      <img src={previewImage} alt="Prescription preview" className="object-cover w-full h-full" />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={handleOcrExtract}
                      disabled={extractMedicines.isPending}
                      data-testid="button-extract-ocr"
                    >
                      {extractMedicines.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-primary" />
                      )}
                      {t("Extract Medicines (OCR)", "استخراج الأدوية (التعرف الضوئي)")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Medicines ── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("Medicines", "الأدوية")}</CardTitle>
                <Badge variant="secondary" className="text-xs">{fields.length} {t("item(s)", "دواء")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((field, index) => {
                const medName = form.watch(`medicines.${index}.name_en`);
                return (
                  <div
                    key={field.id}
                    className="group relative rounded-xl border bg-card p-4 space-y-3 transition-shadow hover:shadow-sm"
                  >
                    {/* Row number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {t(`Medicine ${index + 1}`, `الدواء ${index + 1}`)}
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-md hover:bg-destructive/10"
                          data-testid={`button-remove-med-${index}`}
                          aria-label={t("Remove", "حذف")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Search */}
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        {t("Medicine Name", "اسم الدواء")}
                        <span className="text-destructive ml-1">*</span>
                      </label>
                      <MedicineSearch
                        value={medName}
                        language={language}
                        t={t}
                        testId={`button-med-search-${index}`}
                        onChange={(med) => {
                          form.setValue(`medicines.${index}.name_en`, med.name_en, { shouldValidate: true });
                          if ("medicine_id" in med) {
                            form.setValue(`medicines.${index}.medicine_id`, med.medicine_id);
                            form.setValue(`medicines.${index}.name_ar`, (med as any).name_ar ?? null);
                          }
                        }}
                        onClear={() => {
                          form.setValue(`medicines.${index}.name_en`, "", { shouldValidate: true });
                          form.setValue(`medicines.${index}.medicine_id`, null);
                          form.setValue(`medicines.${index}.name_ar`, null);
                        }}
                      />
                      <FormField
                        control={form.control}
                        name={`medicines.${index}.name_en`}
                        render={({ field: f }) => (
                          <FormItem>
                            <input type="hidden" {...f} />
                            <FormMessage className="mt-1" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Qty + Notes */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="col-span-1">
                        <FormField control={form.control} name={`medicines.${index}.quantity`} render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-sm">{t("Qty", "الكمية")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...f}
                                onChange={e => f.onChange(parseInt(e.target.value, 10) || 1)}
                                className="text-center"
                                data-testid={`input-med-qty-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-1 sm:col-span-4">
                        <FormField control={form.control} name={`medicines.${index}.notes`} render={({ field: f }) => (
                          <FormItem>
                            <FormLabel className="text-sm">{t("Notes / Dosage", "ملاحظات / الجرعة")}</FormLabel>
                            <FormControl>
                              <Input
                                {...f}
                                value={f.value || ""}
                                placeholder={t("e.g. 30-day supply, morning dose only", "مثال: إمداد 30 يوم، جرعة صباحية فقط")}
                                data-testid={`input-med-notes-${index}`}
                              />
                            </FormControl>
                          </FormItem>
                        )} />
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => append({ name_en: "", quantity: 1, notes: "" })}
                data-testid="button-add-med"
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-muted-foreground/25 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <Plus className="w-4 h-4" />
                {t("Add Another Medicine", "إضافة دواء آخر")}
              </button>
            </CardContent>
          </Card>

          {/* ── Actions ── */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-cancel"
              className="sm:w-auto"
            >
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              type="submit"
              disabled={createRequest.isPending}
              data-testid="button-submit-request"
              className="sm:w-auto gap-2"
            >
              {createRequest.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("Submit Request", "إرسال الطلب")}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
