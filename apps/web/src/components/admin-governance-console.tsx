/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { usePatientAuth } from "@/lib/patient-auth";

type Session = { access_token: string };
type Role = {
  role_key: string;
  label: string;
  description: string | null;
  role_level: number;
  parent_role_key: string | null;
  scope_type: string;
  is_active: boolean;
};
type Permission = { permission_key: string; category: string; label: string; description: string | null };
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
  id: string;
  label: string;
  domain: string;
  approval_mode: string;
  required_role_level: number;
  min_approvers: number;
  is_active: boolean;
};
type CareerPath = {
  id: string;
  slug: string;
  role_key: string;
  title_en: string;
  title_ar: string | null;
  summary_en: string | null;
  minimum_points: number;
  is_published: boolean;
  sort_order: number;
};
type Course = {
  id: string;
  slug: string;
  title_en: string;
  completion_points: number;
  is_published: boolean;
};
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
  active_policies: number;
  active_organizations: number;
  active_relationships: number;
  published_career_paths: number;
  published_courses: number;
  published_lessons: number;
};
type Audit = { id: string; table_name: string; record_key: string | null; action: string; created_at: string };
type SectionKey = "roles" | "permissions" | "relationships" | "policies" | "learning" | "audit";

const RELATIONSHIP_TYPES = ["parent", "subsidiary", "factory", "distribution_partner", "commercial_agent", "marketing_representative"];

async function api<T>(path: string, session: Session, init: RequestInit = {}): Promise<T> {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [] as unknown as T;
  try {
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const data = await response.json();
    if (!response.ok) return [] as unknown as T;
    return (data ?? []) as T;
  } catch {
    return [] as unknown as T;
  }
}

export function AdminGovernanceConsole({ session: propSession }: { session?: Session }) {
  const { session: contextSession } = usePatientAuth();
  const rawSession = propSession || contextSession;
  const session: Session = { access_token: rawSession?.access_token || "" };
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

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading governance control plane...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="w-fit bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900">
              <ShieldCheck className="mr-1 h-3 w-3 text-emerald-400" /> Platform Governance Console
            </Badge>
            <CardTitle className="mt-2 text-xl font-bold">Role Hierarchy, Governance, and Authorization Policy</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Define role levels, policy boundaries, organization links, and role-based learning tracks.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Refresh controls
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <Check className="h-4 w-4 text-emerald-600" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Active roles" value={summary.active_roles} />
            <Stat label="Permissions" value={summary.active_permissions} />
            <Stat label="Policies" value={summary.active_policies} />
            <Stat label="Organizations" value={summary.active_organizations} />
            <Stat label="Relationships" value={summary.active_relationships} />
            <Stat label="Paths" value={summary.published_career_paths} />
            <Stat label="Courses" value={summary.published_courses} />
            <Stat label="Lessons" value={summary.published_lessons} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-xl border p-1.5 bg-muted/30">
          <TabButton active={section === "roles"} onClick={() => setSection("roles")}>
            <KeyRound className="mr-2 h-4 w-4" /> Role Hierarchy ({roles.length})
          </TabButton>
          <TabButton active={section === "permissions"} onClick={() => setSection("permissions")}>
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Matrix ({permissions.length})
          </TabButton>
          <TabButton active={section === "relationships"} onClick={() => setSection("relationships")}>
            <GitBranch className="mr-2 h-4 w-4" /> Company Links ({relationships.length})
          </TabButton>
          <TabButton active={section === "policies"} onClick={() => setSection("policies")}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Approval Policies ({policies.length})
          </TabButton>
          <TabButton active={section === "learning"} onClick={() => setSection("learning")}>
            <GraduationCap className="mr-2 h-4 w-4" /> Role Tracks ({paths.length})
          </TabButton>
          <TabButton active={section === "audit"} onClick={() => setSection("audit")}>
            <Award className="mr-2 h-4 w-4" /> Audit Trail ({audit.length})
          </TabButton>
        </div>

        {section === "roles" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <div key={role.role_key} className="flex flex-col justify-between rounded-xl border p-4 shadow-sm bg-card">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-foreground">{role.label}</div>
                      <Badge variant="outline">Level {role.role_level}</Badge>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{role.role_key}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{role.description || "No description provided."}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                    <span className="text-muted-foreground">Scope: {humanize(role.scope_type)}</span>
                    <Button
                      size="sm"
                      variant={role.is_active ? "outline" : "default"}
                      onClick={() => patch("platform_role_definitions", `role_key=eq.${role.role_key}`, { is_active: !role.is_active }, role.role_key)}
                      disabled={busy === role.role_key}
                    >
                      {role.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3 text-center bg-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold">{value.toLocaleString()}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
