import { useState, FormEvent } from "react";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select"; // existing Select component
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/lib/i18n";
import { LoadingSpinner } from "@/components/ui/loading-spinner"; // hypothetical spinner

/**
 * Form for verified company representatives to directly add a new medicine to the catalog.
 * Mirrors the fields used in the public contribution hub but is tailored for company reps.
 */
export function CompanyMedicineAdditionForm({ companySlug }: { companySlug?: string }) {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form fields
  const [medicineName, setMedicineName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [drugClass, setDrugClass] = useState("");
  const [route, setRoute] = useState("");
  const [category, setCategory] = useState("");
  const [strength, setStrength] = useState("");
  const [dosageForm, setDosageForm] = useState("");
  const [description, setDescription] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/medicine_catalog_submissions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          submitted_by: session.user.id,
          organization_id: session.user.id, // placeholder – replace with actual org id if needed
          company_profile_id: null,
          submitter_kind: "company_representative",
          submission_kind: "add_medicine",
          medicine_name: medicineName.trim(),
          manufacturer,
          drug_class: drugClass,
          route,
          category,
          strength,
          dosage_form: dosageForm,
          description: description.trim()
        })
      });
      setMessage(t("Your medicine addition request has been submitted for review.", "تم إرسال طلب إضافة الدواء للمراجعة."));
      // clear form
      setMedicineName("");
      setManufacturer("");
      setDrugClass("");
      setRoute("");
      setCategory("");
      setStrength("");
      setDosageForm("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not submit request.", "تعذر إرسال الطلب."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="add-medicine" className="mt-8 rounded-2xl border bg-white/10 backdrop-blur shadow-lg p-6">
      <h2 className="mb-4 text-xl font-semibold text-white">{t("Add New Medicine", "إضافة دواء جديد")}</h2>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="default" className="mb-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} className="grid gap-4">
        <Input
          placeholder={t("Medicine name", "اسم الدواء")}
          value={medicineName}
          onChange={e => setMedicineName(e.target.value)}
          required
        />
        <Select
          label={t("Manufacturer", "المصنع")}
          value={manufacturer}
          onChange={setManufacturer}
          options={[]}
        />
        <Select
          label={t("Drug class", "فئة الدواء")}
          value={drugClass}
          onChange={setDrugClass}
          options={[]}
        />
        <Select
          label={t("Route", "طريقة الإعطاء")}
          value={route}
          onChange={setRoute}
          options={[]}
        />
        <Select
          label={t("Category", "الفئة")}
          value={category}
          onChange={setCategory}
          options={[]}
        />
        <Input
          placeholder={t("Strength", "القوة")}
          value={strength}
          onChange={e => setStrength(e.target.value)}
        />
        <Input
          placeholder={t("Dosage form", "شكل الجرعة")}
          value={dosageForm}
          onChange={e => setDosageForm(e.target.value)}
        />
        <Textarea
          placeholder={t("Description", "الوصف")}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <LoadingSpinner className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? t("Submitting…", "جارٍ الإرسال…") : t("Submit", "إرسال")}
        </Button>
      </form>
    </section>
  );
}
