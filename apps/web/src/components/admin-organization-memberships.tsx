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
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) return [] as unknown as T;
    return (data ?? []) as T;
  } catch {
    return [] as unknown as T;
  }
}

export function AdminOrganizationMemberships({ session }: { session: Session }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [productLines, setProductLines] = useState<string[]>(DEFAULT_PRODUCT_LINES);

  const [draft, setDraft] = useState({
    user_id: "",
    organization_id: "",
    sub_organization_id: "",
    role: "pharma_rep",
    assigned_lines: ["All Product Lines / جميع خطوط الإنتاج"],
    can_add_products: true,
    can_edit_products: true,
    can_manage_roles: false,
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profileRows, organizationRows, roleRows, membershipRows, lineRows] = await Promise.all([
        api<Profile[]>("/rest/v1/profiles?select=id,full_name,role,is_active&order=full_name.asc.nullslast&limit=1000", session),
        api<Organization[]>("/rest/v1/organizations?select=id,name,organization_type,parent_id,is_active&order=name.asc&limit=1000", session),
        api<Role[]>("/rest/v1/platform_role_definitions?select=role_key,label,scope_type,is_active&is_active=eq.true&order=role_level.asc,label.asc", session),
        api<Membership[]>("/rest/v1/organization_members?select=id,organization_id,sub_organization_id,user_id,role,assigned_lines,can_add_products,can_edit_products,can_manage_roles,is_active,organizations(name),profiles(full_name,role)&order=created_at.desc&limit=1000", session),
        api<{ line?: string; product_line?: string }[]>("/rest/v1/medicines?select=line&line=not.is.null&limit=500", session).catch(() => []),
      ]);

      if (Array.isArray(profileRows) && profileRows.length > 0) setProfiles(profileRows);
      if (Array.isArray(organizationRows) && organizationRows.length > 0) setOrganizations(organizationRows);
      if (Array.isArray(roleRows) && roleRows.length > 0) {
        const mergedRoles = [...DEFAULT_ROLES];
        for (const r of roleRows) {
          if (!mergedRoles.some(dr => dr.role_key === r.role_key)) {
            mergedRoles.push(r);
          }
        }
        setRoles(mergedRoles);
      }

      // Load memberships from database & merge with local Appwrite storage cache
      let fetchedMemberships: Membership[] = Array.isArray(membershipRows) ? membershipRows : [];
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("msh_organization_memberships_v1");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              for (const cm of parsed) {
                const idx = fetchedMemberships.findIndex(m => m.id === cm.id || (m.user_id === cm.user_id && m.organization_id === cm.organization_id));
                if (idx >= 0) {
                  fetchedMemberships[idx] = { ...fetchedMemberships[idx], ...cm };
                } else {
                  fetchedMemberships.unshift(cm);
                }
              }
            }
          }
        } catch {}
      }
      setMemberships(fetchedMemberships);

      // Unique product lines
      const dbLines = new Set(DEFAULT_PRODUCT_LINES);
      if (Array.isArray(lineRows)) {
        lineRows.forEach((l: { line?: string; product_line?: string }) => {
          const val = l.line || l.product_line;
          if (val && val.trim()) dbLines.add(val.trim());
        });
      }
      setProductLines(Array.from(dbLines));

    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load organization memberships.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [session.access_token]);

  // Adjust default privilege checkboxes when role changes
  const handleRoleSelect = (roleKey: string) => {
    const isCeo = roleKey === "company_ceo";
    const isRep = roleKey === "pharma_rep" || roleKey === "line_manager";
    setDraft(current => ({
      ...current,
      role: roleKey,
      can_manage_roles: isCeo,
      can_add_products: isCeo || isRep,
      can_edit_products: isCeo || isRep,
    }));
  };

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.user_id || !draft.organization_id || !draft.role) return;
    setBusy("assign");
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
      // 1. Supabase API write
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
    <Card className="mb-8 border-blue-200 shadow-md">
      <CardHeader className="border-b bg-blue-50/60 dark:bg-blue-950/10">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Organization membership and role assignments
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign each user to the correct organization role, assign Company CEOs & Pharma Representatives, specify Product Line privileges, and manage permissions.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6 p-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

        <form onSubmit={assign} className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4 xl:items-end">
            {/* User Selector */}
            <Select
              label="User"
              value={draft.user_id}
              onChange={(user_id) => setDraft({ ...draft, user_id })}
              options={profiles.filter((row) => row.is_active).map((row) => [row.id, row.full_name || `${row.role} · ${row.id.slice(0, 8)}`])}
            />

            {/* Parent Organization Selector */}
            <Select
              label="Organization"
              value={draft.organization_id}
              onChange={(organization_id) => setDraft({ ...draft, organization_id, sub_organization_id: "" })}
              options={parentOrganizations.filter((row) => row.is_active).map((row) => [row.id, `${row.name} · ${row.organization_type}`])}
            />

            {/* Sub-Organization / Branch Selector */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">Sub-Organization / Company Branch</Label>
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.sub_organization_id}
                onChange={(e) => setDraft({ ...draft, sub_organization_id: e.target.value })}
              >
                <option value="">(All Branches / الرئيسي والجميع)</option>
                {subOrganizations.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Organization Role Selector */}
            <Select
              label="Organization role"
              value={draft.role}
              onChange={handleRoleSelect}
              options={roles.filter((row) => row.scope_type !== "public").map((row) => [row.role_key, row.label])}
            />
          </div>

          {/* Product Line Level Privileges Assignment */}
          <div className="rounded-lg border bg-white p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-600" />
                Assigned Product Lines (Line-level editing/addition scope)
              </Label>
              <span className="text-xs text-muted-foreground">Select line(s) user can add/edit products for</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {productLines.map((lineName) => {
                const isSelected = draft.assigned_lines.includes(lineName);
                return (
                  <Badge
                    key={lineName}
                    variant={isSelected ? "default" : "outline"}
                    className="cursor-pointer text-xs px-2.5 py-1 transition-all hover:scale-105"
                    onClick={() => {
                      if (lineName.includes("All Product Lines")) {
                        setDraft(d => ({ ...d, assigned_lines: [lineName] }));
                      } else {
                        setDraft(d => {
                          const current = d.assigned_lines.filter(l => !l.includes("All Product Lines"));
                          const next = current.includes(lineName)
                            ? current.filter(l => l !== lineName)
                            : [...current, lineName];
                          return { ...d, assigned_lines: next.length > 0 ? next : ["All Product Lines / جميع خطوط الإنتاج"] };
                        });
                      }
                    }}
                  >
                    {isSelected ? "✓ " : "+ "}{lineName}
                  </Badge>
                );
              })}
            </div>

            {/* Privilege Toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.can_add_products}
                  onChange={(e) => setDraft({ ...draft, can_add_products: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Can Add New Products
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.can_edit_products}
                  onChange={(e) => setDraft({ ...draft, can_edit_products: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                Can Edit Line Products
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.can_manage_roles}
                  onChange={(e) => setDraft({ ...draft, can_manage_roles: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <Shield className="h-3.5 w-3.5 text-amber-600" />
                CEO Privilege: Manage Company Roles & Reps
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              disabled={busy === "assign" || !draft.user_id || !draft.organization_id}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow"
            >
              {busy === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCog className="mr-2 h-4 w-4" />}
              Assign role & privileges
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
            Loading memberships…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-[950px] w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-3 text-left">User</th>
                  <th className="px-3 py-3 text-left">Organization / Branch</th>
                  <th className="px-3 py-3 text-left">Assigned role</th>
                  <th className="px-3 py-3 text-left">Line Scope & Privileges</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <MembershipRow
                    key={membership.id}
                    membership={membership}
                    roles={roles}
                    productLines={productLines}
                    busy={busy === membership.id}
                    onSave={(patch) => updateMembership(membership.id, patch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipRow({
  membership,
  roles,
  productLines,
  busy,
  onSave
}: {
  membership: Membership;
  roles: Role[];
  productLines: string[];
  busy: boolean;
  onSave: (patch: Partial<Membership>) => Promise<void>;
}) {
  const [role, setRole] = useState(membership.role);
  const [assignedLines, setAssignedLines] = useState<string[]>(
    Array.isArray(membership.assigned_lines)
      ? membership.assigned_lines
      : typeof membership.assigned_lines === "string"
      ? [membership.assigned_lines]
      : ["All Product Lines / جميع خطوط الإنتاج"]
  );

  useEffect(() => {
    setRole(membership.role);
    if (membership.assigned_lines) {
      setAssignedLines(
        Array.isArray(membership.assigned_lines)
          ? membership.assigned_lines
          : [membership.assigned_lines]
      );
    }
  }, [membership.role, membership.assigned_lines]);

  const isCeo = role === "company_ceo";
  const isRep = role === "pharma_rep";

  return (
    <tr className="border-t hover:bg-slate-50/50">
      <td className="px-3 py-3">
        <div className="font-semibold text-slate-900">{membership.profiles?.full_name || membership.user_id}</div>
        <div className="text-xs text-muted-foreground">Platform role: {membership.profiles?.role || "user"}</div>
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          <div>
            <div className="font-medium text-slate-800">{membership.organizations?.name || membership.organization_id}</div>
            {membership.sub_organization_id && (
              <div className="text-xs text-muted-foreground">Branch: {membership.sub_organization_id}</div>
            )}
          </div>
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="space-y-1">
          <select
            className="h-9 min-w-44 rounded-md border bg-background px-2 text-xs font-medium"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roles.filter((row) => row.scope_type !== "public").map((row) => (
              <option key={row.role_key} value={row.role_key}>{row.label}</option>
            ))}
          </select>
          {isCeo && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] block w-max">
              👑 Company CEO
            </Badge>
          )}
          {isRep && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] block w-max">
              💼 Pharma Representative
            </Badge>
          )}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="max-w-xs space-y-1">
          <div className="flex flex-wrap gap-1">
            {assignedLines.map((l) => (
              <span key={l} className="inline-block bg-slate-100 border text-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono truncate max-w-[140px]">
                {l.split("/")[0]}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-emerald-700 flex gap-2">
            {membership.can_add_products && <span>+ Add</span>}
            {membership.can_edit_products && <span>✎ Edit</span>}
            {membership.can_manage_roles && <span className="text-amber-700 font-semibold">⚡ Manage Roles</span>}
          </div>
        </div>
      </td>

      <td className="px-3 py-3">
        <Badge variant={membership.is_active ? "default" : "outline"}>
          {membership.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>

      <td className="px-3 py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            onClick={() => void onSave({ role, assigned_lines: assignedLines })}
            disabled={busy || (role === membership.role && JSON.stringify(assignedLines) === JSON.stringify(membership.assigned_lines))}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="sr-only">Save role</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void onSave({ is_active: !membership.is_active })}
            disabled={busy}
          >
            {membership.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      <select
        className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm font-medium"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select…</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  );
}
