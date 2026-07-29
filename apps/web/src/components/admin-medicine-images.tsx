import { FormEvent, useEffect, useState } from "react";
import { Check, CheckCircle2, ExternalLink, Image, Search, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminCareNetworkEnrollments } from "@/components/admin-care-network-enrollments";
import { AdminGovernanceConsole } from "@/components/admin-governance-console";
import { AdminOrganizationMemberships } from "@/components/admin-organization-memberships";

type Medicine = { canonical_id: number; name_en: string; name_ar: string; scientific_name: string; manufacturer: string; image_url: string; completeness_percent: number; image_authenticity_score: number };
type Candidate = { id: string; image_url: string; thumbnail_url: string; source_page_url: string; source_domain: string; source_kind: string; discovery_provider: string; result_title: string; match_score: number; authenticity_score: number; status: string };

const KINDS = ["official_manufacturer", "regulatory_leaflet", "pharmacy_partner", "search_engine"];

export function AdminMedicineImages() {
  const [query, setQuery] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selected, setSelected] = useState<Medicine | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [manual, setManual] = useState({ image_url: "", source_page_url: "", source_kind: "official_manufacturer" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <AdminCareNetworkEnrollments />
      <Card className="mb-6 border-emerald-200">
        <CardHeader>
          <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <Image className="mr-1 h-3 w-3" />
            Medicine image trust
          </Badge>
          <CardTitle>Authentic product-photo approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine..." />
            <Button disabled={busy}><Search className="mr-2 h-4 w-4" />Search</Button>
          </div>
        </CardContent>
      </Card>
      <AdminGovernanceConsole />
      <AdminOrganizationMemberships />
    </>
  );
}
