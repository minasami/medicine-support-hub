import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Save, UserCog, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Session = { access_token: string };
type Profile = { id: string; full_name: string | null; role: string; is_active: boolean };
type Organization = { id: string; name: string; organization_type: string; is_active: boolean };
type Role = { role_key: string; label: string; scope_type: string; is_active: boolean };
type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  organizations?: { name: string } | null;
  profiles?: { full_name: string | null; role: string } | null;
};

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.message || data?.error || "Membership request failed.");
  return data as T;
}

export function AdminOrganizationMemberships({ session }: { session: Session }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [draft, setDraft] = useState({ user_id: "", organization_id: "", role: "employee" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profileRows, organizationRows, roleRows, membershipRows] = await Promise.all([
        api<Profile[]>("/rest/v1/profiles?select=id,full_name,role,is_active&order=full_name.asc.nullslast&limit=1000", session),
        api<Organization[]>("/rest/v1/organizations?select=id,name,organization_type,is_active&order=name.asc&limit=1000", session),
        api<Role[]>("/rest/v1/platform_role_definitions?select=role_key,label,scope_type,is_active&is_active=eq.true&order=role_level.asc,label.asc", session),
        api<Membership[]>("/rest/v1/organization_members?select=id,organization_id,user_id,role,is_active,organizations(name),profiles(full_name,role)&order=created_at.desc&limit=1000", session),
      ]);
      setProfiles(profileRows);
      setOrganizations(organizationRows);
      setRoles(roleRows);
      setMemberships(membershipRows);
      if (!draft.role && roleRows[0]) setDraft((current) => ({ ...current, role: roleRows[0].role_key }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load organization memberships.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session.access_token]);

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.user_id || !draft.organization_id || !draft.role) return;
    setBusy("assign");
    setError(null);
    setMessage(null);
    try {
      await api("/rest/v1/organization_members?on_conflict=organization_id,user_id", session, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ ...draft, is_active: true }),
      });
      setMessage("Organization role assigned.");
      setDraft((current) => ({ ...current, user_id: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign the role.");
    } finally {
      setBusy(null);
    }
  }

  async function updateMembership(id: string, patch: Partial<Membership>) {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      await api(`/rest/v1/organization_members?id=eq.${id}`, session, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      setMessage("Membership updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update membership.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-8 border-blue-200">
      <CardHeader className="border-b bg-blue-50/60 dark:bg-blue-950/10">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Organization membership and role assignments</CardTitle>
        <p className="text-sm text-muted-foreground">Assign each user to the correct organization role, update responsibilities, and deactivate access without deleting history.</p>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
        <form onSubmit={assign} className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-3 xl:grid-cols-[1.2fr_1.2fr_1fr_auto] xl:items-end">
          <Select label="User" value={draft.user_id} onChange={(user_id) => setDraft({ ...draft, user_id })} options={profiles.filter((row) => row.is_active).map((row) => [row.id, row.full_name || `${row.role} · ${row.id.slice(0, 8)}`])} />
          <Select label="Organization" value={draft.organization_id} onChange={(organization_id) => setDraft({ ...draft, organization_id })} options={organizations.filter((row) => row.is_active).map((row) => [row.id, `${row.name} · ${row.organization_type}`])} />
          <Select label="Organization role" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} options={roles.filter((row) => row.scope_type !== "public").map((row) => [row.role_key, `${row.label} · ${row.scope_type}`])} />
          <Button type="submit" disabled={busy === "assign" || !draft.user_id || !draft.organization_id}>{busy === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}Assign role</Button>
        </form>

        {loading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading memberships…</div> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-[850px] w-full text-sm">
              <thead className="bg-muted/60"><tr><th className="px-3 py-3 text-left">User</th><th className="px-3 py-3 text-left">Organization</th><th className="px-3 py-3 text-left">Assigned role</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead>
              <tbody>{memberships.map((membership) => <MembershipRow key={membership.id} membership={membership} roles={roles} busy={busy === membership.id} onSave={(patch) => updateMembership(membership.id, patch)} />)}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipRow({ membership, roles, busy, onSave }: { membership: Membership; roles: Role[]; busy: boolean; onSave: (patch: Partial<Membership>) => Promise<void> }) {
  const [role, setRole] = useState(membership.role);
  useEffect(() => setRole(membership.role), [membership.role]);
  return <tr className="border-t"><td className="px-3 py-3"><div className="font-semibold">{membership.profiles?.full_name || membership.user_id}</div><div className="text-xs text-muted-foreground">Platform role: {membership.profiles?.role || "unknown"}</div></td><td className="px-3 py-3"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{membership.organizations?.name || membership.organization_id}</div></td><td className="px-3 py-3"><select className="h-10 min-w-52 rounded-md border bg-background px-3" value={role} onChange={(event) => setRole(event.target.value)}>{roles.filter((row) => row.scope_type !== "public").map((row) => <option key={row.role_key} value={row.role_key}>{row.label}</option>)}</select></td><td className="px-3 py-3"><Badge variant={membership.is_active ? "default" : "outline"}>{membership.is_active ? "Active" : "Inactive"}</Badge></td><td className="px-3 py-3 text-right"><div className="flex justify-end gap-2"><Button size="sm" onClick={() => void onSave({ role })} disabled={busy || role === membership.role}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="sr-only">Save role</span></Button><Button size="sm" variant="outline" onClick={() => void onSave({ is_active: !membership.is_active })} disabled={busy}>{membership.is_active ? "Deactivate" : "Activate"}</Button></div></td></tr>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div><Label>{label}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}
