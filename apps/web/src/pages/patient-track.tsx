import { useEffect, useState } from "react";
import { Link } from "wouter";
import { usePatientAuth } from "@/lib/patient-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Package, CheckCircle, Truck } from "lucide-react";

type RequestRow = {
  id: number;
  tracking_code: string;
  status: string;
  urgency: string;
  medicines: Array<{ name_en?: string; quantity?: number; notes?: string }>;
  created_at: string;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  dispensing: "Dispensing",
  dispensed: "Dispensed",
  packaging: "Packaging",
  packaged: "Packaged",
  in_transit: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

function iconFor(status: string) {
  if (["delivered", "completed"].includes(status)) return CheckCircle;
  if (["in_transit"].includes(status)) return Truck;
  if (["dispensing", "dispensed", "packaging", "packaged"].includes(status)) return Package;
  return Clock;
}

export default function PatientTrackPage() {
  const { isAuthenticated, supabaseFetch } = usePatientAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    supabaseFetch<RequestRow[]>("/rest/v1/medicine_requests?select=id,tracking_code,status,urgency,medicines,created_at,updated_at&order=created_at.desc")
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load requests"))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Track your medicine requests</CardTitle>
            <CardDescription>Sign in to see your current and previous requests.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button asChild><Link href="/account">Sign in</Link></Button>
            <Button asChild variant="outline"><Link href="/request">New request</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Requests</h1>
          <p className="text-muted-foreground">Track your current requests and review previous orders.</p>
        </div>
        <Button asChild><Link href="/request">New request</Link></Button>
      </div>

      {loading && <p className="text-muted-foreground">Loading your requests...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !rows.length && !error && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No requests yet.</CardContent></Card>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const Icon = iconFor(row.status);
          return (
            <Card key={row.id}>
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-blue-600" />
                      <div className="font-bold">Request #{row.id}</div>
                      <Badge variant="secondary">{statusLabels[row.status] ?? row.status}</Badge>
                      {row.urgency === "critical" && <Badge variant="destructive">Critical</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Submitted {new Date(row.created_at).toLocaleString()} • Last updated {new Date(row.updated_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Tracking code: {row.tracking_code}</div>
                  </div>
                </div>

                <div className="mt-4 border-t pt-3 space-y-2">
                  {row.medicines?.map((medicine, index) => (
                    <div key={index} className="flex justify-between gap-3 text-sm">
                      <span>{medicine.name_en ?? "Medicine"}</span>
                      <span className="text-muted-foreground">Qty: {medicine.quantity ?? 1}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
