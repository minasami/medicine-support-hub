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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const formSchema = z.object({
  requester_name: z.string().min(1),
  requester_phone: z.string().min(1),
  is_for_relative: z.boolean(),
  patient_name: z.string().optional(),
  patient_relation: z.string().optional(),
  employee_department: z.string().optional(),
  urgency: z.enum(["normal", "critical"]),
  wet_signature_required: z.boolean(),
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

export default function RequestForm() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ocrReviewList, setOcrReviewList] = useState<Array<{ name: string; checked: boolean; quantity: number }> | null>(null);

  const createRequest = useCreateRequest();
  const extractMedicines = useExtractMedicines();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
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

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("Medicine request", "طلب أدوية")}</CardTitle>
          <CardDescription>
            {t("Submit a medicine support request.", "قدّم طلب دعم أدوية.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="requester_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Your name", "الاسم")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="requester_phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Phone", "الهاتف")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="is_for_relative" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel>{t("Request for a relative", "الطلب لقريب")}</FormLabel>
                </FormItem>
              )} />
              {isForRelative && (
                <>
                  <FormField control={form.control} name="patient_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Patient name", "اسم المريض")}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="patient_relation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("Relation", "صلة القرابة")}</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </>
              )}
              <FormField control={form.control} name="urgency" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("Urgency", "الأولوية")}</FormLabel>
                  <FormControl>
                    <select className="w-full rounded-md border px-3 py-2" {...field}>
                      <option value="normal">{t("Normal", "عادي")}</option>
                      <option value="critical">{t("Critical", "حرج")}</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>{t("Medicines", "الأدوية")}</FormLabel>
                  <Button type="button" size="sm" variant="outline" onClick={() => append({ name_en: "", quantity: 1, notes: "" })}>
                    <Plus className="h-4 w-4 mr-1" /> {t("Add", "إضافة")}
                  </Button>
                </div>
                {fields.map((f, index) => (
                  <div key={f.id} className="flex gap-2 items-start">
                    <FormField control={form.control} name={`medicines.${index}.name_en`} render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl><Input placeholder={t("Medicine name", "اسم الدواء")} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`medicines.${index}.quantity`} render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input type="number" min={1} {...field} onChange={(e) => field.onChange(Number(e.target.value) || 1)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="button" size="icon" variant="ghost" disabled={fields.length <= 1} onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={createRequest.isPending}>
                {createRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("Submit request", "إرسال الطلب")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
