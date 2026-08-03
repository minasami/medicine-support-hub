/**
 * Company team members — Appwrite `company_team_members` + localStorage fallback.
 * CEO / product managers invite line managers and reps with optional line scope.
 */
import { Client, Databases, ID, Query } from "appwrite";
import type {
  CompanyOrgRole,
  CompanyTeamMember,
  CompanyTeamMemberStatus,
} from "@/lib/company-role-hierarchy";
import { canInviteRole, normalizeCompanySlug } from "@/lib/company-role-hierarchy";

const ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
const TABLE_ID =
  import.meta.env.VITE_APPWRITE_TEAM_MEMBERS_COLLECTION_ID ||
  "company_team_members";

const LS_KEY = "msh_company_team_members_v1";

let db: Databases | null = null;
let tableReady: boolean | null = null;

function getDb(): Databases {
  if (!db) {
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    db = new Databases(client);
  }
  return db;
}

function parseLines(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseIds(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
  if (typeof raw === "string" && raw.trim()) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j.map(Number).filter((n) => Number.isFinite(n));
    } catch {
      return raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    }
  }
  return [];
}

function docToMember(d: Record<string, unknown>): CompanyTeamMember {
  return {
    id: String(d.$id || d.id || ""),
    company_slug: normalizeCompanySlug(String(d.company_slug || "")),
    company_name: String(d.company_name || ""),
    user_email: String(d.user_email || "").toLowerCase(),
    user_id: d.user_id ? String(d.user_id) : null,
    role: (String(d.role || "company_rep") as CompanyOrgRole) || "company_rep",
    product_lines: parseLines(d.product_lines),
    product_canonical_ids: parseIds(d.product_canonical_ids),
    status: (String(d.status || "pending") as CompanyTeamMemberStatus) || "pending",
    invited_by: d.invited_by ? String(d.invited_by) : null,
    invited_at: d.invited_at ? String(d.invited_at) : null,
    notes: d.notes ? String(d.notes) : null,
  };
}

function mirrorLocal(member: CompanyTeamMember) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    let list: CompanyTeamMember[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = list.filter(
      (m) =>
        m.id !== member.id &&
        !(m.user_email === member.user_email && m.company_slug === member.company_slug),
    );
    list.unshift(member);
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    /* ignore */
  }
}

function readLocal(filter?: {
  companySlug?: string;
  userEmail?: string;
}): CompanyTeamMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    let list: CompanyTeamMember[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    if (filter?.companySlug) {
      const s = normalizeCompanySlug(filter.companySlug);
      list = list.filter((m) => normalizeCompanySlug(m.company_slug) === s);
    }
    if (filter?.userEmail) {
      const e = filter.userEmail.toLowerCase();
      list = list.filter((m) => m.user_email?.toLowerCase() === e);
    }
    return list;
  } catch {
    return [];
  }
}

export async function probeTeamTable(): Promise<boolean> {
  if (tableReady != null) return tableReady;
  try {
    await getDb().listDocuments(DATABASE_ID, TABLE_ID, [Query.limit(1)]);
    tableReady = true;
  } catch {
    tableReady = false;
  }
  return tableReady;
}

export async function listCompanyTeamMembers(options?: {
  companySlug?: string;
  userEmail?: string;
  status?: CompanyTeamMemberStatus;
  limit?: number;
}): Promise<{ members: CompanyTeamMember[]; storage: "appwrite" | "localStorage" }> {
  const limit = options?.limit ?? 100;
  const ready = await probeTeamTable();

  if (ready) {
    try {
      const queries = [Query.limit(limit), Query.orderDesc("$createdAt")];
      if (options?.companySlug)
        queries.push(Query.equal("company_slug", normalizeCompanySlug(options.companySlug)));
      if (options?.userEmail)
        queries.push(Query.equal("user_email", options.userEmail.toLowerCase()));
      if (options?.status) queries.push(Query.equal("status", options.status));
      const res = await getDb().listDocuments(DATABASE_ID, TABLE_ID, queries);
      const members = res.documents.map((d) =>
        docToMember(d as unknown as Record<string, unknown>),
      );
      return { members, storage: "appwrite" };
    } catch (err) {
      console.warn("[company-team] list failed", err);
    }
  }

  let members = readLocal({
    companySlug: options?.companySlug,
    userEmail: options?.userEmail,
  });
  if (options?.status) members = members.filter((m) => m.status === options.status);
  return { members: members.slice(0, limit), storage: "localStorage" };
}

export async function inviteCompanyTeamMember(input: {
  companySlug: string;
  companyName?: string;
  userEmail: string;
  role: CompanyOrgRole;
  productLines?: string[];
  productCanonicalIds?: number[];
  invitedBy: string;
  actorRole: CompanyOrgRole;
  notes?: string;
  activateImmediately?: boolean;
}): Promise<{ member: CompanyTeamMember; storage: "appwrite" | "localStorage" }> {
  if (!canInviteRole(input.actorRole, input.role) && input.actorRole !== "company_ceo") {
    throw new Error("You are not allowed to invite this role.");
  }
  const email = input.userEmail.toLowerCase().trim();
  if (!email || !email.includes("@")) throw new Error("Valid email required.");

  const member: CompanyTeamMember = {
    company_slug: normalizeCompanySlug(input.companySlug),
    company_name: input.companyName || input.companySlug,
    user_email: email,
    user_id: null,
    role: input.role,
    product_lines: input.productLines || [],
    product_canonical_ids: input.productCanonicalIds || [],
    status: input.activateImmediately ? "active" : "pending",
    invited_by: input.invitedBy,
    invited_at: new Date().toISOString(),
    notes: input.notes || null,
  };

  const ready = await probeTeamTable();
  if (ready) {
    try {
      const docId = ID.unique();
      const doc = await getDb().createDocument(DATABASE_ID, TABLE_ID, docId, {
        company_slug: member.company_slug,
        company_name: member.company_name || "",
        user_email: member.user_email,
        user_id: "",
        role: member.role,
        product_lines: JSON.stringify(member.product_lines || []),
        product_canonical_ids: JSON.stringify(member.product_canonical_ids || []),
        status: member.status,
        invited_by: member.invited_by || "",
        invited_at: member.invited_at || "",
        notes: member.notes || "",
      });
      const saved = docToMember(doc as unknown as Record<string, unknown>);
      mirrorLocal(saved);
      return { member: saved, storage: "appwrite" };
    } catch (err) {
      console.warn("[company-team] invite Appwrite failed", err);
    }
  }

  const local = { ...member, id: `team_${Date.now()}` };
  mirrorLocal(local);
  return { member: local, storage: "localStorage" };
}

export async function updateTeamMemberStatus(
  memberId: string,
  status: CompanyTeamMemberStatus,
): Promise<CompanyTeamMember | null> {
  const ready = await probeTeamTable();
  if (ready) {
    try {
      const doc = await getDb().updateDocument(DATABASE_ID, TABLE_ID, memberId, {
        status,
      });
      const saved = docToMember(doc as unknown as Record<string, unknown>);
      mirrorLocal(saved);
      return saved;
    } catch (err) {
      console.warn("[company-team] status update failed", err);
    }
  }
  const all = readLocal();
  const hit = all.find((m) => m.id === memberId);
  if (!hit) return null;
  const updated = { ...hit, status };
  mirrorLocal(updated);
  return updated;
}

export async function findTeamMembershipForEmail(
  email: string,
  companySlug?: string,
): Promise<CompanyTeamMember | null> {
  const { members } = await listCompanyTeamMembers({
    userEmail: email,
    companySlug,
    limit: 20,
  });
  const active = members.find((m) => m.status === "active");
  return active || members[0] || null;
}
