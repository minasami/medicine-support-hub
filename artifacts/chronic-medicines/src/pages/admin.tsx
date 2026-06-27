import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Database, Users, ShieldCheck, AlertCircle, RefreshCw, Save } from "lucide-react";

type StaffSession = { access_token: string; user?: { id: string; email?: string } };
type Profile = { id: string; full_name: string | null; phone: string | null; role: string; is_active: boolean; created_at?: string };
type MedicineRequest = { id: number; requester_name: string; requester_phone: string; status: string; urgency: string; medicines: Array<{ name_en?: string; quantity?: number }>; created_at: string; updated_at: string };

const STAFF_SESSION_KEY = "medicine_support_staff_session";
const ROLE_OPTIONS = ["admin", "reviewer", "physician", "pharmacist", "pharmacy_assistant", "coordinator", "data_entry", "branch_manager", "cosmetician", "employee"];

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

function getStoredSession(): StaffSession | null {
  try { return JSON.parse(localStorage.getItem(STAFF_SESSION_KEY) || "null"); } catch { return null; }
}

async function supabaseFetch<T>(path: string, session: StaffSession, init: RequestInit = {}): Promise<T> {
  const { url, key } = getConfig();
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${session.access_token}`, Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || "Request failed");
  return data as T;
}

export default function AdminPortal() {
  const [session, setSession] = useState<StaffSession | null>(() => getStoredSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [newUserNote, setNewUserNote] = useState({ email: "", full_name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin" || profile?.role === "platform_admin" || profile?.role === "super_admin";
  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    delivered: requests.filter((r) => ["delivered", "completed"].includes(r.status)).length,
  }), [requests]);

  async function load() {
    const current = getStoredSession();
    setSession(current);
    if (!current?.access_token) { setLoading(false); setError("Please sign in first."); return; }
    setLoading(true); setError(null); setMessage(null);
    try {
      const authUser = await supabaseFetch<{ id: string; email?: string }>("/auth/v1/user", current);
      const own = await supabaseFetch<Profile[]>(`/rest/v1/profiles?select=id,full_name,phone,role,is_active,created_at&id=eq.${authUser.id}&limit=1`, current);
      const ownProfile = own[0] ?? null;
      setProfile(ownProfile);
      if (!ownProfile || !["admin", "platform_admin", "super_admin"].includes(ownProfile.role)) {
        setError("Your account is signed in, but it is not authorized as platform admin."); return;
      }
      const [requestRows, userRows] = await Promise.all([
        supabaseFetch<MedicineRequest[]>("/rest/v1/medicine_requests?select=id,requester_name,requester_phone,status,urgency,medicines,created_at,updated_at&order=created_at.desc&limit=100", current),
        supabaseFetch<Profile[]>("/rest/v1/profiles?select=id,full_name,phone,role,is_active,created_at&order=created_at.desc&limit=200", current),
      ]);
      setRequests(requestRows); setUsers(userRows);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load admin dashboard."); }
    finally { setLoading(false); }
  }

  async function updateUser(user: Profile, patch: Partial<Profile>) {
    if (!session) return;
    setSavingUserId(user.id); setError(null); setMessage(null);
    try {
      const updated = await supabaseFetch<Profile[]>(`/rest/v1/profiles?id=eq.${user.id}&select=*`, session, {
        method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch),
      });
      setUsers((current) => current.map((u) => u.id === user.id ? { ...u, ...(updated[0] ?? patch) } : u));
      setMessage("User updated successfully.");
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update user."); }
    finally { setSavingUserId(null); }
  }

  function handleAddUserNote(e: React.FormEvent) {
    e.preventDefault();
    setMessage(`Ask ${newUserNote.email} to create an account from /account first. After they sign up, refresh this dashboard and assign their role here.`);
    setNewUserNote({ email: "", full_name: "", phone: "" });
  }

  useEffect(() => { load(); }, []);

  if (!session?.access_token) {
    return <div className="container mx-auto px-4 py-10 max-w-xl"><Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>Please sign in before opening the admin dashboard.</AlertDescription></Alert><Button asChild><Link href="/portal">Go to platform sign in</Link></Button></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div><div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><ShieldCheck className="h-4 w-4" /> Platform Administration</div><h1 className="text-3xl font-bold">Admin Dashboard</h1><p className="text-muted-foreground mt-1">Manage users, roles, and medicine requests.</p></div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      {loading && <p className="text-muted-foreground">Loading admin dashboard...</p>}
      {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert className="mb-6"><AlertDescription>{message}</AlertDescription></Alert>}

      {!loading && isAdmin && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="p-5"><div className="text-3xl font-bold">{stats.total}</div><div className="text-sm text-muted-foreground">Total requests</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-3xl font-bold text-amber-600">{stats.pending}</div><div className="text-sm text-muted-foreground">Pending</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-3xl font-bold text-blue-600">{stats.approved}</div><div className="text-sm text-muted-foreground">Approved</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-3xl font-bold text-green-600">{stats.delivered}</div><div className="text-sm text-muted-foreground">Delivered / completed</div></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> User & Role Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddUserNote} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="font-semibold">Add new platform user</div>
                <p className="text-xs text-muted-foreground">Create the account first through /account or Google sign-in, then assign the role below after refreshing.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2"><div><Label>Email</Label><Input value={newUserNote.email} onChange={(e) => setNewUserNote((u) => ({ ...u, email: e.target.value }))} required /></div><div><Label>Name</Label><Input value={newUserNote.full_name} onChange={(e) => setNewUserNote((u) => ({ ...u, full_name: e.target.value }))} /></div><div><Label>Phone</Label><Input value={newUserNote.phone} onChange={(e) => setNewUserNote((u) => ({ ...u, phone: e.target.value }))} /></div></div>
                <Button type="submit" variant="secondary">Prepare user</Button>
              </form>

              {users.map((user) => <div key={user.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3"><div><div className="font-semibold">{user.full_name || "Unnamed user"}</div><div className="text-xs text-muted-foreground">{user.phone || user.id}</div></div><Badge>{user.role}</Badge></div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end"><div><Label>Role</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={user.role} onChange={(e) => updateUser(user, { role: e.target.value })}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}</select></div><Button type="button" variant={user.is_active ? "outline" : "default"} onClick={() => updateUser(user, { is_active: !user.is_active })}>{user.is_active ? "Deactivate" : "Activate"}</Button><Button type="button" variant="ghost" disabled={savingUserId === user.id}><Save className="h-4 w-4 mr-2" />{savingUserId === user.id ? "Saving" : "Saved"}</Button></div>
              </div>)}
              {!users.length && <p className="text-sm text-muted-foreground">No users found.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Recent Requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">{requests.slice(0, 10).map((request) => <div key={request.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><div className="font-semibold">#{request.id} — {request.requester_name}</div><div className="text-xs text-muted-foreground">{request.requester_phone} • {new Date(request.created_at).toLocaleString()}</div></div><Badge variant={request.status === "pending" ? "secondary" : "outline"}>{request.status}</Badge></div><div className="text-sm mt-2 text-muted-foreground">{request.medicines?.map((m) => m.name_en).filter(Boolean).join(", ") || "No medicines listed"}</div></div>)}{!requests.length && <p className="text-sm text-muted-foreground">No requests found.</p>}</CardContent>
          </Card>
        </div>
      </>}
    </div>
  );
}
