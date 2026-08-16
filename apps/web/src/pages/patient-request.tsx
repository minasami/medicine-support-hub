import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2 } from "lucide-react";

type Medicine = {
  id: number;
  legacy_medicine_id: number | null;
  name_en: string | null;
  name_ar: string | null;
  dosage_form: string | null;
  strength: string | null;
  category: string | null;
  display_category: string | null;
  barcode: string | null;
  price: number | null;
  price_currency: string | null;
  code: string | null;
  enrichment_source_count: number;
};

type MedicineLine = {
  medicine_id: number | null;
  catalog_product_id?: number | null;
  name_en: string;
  name_ar?: string | null;
  quantity: number;
  notes: string;
};

export default function PatientRequestPage() {
  const { t } = useLanguage();
  const { isAuthenticated, profile, session, supabaseFetch } = usePatientAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [requesterName, setRequesterName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [urgency, setUrgency] = useState<"normal" | "critical">("normal");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Medicine[]>([]);
  const [medicines, setMedicines] = useState<MedicineLine[]>([
    {
      medicine_id: null,
      catalog_product_id: null,
      name_en: "",
      quantity: 1,
      notes: "",
    },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setRequesterName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    setBirthdate(profile.birthdate ?? "");
  }, [profile]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const search = query.trim();
      if (!search) {
        setResults([]);
        return;
      }
      try {
        const rows = await supabaseFetch<Medicine[]>(
          "/rest/v1/rpc/search_medicines_catalog",
          {
            method: "POST",
            body: JSON.stringify({ p_query: search, p_limit: 12 }),
          },
        );
        setResults(rows);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, supabaseFetch]);

  function addMedicine(med: Medicine) {
    setMedicines((current) => {
      const next = current.filter((item) => item.name_en.trim());
      return [
        ...next,
        {
          medicine_id: med.legacy_medicine_id,
          catalog_product_id: med.id,
          name_en: med.name_en || med.name_ar || `Product #${med.id}`,
          name_ar: med.name_ar,
          quantity: 1,
          notes: med.code ? `Catalog code: ${med.code}` : "",
        },
      ];
    });
    setQuery("");
    setResults([]);
  }

  function updateLine(index: number, patch: Partial<MedicineLine>) {
    setMedicines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(index: number) {
    setMedicines((current) => current.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validMeds = medicines.filter((item) => item.name_en.trim());
    if (!requesterName.trim() || !phone.trim() || !validMeds.length) {
      toast({
        title: t("Missing information", "بيانات ناقصة"),
        description: t(
          "Please add your name, phone, and at least one medicine.",
          "يرجى إدخال الاسم ورقم الهاتف ودواء واحد على الأقل.",
        ),
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        patient_user_id: session?.user?.id ?? null,
        requester_name: requesterName,
        requester_phone: phone,
        requester_address: address,
        requester_birthdate: birthdate || null,
        urgency,
        status: "pending",
        is_for_relative: false,
        wet_signature_required: false,
        medicines: validMeds.map((item) => ({
          ...item,
          quantity: Number(item.quantity) || 1,
        })),
      };
      const created = await supabaseFetch<
        { id: number; tracking_code?: string; status?: string; created_at?: string }[]
      >("/rest/v1/medicine_requests?select=id,tracking_code,status,created_at", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      toast({
        title: t("Request submitted", "تم إرسال الطلب"),
        description: t(
          `Request #${created[0]?.id ?? ""} has been created.`,
          `تم إنشاء الطلب رقم ${created[0]?.id ?? ""}.`,
        ),
      });
      setLocation("/track");
    } catch (error) {
      toast({
        title: t("Failed to submit request", "فشل إرسال الطلب"),
        description:
          error instanceof Error
            ? error.message
            : t("Please try again.", "يرجى المحاولة مرة أخرى."),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t("Request Medicines", "طلب أدوية")}
          </h1>
          <p className="text-muted-foreground">
            {t(
              "Search the indexed medicines2 catalog, then submit the exact product and quantity needed.",
              "ابحث في كتالوج الأدوية المفهرس، ثم أرسل المنتج والكمية المطلوبة بدقة.",
            )}
          </p>
        </div>
        {!isAuthenticated ? (
          <Button asChild variant="secondary">
            <Link href="/account">
              {t("Sign in / create account", "تسجيل الدخول / إنشاء حساب")}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/account">{t("My profile", "ملفي")}</Link>
          </Button>
        )}
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("Patient information", "بيانات المريض")}</CardTitle>
            <CardDescription>
              {t(
                "These fields are auto-filled from your account profile when available.",
                "تُملأ هذه الحقول تلقائيًا من ملف حسابك عند التوفر.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("Full name", "الاسم بالكامل")}</Label>
                <Input
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Phone", "الهاتف")}</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Birthdate", "تاريخ الميلاد")}</Label>
                <Input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Urgency", "درجة الاستعجال")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={urgency}
                  onChange={(e) =>
                    setUrgency(e.target.value as "normal" | "critical")
                  }
                >
                  <option value="normal">{t("Normal", "عادي")}</option>
                  <option value="critical">{t("Critical", "حرج")}</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("Address", "العنوان")}</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Medicines", "الأدوية")}</CardTitle>
            <CardDescription>
              {t(
                "Search the catalog to attach a product ID when a verified compatibility match exists.",
                "ابحث في الكتالوج لربط معرّف المنتج عند وجود مطابقة موثّقة.",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(
                  "Search full product catalog",
                  "ابحث في كامل كتالوج المنتجات",
                )}
              />
              {!!results.length && (
                <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-background shadow-lg">
                  {results.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      className="w-full px-3 py-3 text-left hover:bg-muted"
                      onClick={() => addMedicine(med)}
                    >
                      <div className="font-medium">
                        {med.name_en || med.name_ar}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {med.name_ar}{" "}
                        {med.strength ? `• ${med.strength}` : ""}{" "}
                        {med.price
                          ? `• ${Number(med.price).toLocaleString()} ${
                              med.price_currency || "EGP"
                            }`
                          : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {med.barcode || t("No barcode", "بدون باركود")}{" "}
                        {med.code ? `• ${med.code}` : ""}{" "}
                        {med.display_category ? `• ${med.display_category}` : ""}{" "}
                        {med.enrichment_source_count > 0
                          ? `• ${t("source-backed", "مدعوم بمصدر")}`
                          : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {medicines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_90px_1fr_auto]"
                >
                  <div>
                    <Input
                      value={line.name_en}
                      placeholder={t("Medicine name", "اسم الدواء")}
                      onChange={(e) =>
                        updateLine(index, {
                          name_en: e.target.value,
                          medicine_id: null,
                          catalog_product_id: null,
                        })
                      }
                    />
                    {line.catalog_product_id && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("Catalog product", "منتج الكتالوج")} #
                        {line.catalog_product_id}
                        {line.medicine_id
                          ? ` · ${t("verified legacy link", "رابط تراثي موثّق")} #${line.medicine_id}`
                          : ` · ${t("no legacy link", "بدون رابط تراثي")}`}
                      </div>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, { quantity: Number(e.target.value) })
                    }
                  />
                  <Input
                    value={line.notes}
                    placeholder={t("Notes / dose", "ملاحظات / الجرعة")}
                    onChange={(e) =>
                      updateLine(index, { notes: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setMedicines((current) => [
                  ...current,
                  {
                    medicine_id: null,
                    catalog_product_id: null,
                    name_en: "",
                    quantity: 1,
                    notes: "",
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("Add custom medicine", "إضافة دواء مخصص")}
            </Button>
          </CardContent>
        </Card>

        <Button disabled={busy} size="lg" className="w-full md:w-auto">
          {busy
            ? t("Submitting...", "جاري الإرسال...")
            : t("Submit Request", "إرسال الطلب")}
        </Button>
      </form>
    </div>
  );
}
