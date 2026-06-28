import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";
import { AlertCircle, Building2, RefreshCw } from "lucide-react";

type Organization = { id: string; name: string; organization_type: string; city: string | null; country: string | null; contact_email: string | null; contact_phone: string | null; notes: string | null; is_active: boolean };

const ORG_TYPES = ["ngo", "commercial_pharmacy", "pharma_company", "psp", "donor", "supplier", "pharmacy_partner", "hospital", "corporate_csr", "government_program"];
const SELECT = "id,name,organization_type,city,country,contact_email,contact_phone,notes,is_active";

export default function PlatformAdmin() {
  const { isAuthenticated, profile, supabaseFetch } = usePatientAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [draft, setDraft] = useState({ name: "", organization_type: "ngo", country: "Egypt", city: "", contact_email: "", contact_phone: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = ["super_admin", "platform_admin", "admin"].includes(profile?.role ?? "");

  async function load() {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (!isAuthenticated) throw new Error("Please sign in first.");
      if (!isAdmin) throw new Error("Only platform admins can manage organizations.");
      const rows = await supabaseFetch<Organization[]>(`/rest/v1/organizations?select=${SELECT}&order=name.asc&limit=500`);
      setOrganizations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organizations.");
    } finally { setLoading(false); }
  }

  async function createOrganization(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const created = await supabaseFetch<Organization[]>(`/rest/v1/organizations?select=${SELECT}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...draft, name: draft.name.trim(), city: draft.city || null, contact_email: draft.contact_email || null, contact_phone: draft.contact_phone || null, notes: draft.notes || null, is_active: true }),
      });
      setOrganizations((current) => [created[0], ...current].filter(Boolean));
      setDraft({ name: "", organization_type: "ngo", country: "Egypt", city: "", contact_email: "", contact_phone: "", notes: "" });
      setMessage("Organization added.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to add organization."); }
    finally { setSaving(false); }
  }

  useEffect(() => { load(); }, [isAuthenticated, profile?.role]);

  return <div className="container mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform Administration</div><h1 className="text-3xl font-bold">Organizations</h1><p className="text-muted-foreground">Add NGOs, pharmacies, companies, PSPs, donors, suppliers, hospitals, and partners.</p></div>
      <div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin">Users</Link></Button><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
    </div>
    {loading && <p className="mb-4 text-muted-foreground">Loading...</p>}
    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-4"><AlertDescription>{message}</AlertDescription></Alert>}
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Add organization</CardTitle></CardHeader><CardContent><form onSubmit={createOrganization} className="space-y-3"><div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></div><div><Label>Type</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.organization_type} onChange={(e) => setDraft({ ...draft, organization_type: e.target.value })}>{ORG_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div><div className="grid grid-cols-2 gap-2"><div><Label>Country</Label><Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} /></div><div><Label>City</Label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div></div><div className="grid grid-cols-2 gap-2"><div><Label>Email</Label><Input value={draft.contact_email} onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })} /></div><div><Label>Phone</Label><Input value={draft.contact_phone} onChange={(e) => setDraft({ ...draft, contact_phone: e.target.value })} /></div></div><div><Label>Notes</Label><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div><Button type="submit" disabled={saving}>{saving ? "Adding..." : "Add"}</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Organization list</CardTitle></CardHeader><CardContent className="space-y-3">{organizations.map((org) => <div key={org.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">{org.name}</div><div className="text-xs text-muted-foreground">{org.organization_type} • {org.city || "No city"}, {org.country || "No country"}</div><div className="text-xs text-muted-foreground">{org.contact_email || org.contact_phone || "No contact"}</div></div><Badge variant={org.is_active ? "default" : "outline"}>{org.is_active ? "active" : "inactive"}</Badge></div>{org.notes && <p className="mt-2 text-xs text-muted-foreground">{org.notes}</p>}</div>)}{!organizations.length && <p className="text-sm text-muted-foreground">No organizations yet.</p>}</CardContent></Card>
    </div>
  </div>;
}
