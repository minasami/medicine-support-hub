import { useEffect, useState } from "react";
import { Check, ShieldCheck, UserPlus, Users, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePatientAuth } from "@/lib/patient-auth";

export function AdminOrganizationMemberships() {
  const { session, supabaseFetch } = usePatientAuth();
  const [allUserOptions, setAllUserOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [allEntityOptions, setAllEntityOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const directoryCompanies = await supabaseFetch<any[]>("/rest/v1/rpc/company_profile_directory_page", {
          method: "POST",
          body: JSON.stringify({ p_limit: 6000 }),
        }).catch(() => []);

        const entityMap = new Map<string, { label: string; value: string }>();
        if (Array.isArray(directoryCompanies)) {
          (directoryCompanies as any[]).forEach((c) => {
            const val = c.company_slug || c.id;
            if (val && !entityMap.has(val)) {
              const displayName = c.company_name || c.official_display_name || val;
              entityMap.set(val, {
                label: `🏢 ${displayName} (${c.product_count || 1} products · ${c.origin || "Egypt"})`,
                value: val,
              });
            }
          });
        }
        setAllEntityOptions(Array.from(entityMap.values()));
      } catch (err: any) {
        setError(err?.message || "Failed to load options.");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [session?.access_token]);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          Organization &amp; Representative Governance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <p className="text-sm text-muted-foreground">Manage organization memberships and company representative access.</p>
      </CardContent>
    </Card>
  );
}
