import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Building2,
  Check,
  ChevronRight,
  GitBranch,
  GraduationCap,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeWebUrl } from "@/lib/url-inputs";

type Session = { access_token: string };
type Role = {
  role_key: string;
  label: string;
  description: string | null;
  role_level: number;
  parent_role_key: string | null;
  scope_type: string;
  is_system: boolean;
  is_active: boolean;
};
type Permission = {
  permission_key: string;
  category: string;
  label: string;
  description: string | null;
  risk_level: string;
  is_active: boolean;
};
type RolePermission = { role_key: string; permission_key: string; allowed: boolean };
type Organization = { id: string; name: string; organization_type: string; is_active: boolean };
type Relationship = {
  id: string;
  parent_organization_id: string;
  child_organization_id: string;
  relationship_type: string;
  is_active: boolean;
  notes: string | null;
};
type ApprovalPolicy = {
  policy_key: string;
  queue_key: string;
  label: string;
  description: string | null;
  required_permission: string | null;
  minimum_approvers: number;
  sla_hours: number;
  escalation_role_key: string | null;
  is_active: boolean;
};
type CareerPath = {
  id: string;
  slug: string;
  role_key: string;
  title_en: string;
  title_ar: string | null;
  summary_en: string;
  minimum_points: number;
  is_published: boolean;
  sort_order: number;
};
type Course = { id: string; slug: string; title_en: string; completion_points: number; is_published: boolean };
type Lesson = {
  id: string;
  course_id: string;
  lesson_slug: string;
  title_en: string;
  video_url: string | null;
  video_provider: string | null;
  experience_points: number;
  is_published: boolean;
};
type Summary = {
  active_roles: number;
  active_permissions: number;
  active_role_permissions: number;
  active_organization_relationships: number;
  active_approval_policies: number;
};
type Audit = {
  id: number;
  table_name: string;
  record_key: string | null;
  action: string;
  created_at: string;
};

type SectionKey = "roles" | "organizations" | "approvals" | "learning" | "audit";

const RELATIONSHIP_TYPES = [
  "parent",
  "affiliate",
  "branch",
  "program_owner",
  "service_network",
  "contracted_provider",
];

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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!response.ok) throw new Error(data?.message || data?.error || "Governance request failed.");
  return data as T;
}

export function AdminGovernanceConsole({ session }: { session: Session }) {
  const [section, setSection] = useState<SectionKey>("roles");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [paths, setPaths] = useState<CareerPath[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [relationshipDraft, setRelationshipDraft] = useState({
    parent: "",
    child: "",
    type: "parent",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const permissionSet = useMemo(
    () => new Set(rolePermissions.filter((row) => row.allowed).map((row) => `${row.role_key}:${row.permission_key}`)),
    [rolePermissions],
  );
  const organizationName = (id: string) => organizations.find((row) => row.id === id)?.name || id;
  const courseName = (id: string) => courses.find((row) => row.id === id)?.title_en || id;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [roleRows, permissionRows, rolePermissionRows, organizationRows, relationshipRows, policyRows, pathRows, courseRows, lessonRows, summaryRows, auditRows] = await Promise.all([
        api<Role[]>("/rest/v1/platform_role_definitions?select=*&order=role_level.asc,label.asc", session),
        api<Permission[]>("/rest/v1/platform_permissions?select=*&order=category.asc,label.asc", session),
        api<RolePermission[]>("/rest/v1/platform_role_permissions?select=role_key,permission_key,allowed", session),
        api<Organization[]>("/rest/v1/organizations?select=id,name,organization_type,is_active&order=name.asc&limit=1000", session),
        api<Relationship[]>("/rest/v1/organization_relationships?select=*&order=created_at.desc&limit=500", session),
        api<ApprovalPolicy[]>("/rest/v1/platform_approval_policies?select=*&order=label.asc", session),
        api<CareerPath[]>("/rest/v1/learning_career_paths?select=id,slug,role_key,title_en,title_ar,summary_en,minimum_points,is_published,sort_order&order=sort_order.asc", session),
        api<Course[]>("/rest/v1/learning_courses?select=id,slug,title_en,completion_points,is_published&order=sort_order.asc,title_en.asc", session),
        api<Lesson[]>("/rest/v1/learning_lessons?select=id,course_id,lesson_slug,title_en,video_url,video_provider,experience_points,is_published&order=course_id.asc,lesson_order.asc", session),
        api<Summary[]>("/rest/v1/platform_governance_summary_v1?select=*", session),
        api<Audit[]>("/rest/v1/platform_governance_audit?select=id,table_name,record_key,action,created_at&order=created_at.desc&limit=80", session),
      ]);
      setRoles(roleRows);
      setPermissions(permissionRows);
      setRolePermissions(rolePermissionRows);
      setOrganizations(organizationRows);
      setRelationships(relationshipRows);
      setPolicies(policyRows);
      setPaths(pathRows);
      setCourses(courseRows);
      setLessons(lessonRows);
      setSummary(summaryRows[0] || null);
      setAudit(auditRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load governance controls.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session.access_token]);

  async function patch<T extends object>(table: string, filter: string, body: T, busyKey: string) {
    setBusy(busyKey);
    setError(null);
    setMessage(null);
    try {
      await api(`/rest/v1/${table}?${filter}`, session, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      setMessage("Governance change saved and added to the audit trail.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the change.");
    } finally {
      setBusy(null);
    }
  }

  async function togglePermission(roleKey: string, permissionKey: string) {
    const key = `${roleKey}:${permissionKey}`;
    const nextAllowed = !permissionSet.has(key);
    setBusy(key);
    setError(null);
    try {
      await api("/rest/v1/platform_role_permissions?on_conflict=role_key,permission_key", session, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          role_key: roleKey,
          permission_key: permissionKey,
          allowed: nextAllowed,
          approved_at: new Date().toISOString(),
        }),
      });
      setRolePermissions((current) => [
        ...current.filter((row) => !(row.role_key === roleKey && row.permission_key === permissionKey)),
        { role_key: roleKey, permission_key: permissionKey, allowed: nextAllowed },
      ]);
      setMessage(`${nextAllowed ? "Granted" : "Removed"} ${permissionKey} for ${roleKey}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update permission.");
    } finally {
      setBusy(null);
    }
  }

  async function createRelationship(event: React.FormEvent) {
    event.preventDefault();
    if (!relationshipDraft.parent || !relationshipDraft.child) return;
    setBusy("relationship");
    setError(null);
    try {
      await api("/rest/v1/organization_relationships", session, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          parent_organization_id: relationshipDraft.parent,
          child_organization_id: relationshipDraft.child,
          relationship_type: relationshipDraft.type,
          notes: relationshipDraft.notes.trim() || null,
          is_active: true,
        }),
      });
      setRelationshipDraft({ parent: "", child: "", type: "parent", notes: "" });
      setMessage("Organization relationship created.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create relationship.");
    } finally {
      setBusy(null);
    }
  }

  const sections: Array<{ key: SectionKey; label: string; icon: typeof ShieldCheck }> = [
    { key: "roles", label: "Roles & privileges", icon: KeyRound },
    { key: "organizations", label: "Organization hierarchy", icon: GitBranch },
    { key: "approvals", label: "Approval policies", icon: ShieldCheck },
    { key: "learning", label: "Learning Studio", icon: GraduationCap },
    { key: "audit", label: "Audit trail", icon: SlidersHorizontal },
  ];

  return (
    <Card className="mb-8 overflow-hidden border-primary/25">
      <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Governance, hierarchy, privileges and learning
            </CardTitle>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
              One audited GUI for platform roles, permission assignments, organization relationships, approval rules, career paths, lesson videos, points and certificates. Existing row-level security remains the enforcement boundary.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh controls
          </Button>
        </div>
        {summary && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Active roles" value={summary.active_roles} />
            <Metric label="Permissions" value={summary.active_permissions} />
            <Metric label="Role grants" value={summary.active_role_permissions} />
            <Metric label="Org links" value={summary.active_organization_relationships} />
            <Metric label="Approval policies" value={summary.active_approval_policies} />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="mobile-scrollbar-hidden flex gap-1 overflow-x-auto border-b p-2">
          {sections.map(({ key, label, icon: Icon }) => (
            <Button key={key} variant={section === key ? "default" : "ghost"} className="shrink-0" onClick={() => setSection(key)}>
              <Icon className="mr-2 h-4 w-4" />{label}
            </Button>
          ))}
        </div>
        <div className="p-4 md:p-6">
          {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert className="mb-4"><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
          {loading ? (
            <div className="flex min-h-44 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading governance…</div>
          ) : section === "roles" ? (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-bold">Role hierarchy</h3>
                <p className="mt-1 text-sm text-muted-foreground">Lower hierarchy numbers represent broader authority. Every change is audited.</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {roles.map((role) => (
                    <RoleEditor key={role.role_key} role={role} roles={roles} busy={busy === role.role_key} onSave={(body) => patch("platform_role_definitions", `role_key=eq.${encodeURIComponent(role.role_key)}`, body, role.role_key)} />
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-lg font-bold">Permission matrix</h3>
                <p className="mt-1 text-sm text-muted-foreground">This registry can be used by current and future RLS policies through <code>platform_user_has_permission</code>.</p>
                <div className="mt-4 overflow-x-auto rounded-xl border">
                  <table className="min-w-[1100px] text-sm">
                    <thead className="bg-muted/60"><tr><th className="sticky left-0 z-10 bg-muted px-3 py-3 text-left">Role</th>{permissions.map((permission) => <th key={permission.permission_key} className="px-2 py-3 text-center"><span className="block text-xs font-semibold">{permission.label}</span><Badge variant="outline" className="mt-1 text-[10px]">{permission.risk_level}</Badge></th>)}</tr></thead>
                    <tbody>{roles.filter((role) => role.is_active).map((role) => <tr key={role.role_key} className="border-t"><th className="sticky left-0 bg-card px-3 py-3 text-left"><div>{role.label}</div><div className="text-xs font-normal text-muted-foreground">{role.role_key}</div></th>{permissions.map((permission) => { const key = `${role.role_key}:${permission.permission_key}`; const checked = permissionSet.has(key); return <td key={permission.permission_key} className="px-2 py-2 text-center"><button type="button" aria-label={`${checked ? "Remove" : "Grant"} ${permission.label} for ${role.label}`} onClick={() => void togglePermission(role.role_key, permission.permission_key)} disabled={busy === key} className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition ${checked ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>{busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : checked ? <Check className="h-4 w-4" /> : null}</button></td>; })}</tr>)}</tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : section === "organizations" ? (
            <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
              <form onSubmit={createRelationship} className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <h3 className="flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5" />Connect organizations</h3>
                <Select label="Parent / network organization" value={relationshipDraft.parent} onChange={(parent) => setRelationshipDraft((current) => ({ ...current, parent }))} options={organizations.filter((row) => row.is_active).map((row) => [row.id, row.name])} />
                <Select label="Child / connected organization" value={relationshipDraft.child} onChange={(child) => setRelationshipDraft((current) => ({ ...current, child }))} options={organizations.filter((row) => row.is_active && row.id !== relationshipDraft.parent).map((row) => [row.id, row.name])} />
                <Select label="Relationship" value={relationshipDraft.type} onChange={(type) => setRelationshipDraft((current) => ({ ...current, type }))} options={RELATIONSHIP_TYPES.map((value) => [value, humanize(value)])} />
                <div><Label>Governance notes</Label><Input className="mt-1" value={relationshipDraft.notes} onChange={(event) => setRelationshipDraft((current) => ({ ...current, notes: event.target.value }))} /></div>
                <Button type="submit" disabled={busy === "relationship" || !relationshipDraft.parent || !relationshipDraft.child}>{busy === "relationship" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}Create relationship</Button>
              </form>
              <div>
                <h3 className="text-lg font-bold">Current hierarchy and networks</h3>
                <div className="mt-4 space-y-3">
                  {relationships.map((relationship) => <div key={relationship.id} className="rounded-xl border p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold">{organizationName(relationship.parent_organization_id)}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate font-semibold">{organizationName(relationship.child_organization_id)}</span></div><Badge variant={relationship.is_active ? "default" : "outline"}>{humanize(relationship.relationship_type)}</Badge></div>{relationship.notes && <p className="mt-2 text-sm text-muted-foreground">{relationship.notes}</p>}<Button className="mt-3" size="sm" variant="outline" onClick={() => patch("organization_relationships", `id=eq.${relationship.id}`, { is_active: !relationship.is_active }, relationship.id)}>{relationship.is_active ? "Deactivate link" : "Reactivate link"}</Button></div>)}
                  {!relationships.length && <p className="text-sm text-muted-foreground">No organization relationships configured yet.</p>}
                </div>
              </div>
            </div>
          ) : section === "approvals" ? (
            <div>
              <h3 className="text-lg font-bold">Approval policies and escalation</h3>
              <p className="mt-1 text-sm text-muted-foreground">Approval queues remain visible in the Platform Control Center; these policies define permission, minimum reviewers, SLA and escalation ownership.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {policies.map((policy) => <PolicyEditor key={policy.policy_key} policy={policy} roles={roles} permissions={permissions} busy={busy === policy.policy_key} onSave={(body) => patch("platform_approval_policies", `policy_key=eq.${encodeURIComponent(policy.policy_key)}`, body, policy.policy_key)} />)}
              </div>
            </div>
          ) : section === "learning" ? (
            <div className="space-y-8">
              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold"><Award className="h-5 w-5" />Career and learning paths</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {paths.map((path) => <div key={path.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{path.title_en}</div><div className="mt-1 text-xs text-muted-foreground">{path.role_key} · {path.minimum_points} points</div></div><Badge variant={path.is_published ? "default" : "outline"}>{path.is_published ? "Published" : "Draft"}</Badge></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{path.summary_en}</p><Button className="mt-3" size="sm" variant="outline" onClick={() => patch("learning_career_paths", `id=eq.${path.id}`, { is_published: !path.is_published }, path.id)}>{path.is_published ? "Unpublish" : "Publish"}</Button></div>)}
                </div>
              </section>
              <section>
                <h3 className="flex items-center gap-2 text-lg font-bold"><Video className="h-5 w-5" />Role-based lesson video library</h3>
                <p className="mt-1 text-sm text-muted-foreground">Paste a YouTube, Vimeo or direct HTTPS video URL. Learners will see it inside the relevant lesson. Empty lessons remain text-first.</p>
                <div className="mt-4 space-y-3">
                  {lessons.map((lesson) => <LessonVideoEditor key={lesson.id} lesson={lesson} courseName={courseName(lesson.course_id)} busy={busy === lesson.id} onSave={(body) => patch("learning_lessons", `id=eq.${lesson.id}`, body, lesson.id)} />)}
                </div>
              </section>
              <section>
                <h3 className="text-lg font-bold">Course rewards</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CoursePointsEditor key={course.id} course={course} busy={busy === course.id} onSave={(body) => patch("learning_courses", `id=eq.${course.id}`, body, course.id)} />)}</div>
              </section>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold">Recent governance audit</h3>
              <div className="mt-4 space-y-2">{audit.map((row) => <div key={row.id} className="flex flex-col gap-1 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><span className="font-semibold">{humanize(row.table_name)}</span><span className="ml-2 text-xs text-muted-foreground">{row.record_key || "record"}</span></div><div className="flex items-center gap-2"><Badge variant="outline">{row.action}</Badge><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span></div></div>)}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card px-3 py-2"><div className="text-xl font-bold">{Number(value || 0).toLocaleString()}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function RoleEditor({ role, roles, busy, onSave }: { role: Role; roles: Role[]; busy: boolean; onSave: (body: Partial<Role>) => Promise<void> }) {
  const [draft, setDraft] = useState(role);
  useEffect(() => setDraft(role), [role]);
  return <div className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{role.label}</div><div className="text-xs text-muted-foreground">{role.role_key} · {role.scope_type}</div></div><Badge variant={draft.is_active ? "default" : "outline"}>{draft.is_active ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{role.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><Label>Parent role</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.parent_role_key || ""} onChange={(event) => setDraft({ ...draft, parent_role_key: event.target.value || null })}><option value="">No parent</option>{roles.filter((candidate) => candidate.role_key !== role.role_key).map((candidate) => <option key={candidate.role_key} value={candidate.role_key}>{candidate.label}</option>)}</select></div><div><Label>Hierarchy level</Label><Input className="mt-1" type="number" min="0" max="1000" value={draft.role_level} onChange={(event) => setDraft({ ...draft, role_level: Number(event.target.value) })} /></div></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => void onSave({ parent_role_key: draft.parent_role_key, role_level: draft.role_level, is_active: draft.is_active })} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save hierarchy</Button><Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}>{draft.is_active ? "Mark inactive" : "Mark active"}</Button></div></div>;
}

function PolicyEditor({ policy, roles, permissions, busy, onSave }: { policy: ApprovalPolicy; roles: Role[]; permissions: Permission[]; busy: boolean; onSave: (body: Partial<ApprovalPolicy>) => Promise<void> }) {
  const [draft, setDraft] = useState(policy);
  useEffect(() => setDraft(policy), [policy]);
  return <div className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{policy.label}</div><div className="text-xs text-muted-foreground">{policy.queue_key}</div></div><Badge variant={draft.is_active ? "default" : "outline"}>{draft.is_active ? "Active" : "Inactive"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{policy.description}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Select label="Required permission" value={draft.required_permission || ""} onChange={(required_permission) => setDraft({ ...draft, required_permission: required_permission || null })} options={permissions.map((row) => [row.permission_key, row.label])} /><Select label="Escalation role" value={draft.escalation_role_key || ""} onChange={(escalation_role_key) => setDraft({ ...draft, escalation_role_key: escalation_role_key || null })} options={roles.map((row) => [row.role_key, row.label])} /><div><Label>Minimum approvers</Label><Input className="mt-1" type="number" min="1" max="10" value={draft.minimum_approvers} onChange={(event) => setDraft({ ...draft, minimum_approvers: Number(event.target.value) })} /></div><div><Label>SLA hours</Label><Input className="mt-1" type="number" min="1" value={draft.sla_hours} onChange={(event) => setDraft({ ...draft, sla_hours: Number(event.target.value) })} /></div></div><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => void onSave({ required_permission: draft.required_permission, escalation_role_key: draft.escalation_role_key, minimum_approvers: draft.minimum_approvers, sla_hours: draft.sla_hours, is_active: draft.is_active })} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save policy</Button><Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, is_active: !draft.is_active })}>{draft.is_active ? "Disable" : "Enable"}</Button></div></div>;
}

function LessonVideoEditor({ lesson, courseName, busy, onSave }: { lesson: Lesson; courseName: string; busy: boolean; onSave: (body: Partial<Lesson>) => Promise<void> }) {
  const [url, setUrl] = useState(lesson.video_url || "");
  const [provider, setProvider] = useState(lesson.video_provider || "youtube");
  const [points, setPoints] = useState(lesson.experience_points);
  useEffect(() => { setUrl(lesson.video_url || ""); setProvider(lesson.video_provider || "youtube"); setPoints(lesson.experience_points); }, [lesson]);
  return <div className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[1fr_1.2fr_.45fr_.35fr_auto] lg:items-end"><div><div className="font-semibold">{lesson.title_en}</div><div className="text-xs text-muted-foreground">{courseName}</div></div><div><Label>Video URL</Label><Input className="mt-1" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="youtube.com/watch?v=…" /></div><Select label="Provider" value={provider} onChange={setProvider} options={[["youtube","YouTube"],["vimeo","Vimeo"],["direct","Direct video"],["external","External learning page"]]} /><div><Label>XP</Label><Input className="mt-1" type="number" min="1" max="1000" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></div><Button size="sm" onClick={() => void onSave({ video_url: url.trim() ? normalizeWebUrl(url) : null, video_provider: url.trim() ? provider : null, experience_points: points })} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="sr-only">Save video</span></Button></div>;
}

function CoursePointsEditor({ course, busy, onSave }: { course: Course; busy: boolean; onSave: (body: Partial<Course>) => Promise<void> }) {
  const [points, setPoints] = useState(course.completion_points);
  useEffect(() => setPoints(course.completion_points), [course.completion_points]);
  return <div className="rounded-xl border p-4"><div className="font-semibold">{course.title_en}</div><div className="mt-3 flex items-end gap-2"><div className="flex-1"><Label>Completion points</Label><Input className="mt-1" type="number" min="1" max="10000" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></div><Button size="sm" onClick={() => void onSave({ completion_points: points })} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button></div></div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <div><Label>{label}</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
