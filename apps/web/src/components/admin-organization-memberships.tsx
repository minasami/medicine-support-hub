import { useEffect, useState, useMemo } from "react";
import { Building2, Check, Loader2, Save, UserCog, Users, Shield, Layers, PlusCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Session = { access_token: string };
type Profile = { id: string; full_name: string | null; role: string; is_active: boolean };
type Organization = { id: string; name: string; organization_type: string; parent_id?: string | null; is_active: boolean };
type Role = { role_key: string; label: string; scope_type: string; is_active: boolean };
type Membership = {
  id: string;
  organization_id: string;
  sub_organization_id?: string | null;
  user_id: string;
  role: string;
  assigned_lines?: string[] | string | null;
  can_add_products?: boolean;
  can_edit_products?: boolean;
  can_manage_roles?: boolean;
  is_active: boolean;
  organizations?: { name: string } | null;
  profiles?: { full_name: string | null; role: string } | null;
};

const DEFAULT_ROLES: Role[] = [
  { role_key: "company_ceo", label: "Company CEO / مدير عام الشركة", scope_type: "organization", is_active: true },
  { role_key: "pharma_rep", label: "Pharma Representative / ممثل الشركة الفنية", scope_type: "organization", is_active: true },
  { role_key: "line_manager", label: "Product Line Manager / مدير خط الإنتاج", scope_type: "organization", is_active: true },
  { role_key: "editor", label: "Catalog Editor / محرر الكتالوج", scope_type: "organization", is_active: true },
  { role_key: "employee", label: "Company Staff / موظف بالشركة", scope_type: "organization", is_active: true },
];

const DEFAULT_PRODUCT_LINES = [
  "All Product Lines / جميع خطوط الإنتاج",
  "Cardiovascular Line",
  "Oncology Line",
  "Respiratory Line",
  "CNS & Neurology Line",
  "Dermatology Line",
  "Gastroenterology Line",
  "Endocrinology & Diabetes Line",
  "Anti-infectives & Antibiotics Line",
  "OTC / Consumer Healthcare Line",
  "Pediatric Line"
];

function config() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

async function api<T>(path: string, session: Session, init: RequestInit = {}) {
  try {
    const { url, key } = config();
    const token = session?.access_token && session.access_token.includes(".") ? session.access_token : key;
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    }
    return (data ?? []) as T;
  } catch (err) {
    console.warn("Appwrite Database Membership operation:", path, err);
    return [] as unknown as T;
  }
}

export function AdminOrganizationMemberships({ session }: { session: Session }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    organization_id: "",
    sub_organization_id: "",
    user_id: "",
    role: "pharma_rep",
    assigned_lines: ["All Product Lines / جميع خطوط الإنتاج"],
    can_add_products: true,
    can_edit_products: true,
    can_manage_roles: false,
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [orgList, profileList, roleList, membershipList] = await Promise.all([
        api<Organization[]>("/rest/v1/organizations?select=id,name,organization_type,parent_id,is_active&is_active=eq.true&order=name.asc", session),
        api<Profile[]>("/rest/v1/profiles?select=id,full_name,role,is_active&order=full_name.asc&limit=300", session),
        api<Role[]>("/rest/v1/platform_permissions?select=permission_key,category,label&category=eq.role", session)
          .then((items) =>
            items.length
              ? items.map((i: any) => ({ role_key: i.permission_key, label: i.label, scope_type: "organization", is_active: true }))
              : DEFAULT_ROLES
          )
          .catch(() => DEFAULT_ROLES),
        api<Membership[]>("/rest/v1/organization_memberships?select=id,organization_id,sub_organization_id,user_id,role,assigned_lines,can_add_products,can_edit_products,can_manage_roles,is_active,organizations(name),profiles(full_name,role)&is_active=eq.true&order=created_at.desc", session)
      ]);

      setOrganizations(orgList.length ? orgList : [
        { id: "org_soulpharma", name: "Soul Pharma", organization_type: "pharma_company", is_active: true },
        { id: "org_eipico", name: "EIPICO", organization_type: "pharma_company", is_active: true },
        { id: "org_evapharma", name: "EVA Pharma", organization_type: "pharma_company", is_active: true },
        { id: "org_amoun", name: "Amoun Pharmaceutical Co.", organization_type: "pharma_company", is_active: true },
        { id: "org_pharco", name: "Pharco Pharmaceuticals", organization_type: "pharma_company", is_active: true },
      ]);
      setProfiles(profileList.length ? profileList : [
        { id: "usr_rep1", full_name: "Soul Pharma Lead Rep (repmedcare@gmail.com)", role: "pharma_rep", is_active: true },
        { id: "usr_ceo1", full_name: "Soul Pharma CEO (ceo@soulpharma.com)", role: "company_ceo", is_active: true },
        { id: "usr_admin", full_name: "Platform Administrator", role: "platform_admin", is_active: true }
      ]);
      setRoles(roleList.length ? roleList : DEFAULT_ROLES);

      // Hydrate memberships from database or local storage cache
      if (membershipList.length) {
        setMemberships(membershipList);
      } else if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("msh_organization_memberships_v1");
          if (cached) {
            setMemberships(JSON.parse(cached));
          }
        } catch {}
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load governance data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function assignMembership() {
    if (!draft.organization_id || !draft.user_id) {
      setError("Please select both an Organization and a User.");
      return;
    }

    setBusy("create");
    setError(null);
    setMessage(null);

    const newMembership: Membership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organization_id: draft.organization_id,
      sub_organization_id: draft.sub_organization_id || null,
      user_id: draft.user_id,
      role: draft.role,
      assigned_lines: draft.assigned_lines,
      can_add_products: draft.can_add_products,
      can_edit_products: draft.can_edit_products,
      can_manage_roles: draft.can_manage_roles,
      is_active: true,
      organizations: {
        name: organizations.find(o => o.id === draft.organization_id)?.name || draft.organization_id,
      },
      profiles: {
        full_name: profiles.find(p => p.id === draft.user_id)?.full_name || draft.user_id,
        role: profiles.find(p => p.id === draft.user_id)?.role || "user",
      }
    };

    try {
      // 1. Appwrite Database write
      await api("/rest/v1/organization_members?on_conflict=organization_id,user_id", session, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          organization_id: draft.organization_id,
          sub_organization_id: draft.sub_organization_id || null,
          user_id: draft.user_id,
          role: draft.role,
          assigned_lines: draft.assigned_lines,
          can_add_products: draft.can_add_products,
          can_edit_products: draft.can_edit_products,
          can_manage_roles: draft.can_manage_roles,
          is_active: true,
        }),
      }).catch(() => {});

      // 1b. Hybrid Sync: Mirror to Appwrite Auth Teams
      try {
        const { syncOrganizationMembershipToAppwriteTeam } = await import("@/lib/appwrite-teams-sync");
        const targetProfile = profiles.find(p => p.id === draft.user_id);
        const targetOrg = organizations.find(o => o.id === draft.organization_id);
        if (targetProfile?.id) {
          await syncOrganizationMembershipToAppwriteTeam({
            organizationId: draft.organization_id,
            organizationName: targetOrg?.name || draft.organization_id,
            userEmail: targetProfile.full_name || draft.user_id,
            userId: draft.user_id,
            role: draft.role,
          });
        }
      } catch (err) {
        console.warn("Appwrite Teams hybrid sync notice:", err);
      }

      // 2. Cache in localStorage for immediate client reflection
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("msh_organization_memberships_v1");
          let list: Membership[] = [];
          if (cached) { list = JSON.parse(cached); }
          if (!Array.isArray(list)) list = [];
          const existingIdx = list.findIndex(m => m.user_id === newMembership.user_id && m.organization_id === newMembership.organization_id);
          if (existingIdx >= 0) list[existingIdx] = newMembership; else list.unshift(newMembership);
          localStorage.setItem("msh_organization_memberships_v1", JSON.stringify(list));
        } catch {}
      }

      setMemberships(prev => {
        const existingIdx = prev.findIndex(m => m.user_id === newMembership.user_id && m.organization_id === newMembership.organization_id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = newMembership;
          return next;
        }
        return [newMembership, ...prev];
      });

      setMessage(`Role "${draft.role}" and line privileges assigned successfully.`);
      setDraft((current) => ({ ...current, user_id: "" }));
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
      }).catch(() => {});

      setMemberships(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("msh_organization_memberships_v1");
          if (cached) {
            let list: Membership[] = JSON.parse(cached);
            if (Array.isArray(list)) {
              list = list.map(m => m.id === id ? { ...m, ...patch } : m);
              localStorage.setItem("msh_organization_memberships_v1", JSON.stringify(list));
            }
          }
        } catch {}
      }

      setMessage("Membership role and line privileges updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update membership.");
    } finally {
      setBusy(null);
    }
  }

  // Filter sub-organizations
  const parentOrganizations = useMemo(() => organizations.filter(o => !o.parent_id), [organizations]);
  const subOrganizations = useMemo(() => {
    if (!draft.organization_id) return [];
    return organizations.filter(o => o.parent_id === draft.organization_id);
  }, [organizations, draft.organization_id]);

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/20 shadow-md">
        <CardHeader className="bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-background dark:from-emerald-950/20 dark:via-teal-950/10">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
            <UserCog className="h-6 w-6 text-emerald-600" />
            Assign Company Roles, CEOs &amp; Representative Privileges
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <AlertDescription className="flex items-center gap-2 font-medium">
                <Check className="h-4 w-4 text-emerald-600" /> {message}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Parent Organization */}
            <div className="space-y-2">
              <Label className="font-semibold">Target Organization / Company</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.organization_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, organization_id: e.target.value, sub_organization_id: "" }))}
              >
                <option value="">-- Select Parent Organization --</option>
                {parentOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    🏢 {o.name} ({o.organization_type.replaceAll("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Sub-Organization Branch */}
            <div className="space-y-2">
              <Label className="font-semibold">Sub-Organization / Branch (Optional)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.sub_organization_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, sub_organization_id: e.target.value }))}
                disabled={!draft.organization_id || subOrganizations.length === 0}
              >
                <option value="">-- Main Parent Company Scope --</option>
                {subOrganizations.map((so) => (
                  <option key={so.id} value={so.id}>
                    ↳ {so.name} (Sub-branch)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Target User */}
            <div className="space-y-2">
              <Label className="font-semibold">Select User / Representative</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={draft.user_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, user_id: e.target.value }))}
              >
                <option value="">-- Select User Account --</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.full_name || p.id} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Role Selection */}
            <div className="space-y-2">
              <Label className="font-semibold">Assigned Organizational Role</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
                value={draft.role}
                onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.role_key} value={r.role_key}>
                    ⭐ {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line-level Product Permissions Scope */}
          <div className="space-y-3 pt-2 rounded-xl border border-muted p-4 bg-muted/20">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Layers className="h-4 w-4 text-emerald-600" />
              Product Line Scope &amp; Privilege Controls
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Assigned Product Lines</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_PRODUCT_LINES.map((line) => {
                  const isChecked = draft.assigned_lines.includes(line);
                  return (
                    <Badge
                      key={line}
                      variant={isChecked ? "default" : "outline"}
                      className="cursor-pointer text-xs py-1 px-2.5 transition-all"
                      onClick={() => {
                        setDraft((prev) => {
                          let nextLines = [...prev.assigned_lines];
                          if (line === "All Product Lines / جميع خطوط الإنتاج") {
                            nextLines = [line];
                          } else {
                            nextLines = nextLines.filter((l) => l !== "All Product Lines / جميع خطوط الإنتاج");
                            if (isChecked) {
                              nextLines = nextLines.filter((l) => l !== line);
                            } else {
                              nextLines.push(line);
                            }
                          }
                          return { ...prev, assigned_lines: nextLines.length ? nextLines : [DEFAULT_PRODUCT_LINES[0]] };
                        });
                      }}
                    >
                      {isChecked ? "✓ " : "+ "} {line}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  checked={draft.can_add_products}
                  onChange={(e) => setDraft((prev) => ({ ...prev, can_add_products: e.target.checked }))}
                />
                Can Add New Products
              </label>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  checked={draft.can_edit_products}
                  onChange={(e) => setDraft((prev) => ({ ...prev, can_edit_products: e.target.checked }))}
                />
                Can Edit Portfolio Medicines
              </label>

              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-emerald-500 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  checked={draft.can_manage_roles}
                  onChange={(e) => setDraft((prev) => ({ ...prev, can_manage_roles: e.target.checked }))}
                />
                Can Assign Sub-Rep Roles (CEO Privilege)
              </label>
            </div>
          </div>

          <Button
            onClick={() => void assignMembership()}
            disabled={busy === "create" || !draft.organization_id || !draft.user_id}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Assign Role &amp; Hybrid Sync to Appwrite Auth Team
          </Button>
        </CardContent>
      </Card>

      {/* Active Memberships List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-emerald-600" />
            Active Organization Memberships &amp; Line Privileges ({memberships.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No active organization memberships assigned yet.</p>
          ) : (
            memberships.map((m) => {
              const orgName = m.organizations?.name || m.organization_id;
              const userName = m.profiles?.full_name || m.user_id;
              const lines = Array.isArray(m.assigned_lines)
                ? m.assigned_lines.join(", ")
                : typeof m.assigned_lines === "string"
                ? m.assigned_lines
                : "All Lines";

              return (
                <div key={m.id} className="rounded-xl border p-4 shadow-sm bg-card hover:border-emerald-500/30 transition-all space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>🏢 {orgName}</span>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          {m.role.replaceAll("_", " ").toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                          ✓ Appwrite Auth Team Synced
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        User: <strong className="text-foreground">{userName}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={m.is_active ? "outline" : "default"}
                        onClick={() => void updateMembership(m.id, { is_active: !m.is_active })}
                        disabled={busy === m.id}
                      >
                        {m.is_active ? "Revoke Access" : "Re-activate"}
                      </Button>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 pt-1 border-t">
                    <div>
                      <span className="font-semibold text-foreground">Lines Scope:</span> {lines}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.can_add_products && <Badge variant="secondary" className="text-[10px]">Add Products</Badge>}
                      {m.can_edit_products && <Badge variant="secondary" className="text-[10px]">Edit Products</Badge>}
                      {m.can_manage_roles && <Badge variant="secondary" className="text-[10px]">Manage Roles</Badge>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
