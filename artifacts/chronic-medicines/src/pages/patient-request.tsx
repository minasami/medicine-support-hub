import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2 } from "lucide-react";

type Medicine = {
  id: number;
  name_en: string;
  name_ar: string | null;
  dosage_form: string;
  strength: string | null;
  category: string | null;
};

type MedicineLine = {
  medicine_id: number | null;
  name_en: string;
  name_ar?: string | null;
  quantity: number;
  notes: string;
};

export default function PatientRequestPage() {
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
  const [medicines, setMedicines] = useState<MedicineLine[]>([{ medicine_id: null, name_en: "", quantity: 1, notes: "" }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setRequesterName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
    setBirthdate(profile.birthdate ?? "");
  }, [profile]);

  useEffect(() => {
    const id = setTimeout(async () => {
      const search = query.trim();
      if (!search) {
        setResults([]);
        return;
      }
      try {
        const safe = search.replace(/[(),]/g, " ");
        const rows = await supabaseFetch<Medicine[]>(
          `/rest/v1/medicines?select=id,name_en,name_ar,dosage_form,strength,category&is_active=eq.true&limit=10&or=(name_en.ilike.*${encodeURIComponent(safe)}*,name_ar.ilike.*${encodeURIComponent(safe)}*)`,
        );
        setResults(rows);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  function addMedicine(med: Medicine) {
    setMedicines((current) => {
      const next = current.filter((m) => m.name_en.trim());
      return [...next, { medicine_id: med.id, name_en: med.name_en, name_ar: med.name_ar, quantity: 1, notes: "" }];
    });
    setQuery("");
    setResults([]);
  }

  function updateLine(index: number, patch: Partial<MedicineLine>) {
    setMedicines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setMedicines((current) => current.filter((_, i) => i !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validMeds = medicines.filter((m) => m.name_en.trim());
    if (!requesterName.trim() || !phone.trim() || !validMeds.length) {
      toast({ title: "Missing information", description: "Please add your name, phone, and at least one medicine.", variant: "destructive" });
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
        medicines: validMeds.map((m) => ({ ...m, quantity: Number(m.quantity) || 1 })),
      };

      const created = await supabaseFetch<any[]>("/rest/v1/medicine_requests?select=id,tracking_code,status,created_at", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });

      toast({ title: "Request submitted", description: `Request #${created[0]?.id ?? ""} has been created.` });
      setLocation("/track");
    } catch (error) {
      toast({ title: "Failed to submit request", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Request Medicines</h1>
          <p className="text-muted-foreground">Commercial pharmacy patients can request medicines from their saved profile.</p>
        </div>
        {!isAuthenticated ? (
          <Button asChild variant="secondary"><Link href="/account">Sign in / create account</Link></Button>
        ) : (
          <Button asChild variant="outline"><Link href="/account">My profile</Link></Button>
        )}
      </div>

      {!isAuthenticated && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            You can submit without an account, but signing in will save your profile and show this request under Track Order.
          </CardContent>
        </Card>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient information</CardTitle>
            <CardDescription>These fields are auto-filled from your account profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full name</Label><Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Birthdate</Label><Input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} /></div>
              <div className="space-y-2"><Label>Urgency</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={urgency} onChange={(e) => setUrgency(e.target.value as "normal" | "critical")}><option value="normal">Normal</option><option value="critical">Critical</option></select></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medicines</CardTitle>
            <CardDescription>Search the medicine database, then add quantity and notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine by English or Arabic name" />
              {!!results.length && (
                <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg max-h-72 overflow-auto">
                  {results.map((med) => (
                    <button key={med.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted" onClick={() => addMedicine(med)}>
                      <div className="font-medium">{med.name_en}</div>
                      <div className="text-xs text-muted-foreground">{med.name_ar} {med.strength ? `• ${med.strength}` : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {medicines.map((line, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_90px_1fr_auto] gap-2 rounded-lg border p-3">
                  <Input value={line.name_en} placeholder="Medicine name" onChange={(e) => updateLine(index, { name_en: e.target.value, medicine_id: null })} />
                  <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} />
                  <Input value={line.notes} placeholder="Notes / dose" onChange={(e) => updateLine(index, { notes: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="secondary" onClick={() => setMedicines((m) => [...m, { medicine_id: null, name_en: "", quantity: 1, notes: "" }])}>
              <Plus className="h-4 w-4 mr-2" /> Add custom medicine
            </Button>
          </CardContent>
        </Card>

        <Button disabled={busy} size="lg" className="w-full md:w-auto">{busy ? "Submitting..." : "Submit Request"}</Button>
      </form>
    </div>
  );
}
